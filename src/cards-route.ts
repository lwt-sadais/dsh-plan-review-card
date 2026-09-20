/**
 * Host half of the card finder: one fenced POST route replaying every durable
 * present_result_card call/result pair of a session. History comes from the
 * richest available store source (live-session event log, legacy events array,
 * or the session-query service), merged with a small live mirror that covers
 * sources that cannot replay pre-restart events. Traces merge by call identity
 * and the route outputs cards in creation order with an ordinal seq. Zero DSH
 * writes — the route only reads, and the browser-trust fence mirrors the /api
 * gateway.
 */
import {
  FALLBACK_CARD_TITLE,
  INCOMPLETE_STATUS,
  INTERRUPTED_STATUS,
  RESULT_CARD_TOOL,
  REVIEW_OUTCOME_STATUS,
  WAITING_STATUS,
  normalizeCardArgs,
  type ResultCardArgs,
  type ResultCardModel,
  type ReviewOutcome,
} from './contract.js'

/** Route prefix mounted on the host webserver (method paths append below it). */
const CARDS_ROUTE_PREFIX = '/plan-review-card/api'
/** Per-session cap of mirrored live traces (a bounded, lossy ring). */
const MIRROR_MAX_ENTRIES = 200

/** Structural face of one session-store event (the subset the parser reads). */
export interface CardSessionEvent {
  type: string
  seq: number
  data: Record<string, unknown>
}

/** The request facts route handlers read (structural subset of IncomingMessage). */
export interface CardsHttpRequest {
  url?: string
  method?: string
  headers: Record<string, string | string[] | undefined>
  [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>
}

/** The response face route handlers write to (structural subset of ServerResponse). */
export interface CardsHttpResponse {
  statusCode: number
  writeHead(status: number, headers?: Record<string, string>): void
  end(body?: string | Uint8Array): void
}

/** One session-store face the route reads, across harness generations. */
export interface CardStoreSession {
  /** Legacy harness shape: a plain ordered events array. */
  events?: readonly CardSessionEvent[] | undefined
  /** Current harness shape: the live session's full in-process event log. */
  snapshotEvents?: (() => readonly CardSessionEvent[]) | undefined
}

/** The structural service face the route needs (intersected at the call site). */
export interface CardsRouteContext {
  sessions: {
    get(id: string): CardStoreSession | undefined
  }
  /** Optional session-query service: the fallback for sessions not live in the store. */
  sessionQuery?: {
    readSession?: (sessionId: string) => Promise<{ events?: readonly CardSessionEvent[] } | undefined>
  } | undefined
  webServer: {
    register(route: {
      kind: 'exact' | 'prefix'
      path: string
      handler: (request: CardsHttpRequest, response: CardsHttpResponse) => void | Promise<void>
    }): () => void
  }
  webRuntime?: { trustedHosts?: readonly string[] } | undefined
  on(event: string, listener: (session: unknown, event: CardSessionEvent) => void): () => void
}

/** One extracted present_result_card trace from the durable or live feed. */
export interface CardTrace {
  seq: number
  kind: 'call' | 'result'
  callId: string
  /** tool/call only: the raw JSON arguments the model sent. */
  argsRaw?: string | undefined
  /** tool/result only: the canonical review outcome when parseable. */
  outcome?: ReviewOutcome | undefined
  /** tool/result only: whether the tool result was an error. */
  isError?: boolean | undefined
}

/** One durable card row the route returns to the client. */
export interface DurableCard {
  callId: string
  /** Seq of the card's first tool/call event: the stable creation-order sort key clients list by. */
  seq: number
  model: ResultCardModel
}

/** Read one header as a string (array headers collapse to their first value). */
function header(request: CardsHttpRequest, name: string): string | undefined {
  const value = request.headers[name]
  return typeof value === 'string' ? value : undefined
}

/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/** Whether a hostname names the local loopback authority. */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Canonical authority form: hostname, or host:port when a port was written. */
function canonicalAuthority(entryUrl: URL): string {
  return entryUrl.port === '' ? entryUrl.hostname : entryUrl.host
}

/** Whether one request authority matches a trusted non-loopback entry. */
function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/**
 * Decide whether one cards-route request may pass: the Host must be ours
 * (loopback or a configured trusted authority) and browser cross-site
 * markers must be absent. This is a DNS-rebinding / cross-site defense,
 * not authentication — the same fence the /api gateway applies.
 */
export function isTrustedCardRequest(request: CardsHttpRequest, trustedHosts: readonly string[]): boolean {
  const host = header(request, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request, 'sec-fetch-site') === 'cross-site') return false
  // When a browser attaches an Origin it must name this hostname (the Host
  // fence already bound the authority, so only the hostname compares).
  // Absent Origin is fine; the opaque literal "null" is refused.
  const origin = header(request, 'origin')
  if (origin === undefined || origin === 'null') return origin === undefined
  try {
    return new URL(origin).hostname === hostUrl.hostname
  } catch {
    return false
  }
}

