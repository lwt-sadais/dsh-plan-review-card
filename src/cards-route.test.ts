import { describe, expect, it, vi } from 'vitest'
import {
  isLoopbackHostname,
  isTrustedCardRequest,
  pairCardModels,
  registerCardsRoute,
  traceOfEvent,
  type CardSessionEvent,
  type CardTrace,
  type CardsHttpRequest,
  type CardsHttpResponse,
  type CardsRouteContext,
} from './cards-route.js'

/** Build one tool/call event carrying structured card arguments. */
function callEvent(seq: number, callId: string, args: unknown): CardSessionEvent {
  return { type: 'tool/call', seq, data: { name: 'present_result_card', callId, arguments: JSON.stringify(args) } }
}

/** Build one tool/result event carrying the review outcome payload. */
function resultEvent(seq: number, callId: string, outcome?: string, isError = false): CardSessionEvent {
  return {
    type: 'tool/result',
    seq,
    data: {
      message: {
        source: { callId },
        isError,
        content: outcome === undefined ? [] : [{ type: 'text', text: JSON.stringify({ outcome }) }],
      },
    },
  }
}

/** Mount the route on the fake host and return the captured handler for direct invocation. */
function capturedHandler(ctx: CardsRouteContext & { registered: Array<Record<string, unknown>> }): (request: CardsHttpRequest, response: CardsHttpResponse) => Promise<void> {
  registerCardsRoute(ctx)
  const route = ctx.registered[0] as { handler?: unknown } | undefined
  if (route === undefined || typeof route.handler !== 'function') throw new Error('route was not registered')
  return route.handler as (request: CardsHttpRequest, response: CardsHttpResponse) => Promise<void>
}

/** Build a fake host context with one session's events and a recording webserver. */
function fakeHost(events: CardSessionEvent[]): CardsRouteContext & { registered: Array<Record<string, unknown>> } {
  const registered: Array<Record<string, unknown>> = []
  return {
    registered,
    sessions: { get: (id: string) => id === 'session-a' ? { events } : undefined },
    webServer: {
      register: (route) => {
        registered.push(route as Record<string, unknown>)
        return () => {}
      },
    },
    on: () => () => {},
  }
}

describe('traceOfEvent', () => {
  it('extracts card calls with their raw arguments', () => {
    const trace = traceOfEvent(callEvent(1, 'call-1', { kind: 'plan', title: '方案' }))
    expect(trace).toMatchObject({ seq: 1, kind: 'call', callId: 'call-1' })
  })

  it('extracts card results with their canonical review outcome', () => {
    const trace = traceOfEvent(resultEvent(2, 'call-1', 'approved'))
    expect(trace).toMatchObject({ seq: 2, kind: 'result', callId: 'call-1', outcome: 'approved', isError: false })
  })

  it('ignores unrelated tools and results without a call identity', () => {
    expect(traceOfEvent({ type: 'tool/call', seq: 1, data: { name: 'bash', callId: 'x' } })).toBeUndefined()
    expect(traceOfEvent({ type: 'tool/result', seq: 2, data: {} })).toBeUndefined()
  })

  it('maps error results and unparseable outcomes', () => {
    expect(traceOfEvent(resultEvent(3, 'call-1', undefined, true))?.isError).toBe(true)
    expect(traceOfEvent(resultEvent(4, 'call-1'))?.outcome).toBeUndefined()
  })
})

describe('pairCardModels', () => {
  it('pairs calls with results into durable card models', () => {
    const traces = [
      traceOfEvent(callEvent(1, 'call-1', { kind: 'evaluation', title: '评估', summary: '摘要', content: '# 全文' }))!,
      traceOfEvent(resultEvent(2, 'call-1', 'approved'))!,
    ]
    expect(pairCardModels(traces)).toEqual([{
      callId: 'call-1',
      model: { kind: 'evaluation', title: '评估', summary: '摘要', content: '# 全文', state: 'approved', status: '已批准' },
    }])
  })

  it('keeps unreviewed cards waiting and errors interrupted', () => {
    const waiting = pairCardModels([traceOfEvent(callEvent(1, 'call-1', { kind: 'report', title: '报告', summary: '', content: '正文' }))!])
    expect(waiting[0]?.model).toMatchObject({ state: 'waiting', status: '等待审查' })
    const interrupted = pairCardModels([
      traceOfEvent(callEvent(1, 'call-1', { kind: 'report', title: '报告', summary: '', content: '正文' }))!,
      traceOfEvent(resultEvent(2, 'call-1', undefined, true))!,
    ])
    expect(interrupted[0]?.model).toMatchObject({ state: 'failed', status: '审查中断' })
  })

  it('marks settled results without a parseable outcome as incomplete', () => {
    const cards = pairCardModels([
      traceOfEvent(callEvent(1, 'call-1', { kind: 'report', title: '报告', summary: '', content: '正文' }))!,
      traceOfEvent(resultEvent(2, 'call-1'))!,
    ])
    expect(cards[0]?.model).toMatchObject({ state: 'failed', status: '审查未完成' })
  })

  it('skips orphan results and falls back to the structured-result title', () => {
    const orphan = pairCardModels([traceOfEvent(resultEvent(1, 'call-x', 'approved'))!])
    expect(orphan).toEqual([])
    const malformed = pairCardModels([{
      seq: 1, kind: 'call', callId: 'call-1', argsRaw: '{broken',
    }])
    expect(malformed[0]?.model.title).toBe('结构化结果')
  })
})

