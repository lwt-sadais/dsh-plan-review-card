import { readFile } from 'node:fs/promises'
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

describe('host route mounting', () => {
  it('requires the webserver, session store, and web runtime services', async () => {
    const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
    expect(source).toContain("'webServer', 'sessions', 'webRuntime'")
  })

  it('mounts the fenced durable-cards route at composition time', async () => {
    const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
    expect(source).toContain('registerCardsRoute(ctx as Context & CardsRouteContext)')
  })
})