/** Extract the present_result_card trace of one raw session event (undefined = unrelated). */
export function traceOfEvent(event: CardSessionEvent): CardTrace | undefined {
  if (event.type === 'tool/call') {
    const data = event.data as { name?: unknown; callId?: unknown; arguments?: unknown }
    if (data.name !== RESULT_CARD_TOOL || typeof data.callId !== 'string') return undefined
    return {
      seq: event.seq,
      kind: 'call',
      callId: data.callId,
      argsRaw: typeof data.arguments === 'string' ? data.arguments : undefined,
    }
  }
  if (event.type === 'tool/result') {
    const message = (event.data as { message?: unknown }).message as {
      source?: { callId?: unknown }
      content?: unknown
      isError?: unknown
    } | undefined
    const callId = message?.source?.callId
    if (typeof callId !== 'string') return undefined
    const text = Array.isArray(message?.content)
      ? (message.content as Array<{ type?: unknown; text?: unknown }>)
        .filter(block => block?.type === 'text')
        .map(block => typeof block.text === 'string' ? block.text : '')
        .join('\n')
      : ''
    let outcome: ReviewOutcome | undefined
    try {
      const value = JSON.parse(text) as { outcome?: unknown }
      if (typeof value.outcome === 'string' && value.outcome in REVIEW_OUTCOME_STATUS) {
        outcome = value.outcome as ReviewOutcome
      }
    } catch {
      // Unparseable or non-JSON result text: the review never completed.
    }
    return { seq: event.seq, kind: 'result', callId, outcome, isError: message?.isError === true }
  }
  return undefined
}

/** Parse card arguments from one tool/call event payload. */
function parseCallArgs(raw: string | undefined): ResultCardArgs {
  if (raw === undefined) return { kind: 'report', title: FALLBACK_CARD_TITLE, summary: '', content: '' }
  try {
    return normalizeCardArgs(JSON.parse(raw) as Partial<ResultCardArgs>)
  } catch {
    return { kind: 'report', title: FALLBACK_CARD_TITLE, summary: '', content: '' }
  }
}

/**
 * Pair call and result traces into durable card models in input order — the
 * caller owns creation ordering. Duplicate calls keep their first position,
 * and `seq` becomes the output ordinal so clients get a monotonic creation
 * key independent of any event-log seq scale.
 */
export function pairCardModels(traces: readonly CardTrace[]): DurableCard[] {
  const cards = new Map<string, DurableCard>()
  for (const trace of traces) {
    if (trace.kind === 'call') {
      if (cards.has(trace.callId)) continue
      cards.set(trace.callId, {
        callId: trace.callId,
        seq: cards.size,
        model: { ...parseCallArgs(trace.argsRaw), state: 'waiting', status: WAITING_STATUS },
      })
      continue
    }
    const card = cards.get(trace.callId)
    if (card === undefined) continue
    if (trace.isError) {
      card.model = { ...card.model, state: 'failed', status: INTERRUPTED_STATUS }
      continue
    }
    card.model = trace.outcome === undefined
      ? { ...card.model, state: 'failed', status: INCOMPLETE_STATUS }
      : { ...card.model, state: trace.outcome, status: REVIEW_OUTCOME_STATUS[trace.outcome] }
  }
  return [...cards.values()]
}

/** The live mirror covering events appended after the store's rehydration boundary. */
function createCardMirror(ctx: CardsRouteContext): { entries(sessionId: string): CardTrace[] } {
  const perSession = new Map<string, CardTrace[]>()
  const callIds = new Map<string, Set<string>>()
  if (typeof ctx.on !== 'function') {
    // Test doubles without the event API degrade to event-log replay only.
    return { entries: () => [] }
  }
  ctx.on('session/event', (session, event) => {
    const sessionId = (session as { id?: unknown } | null | undefined)?.id
    if (typeof sessionId !== 'string') return
    const trace = traceOfEvent(event)
    if (trace === undefined) return
    if (trace.kind === 'call') {
      let ids = callIds.get(sessionId)
      if (ids === undefined) callIds.set(sessionId, ids = new Set())
      ids.add(trace.callId)
    } else if (!callIds.get(sessionId)?.has(trace.callId)) {
      // Never cache results without a mirrored call identity.
      return
    }
    let list = perSession.get(sessionId)
    if (list === undefined) perSession.set(sessionId, list = [])
    list.push(trace)
    if (list.length > MIRROR_MAX_ENTRIES) {
      const removed = list.splice(0, list.length - MIRROR_MAX_ENTRIES)
      for (const entry of removed) {
        if (entry.kind !== 'call') continue
        callIds.get(sessionId)?.delete(entry.callId)
      }
    }
  })
  return { entries: sessionId => perSession.get(sessionId) ?? [] }
}