describe('isTrustedCardRequest', () => {
  const request = (headers: Record<string, string>): CardsHttpRequest => ({
    headers,
    // biome-ignore lint/correctness/useHookAtTopLevel: test iterator stub
    [Symbol.asyncIterator]: () => ({ next: async () => ({ done: true, value: undefined }) }),
  }) as CardsHttpRequest

  it('passes same-origin loopback requests', () => {
    expect(isTrustedCardRequest(request({ host: '127.0.0.1:43120' }), [])).toBe(true)
    expect(isTrustedCardRequest(request({ host: 'localhost:43120', origin: 'http://localhost:43120' }), [])).toBe(true)
  })

  it('refuses missing hosts, cross-site markers, and foreign origins', () => {
    expect(isTrustedCardRequest(request({}), [])).toBe(false)
    expect(isTrustedCardRequest(request({ host: '127.0.0.1:43120', 'sec-fetch-site': 'cross-site' }), [])).toBe(false)
    expect(isTrustedCardRequest(request({ host: '127.0.0.1:43120', origin: 'http://evil.example' }), [])).toBe(false)
    expect(isTrustedCardRequest(request({ host: '127.0.0.1:43120', origin: 'null' }), [])).toBe(false)
  })

  it('accepts trusted non-loopback authorities and refuses strangers', () => {
    expect(isTrustedCardRequest(request({ host: '192.168.1.5:43120' }), ['192.168.1.5:43120'])).toBe(true)
    expect(isTrustedCardRequest(request({ host: '192.168.1.9:43120' }), ['192.168.1.5:43120'])).toBe(false)
  })
})

describe('isLoopbackHostname', () => {
  it('recognizes loopback spellings only', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('127.0.0.2')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('example.com')).toBe(false)
    expect(isLoopbackHostname('127.0.0')).toBe(false)
  })
})

describe('registerCardsRoute', () => {
  it('replays durable cards for the requested session', async () => {
    const host = fakeHost([
      callEvent(1, 'call-1', { kind: 'plan', title: '方案', summary: '摘要', content: '# 正文' }),
      resultEvent(2, 'call-1', 'adjustment-requested'),
    ])
    const handler = capturedHandler(host)
    const chunks: string[] = []
    const response = {
      statusCode: 0,
      writeHead: vi.fn(),
      end: vi.fn((body?: string | Uint8Array) => { if (typeof body === 'string') chunks.push(body) }),
    }
    await handler({
      method: 'POST',
      url: '/plan-review-card/api/cards',
      headers: { host: '127.0.0.1:43120' },
      [Symbol.asyncIterator]() {
        let done = false
        return { next: async () => { if (done) return { done: true, value: undefined }; done = true; return { done: false, value: JSON.stringify({ sessionId: 'session-a' }) } } }
      },
    } as CardsHttpRequest, response as CardsHttpResponse)
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.anything())
    const body = JSON.parse(chunks[0] ?? '{}') as { cards?: Array<{ callId: string; model: { state: string } }> }
    expect(body.cards).toEqual([{ callId: 'call-1', model: expect.objectContaining({ state: 'adjustment-requested', status: '需调整' }) }])
  })

  it('refuses unknown sessions and malformed payloads', async () => {
    const host = fakeHost([])
    const handler = capturedHandler(host)
    const makeResponse = (): CardsHttpResponse => ({
      statusCode: 0,
      writeHead: vi.fn(),
      end: vi.fn(),
    })
    const call = async (body: unknown): Promise<number> => {
      const response = makeResponse()
      await handler({
        method: 'POST',
        url: '/plan-review-card/api/cards',
        headers: { host: '127.0.0.1:43120' },
        [Symbol.asyncIterator]() {
          let done = false
          return { next: async () => { if (done) return { done: true, value: undefined }; done = true; return { done: false, value: JSON.stringify(body) } } }
        },
      } as CardsHttpRequest, response)
      return response.statusCode
    }
    expect(await call({ sessionId: 'session-b' })).toBe(200)
    expect(await call({})).toBe(400)
    expect(await call('not-an-object')).toBe(400)
  })

  it('answers 403 outside the trust fence and 405 for wrong methods', async () => {
    const host = fakeHost([])
    const handler = capturedHandler(host)
    const makeRequest = (method: string, headers: Record<string, string>): CardsHttpRequest => ({
      method,
      url: '/plan-review-card/api/cards',
      headers,
      [Symbol.asyncIterator]() {
        let done = false
        return { next: async () => { if (done) return { done: true, value: undefined }; done = true; return { done: false, value: JSON.stringify({ sessionId: 'session-a' }) } } }
      },
    } as CardsHttpRequest)
    const run = async (request: CardsHttpRequest): Promise<number> => {
      const response: CardsHttpResponse = { statusCode: 0, writeHead: vi.fn(), end: vi.fn() }
      await handler(request, response)
      return response.statusCode
    }
    expect(await run(makeRequest('POST', { host: 'evil.example' }))).toBe(403)
    expect(await run(makeRequest('GET', { host: '127.0.0.1:43120' }))).toBe(405)
  })
})
