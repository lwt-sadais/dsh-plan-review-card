import { describe, expect, it } from 'vitest'
import { resolveSessionId, sessionIdFromSlotProps } from './session-id.js'

describe('sessionIdFromSlotProps', () => {
  it('reads the session id exposed by 0.2.x slot runtimes', () => {
    expect(sessionIdFromSlotProps({ sessionId: 'session-new', block: {} })).toBe('session-new')
  })

  it('reads the legacy session object shape', () => {
    expect(sessionIdFromSlotProps({ session: { sessionId: 'session-old' } })).toBe('session-old')
  })

  it('rejects empty and non-string identities', () => {
    expect(sessionIdFromSlotProps({ sessionId: '' })).toBeUndefined()
    expect(sessionIdFromSlotProps({ sessionId: 42 })).toBeUndefined()
    expect(sessionIdFromSlotProps({ session: { sessionId: '' } })).toBeUndefined()
    expect(sessionIdFromSlotProps({})).toBeUndefined()
    expect(sessionIdFromSlotProps(null)).toBeUndefined()
  })
})

describe('resolveSessionId', () => {
  it('prefers the slot identity', () => {
    expect(resolveSessionId('session-props', 'session-list')).toBe('session-props')
  })

  it('falls back to the 0.1.x sessions-list identity', () => {
    expect(resolveSessionId(undefined, 'session-list')).toBe('session-list')
  })

  it('stays undefined before either source is ready', () => {
    expect(resolveSessionId(undefined, undefined)).toBeUndefined()
  })
})
