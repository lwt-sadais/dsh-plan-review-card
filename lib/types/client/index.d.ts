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
    error?: {
        code?: string;
    };
    content: ContentBlock[];
    call?: {
        argsRaw?: string;
    };
}
type ToolBlock = RunningToolBlock | SettledToolBlock;
interface PlanToolRowProps {
    block: ToolBlock;
    inspect?: () => void;
}
interface SlotRegistry {
    inject(name: string, factory: () => unknown): void;
    register(options: {
        name: string;
        key: string;
    }, component: (props: PlanToolRowProps) => JSX.Element): unknown;
}
interface ClientContext {
    slots: SlotRegistry;
    effect(callback: () => () => void, label: string): () => void;
}
/** Register the exit_plan_mode keyed tool view through DSH's public client Slot boundary. */
export declare function apply(ctx: ClientContext): void;
export declare const inject: string[];
export {};
