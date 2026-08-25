export const RESULT_CARD_TOOL = 'present_result_card';
export const REVIEW_QUESTION_ID = 'result-card-review';
export const APPROVE_LABEL = '批准并接受';
export const REJECT_LABEL = '拒绝';
export const ADJUST_LABEL = '要求调整';
export const RESULT_KINDS = ['plan', 'evaluation', 'report'];
/** Normalize the user's structured answer into the tool's stable review vocabulary. */
export function resolveReview(selected, custom) {
    const feedback = custom?.trim();
    if (feedback !== undefined && feedback !== '') {
        return { outcome: 'adjustment-requested', feedback };
    }
    if (selected.includes(APPROVE_LABEL))
        return { outcome: 'approved' };
    if (selected.includes(REJECT_LABEL))
        return { outcome: 'rejected' };
    return { outcome: 'adjustment-requested' };
}
