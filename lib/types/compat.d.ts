/**
 * Host-side compatibility shims for running one artifact across harness
 * generations. Each helper probes the runtime capability instead of matching a
 * version string, and every newer path keeps the older one as a fallback.
 */
import type { Context } from '@deepseek-ai/cordis';
/**
 * Read a service without declaring it in `inject`, which is what lets one
 * artifact run where the available service set differs between generations.
 * @param ctx - the plugin context providing `ctx.get`.
 * @param name - the service name to read.
 * @returns the service value, or undefined when the runtime does not provide it.
 */
export declare function optionalService<T>(ctx: Context, name: string): T | undefined;
/**
 * Resolve the browser-trust authorities across harness generations: 0.1.x
 * exposes them as `webRuntime.trustedHosts`, while 0.2.x moved the same list to
 * `connection.trustedHosts`. The legacy source stays first so old deployments
 * keep their exact behavior.
 * @param ctx - the host plugin context.
 * @returns the first trust list the runtime provides, else an empty list.
 */
export declare function resolveTrustedHosts(ctx: Context): readonly string[];
/**
 * Decide whether a user-question failure means the caller cancelled the ask.
 * 0.1.x throws `ASK_CANCELLED`; 0.2.x renamed the same outcome to `ASK_ABORTED`.
 * @param error - the caught failure.
 * @returns true for either cancellation code on a UserQuestionError.
 */
export declare function isCancelledQuestionError(error: unknown): boolean;
