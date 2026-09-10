export declare const RESULT_CARD_TOOL = "present_result_card";
export declare const REVIEW_QUESTION_ID = "result-card-review";
export declare const APPROVE_LABEL = "\u6279\u51C6\u5E76\u63A5\u53D7";
export declare const REJECT_LABEL = "\u62D2\u7EDD";
export declare const ADJUST_LABEL = "\u8981\u6C42\u8C03\u6574";
export declare const RESULT_KINDS: readonly ["plan", "evaluation", "report"];
export type ResultKind = typeof RESULT_KINDS[number];
export interface ResultCardArgs {
    kind: ResultKind;
    title: string;
    summary: string;
    content: string;
}
export type ReviewOutcome = 'approved' | 'rejected' | 'adjustment-requested' | 'cancelled';
export interface ReviewResult {
    outcome: ReviewOutcome;
    feedback?: string;
}
export declare const REVIEW_SUMMARY_MAX_CHARACTERS = 160;
/** Display labels for the three structured-result categories. */
export declare const RESULT_KIND_LABELS: Record<ResultKind, string>;
/** Title fallback when card arguments cannot be parsed at all. */
export declare const FALLBACK_CARD_TITLE = "\u7ED3\u6784\u5316\u7ED3\u679C";
/** Review-status presentation shared by the replay client and the host card route. */
export declare const WAITING_STATUS = "\u7B49\u5F85\u5BA1\u67E5";
export declare const INTERRUPTED_STATUS = "\u5BA1\u67E5\u4E2D\u65AD";
export declare const INCOMPLETE_STATUS = "\u5BA1\u67E5\u672A\u5B8C\u6210";
export declare const REVIEW_OUTCOME_STATUS: Record<ReviewOutcome, string>;
/** Replay-stable card presentation shared by the client registry and the host route. */
export interface ResultCardModel {
    kind: ResultKind;
    title: string;
    summary: string;
    content: string;
    state: 'waiting' | ReviewOutcome | 'failed';
    status: string;
}
/** Normalize parsed card arguments into the replay-stable view the UI renders. */
export declare function normalizeCardArgs(value: Partial<ResultCardArgs>): ResultCardArgs;
/** Build a compact review detail while preserving the full report in the result card. */
export declare function formatReviewDetail(title: string, summary: string): string;
/** Normalize the user's structured answer into the tool's stable review vocabulary. */
export declare function resolveReview(selected: readonly string[], custom?: string): ReviewResult;
