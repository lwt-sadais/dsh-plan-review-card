import type { ComponentType } from 'react'

export const RESULT_TAB_TYPE = 'dsh-plan-review-card:result'

export interface ResultTabMeta {
  callId: string
}

export interface ResultTabProps {
  scope: { sessionId: string }
  tab: { id: string; title: string; meta?: unknown }
  visible: boolean
}

interface ResultTabSeed {
  type: string
  id: string
  title: string
  meta: ResultTabMeta
}

interface BetterSidebarService {
  registerTab(descriptor: {
    id: string
    title: string
    hidden: boolean
    dedupeKey: (tab: { id: string }) => string
    component: ComponentType<ResultTabProps>
  }): () => void
  getTab(id: string): unknown
  isTabEnabled(id: string): boolean
  openTab(seed: ResultTabSeed, scope?: { sessionId: string }): void
}

export interface SidebarContext {
  get?(name: string): unknown
  inject?(services: string[], callback: (ctx: SidebarContext & { betterSidebar: BetterSidebarService }) => void): void
  effect?(callback: () => () => void, label: string): unknown
}

/** Validate the only persisted result-tab payload: a durable tool call identity. */
export function resultCallId(meta: unknown): string | undefined {
  if (meta === null || typeof meta !== 'object') return undefined
  const callId = (meta as { callId?: unknown }).callId
  return typeof callId === 'string' && callId !== '' ? callId : undefined
}

/** Register the hidden result tab whenever the optional better-sidebar service is composed. */
export function registerResultSidebar(
  ctx: SidebarContext,
  component: ComponentType<ResultTabProps>,
): void {
  ctx.inject?.(['betterSidebar'], (sidebarCtx) => {
    sidebarCtx.effect?.(() => sidebarCtx.betterSidebar.registerTab({
      id: RESULT_TAB_TYPE,
      title: '结构化结果',
      hidden: true,
      dedupeKey: tab => tab.id,
      component,
    }), 'dsh-plan-review-card: result sidebar tab')
  })
}

/** Open one card in the current session's unified sidebar, or report capability absence. */
export function openResultSidebar(
  ctx: SidebarContext,
  sessionId: string,
  callId: string,
  title: string,
): boolean {
  const sidebar = ctx.get?.('betterSidebar') as BetterSidebarService | undefined
  if (sidebar === undefined || sidebar.getTab(RESULT_TAB_TYPE) === undefined
    || !sidebar.isTabEnabled(RESULT_TAB_TYPE)) return false
  sidebar.openTab({
    type: RESULT_TAB_TYPE,
    id: `result-card:${callId}`,
    title,
    meta: { callId },
  }, { sessionId })
  return true
}
