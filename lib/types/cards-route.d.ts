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
/** One session-store face the route reads, across harness generations. */
export interface CardStoreSession {
    /** Legacy harness shape: a plain ordered events array. */
    events?: readonly CardSessionEvent[] | undefined;
    /** Current harness shape: the live session's full in-process event log. */
    snapshotEvents?: (() => readonly CardSessionEvent[]) | undefined;
}
/** The structural service face the route needs (intersected at the call site). */
export interface CardsRouteContext {
    sessions: {
        get(id: string): CardStoreSession | undefined;
    };
    /** Optional session-query service: the fallback for sessions not live in the store. */
    sessionQuery?: {
        readSession?: (sessionId: string) => Promise<{
            events?: readonly CardSessionEvent[];
        } | undefined>;
    } | undefined;
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
    /** Seq of the card's first tool/call event: the stable creation-order sort key clients list by. */
    seq: number;
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
/**
 * Pair call and result traces into durable card models in input order — the
 * caller owns creation ordering. Duplicate calls keep their first position,
 * and `seq` becomes the output ordinal so clients get a monotonic creation
 * key independent of any event-log seq scale.
 */
export declare function pairCardModels(traces: readonly CardTrace[]): DurableCard[];
/**
 * Merge the store log and the live mirror by call identity, creation order
 * first. Store traces come first (their array order is the creation order);
 * the mirror only fills calls the store source lacks — its results update an
 * already-known card's model without reordering it.
 */
export declare function mergedTraces(store: readonly CardTrace[], mirror: readonly CardTrace[]): CardTrace[];
/** Mount the fenced durable-cards route on the host webserver. */
export declare function registerCardsRoute(host: CardsRouteContext): void;
