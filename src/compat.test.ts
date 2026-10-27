import type { Context } from '@deepseek-ai/cordis'
import { UserQuestionError } from '@deepseek-ai/dsh-user-questions'
import { describe, expect, it } from 'vitest'
import { isCancelledQuestionError, optionalService, resolveTrustedHosts } from './compat.js'

/** Build a minimal context whose optional-service reader returns the supplied map. */
function fakeContext(services: Record<string, unknown>): Context {
  return {
    get: (name: string) => services[name],
  } as unknown as Context
}

describe('resolveTrustedHosts', () => {
  it('reads the 0.1.x web runtime source', () => {
    const ctx = fakeContext({ webRuntime: { trustedHosts: ['old.example:43120'] } })
    expect(resolveTrustedHosts(ctx)).toEqual(['old.example:43120'])
  })

  it('reads the 0.2.x connection source', () => {
    const ctx = fakeContext({ connection: { trustedHosts: ['new.example:43120'] } })
    expect(resolveTrustedHosts(ctx)).toEqual(['new.example:43120'])
  })

  it('prefers the legacy source when a composition provides both', () => {
    const ctx = fakeContext({
      webRuntime: { trustedHosts: ['old.example:43120'] },
      connection: { trustedHosts: ['new.example:43120'] },
    })
    expect(resolveTrustedHosts(ctx)).toEqual(['old.example:43120'])
  })

  it('falls back to the loopback-only empty list when neither source exists', () => {
    expect(resolveTrustedHosts(fakeContext({}))).toEqual([])
    expect(resolveTrustedHosts(fakeContext({ connection: { trustedHosts: 'not-an-array' } }))).toEqual([])
  })
})

describe('optionalService', () => {
  it('returns a provided service without requiring an inject declaration', () => {
    const ctx = fakeContext({ webRuntime: { trustedHosts: [] } })
    expect(optionalService<{ trustedHosts: readonly string[] }>(ctx, 'webRuntime')).toEqual({ trustedHosts: [] })
  })

  it('returns undefined for a missing or null service', () => {
    expect(optionalService(fakeContext({}), 'webRuntime')).toBeUndefined()
    expect(optionalService(fakeContext({ webRuntime: null }), 'webRuntime')).toBeUndefined()
  })
})

describe('isCancelledQuestionError', () => {
  it('accepts the 0.1.x cancellation code', () => {
    expect(isCancelledQuestionError(new UserQuestionError('cancelled', 'ASK_CANCELLED'))).toBe(true)
  })

  it('accepts the 0.2.x cancellation code', () => {
    expect(isCancelledQuestionError(new UserQuestionError('aborted', 'ASK_ABORTED'))).toBe(true)
  })

  it('rejects other question failures and foreign errors', () => {
    expect(isCancelledQuestionError(new UserQuestionError('bad answer', 'BAD_ANSWER'))).toBe(false)
    expect(isCancelledQuestionError(new Error('unrelated'))).toBe(false)
    expect(isCancelledQuestionError({ code: 'ASK_ABORTED' })).toBe(false)
    expect(isCancelledQuestionError(undefined)).toBe(false)
  })
})
