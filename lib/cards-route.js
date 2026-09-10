/**
 * Host half of the floating card finder: one fenced POST route replaying every
 * durable present_result_card call/result pair of a session from the session
 * store's event log, merged with a small live mirror that covers the gap after
 * a host restart (the store session stays frozen at its rehydration boundary,
 * so `session.events` misses everything appended since). Zero DSH writes —
 * the route only reads, and the browser-trust fence mirrors the /api gateway.
 */
import { FALLBACK_CARD_TITLE, INCOMPLETE_STATUS, INTERRUPTED_STATUS, RESULT_CARD_TOOL, REVIEW_OUTCOME_STATUS, WAITING_STATUS, normalizeCardArgs, } from './contract.js';
/** Route prefix mounted on the host webserver (method paths append below it). */
const CARDS_ROUTE_PREFIX = '/plan-review-card/api';
/** Per-session cap of mirrored live traces (a bounded, lossy ring). */
const MIRROR_MAX_ENTRIES = 200;
/** Read one header as a string (array headers collapse to their first value). */
function header(request, name) {
    const value = request.headers[name];
    return typeof value === 'string' ? value : undefined;
}
/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority) {
    try {
        return new URL(`http://${authority}`);
    }
    catch {
        return undefined;
    }
}
/** Whether a hostname names the local loopback authority. */
export function isLoopbackHostname(hostname) {
    if (hostname === 'localhost' || hostname === '[::1]')
        return true;
    const parts = hostname.split('.');
    return parts.length === 4
        && parts[0] === '127'
        && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Canonical authority form: hostname, or host:port when a port was written. */
function canonicalAuthority(entryUrl) {
    return entryUrl.port === '' ? entryUrl.hostname : entryUrl.host;
}
/** Whether one request authority matches a trusted non-loopback entry. */
function isTrustedAuthority(hostUrl, trustedHosts) {
    return trustedHosts.some((entry) => {
        const entryUrl = parseAuthority(entry);
        if (entryUrl === undefined)
            return false;
        return canonicalAuthority(entryUrl) === entryUrl.hostname
            ? entryUrl.hostname === hostUrl.hostname
            : entryUrl.host === hostUrl.host;
    });
}
/**
 * Decide whether one cards-route request may pass: the Host must be ours
 * (loopback or a configured trusted authority) and browser cross-site
 * markers must be absent. This is a DNS-rebinding / cross-site defense,
 * not authentication — the same fence the /api gateway applies.
 */
export function isTrustedCardRequest(request, trustedHosts) {
    const host = header(request, 'host');
    if (host === undefined)
        return false;
    const hostUrl = parseAuthority(host);
    if (hostUrl === undefined)
        return false;
    if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts))
        return false;
    if (header(request, 'sec-fetch-site') === 'cross-site')
        return false;
    // When a browser attaches an Origin it must name this hostname (the Host
    // fence already bound the authority, so only the hostname compares).
    // Absent Origin is fine; the opaque literal "null" is refused.
    const origin = header(request, 'origin');
    if (origin === undefined || origin === 'null')
        return origin === undefined;
    try {
        return new URL(origin).hostname === hostUrl.hostname;
    }
    catch {
        return false;
    }
}
/** Extract the present_result_card trace of one raw session event (undefined = unrelated). */
export function traceOfEvent(event) {
    if (event.type === 'tool/call') {
        const data = event.data;
        if (data.name !== RESULT_CARD_TOOL || typeof data.callId !== 'string')
            return undefined;
        return {
            seq: event.seq,
            kind: 'call',
            callId: data.callId,
            argsRaw: typeof data.arguments === 'string' ? data.arguments : undefined,
        };
    }
    if (event.type === 'tool/result') {
        const message = event.data.message;
        const callId = message?.source?.callId;
        if (typeof callId !== 'string')
            return undefined;
        const text = Array.isArray(message?.content)
            ? message.content
                .filter(block => block?.type === 'text')
                .map(block => typeof block.text === 'string' ? block.text : '')
                .join('\n')
            : '';
        let outcome;
        try {
            const value = JSON.parse(text);
            if (typeof value.outcome === 'string' && value.outcome in REVIEW_OUTCOME_STATUS) {
                outcome = value.outcome;
            }
        }
        catch {
            // Unparseable or non-JSON result text: the review never completed.
        }
        return { seq: event.seq, kind: 'result', callId, outcome, isError: message?.isError === true };
    }
    return undefined;
}
/** Parse card arguments from one tool/call event payload. */
function parseCallArgs(raw) {
    if (raw === undefined)
        return { kind: 'report', title: FALLBACK_CARD_TITLE, summary: '', content: '' };
    try {
        return normalizeCardArgs(JSON.parse(raw));
    }
    catch {
        return { kind: 'report', title: FALLBACK_CARD_TITLE, summary: '', content: '' };
    }
}
/** Pair call and result traces into durable card models, oldest first. */
export function pairCardModels(traces) {
    const cards = new Map();
    for (const trace of [...traces].sort((left, right) => left.seq - right.seq)) {
        if (trace.kind === 'call') {
            cards.set(trace.callId, {
                callId: trace.callId,
                model: { ...parseCallArgs(trace.argsRaw), state: 'waiting', status: WAITING_STATUS },
            });
            continue;
        }
        const card = cards.get(trace.callId);
        if (card === undefined)
            continue;
        if (trace.isError) {
            card.model = { ...card.model, state: 'failed', status: INTERRUPTED_STATUS };
            continue;
        }
        card.model = trace.outcome === undefined
            ? { ...card.model, state: 'failed', status: INCOMPLETE_STATUS }
            : { ...card.model, state: trace.outcome, status: REVIEW_OUTCOME_STATUS[trace.outcome] };
    }
    return [...cards.values()];
}
/** The live mirror covering events appended after the store's rehydration boundary. */
function createCardMirror(ctx) {
    const perSession = new Map();
    const callIds = new Map();
    if (typeof ctx.on !== 'function') {
        // Test doubles without the event API degrade to event-log replay only.
        return { entries: () => [] };
    }
    ctx.on('session/event', (session, event) => {
        const sessionId = session?.id;
        if (typeof sessionId !== 'string')
            return;
        const trace = traceOfEvent(event);
        if (trace === undefined)
            return;
        if (trace.kind === 'call') {
            let ids = callIds.get(sessionId);
            if (ids === undefined)
                callIds.set(sessionId, ids = new Set());
            ids.add(trace.callId);
        }
        else if (!callIds.get(sessionId)?.has(trace.callId)) {
            // Never cache results without a mirrored call identity.
            return;
        }
        let list = perSession.get(sessionId);
        if (list === undefined)
            perSession.set(sessionId, list = []);
        list.push(trace);
        if (list.length > MIRROR_MAX_ENTRIES) {
            const removed = list.splice(0, list.length - MIRROR_MAX_ENTRIES);
            for (const entry of removed) {
                if (entry.kind !== 'call')
                    continue;
                callIds.get(sessionId)?.delete(entry.callId);
            }
        }
    });
    return { entries: sessionId => perSession.get(sessionId) ?? [] };
}
/** Merge the store log and the live mirror, deduped by seq, oldest first. */
function mergedTraces(ctx, sessionId, mirror) {
    const bySeq = new Map();
    for (const event of ctx.sessions.get(sessionId)?.events ?? []) {
        const trace = traceOfEvent(event);
        if (trace !== undefined)
            bySeq.set(trace.seq, trace);
    }
    for (const trace of mirror.entries(sessionId))
        bySeq.set(trace.seq, trace);
    return [...bySeq.values()].sort((left, right) => left.seq - right.seq);
}
/** Collect one JSON body from the async request iterator. */
async function readJsonBody(request) {
    const decoder = new TextDecoder();
    let raw = '';
    for await (const chunk of request) {
        raw += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    }
    raw += decoder.decode();
    if (raw === '')
        throw new Error('request body is required');
    const value = JSON.parse(raw);
    if (value === null || typeof value !== 'object')
        throw new Error('request body must be an object');
    return value;
}
/** Write one JSON response with the shared content type. */
function writeJson(response, status, body) {
    response.statusCode = status;
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
}
/** The parsed method segment of one route URL, or undefined when malformed. */
function methodOf(url) {
    if (url === undefined)
        return undefined;
    const prefix = `${CARDS_ROUTE_PREFIX}/`;
    if (!url.startsWith(prefix))
        return undefined;
    const method = url.slice(prefix.length).split('?')[0] ?? '';
    return method === '' || method.includes('/') ? undefined : method;
}
/** Mount the fenced durable-cards route on the host webserver. */
export function registerCardsRoute(host) {
    const mirror = createCardMirror(host);
    const trustedHosts = host.webRuntime?.trustedHosts ?? [];
    host.webServer.register({
        kind: 'prefix',
        path: CARDS_ROUTE_PREFIX,
        handler: async (request, response) => {
            if (!isTrustedCardRequest(request, trustedHosts)) {
                writeJson(response, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } });
                return;
            }
            const method = methodOf(request.url);
            if (request.method !== 'POST' || method !== 'cards') {
                writeJson(response, 405, { ok: false, error: { code: 'method-error', message: 'method not allowed' } });
                return;
            }
            try {
                const payload = await readJsonBody(request);
                const sessionId = payload.sessionId;
                if (typeof sessionId !== 'string' || sessionId === '')
                    throw new Error('sessionId is required');
                writeJson(response, 200, { ok: true, cards: pairCardModels(mergedTraces(host, sessionId, mirror)) });
            }
            catch (error) {
                writeJson(response, 400, {
                    ok: false,
                    error: { code: 'bad-request', message: error instanceof Error ? error.message : String(error) },
                });
            }
        },
    });
}
