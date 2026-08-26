import { describe, expect, it } from 'vitest'
import { isSubagentSession } from './index.js'

describe('isSubagentSession', () => {
  it('identifies sessions created by the subagent runtime', () => {
    expect(isSubagentSession({ origin: 'subagent' })).toBe(true)
  })

  it('keeps direct and legacy sessions enabled', () => {
    expect(isSubagentSession({ origin: 'user' })).toBe(false)
    expect(isSubagentSession({})).toBe(false)
  })
})
