import type { Context } from '@deepseek-ai/cordis';
/**
 * Register the structured-result tool and its model-facing semantic trigger
 * guidance. `webRuntime` is intentionally not required: 0.2.x no longer
 * provides it, and the card route reads the trust list through `ctx.get` so
 * both generations share this declaration.
 */
export declare const inject: string[];
/** Identify sessions owned by the subagent runtime rather than a direct user conversation. */
export declare function isSubagentSession(header: {
    origin?: string;
}): boolean;
export declare function apply(ctx: Context): void;
