import { describe, expect, it, vi } from 'vitest'
import {
  RESULT_TAB_TYPE,
  openResultSidebar,
  registerResultSidebar,
  resultCallId,
  type ResultTabProps,
} from './sidebar-bridge.js'

/** Minimal inert component used to inspect the registered descriptor. */
function View(_props: ResultTabProps): null {
  return null
}

describe('result sidebar bridge', () => {
  it('registers a hidden result tab through the optional service lifecycle', () => {
    const registerTab = vi.fn(() => () => undefined)
    const effect = vi.fn((callback: () => () => void) => callback())
    const inject = vi.fn((_services: string[], callback: (ctx: unknown) => unknown) =>
      callback({ betterSidebar: { registerTab }, effect }))
    registerResultSidebar({ inject, effect }, View)
    expect(inject).toHaveBeenCalledWith(['betterSidebar'], expect.any(Function))
    expect(registerTab).toHaveBeenCalledWith(expect.objectContaining({
      id: RESULT_TAB_TYPE,
      hidden: true,
      component: View,
    }))
    const descriptor = registerTab.mock.calls[0]?.[0]
    expect(descriptor?.dedupeKey({ id: 'result-card:call-1' })).toBe('result-card:call-1')
  })

  it('opens a deterministic visible-content tab that expands the sidebar without persisting Markdown', () => {
    const openTab = vi.fn()
    const opened = openResultSidebar(
      { get: () => ({ openTab, getTab: () => ({}), isTabEnabled: () => true }) },
      'session-a',
      'call-1',
      '实现分析',
    )
    expect(opened).toBe(true)
    expect(openTab).toHaveBeenCalledWith({
      type: RESULT_TAB_TYPE,
      id: 'result-card:call-1',
      title: '实现分析',
      path: 'result-card:call-1',
      meta: { callId: 'call-1' },
    }, { sessionId: 'session-a' })
  })

  it('falls back cleanly when better-sidebar is absent or the result tab is disabled', () => {
    expect(openResultSidebar({ get: () => undefined }, 'session-a', 'call-1', '报告')).toBe(false)
    expect(openResultSidebar({
      get: () => ({ openTab: vi.fn(), getTab: () => ({}), isTabEnabled: () => false }),
    }, 'session-a', 'call-1', '报告')).toBe(false)
    expect(resultCallId({ callId: 'call-1' })).toBe('call-1')
    expect(resultCallId({ content: '# forbidden duplicate' })).toBeUndefined()
  })
})
