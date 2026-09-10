/**
 * Host half of the floating card finder: one fenced POST route replaying every
 * durable present_result_card call/result pair of a session from the session
 * store's event log, merged with a small live mirror that covers the gap after
 * a host restart (the store session stays frozen at its rehydration boundary,
 * so `session.events` misses everything appended since). Zero DSH writes —
 * the route only reads, and the browser-trust fence mirrors the /api gateway.
 */
import { type ResultCardModel, type ReviewOutcome } from './contract.js';
/** Structural face of one session-store event (the subset the parser reads). */
export interface CardSessionEvent {
    type: string;
    seq: number;
    data: Record<string, unknown>;
}
/** The request facts route handlers read (structural subset of IncomingMessage). */
export interface CardsHttpRequest {
    url?: string;
    method?: string;
    headers: Record<string, string | string[] | undefined>;
    [Symbol.asyncIterator](): AsyncIterator<string | Uint8Array>;
}
/** The response face route handlers write to (structural subset of ServerResponse). */
export interface CardsHttpResponse {
    statusCode: number;
    writeHead(status: number, headers?: Record<string, string>): void;
    end(body?: string | Uint8Array): void;
}
/** The structural service face the route needs (intersected at the call site). */
export interface CardsRouteContext {
    sessions: {
        get(id: string): {
            events?: readonly CardSessionEvent[];
        } | undefined;
    };
    webServer: {
        register(route: {
            kind: 'exact' | 'prefix';
            path: string;
            handler: (request: CardsHttpRequest, response: CardsHttpResponse) => void | Promise<void>;
        }): () => void;
    };
    webRuntime?: {
        trustedHosts?: readonly string[];
    } | undefined;
    on(event: string, listener: (session: unknown, event: CardSessionEvent) => void): () => void;
}
/** One extracted present_result_card trace from the durable or live feed. */
export interface CardTrace {
    seq: number;
    kind: 'call' | 'result';
    callId: string;
    /** tool/call only: the raw JSON arguments the model sent. */
    argsRaw?: string | undefined;
    /** tool/result only: the canonical review outcome when parseable. */
    outcome?: ReviewOutcome | undefined;
    /** tool/result only: whether the tool result was an error. */
    isError?: boolean | undefined;
}
/** One durable card row the route returns to the client. */
export interface DurableCard {
    callId: string;
    model: ResultCardModel;
}
/** Whether a hostname names the local loopback authority. */
export declare function isLoopbackHostname(hostname: string): boolean;
/**
 * Decide whether one cards-route request may pass: the Host must be ours
 * (loopback or a configured trusted authority) and browser cross-site
 * markers must be absent. This is a DNS-rebinding / cross-site defense,
 * not authentication — the same fence the /api gateway applies.
 */
export declare function isTrustedCardRequest(request: CardsHttpRequest, trustedHosts: readonly string[]): boolean;
/** Extract the present_result_card trace of one raw session event (undefined = unrelated). */
export declare function traceOfEvent(event: CardSessionEvent): CardTrace | undefined;
/** Pair call and result traces into durable card models, oldest first. */
export declare function pairCardModels(traces: readonly CardTrace[]): DurableCard[];
/** Mount the fenced durable-cards route on the host webserver. */
export declare function registerCardsRoute(host: CardsRouteContext): void;
