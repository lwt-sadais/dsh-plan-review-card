/**
 * Conversation-identity adapters shared by the card row and the composer dock.
 * 0.2.x slot runtimes pass `sessionId` (and may keep the legacy `session`
 * object), while 0.1.x exposed the same fact through the sessions-list store.
 * The helpers keep the new source first and the legacy source as fallback.
 */
/**
 * Read the conversation id from slot props.
 * @param props - the slot component props, whose shape varies by generation.
 * @returns the session id when the props carry one.
 */
export declare function sessionIdFromSlotProps(props: unknown): string | undefined;
/**
 * Resolve which conversation identity to use: slot props win, and the legacy
 * list snapshot's `current` remains the fallback for 0.1.x compositions.
 * @param fromProps - session id read from slot props, if any.
 * @param fromList - legacy sessions-list snapshot's current id, if any.
 * @returns the first available identity.
 */
export declare function resolveSessionId(fromProps: string | undefined, fromList: string | undefined): string | undefined;
