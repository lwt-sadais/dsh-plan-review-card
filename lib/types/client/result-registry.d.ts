export interface ResultCardViewModel {
    kind: 'plan' | 'evaluation' | 'report';
    title: string;
    summary: string;
    content: string;
    state: 'waiting' | 'approved' | 'rejected' | 'adjustment-requested' | 'cancelled' | 'failed';
    status: string;
}
export interface ResultCardRecord {
    model: ResultCardViewModel;
    inspect?: () => void;
}
/** In-memory bridge between durable ToolRow models and better-sidebar tab views. */
export declare class ResultCardRegistry {
    private readonly entries;
    /** Publish the latest replay-derived model and notify the corresponding sidebar view. */
    publish(sessionId: string, callId: string, record: ResultCardRecord): void;
    /** Read the latest model for one session and tool-call identity. */
    get(sessionId: string, callId: string): ResultCardRecord | undefined;
    /** Subscribe to model changes for one sidebar result tab. */
    subscribe(sessionId: string, callId: string, listener: () => void): () => void;
    /** Remove a ToolRow-bound inspect callback while retaining its durable display model. */
    removeInspect(sessionId: string, callId: string, inspect: () => void): void;
    /** Clear all transient records and notify mounted views before lifecycle disposal. */
    clear(): void;
}
