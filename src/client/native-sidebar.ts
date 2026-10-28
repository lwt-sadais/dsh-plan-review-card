/**
 * Native right-sidebar bridge: DSH 0.2.x exposes `ctx.sidebarRightTabs` for tab
 * types and `ctx.sidebarRight` for navigation. A card becomes one deduped
 * resource tab so repeated clicks focus the same occurrence, and the tab body
 * reuses the same result view as the legacy unified sidebar.
 */
import { createElement, type ComponentType, type ReactElement } from 'react'
import type { ResultTabProps, SidebarContext } from './sidebar-bridge.js'

/** Identity of the native tab type; also the key its body registers under. */
export const NATIVE_RESULT_TAB_ID = 'dsh-plan-review-card/result'
/** Kind recorded in the right-sidebar layout for every result tab. */
export const NATIVE_RESULT_TAB_KIND = 'plan-review-card'
/** Resource address prefix that gives every card its own dedupe key. */
export const NATIVE_RESULT_ADDRESS_PREFIX = 'dsh-resource://plan-review-card/'

/** Structural face of the native tab type registry (`ctx.sidebarRightTabs`). */
interface NativeTabRegistry {
  register(definition: {
    id: string
    kind: string
    patterns: readonly string[]
    priority?: 'extension' | 'builtin' | 'fallback'
    canOpen?: (address: string) => boolean
    title: (address: string) => string
    keepMounted?: boolean
  }): () => void
}

/** Structural face of the native navigation controller (`ctx.sidebarRight`). */
interface NativeSidebar {
  openResource(address: string, options?: { params?: unknown }): void
}

/** Slot registry face needed to register the native tab body. */
export interface NativeSlotRegistry {
  inject(name: string, factory: () => unknown): (() => void) | void
  register<P>(options: {
    name: string
    key?: string
    inject?: (sessionId: string) => Record<string, unknown>
  }, component: ComponentType<P>): unknown
}

/** Tab record fields the native body reads through the injected hook. */
export interface NativeTabInfo {
  tab: {
    id: string
    kind: string
    contentId: string
    title: string
    visible: boolean
    navigation?: { params?: unknown } | undefined
  }
}

/** Props the native body receives from the slot runtime and its inject callback. */
export interface NativeResultTabProps {
  sessionId: string
  useTabInfo: () => NativeTabInfo
}

/** Build the per-card resource address that makes each card its own deduped tab. */
export function resultResourceAddress(sessionId: string, callId: string): string {
  return `${NATIVE_RESULT_ADDRESS_PREFIX}${encodeURIComponent(sessionId)}/${encodeURIComponent(callId)}`
}

/** Decode one result resource address, or report that it is not one. */
export function parseResultResource(address: string): { sessionId: string; callId: string } | undefined {
  if (!address.startsWith(NATIVE_RESULT_ADDRESS_PREFIX)) return undefined
  const rest = address.slice(NATIVE_RESULT_ADDRESS_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0 || slash === rest.length - 1) return undefined
  try {
    const sessionId = decodeURIComponent(rest.slice(0, slash))
    const callId = decodeURIComponent(rest.slice(slash + 1))
    return sessionId !== '' && callId !== '' ? { sessionId, callId } : undefined
  } catch {
    return undefined
  }
}

/** Read the card identity from navigation params first, then from the restored address. */
export function nativeCallIdOf(tab: NativeTabInfo['tab']): string | undefined {
  const params = tab.navigation?.params
  if (params !== null && typeof params === 'object') {
    const callId = (params as { callId?: unknown }).callId
    if (typeof callId === 'string' && callId !== '') return callId
  }
  return parseResultResource(tab.contentId)?.callId
}

/**
 * Register the native result tab type and body when the right sidebar is
 * composed. The optional injection keeps older harness generations, which have
 * neither service, on their existing fallbacks.
 * @param ctx - the client plugin context carrying optional service injection.
 * @param slots - the slot registry used for the tab body seat.
 * @param view - the result view shared with the legacy unified sidebar.
 * @param titleOf - resolves a live card title for the tab chip.
 */
export function registerNativeResultSidebar(
  ctx: SidebarContext,
  slots: NativeSlotRegistry,
  view: ComponentType<ResultTabProps>,
  titleOf?: (sessionId: string, callId: string) => string | undefined,
): void {
  ctx.inject?.(['sidebarRightTabs'], (scoped) => {
    const tabs = scoped.get?.('sidebarRightTabs') as NativeTabRegistry | undefined
    if (tabs === undefined) return
    const definition = {
      id: NATIVE_RESULT_TAB_ID,
      kind: NATIVE_RESULT_TAB_KIND,
      patterns: [`${NATIVE_RESULT_ADDRESS_PREFIX}**`],
      canOpen: (address: string) => parseResultResource(address) !== undefined,
      title: (address: string) => {
        const parsed = parseResultResource(address)
        return parsed === undefined ? '结构化结果' : titleOf?.(parsed.sessionId, parsed.callId) ?? '结构化结果'
      },
      keepMounted: true,
    }
    scoped.effect?.(() => tabs.register(definition), 'dsh-plan-review-card: native result tab type')
    const NativeBody = (props: NativeResultTabProps): ReactElement => {
      const { tab } = props.useTabInfo()
      const callId = nativeCallIdOf(tab)
      if (callId === undefined) {
        return createElement('div', { className: 'dprc-sidebar-empty' }, '无法读取结果卡片标识。')
      }
      return createElement(view, {
        scope: { sessionId: props.sessionId },
        tab: { id: tab.id, title: tab.title, meta: { callId } },
        visible: tab.visible,
      })
    }
    scoped.effect?.(() => {
      const dispose = slots.inject('sidebar.right.pane.tab', () => slots.register<NativeResultTabProps>({
        name: 'sidebar.right.pane.tab',
        key: NATIVE_RESULT_TAB_ID,
        inject: (sessionId: string) => ({ sessionId }),
      }, NativeBody))
      return typeof dispose === 'function' ? dispose : () => {}
    }, 'dsh-plan-review-card: native result tab body')
  })
}

/**
 * Open one card as a resource tab in the native right sidebar.
 * @param ctx - the client context that may provide `sidebarRight`.
 * @param sessionId - the conversation owning the card.
 * @param callId - the durable tool-call identity of the card.
 * @returns true when the native navigation accepted the tab, false to fall back.
 */
export function openNativeResultSidebar(
  ctx: SidebarContext,
  sessionId: string,
  callId: string,
): boolean {
  const sidebar = ctx.get?.('sidebarRight') as NativeSidebar | undefined
  if (sidebar === undefined) return false
  try {
    sidebar.openResource(resultResourceAddress(sessionId, callId), { params: { callId } })
    return true
  } catch {
    return false
  }
}