/**
 * Load the durable card traces of one session in creation order from the
 * richest available store source: the live session's full in-process event
 * log (covers resumed history), the legacy events array, or the session-query
 * service for sessions that are not live. Unexpected source shapes degrade to
 * an empty list so the mirror remains the fallback.
 */
async function storeTraces(ctx: CardsRouteContext, sessionId: string): Promise<CardTrace[]> {
  try {
    const session = ctx.sessions.get(sessionId)
    const events = session?.snapshotEvents?.() ?? session?.events ?? await readSessionEvents(ctx, sessionId)
    const traces: CardTrace[] = []
    for (const event of events) {
      const trace = traceOfEvent(event)
      if (trace !== undefined) traces.push(trace)
    }
    return traces
  } catch {
    return []
  }
}

/** Read one complete session log through the optional session-query service. */
async function readSessionEvents(ctx: CardsRouteContext, sessionId: string): Promise<readonly CardSessionEvent[]> {
  const query = ctx.sessionQuery
  if (typeof query?.readSession !== 'function') return []
  try {
    const loaded = await query.readSession(sessionId)
    return loaded?.events ?? []
  } catch {
    return []
  }
}

/**
 * Merge the store log and the live mirror by call identity, creation order
 * first. Store traces come first (their array order is the creation order);
 * the mirror only fills calls the store source lacks — its results update an
 * already-known card's model without reordering it.
 */
export function mergedTraces(store: readonly CardTrace[], mirror: readonly CardTrace[]): CardTrace[] {
  const seenCalls = new Set<string>()
  const merged: CardTrace[] = []
  for (const trace of [...store, ...mirror]) {
    if (trace.kind === 'call') {
      if (seenCalls.has(trace.callId)) continue
      seenCalls.add(trace.callId)
    } else if (!seenCalls.has(trace.callId)) {
      // Never let a result without a known call identity create or reorder cards.
      continue
    }
    merged.push(trace)
  }
  return merged
}

/** Collect one JSON body from the async request iterator. */
async function readJsonBody(request: CardsHttpRequest): Promise<Record<string, unknown>> {
  const decoder = new TextDecoder()
  let raw = ''
  for await (const chunk of request) {
    raw += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
  }
  raw += decoder.decode()
  if (raw === '') throw new Error('request body is required')
  const value = JSON.parse(raw) as unknown
  if (value === null || typeof value !== 'object') throw new Error('request body must be an object')
  return value as Record<string, unknown>
}

/** Write one JSON response with the shared content type. */
function writeJson(response: CardsHttpResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

/** The parsed method segment of one route URL, or undefined when malformed. */
function methodOf(url: string | undefined): string | undefined {
  if (url === undefined) return undefined
  const prefix = `${CARDS_ROUTE_PREFIX}/`
  if (!url.startsWith(prefix)) return undefined
  const method = url.slice(prefix.length).split('?')[0] ?? ''
  return method === '' || method.includes('/') ? undefined : method
}

/** Mount the fenced durable-cards route on the host webserver. */
export function registerCardsRoute(host: CardsRouteContext): void {
  const mirror = createCardMirror(host)
  const trustedHosts = host.webRuntime?.trustedHosts ?? []
  host.webServer.register({
    kind: 'prefix',
    path: CARDS_ROUTE_PREFIX,
    handler: async (request, response) => {
      if (!isTrustedCardRequest(request, trustedHosts)) {
        writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      const method = methodOf(request.url)
      if (request.method !== 'POST' || method !== 'cards') {
        writeJson(response, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } })
        return
      }
      try {
        const payload = await readJsonBody(request)
        const sessionId = payload.sessionId
        if (typeof sessionId !== 'string' || sessionId === '') throw new Error('sessionId is required')
        const store = await storeTraces(host, sessionId)
        writeJson(response, 200, { ok: true, cards: pairCardModels(mergedTraces(store, mirror.entries(sessionId))) })
      } catch (error) {
        writeJson(response, 400, {
          ok: false,
          error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) },
        })
      }
    },
  })
}
