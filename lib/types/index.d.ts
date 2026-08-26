import type { Context } from '@deepseek-ai/cordis';
/** Register the structured-result tool and its model-facing semantic trigger guidance. */
export declare const inject: string[];
/** Identify sessions owned by the subagent runtime rather than a direct user conversation. */
export declare function isSubagentSession(header: {
    origin?: string;
}): boolean;
export declare function apply(ctx: Context): void;
