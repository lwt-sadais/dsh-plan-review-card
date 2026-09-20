import type { ResultCardModel } from '../contract.js';
/** Replay-stable card presentation shared with the host route (kept for client call sites). */
export type ResultCardViewModel = ResultCardModel;
export interface ResultCardRecord {
    model: ResultCardViewModel;
    inspect?: () => void;
}
/** One listed card: the call identity plus its latest known record. */
export interface ResultCardEntryRef {
    callId: string;
    /** Seq of the card's first tool/call event; undefined while the durable route has not supplied it yet. */
    callSeq?: number | undefined;
    record: ResultCardRecord;
}
/** In-memory bridge between durable ToolRow models and better-sidebar tab views. */
export declare class ResultCardRegistry {
    private readonly entries;
    private readonly changeListeners;
    /** Publish the latest replay-derived model and notify the corresponding sidebar view. */
    publish(sessionId: string, callId: string, record: ResultCardRecord, callSeq?: number): void;
    /** Read the latest model for one session and tool-call identity. */
    get(sessionId: string, callId: string): ResultCardRecord | undefined;
    /**
     * List the known cards of one session oldest-first by the durable call-event
     * seq. Entries still missing a seq — a just-created card or an unreachable
     * route — sort first as pending newest; an all-missing list keeps registry
     * insertion order through the stable sort.
     */
    records(sessionId: string): ResultCardEntryRef[];
    /** Patch the durable call-event seq onto an already-known card without touching its record. */
    attachCallSeq(sessionId: string, callId: string, callSeq: number): void;
    /** Subscribe to every registry mutation so list surfaces re-read their snapshot. */
    subscribeChanges(listener: () => void): () => void;
    /** Notify list surfaces after a mutation completes. */
    private notifyChanges;
    /** Subscribe to model changes for one sidebar result tab. */
    subscribe(sessionId: string, callId: string, listener: () => void): () => void;
    /** Remove a ToolRow-bound inspect callback while retaining its durable display model. */
    removeInspect(sessionId: string, callId: string, inspect: () => void): void;
    /** Clear all transient records and notify mounted views before lifecycle disposal. */
    clear(): void;
}
