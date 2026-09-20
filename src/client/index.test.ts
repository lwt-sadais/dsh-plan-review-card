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

  it('mounts a body-level floating quick finder owned by the plugin lifecycle', async () => {
    const source = await clientSource()
    expect(source).toMatch(/function FloatingCardList/u)
    expect(source).toContain('createRoot(host)')
    expect(source).toContain('host.dataset.dprcFloatingHost')
    expect(source).toContain('root.render(<FloatingCardList />)')
  })

  it('opens finder cards through the sidebar, mounted-row reveal, or embedded panel', async () => {
    const source = await clientSource()
    expect(source).toContain('data-dprc-call-id={block.callId}')
    expect(source).toContain('openResultSidebar(activeContext, sessionId, entry.callId, entry.model.title)')
    expect(source).toContain('window.dispatchEvent(new CustomEvent(REMOTE_OPEN_EVENT, { detail: entry.callId }))')
    expect(source).toContain('setPanelCallId(entry.callId)')
  })

  it('backfills durable cards from the host route without clobbering mounted records', async () => {
    const source = await clientSource()
    expect(source).toContain('fetch(CARDS_ROUTE')
    expect(source).toContain('if (callSeq !== undefined) registry.attachCallSeq(sessionId, card.callId, callSeq)')
    expect(source).toContain('}, callSeq)')
  })

  it('orders the finder list newest-first by the durable call-event seq', async () => {
    const source = await clientSource()
    expect(source).toContain('callSeq: ref.callSeq')
    expect(source).toContain('entries.slice().reverse()')
    expect(source).toContain('entry.callSeq === undefined')
    expect(source).toContain('onClick={toggleList}')
  })

  it('anchors the finder to the left of the Session-log capsule with a safe fallback', async () => {
    const source = await clientSource()
    expect(source).toContain(String.raw`SESSION_LOG_BUTTON_SELECTOR = 'button[class*="moreButton"]'`)
    expect(source).toMatch(/function useSessionLogAnchor/u)
    expect(source).toContain('rect.left - 40 - FAB_ANCHOR_GAP')
    expect(source).toMatch(/data-anchored=\{anchored \|\| undefined\}/u)
  })

  it('lets the opened list drag freely and persist its position', async () => {
    const source = await clientSource()
    expect(source).toContain('LIST_POSITION_STORAGE_KEY')
    expect(source).toMatch(/onPointerDown=\{startListDrag\}/u)
    expect(source).toContain('setPointerCapture(event.pointerId)')
    expect(source).toContain('saveFloatingPosition(LIST_POSITION_STORAGE_KEY, next)')
    expect(source).toMatch(/复位列表位置/u)
  })
})
