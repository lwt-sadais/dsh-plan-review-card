import { describe, expect, it, vi } from 'vitest'
import {
  NATIVE_RESULT_ADDRESS_PREFIX,
  NATIVE_RESULT_TAB_ID,
  NATIVE_RESULT_TAB_KIND,
  nativeCallIdOf,
  openNativeResultSidebar,
  parseResultResource,
  registerNativeResultSidebar,
  resultResourceAddress,
  type NativeResultTabProps,
  type NativeSlotRegistry,
} from './native-sidebar.js'
import type { ResultTabProps, SidebarContext } from './sidebar-bridge.js'

/** Minimal inert result view used to inspect the registered body. */
function View(_props: ResultTabProps): null {
  return null
}

/** Build a context whose optional injection resolves the supplied service map. */
function fakeContext(services: Record<string, unknown>): SidebarContext {
  const effect = (callback: () => () => void): () => void => callback()
  return {
    get: (name: string) => services[name],
    inject: (_names: string[], callback: (ctx: unknown) => void) => callback({
      get: (name: string) => services[name],
      effect,
    }),
    effect,
  } as unknown as SidebarContext
}

describe('result resource addresses', () => {
  it('round-trips session and call identities, including encoded separators', () => {
    const address = resultResourceAddress('session/a', 'call_一/2')
    expect(address.startsWith(NATIVE_RESULT_ADDRESS_PREFIX)).toBe(true)
    expect(parseResultResource(address)).toEqual({ sessionId: 'session/a', callId: 'call_一/2' })
  })

  it('rejects addresses outside the result scheme or missing either identity', () => {
    expect(parseResultResource('dsh-resource://file/a.md')).toBeUndefined()
    expect(parseResultResource(`${NATIVE_RESULT_ADDRESS_PREFIX}session-only`)).toBeUndefined()
    expect(parseResultResource(`${NATIVE_RESULT_ADDRESS_PREFIX}session-only/`)).toBeUndefined()
    expect(parseResultResource(`${NATIVE_RESULT_ADDRESS_PREFIX}/call-only`)).toBeUndefined()
    expect(parseResultResource(`${NATIVE_RESULT_ADDRESS_PREFIX}%E0%A4%A/call`)).toBeUndefined()
  })
})

describe('native result tab registration', () => {
  it('registers a per-card resource type and its body seat', () => {
    const register = vi.fn<(definition: unknown) => () => void>(() => () => undefined)
    const slots: NativeSlotRegistry = {
      inject: vi.fn((_name: string, factory: () => unknown) => factory()),
      register: vi.fn(() => ({})),
    }
    const ctx = fakeContext({ sidebarRightTabs: { register } })
    registerNativeResultSidebar(ctx, slots, View, (sessionId, callId) => callId === 'call-1' ? '卡片标题' : undefined)

    expect(register).toHaveBeenCalledTimes(1)
    const definition = register.mock.calls[0]?.[0] as {
      id: string
      kind: string
      patterns: readonly string[]
      canOpen: (address: string) => boolean
      title: (address: string) => string
      keepMounted: boolean
    }
    const address = resultResourceAddress('session-a', 'call-1')
    expect(definition.id).toBe(NATIVE_RESULT_TAB_ID)
    expect(definition.kind).toBe(NATIVE_RESULT_TAB_KIND)
    expect(definition.patterns).toEqual([`${NATIVE_RESULT_ADDRESS_PREFIX}**`])
    expect(definition.keepMounted).toBe(true)
    expect(definition.canOpen(address)).toBe(true)
    expect(definition.canOpen('dsh-resource://plan-review-card/only-session')).toBe(false)
    expect(definition.title(address)).toBe('卡片标题')
    expect(definition.title(resultResourceAddress('session-a', 'unknown'))).toBe('结构化结果')

    expect(slots.inject).toHaveBeenCalledWith('sidebar.right.pane.tab', expect.any(Function))
    expect(slots.register).toHaveBeenCalledWith(expect.objectContaining({
      name: 'sidebar.right.pane.tab',
      key: NATIVE_RESULT_TAB_ID,
      inject: expect.any(Function),
    }), expect.any(Function))
  })

  it('adapts one native tab occurrence to the shared result view contract', () => {
    const register = vi.fn<(definition: unknown) => () => void>(() => () => undefined)
    const slots: NativeSlotRegistry = {
      inject: vi.fn((_name: string, factory: () => unknown) => factory()),
      register: vi.fn(() => ({})),
    }
    registerNativeResultSidebar(fakeContext({ sidebarRightTabs: { register } }), slots, View)
    const body = (slots.register as unknown as { mock: { calls: Array<[unknown, (props: NativeResultTabProps) => { props: unknown }]> } })
      .mock.calls[0]?.[1]
    if (body === undefined) throw new Error('body was not registered')
    const address = resultResourceAddress('session-a', 'call-1')
    const element = body({
      sessionId: 'session-a',
      useTabInfo: () => ({
        tab: { id: 'tab-1', kind: NATIVE_RESULT_TAB_KIND, contentId: address, title: '标题', visible: true },
      }),
    })
    expect(element.props).toEqual({
      scope: { sessionId: 'session-a' },
      tab: { id: 'tab-1', title: '标题', meta: { callId: 'call-1' } },
      visible: true,
    })
  })

  it('does nothing when the runtime has no right-sidebar tab registry', () => {
    const register = vi.fn()
    const slots: NativeSlotRegistry = { inject: vi.fn(), register: vi.fn() }
    registerNativeResultSidebar(fakeContext({}), slots, View)
    expect(register).not.toHaveBeenCalled()
    expect(slots.register).not.toHaveBeenCalled()
  })
})

describe('native result navigation', () => {
  it('opens the card address with its call identity as navigation params', () => {
    const openResource = vi.fn()
    expect(openNativeResultSidebar({ get: () => ({ openResource }) }, 'session-a', 'call-1')).toBe(true)
    expect(openResource).toHaveBeenCalledWith(resultResourceAddress('session-a', 'call-1'), { params: { callId: 'call-1' } })
  })

  it('falls back when the service is absent or the address cannot be claimed', () => {
    expect(openNativeResultSidebar({ get: () => undefined }, 'session-a', 'call-1')).toBe(false)
    expect(openNativeResultSidebar({
      get: () => ({ openResource: () => { throw new Error('unclaimed') } }),
    }, 'session-a', 'call-1')).toBe(false)
  })
})

describe('nativeCallIdOf', () => {
  it('prefers navigation params and falls back to the restored resource address', () => {
    const base = {
      id: 'tab-1',
      kind: NATIVE_RESULT_TAB_KIND,
      contentId: resultResourceAddress('session-a', 'call-from-address'),
      title: '标题',
      visible: true,
    }
    expect(nativeCallIdOf({ ...base, navigation: { params: { callId: 'call-from-params' } } })).toBe('call-from-params')
    expect(nativeCallIdOf(base)).toBe('call-from-address')
    expect(nativeCallIdOf({ ...base, contentId: 'dsh-resource://other/x' })).toBeUndefined()
  })
})
