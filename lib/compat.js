import { UserQuestionError } from '@deepseek-ai/dsh-user-questions';
/** Question-answer codes that mean the human cancelled the pending review. */
const CANCELLED_QUESTION_CODES = new Set(['ASK_CANCELLED', 'ASK_ABORTED']);
/**
 * Read a service without declaring it in `inject`, which is what lets one
 * artifact run where the available service set differs between generations.
 * @param ctx - the plugin context providing `ctx.get`.
 * @param name - the service name to read.
 * @returns the service value, or undefined when the runtime does not provide it.
 */
export function optionalService(ctx, name) {
    const value = ctx.get(name);
    return value === undefined || value === null ? undefined : value;
}
/**
 * Resolve the browser-trust authorities across harness generations: 0.1.x
 * exposes them as `webRuntime.trustedHosts`, while 0.2.x moved the same list to
 * `connection.trustedHosts`. The legacy source stays first so old deployments
 * keep their exact behavior.
 * @param ctx - the host plugin context.
 * @returns the first trust list the runtime provides, else an empty list.
 */
export function resolveTrustedHosts(ctx) {
    for (const name of ['webRuntime', 'connection']) {
        const source = optionalService(ctx, name);
        if (Array.isArray(source?.trustedHosts))
            return source.trustedHosts;
    }
    return [];
}
/**
 * Decide whether a user-question failure means the caller cancelled the ask.
 * 0.1.x throws `ASK_CANCELLED`; 0.2.x renamed the same outcome to `ASK_ABORTED`.
 * @param error - the caught failure.
 * @returns true for either cancellation code on a UserQuestionError.
 */
export function isCancelledQuestionError(error) {
    return error instanceof UserQuestionError
        && typeof error.code === 'string'
        && CANCELLED_QUESTION_CODES.has(error.code);
}
