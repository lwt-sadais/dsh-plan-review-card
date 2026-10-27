import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { inject, isSubagentSession } from './index.js'

describe('isSubagentSession', () => {
  it('identifies sessions created by the subagent runtime', () => {
    expect(isSubagentSession({ origin: 'subagent' })).toBe(true)
  })

  it('keeps direct and legacy sessions enabled', () => {
    expect(isSubagentSession({ origin: 'user' })).toBe(false)
    expect(isSubagentSession({})).toBe(false)
  })
})

describe('host route mounting', () => {
  it('keeps only the services both supported generations provide', () => {
    expect(inject).toEqual(['agents', 'tools', 'systemPrompt', 'userQuestions', 'webServer', 'sessions'])
    expect(inject).not.toContain('webRuntime')
  })

  it('mounts the fenced durable-cards route with a runtime-resolved trust provider', async () => {
    const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
    expect(source).toContain('registerCardsRoute(ctx as Context & CardsRouteContext, () => resolveTrustedHosts(ctx))')
  })
})
