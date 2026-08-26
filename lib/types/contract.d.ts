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
/** Build a compact review detail while preserving the full report in the result card. */
export declare function formatReviewDetail(title: string, summary: string): string;
/** Normalize the user's structured answer into the tool's stable review vocabulary. */
export declare function resolveReview(selected: readonly string[], custom?: string): ReviewResult;
