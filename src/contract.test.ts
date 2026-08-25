import { describe, expect, it } from 'vitest'
import { ADJUST_LABEL, APPROVE_LABEL, REJECT_LABEL, resolveReview } from './contract.js'

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
