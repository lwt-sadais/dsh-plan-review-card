import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

/** Read the client source once per assertion without coupling to built output formatting. */
async function clientSource(): Promise<string> {
  return readFile(new URL('./index.tsx', import.meta.url), 'utf8')
}

describe('complete result presentation boundaries', () => {
  it('registers the native right sidebar and the better-sidebar view before the fallback panel', async () => {
    const source = await clientSource()
    expect(source).toContain('registerNativeResultSidebar(ctx, ctx.slots as unknown as NativeSlotRegistry, ResultCardSidebarView, nativeResultTitle)')
    expect(source).toContain('registerResultSidebar(ctx, ResultCardSidebarView)')
    expect(source).toContain('openNativeResultSidebar(activeContext, sessionId, callId)')
    expect(source).toMatch(/openCardSidebar\(sessionId, block\.callId, model\.title\)\) return/u)
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

  it('registers the card finder in the composer input toolbar after the resident dock entries', async () => {
    const source = await clientSource()
    expect(source).toContain("ctx.slots.inject('conversation.input.left'")
    expect(source).toContain("id: 'plan-review-card'")
    expect(source).toContain('order: 4')
    expect(source).toContain('function CardsDock')
  })

  it('opens finder cards through the sidebar, mounted-row reveal, or embedded panel', async () => {
    const source = await clientSource()
    expect(source).toContain('data-dprc-call-id={block.callId}')
    expect(source).toContain('openCardSidebar(sessionId, entry.callId, entry.model.title)')
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

  it('pops the finder list above the toolbar button and keeps outside-press closing', async () => {
    const source = await clientSource()
    expect(source).toContain('function clampFinderLeft')
    expect(source).toMatch(/transform: 'translateY\(-100%\)'/u)
    expect(source).toContain('data-dprc-floating=""')
    expect(source).toContain('buttonRef.current?.getBoundingClientRect()')
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
