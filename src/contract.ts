export const RESULT_CARD_TOOL = 'present_result_card'
export const REVIEW_QUESTION_ID = 'result-card-review'
export const APPROVE_LABEL = '批准并接受'
export const REJECT_LABEL = '拒绝'
export const ADJUST_LABEL = '要求调整'

export const RESULT_KINDS = ['plan', 'evaluation', 'report'] as const
export type ResultKind = typeof RESULT_KINDS[number]

export interface ResultCardArgs {
  kind: ResultKind
  title: string
  summary: string
  content: string
}

export type ReviewOutcome = 'approved' | 'rejected' | 'adjustment-requested' | 'cancelled'

export interface ReviewResult {
  outcome: ReviewOutcome
  feedback?: string
}

export const REVIEW_SUMMARY_MAX_CHARACTERS = 160

/** Display labels for the three structured-result categories. */
export const RESULT_KIND_LABELS: Record<ResultKind, string> = {
  plan: '实施方案',
  evaluation: '评估报告',
  report: '分析报告',
}

/** Title fallback when card arguments cannot be parsed at all. */
export const FALLBACK_CARD_TITLE = '结构化结果'

/** Review-status presentation shared by the replay client and the host card route. */
export const WAITING_STATUS = '等待审查'
export const INTERRUPTED_STATUS = '审查中断'
export const INCOMPLETE_STATUS = '审查未完成'
export const REVIEW_OUTCOME_STATUS: Record<ReviewOutcome, string> = {
  approved: '已批准',
  rejected: '已拒绝',
  'adjustment-requested': '需调整',
  cancelled: '已取消',
}

/** Replay-stable card presentation shared by the client registry and the host route. */
export interface ResultCardModel {
  kind: ResultKind
  title: string
  summary: string
  content: string
  state: 'waiting' | ReviewOutcome | 'failed'
  status: string
}

/** Normalize parsed card arguments into the replay-stable view the UI renders. */
export function normalizeCardArgs(value: Partial<ResultCardArgs>): ResultCardArgs {
  const kind = value.kind === 'plan' || value.kind === 'evaluation' || value.kind === 'report' ? value.kind : 'report'
  return {
    kind,
    title: typeof value.title === 'string' && value.title.trim() !== '' ? value.title : RESULT_KIND_LABELS[kind],
    summary: typeof value.summary === 'string' ? value.summary : '',
    content: typeof value.content === 'string' ? value.content : '',
  }
}

/** Build a compact review detail while preserving the full report in the result card. */
export function formatReviewDetail(title: string, summary: string): string {
  const normalized = summary.trim().replace(/\s+/gu, ' ')
  if (normalized === '') return `未提供摘要，完整内容请在上方“${title}”结果卡片中查看。`

  const characters = Array.from(normalized)
  const truncated = characters.length > REVIEW_SUMMARY_MAX_CHARACTERS
  const visible = truncated
    ? `${characters.slice(0, REVIEW_SUMMARY_MAX_CHARACTERS - 1).join('')}…`
    : normalized
  const counter = truncated
    ? `${characters.length}/${REVIEW_SUMMARY_MAX_CHARACTERS} 字，已截断`
    : `${characters.length}/${REVIEW_SUMMARY_MAX_CHARACTERS} 字`
  return `摘要（${counter}）\n${visible}\n\n完整内容请在上方“${title}”结果卡片中查看。`
}

/** Normalize the user's structured answer into the tool's stable review vocabulary. */
export function resolveReview(selected: readonly string[], custom?: string): ReviewResult {
  const feedback = custom?.trim()
  if (feedback !== undefined && feedback !== '') {
    return { outcome: 'adjustment-requested', feedback }
  }
  if (selected.includes(APPROVE_LABEL)) return { outcome: 'approved' }
  if (selected.includes(REJECT_LABEL)) return { outcome: 'rejected' }
  return { outcome: 'adjustment-requested' }
}
