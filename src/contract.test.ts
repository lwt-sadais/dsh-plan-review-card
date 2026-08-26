import { describe, expect, it } from 'vitest'
import {
  ADJUST_LABEL,
  APPROVE_LABEL,
  REJECT_LABEL,
  formatReviewDetail,
  resolveReview,
} from './contract.js'

describe('formatReviewDetail', () => {
  it('shows the normalized summary and character count', () => {
    expect(formatReviewDetail('评估报告', '  第一行\n 第二行  ')).toBe(
      '摘要（7/160 字）\n第一行 第二行\n\n完整内容请在上方“评估报告”结果卡片中查看。',
    )
  })

  it('uses a compact fallback when the summary is empty', () => {
    expect(formatReviewDetail('评估报告', '  ')).toBe(
      '未提供摘要，完整内容请在上方“评估报告”结果卡片中查看。',
    )
  })

  it('keeps a summary of exactly 160 Unicode characters', () => {
    const summary = '好'.repeat(160)
    expect(formatReviewDetail('评估报告', summary)).toContain(`摘要（160/160 字）\n${summary}\n`)
    expect(formatReviewDetail('评估报告', summary)).not.toContain('已截断')
  })

  it('truncates longer summaries to 160 Unicode characters including the ellipsis', () => {
    const summary = `${'好'.repeat(159)}😀尾`
    const detail = formatReviewDetail('评估报告', summary)
    expect(detail).toContain('摘要（161/160 字，已截断）')
    expect(detail).toContain(`${'好'.repeat(159)}…`)
    expect(detail).not.toContain('😀')
  })
})

describe('resolveReview', () => {
  it('accepts an approved result', () => {
    expect(resolveReview([APPROVE_LABEL])).toEqual({ outcome: 'approved' })
  })

  it('preserves rejection as a terminal review outcome', () => {
    expect(resolveReview([REJECT_LABEL])).toEqual({ outcome: 'rejected' })
  })

  it('maps adjustment selection to a revision request', () => {
    expect(resolveReview([ADJUST_LABEL])).toEqual({ outcome: 'adjustment-requested' })
  })

  it('prioritizes trimmed custom feedback over selected options', () => {
    expect(resolveReview([ADJUST_LABEL], '  增加回滚方案  ')).toEqual({
      outcome: 'adjustment-requested',
      feedback: '增加回滚方案',
    })
  })
})
