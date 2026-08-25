interface ContentBlock {
    type: string;
    text?: string;
}
interface RunningToolBlock {
    callId: string;
    argsRaw?: string;
}
interface SettledToolBlock {
    callId: string;
    kind: string;
    isError?: boolean;
    content: ContentBlock[];
    call?: {
        argsRaw?: string;
    };
}
type ToolBlock = RunningToolBlock | SettledToolBlock;
interface ToolRowProps {
    block: ToolBlock;
    inspect?: () => void;
}
interface SlotRegistry {
    inject(name: string, factory: () => unknown): void;
    register(options: {
        name: string;
        key: string;
    }, component: (props: ToolRowProps) => JSX.Element): unknown;
}
interface ClientContext {
    slots: SlotRegistry;
    effect(callback: () => () => void, label: string): () => void;
}
/** Register the keyed card renderer through DSH's public client Slot boundary. */
export declare function apply(ctx: ClientContext): void;
export declare const inject: string[];
export {};
