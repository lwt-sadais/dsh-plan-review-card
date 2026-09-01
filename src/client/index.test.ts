import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

/** Read the client source once per assertion without coupling to built output formatting. */
async function clientSource(): Promise<string> {
  return readFile(new URL('./index.tsx', import.meta.url), 'utf8')
}

describe('complete result presentation boundaries', () => {
  it('registers a better-sidebar result view and opens it before the fallback panel', async () => {
    const source = await clientSource()
    expect(source).toContain('registerResultSidebar(ctx, ResultCardSidebarView)')
    expect(source).toMatch(/openResultSidebar\(activeContext, sessionId, block\.callId, model\.title\)\) return/u)
    expect(source).toContain("export const inject = ['slots', 'sessions']")
  })

  it('retains the document-body Portal when better-sidebar is unavailable', async () => {
    const source = await clientSource()
    expect(source).toContain("import { createPortal } from 'react-dom'")
    expect(source).toMatch(/const panel = open \? createPortal\([\s\S]+document\.body,[\s\S]+\) : null/u)
  })

  it('publishes full models in memory while persisted tab meta keeps only callId', async () => {
    const source = await clientSource()
    const bridge = await readFile(new URL('./sidebar-bridge.ts', import.meta.url), 'utf8')
    expect(source).toContain('registry.publish(sessionId, block.callId')
    expect(bridge).toContain('meta: { callId }')
    expect(bridge).not.toContain('meta: { callId, content')
  })
})
