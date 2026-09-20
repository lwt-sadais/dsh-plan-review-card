import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { MarkdownText, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  FALLBACK_CARD_TITLE,
  INCOMPLETE_STATUS,
  INTERRUPTED_STATUS,
  RESULT_CARD_TOOL,
  RESULT_KIND_LABELS,
  REVIEW_OUTCOME_STATUS,
  WAITING_STATUS,
  normalizeCardArgs,
  type ResultCardArgs,
  type ResultCardModel,
  type ResultKind,
  type ReviewOutcome,
} from '../contract.js'
import { ResultCardRegistry, type ResultCardViewModel } from './result-registry.js'
import {
  openResultSidebar,
  registerResultSidebar,
  resultCallId,
  type ResultTabProps,
  type SidebarContext,
} from './sidebar-bridge.js'

const MARKDOWN_LABELS: MarkdownLabels = {
  code: { copyLabel: '复制代码', copiedLabel: '已复制' },
  footnotes: '脚注',
}
const STYLE_ID = 'dsh-plan-review-card'
const PANEL_WIDTH_STORAGE_KEY = 'dsh-plan-review-card:panel-width'
const DEFAULT_PANEL_WIDTH = 480
const MIN_PANEL_WIDTH = 320
const MAX_PANEL_WIDTH = 760
const PANEL_VIEWPORT_RATIO = 0.65
const PANEL_WIDTH_STEP = 24
const PANEL_OPEN_EVENT = 'dsh-plan-review-card:open-panel'
const REMOTE_OPEN_EVENT = 'dsh-plan-review-card:remote-open'
const CARDS_ROUTE = '/plan-review-card/api/cards'
const LIST_POSITION_STORAGE_KEY = 'dsh-plan-review-card:list-position'
/** The official header "more" icon button hosting the session-log entry (CSS Modules hash prefix may drift; match the stable suffix). */
const SESSION_LOG_BUTTON_SELECTOR = 'button[class*="moreButton"]'
/** Horizontal gap between the quick finder and the Session-log capsule when anchored. */
const FAB_ANCHOR_GAP = 8
/** Fallback interval for re-reading the anchored capsule's geometry. */
const FAB_ANCHOR_POLL_INTERVAL = 600
const STYLE_TEXT = `
.dprc-card{margin:4px 16px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-primary)}
.dprc-card[data-state="waiting"]{border-color:var(--dsw-alias-state-warn-secondary)}
.dprc-card[data-state="approved"]{border-color:var(--dsw-alias-state-success-secondary,var(--dsw-alias-border-l1))}
.dprc-summary-row{display:flex;min-height:52px;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;outline:none}
.dprc-summary-row:hover,.dprc-summary-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dprc-icon{display:grid;width:28px;height:28px;flex:none;place-items:center;border-radius:8px;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);font-size:15px}
.dprc-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.dprc-heading{display:flex;align-items:center;gap:7px;min-width:0}
.dprc-kind{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px}.dprc-title{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.dprc-summary{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}.dprc-status{flex:none;border-radius:999px;padding:2px 8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}
.dprc-card[data-state="waiting"] .dprc-status{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary)}.dprc-card[data-state="approved"] .dprc-status{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}
.dprc-card[data-state="adjustment-requested"] .dprc-status,.dprc-card[data-state="rejected"] .dprc-status,.dprc-card[data-state="failed"] .dprc-status{background:var(--dsw-alias-state-error-tertiary);color:var(--dsw-alias-state-error-primary)}.dprc-card[data-state="cancelled"] .dprc-status{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.dprc-chevron{width:16px;flex:none;color:var(--dsw-alias-label-tertiary);text-align:center}.dprc-panel-layer{position:fixed;z-index:1000;top:0;right:0;height:100%;pointer-events:none}.dprc-panel{position:relative;display:flex;width:var(--dprc-panel-width);height:100%;pointer-events:auto;flex-direction:column;border-left:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);box-shadow:-12px 0 32px rgba(0,0,0,.14);animation:dprc-slide-in 180ms ease-out}.dprc-resize-handle{position:absolute;z-index:2;top:0;bottom:0;left:-5px;width:10px;cursor:col-resize;touch-action:none;outline:none}.dprc-resize-handle:after{position:absolute;top:50%;left:4px;width:3px;height:44px;border-radius:999px;background:var(--dsw-alias-border-l2);content:"";opacity:0;transform:translateY(-50%);transition:opacity 120ms ease}.dprc-resize-handle:hover:after,.dprc-resize-handle:focus-visible:after,.dprc-panel[data-resizing="true"] .dprc-resize-handle:after{opacity:1}
.dprc-panel-header{display:flex;min-height:72px;align-items:center;gap:12px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:12px 16px}.dprc-panel-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.dprc-panel-title{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:16px;font-weight:600;line-height:24px;text-overflow:ellipsis;white-space:nowrap}.dprc-panel-summary{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}.dprc-close{display:grid;width:44px;height:44px;flex:none;cursor:pointer;place-items:center;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:22px}.dprc-close:hover,.dprc-close:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dprc-markdown{min-height:0;flex:1;padding:20px 24px;overflow:auto;font-size:14px;line-height:24px}.dprc-actions{display:flex;flex:none;justify-content:flex-end;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding:12px 16px}.dprc-button{min-height:36px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:6px 12px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px}.dprc-button-primary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:white}.dprc-button:hover{filter:brightness(.96)}
.dprc-sidebar{display:flex;width:100%;height:100%;min-height:0;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}.dprc-sidebar-header{display:flex;flex:none;align-items:center;gap:10px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:12px 14px}.dprc-sidebar-empty{display:grid;min-height:180px;place-items:center;padding:24px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:22px;text-align:center}
@keyframes dprc-slide-in{from{transform:translateX(24px);opacity:.72}to{transform:translateX(0);opacity:1}}@media(max-width:720px){.dprc-summary{display:none}.dprc-status{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dprc-panel-layer{left:0}.dprc-panel{width:100%;border-left:0}.dprc-resize-handle{display:none}.dprc-panel-header{padding-top:max(12px,env(safe-area-inset-top))}.dprc-markdown{padding:16px}.dprc-actions{flex-wrap:wrap;padding-bottom:max(12px,env(safe-area-inset-bottom))}.dprc-button-primary{width:100%}}@media(prefers-reduced-motion:reduce){.dprc-panel{animation:none}}
.dprc-fab-layer{position:fixed;z-index:26;left:var(--dprc-fab-left,auto);top:var(--dprc-fab-top,60px);right:var(--dprc-fab-right,12px);display:flex;flex-direction:column;align-items:flex-end;gap:8px}
.dprc-fab-layer[data-anchored="true"]{right:auto}
.dprc-fab{position:relative;display:grid;width:40px;height:40px;place-items:center;cursor:pointer;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:16px;box-shadow:0 4px 16px rgba(0,0,0,.12)}
.dprc-fab:hover,.dprc-fab:focus-visible{filter:brightness(.96);outline:none}
.dprc-fab-badge{position:absolute;top:-6px;right:-6px;min-width:18px;padding:0 5px;border-radius:999px;background:var(--dsw-alias-state-business-primary);color:#fff;font-size:11px;line-height:18px;text-align:center}
.dprc-fab-list{position:fixed;width:320px;max-height:min(60vh,480px);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);box-shadow:0 8px 28px rgba(0,0,0,.16)}
.dprc-fab-list-header{display:flex;flex:none;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid var(--dsw-alias-border-l1);padding:10px 12px 10px 14px;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:grab;user-select:none;touch-action:none}
.dprc-fab-list-header:active{cursor:grabbing}
.dprc-fab-list-header[data-dragging="true"]{cursor:grabbing;background:var(--dsw-alias-interactive-bg-hover)}
.dprc-fab-list-reset{flex:none;cursor:pointer;border:0;border-radius:6px;padding:2px 6px;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px}
.dprc-fab-list-reset:hover,.dprc-fab-list-reset:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dprc-fab-items{margin:0;padding:4px;list-style:none;overflow-y:auto}
.dprc-fab-item{display:flex;width:100%;align-items:center;gap:10px;cursor:pointer;border:0;border-radius:10px;padding:8px 10px;background:transparent;color:inherit;font:inherit;text-align:left}
.dprc-fab-item:hover,.dprc-fab-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}
.dprc-fab-item-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}
.dprc-fab-item-heading{display:flex;min-width:0;align-items:center;gap:7px}
.dprc-fab-item-title{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.dprc-fab-item-summary{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:720px){.dprc-fab-list{width:min(320px,calc(100vw - 24px))}}
`

interface ContentBlock {
  type: string
  text?: string
}

interface RunningToolBlock {
  callId: string
  argsRaw?: string
}

interface SettledToolBlock {
  callId: string
  kind: string
  isError?: boolean
  content: ContentBlock[]
  call?: { argsRaw?: string }
}

type ToolBlock = RunningToolBlock | SettledToolBlock

interface ToolRowProps {
  block: ToolBlock
  inspect?: () => void
}

interface SlotRegistry {
  inject(name: string, factory: () => unknown): void
  register(options: { name: string; key: string }, component: (props: ToolRowProps) => JSX.Element): unknown
}

interface ClientContext extends SidebarContext {
  slots: SlotRegistry
  sessions: {
    list: {
      getSnapshot(): { current?: string }
      subscribe(listener: () => void): () => void
    }
  }
  effect(callback: () => () => void, label: string): () => void
}

let activeContext: ClientContext | undefined
let activeRegistry: ResultCardRegistry | undefined

/** Read the current conversation identity through the sessions list observable. */
function useCurrentSessionId(): string | undefined {
  const sessions = activeContext?.sessions
  return useSyncExternalStore(
    useMemo(() => sessions === undefined ? () => () => {} : (listener: () => void) => sessions.list.subscribe(listener), [sessions]),
    useCallback(() => sessions?.list.getSnapshot().current, [sessions]),
  )
}

/** Parse complete card arguments from a running or settled tool snapshot. */
function parseArgs(block: ToolBlock): ResultCardArgs {
  const raw = 'kind' in block ? block.call?.argsRaw : block.argsRaw
  try {
    return normalizeCardArgs(JSON.parse(raw ?? '') as Partial<ResultCardArgs>)
  } catch {
    return { kind: 'report', title: FALLBACK_CARD_TITLE, summary: '', content: '' }
  }
}

/** Parse the canonical review outcome from a settled tool result. */
function settledOutcome(block: SettledToolBlock): ReviewOutcome | undefined {
  const text = block.content.filter((item) => item.type === 'text').map((item) => item.text ?? '').join('\n')
  try {
    const value = JSON.parse(text) as { outcome?: string }
    if (value.outcome === 'approved' || value.outcome === 'rejected' || value.outcome === 'adjustment-requested' || value.outcome === 'cancelled') return value.outcome
  } catch {}
  return undefined
}

/** Derive one replay-stable card model from durable call and result data. */
function cardModel(block: ToolBlock): ResultCardModel {
  const args = parseArgs(block)
  if (!('kind' in block)) return { ...args, state: 'waiting', status: WAITING_STATUS }
  if (block.isError) return { ...args, state: 'failed', status: INTERRUPTED_STATUS }
  const outcome = settledOutcome(block)
  if (outcome === undefined) return { ...args, state: 'failed', status: INCOMPLETE_STATUS }
  return { ...args, state: outcome, status: REVIEW_OUTCOME_STATUS[outcome] }
}

/** Focus DSH's authoritative question panel instead of duplicating its response transport. */
function focusReview(): void {
  const review = document.querySelector<HTMLElement>('[data-question-key], [data-plan-review-key]')
  if (review === null) return
  review.scrollIntoView({ behavior: 'smooth', block: 'center' })
  review.querySelector<HTMLElement>('button, textarea, input')?.focus()
}

/** Copy complete Markdown using the browser clipboard API. */
async function copyMarkdown(content: string): Promise<void> {
  await navigator.clipboard.writeText(content)
}

/** Download complete Markdown without requiring a Host filesystem permission. */
function downloadMarkdown(title: string, content: string): void {
  const safeName = title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'structured-result'
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${safeName}.md`
  anchor.click()
  URL.revokeObjectURL(url)
}

/** Shared complete-result body used by the unified sidebar and Portal fallback. */
function ResultContent(props: {
  model: ResultCardViewModel
  inspect: (() => void) | undefined
  onReview: () => void
}): JSX.Element {
  const { model, inspect, onReview } = props
  const [copied, setCopied] = useState(false)
  /** Copy the report while keeping transient confirmation local to this view. */
  const copy = (): void => {
    copyMarkdown(model.content).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }).catch(() => setCopied(false))
  }
  return (
    <>
      <div className="dprc-markdown">{model.content === '' ? '无法读取完整内容。' : <MarkdownText text={model.content} labels={MARKDOWN_LABELS} />}</div>
      <footer className="dprc-actions" onClick={event => { event.stopPropagation() }}>
        {inspect !== undefined && <button type="button" className="dprc-button" onClick={inspect}>查看调用</button>}
        <button type="button" className="dprc-button" onClick={copy}>{copied ? '已复制' : '复制 Markdown'}</button>
        <button type="button" className="dprc-button" onClick={() => { downloadMarkdown(model.title, model.content) }}>导出 Markdown</button>
        {model.state === 'waiting' && <button type="button" className="dprc-button dprc-button-primary" onClick={onReview}>批准、拒绝或批注</button>}
      </footer>
    </>
  )
}

/** Render one persisted better-sidebar result tab from the transient ToolRow registry. */
function ResultCardSidebarView({ scope, tab }: ResultTabProps): JSX.Element {
  const callId = resultCallId(tab.meta)
  const registry = activeRegistry
  const record = useSyncExternalStore(
    useMemo(() => (listener: () => void) => {
      if (registry === undefined || callId === undefined) return () => {}
      return registry.subscribe(scope.sessionId, callId, listener)
    }, [registry, scope.sessionId, callId]),
    useCallback(() => {
      if (registry === undefined || callId === undefined) return undefined
      return registry.get(scope.sessionId, callId)
    }, [registry, scope.sessionId, callId]),
  )
  if (record === undefined) {
    return <div className="dprc-sidebar-empty">正在从会话记录恢复完整内容…<br />请在消息流中加载或点击对应结果卡。</div>
  }
  return (
    <section className="dprc-sidebar" aria-label={record.model.title}>
      <header className="dprc-sidebar-header">
        <span className="dprc-icon" aria-hidden="true">▤</span>
        <span className="dprc-panel-copy">
          <span className="dprc-kind">{RESULT_KIND_LABELS[record.model.kind]}</span>
          <span className="dprc-panel-title">{record.model.title}</span>
          {record.model.summary !== '' && <span className="dprc-panel-summary">{record.model.summary}</span>}
        </span>
        <span className="dprc-status">{record.model.status}</span>
      </header>
      <ResultContent model={record.model} inspect={record.inspect} onReview={focusReview} />
    </section>
  )
}

/** Keep the desktop panel inside readable and interaction-safe viewport bounds. */
function clampPanelWidth(width: number): number {
  const viewportMaximum = Math.floor(window.innerWidth * PANEL_VIEWPORT_RATIO)
  return Math.min(Math.max(width, MIN_PANEL_WIDTH), Math.min(MAX_PANEL_WIDTH, viewportMaximum))
}

/** Restore the last valid desktop width without trusting stale browser storage. */
function initialPanelWidth(): number {
  const saved = Number.parseFloat(window.localStorage.getItem(PANEL_WIDTH_STORAGE_KEY) ?? '')
  return clampPanelWidth(Number.isFinite(saved) ? saved : DEFAULT_PANEL_WIDTH)
}

/** Shared slide-in reading panel: width memory, edge resize, and the complete-result body. */
function ResultPanel(props: {
  model: ResultCardViewModel
  inspect?: (() => void) | undefined
  /** DOM id wiring from the owning card row (absent on quick-finder panels). */
  panelId?: string
  onReview: () => void
  onClose: () => void
}): JSX.Element {
  const { model, inspect, panelId, onReview, onClose } = props
  const [panelWidth, setPanelWidth] = useState(initialPanelWidth)
  const [resizing, setResizing] = useState(false)
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number }>()
  const panelTitleId = panelId === undefined ? undefined : `${panelId}-title`

  useEffect(() => {
    /** Keep Escape available without changing focus or blocking native input. */
    const closeFromEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    /** Re-clamp a saved or dragged width when the application viewport shrinks. */
    const fitToViewport = (): void => setPanelWidth((current) => clampPanelWidth(current))
    document.addEventListener('keydown', closeFromEscape)
    window.addEventListener('resize', fitToViewport)
    return () => {
      document.removeEventListener('keydown', closeFromEscape)
      window.removeEventListener('resize', fitToViewport)
    }
  }, [onClose])

  /** Start pointer-captured resizing from the panel's left edge. */
  const startResize = (event: PointerEvent<HTMLDivElement>): void => {
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: panelWidth }
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizing(true)
  }
  /** Resize leftward to grow and rightward to shrink within safe viewport bounds. */
  const resize = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (drag === undefined || drag.pointerId !== event.pointerId) return
    setPanelWidth(clampPanelWidth(drag.startWidth + drag.startX - event.clientX))
  }
  /** Persist the final width when pointer capture ends. */
  const finishResize = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    if (drag === undefined || drag.pointerId !== event.pointerId) return
    const next = clampPanelWidth(drag.startWidth + drag.startX - event.clientX)
    dragRef.current = undefined
    setPanelWidth(next)
    setResizing(false)
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(next))
  }
  /** Support keyboard resizing and a predictable Home reset. */
  const resizeFromKeyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home') return
    event.preventDefault()
    const next = event.key === 'Home'
      ? clampPanelWidth(DEFAULT_PANEL_WIDTH)
      : clampPanelWidth(panelWidth + (event.key === 'ArrowLeft' ? PANEL_WIDTH_STEP : -PANEL_WIDTH_STEP))
    setPanelWidth(next)
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(next))
  }
  /** Restore the default width from the resize handle. */
  const resetPanelWidth = (): void => {
    const next = clampPanelWidth(DEFAULT_PANEL_WIDTH)
    setPanelWidth(next)
    window.localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(next))
  }

  const panelStyle = { '--dprc-panel-width': `${panelWidth}px` } as CSSProperties
  return (
    <div className="dprc-panel-layer" style={panelStyle}>
      <aside id={panelId} className="dprc-panel" role="complementary" aria-labelledby={panelTitleId} aria-label={model.title} data-resizing={resizing || undefined}>
        <div className="dprc-resize-handle" role="separator" tabIndex={0} aria-label="调整完整内容侧栏宽度" aria-orientation="vertical" aria-valuemin={MIN_PANEL_WIDTH} aria-valuemax={Math.min(MAX_PANEL_WIDTH, Math.floor(window.innerWidth * PANEL_VIEWPORT_RATIO))} aria-valuenow={Math.round(panelWidth)} onPointerDown={startResize} onPointerMove={resize} onPointerUp={finishResize} onPointerCancel={finishResize} onKeyDown={resizeFromKeyboard} onDoubleClick={resetPanelWidth} />
        <header className="dprc-panel-header">
          <span className="dprc-icon" aria-hidden="true">▤</span>
          <span className="dprc-panel-copy">
            <span className="dprc-kind">{RESULT_KIND_LABELS[model.kind]}</span>
            <span id={panelTitleId} className="dprc-panel-title">{model.title}</span>
            {model.summary !== '' && <span className="dprc-panel-summary">{model.summary}</span>}
          </span>
          <span className="dprc-status">{model.status}</span>
          <button type="button" className="dprc-close" aria-label="关闭完整内容" onClick={onClose}>×</button>
        </header>
        <ResultContent model={model} inspect={inspect} onReview={onReview} />
      </aside>
    </div>
  )
}

/** Render a persistent structured-result card that opens its complete content in a side panel. */
function ResultCard({ block, inspect }: ToolRowProps): JSX.Element {
  const model = useMemo(() => cardModel(block), [block])
  const sessionId = useCurrentSessionId()
  const [open, setOpen] = useState(false)
  const panelId = `dprc-panel-${block.callId}`

  useEffect(() => {
    const registry = activeRegistry
    if (registry === undefined || sessionId === undefined) return
    registry.publish(sessionId, block.callId, { model, ...(inspect === undefined ? {} : { inspect }) })
    return () => {
      if (inspect !== undefined) registry.removeInspect(sessionId, block.callId, inspect)
    }
  }, [sessionId, block.callId, model, inspect])

  /** Open this card in the unified sidebar, falling back to the legacy Portal. */
  const showPanel = (): void => {
    if (sessionId !== undefined && activeContext !== undefined
      && openResultSidebar(activeContext, sessionId, block.callId, model.title)) return
    window.dispatchEvent(new CustomEvent(PANEL_OPEN_EVENT, { detail: block.callId }))
    setOpen(true)
  }
  /** Close the side panel without stealing focus from the conversation composer. */
  const closePanel = (): void => setOpen(false)
  /** Open the side panel from keyboard activation keys. */
  const openFromKeyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    showPanel()
  }

  useEffect(() => {
    /** Keep only one result panel visible across all persistent card instances. */
    const closeForAnotherCard = (event: Event): void => {
      if ((event as CustomEvent<string>).detail !== block.callId) setOpen(false)
    }
    window.addEventListener(PANEL_OPEN_EVENT, closeForAnotherCard)
    return () => window.removeEventListener(PANEL_OPEN_EVENT, closeForAnotherCard)
  }, [block.callId])

  useEffect(() => {
    /** Reveal this card when the floating quick finder targets it. */
    const openFromFinder = (event: Event): void => {
      if ((event as CustomEvent<string>).detail !== block.callId) return
      setOpen(true)
    }
    window.addEventListener(REMOTE_OPEN_EVENT, openFromFinder)
    return () => window.removeEventListener(REMOTE_OPEN_EVENT, openFromFinder)
  }, [block.callId])

  const panel = open ? createPortal(
    <ResultPanel
      panelId={panelId}
      model={model}
      inspect={inspect}
      onClose={closePanel}
      onReview={() => {
        setOpen(false)
        window.setTimeout(focusReview, 0)
      }}
    />,
    document.body,
  ) : null

  return (
    <article className="dprc-card" data-state={model.state} data-tool={RESULT_CARD_TOOL} data-dprc-call-id={block.callId}>
      <div className="dprc-summary-row" role="button" tabIndex={0} aria-controls={panelId} aria-expanded={open} onClick={showPanel} onKeyDown={openFromKeyboard}>
        <span className="dprc-icon" aria-hidden="true">▤</span>
        <span className="dprc-copy">
          <span className="dprc-heading"><span className="dprc-kind">{RESULT_KIND_LABELS[model.kind]}</span><span className="dprc-title">{model.title}</span></span>
          <span className="dprc-summary">{model.summary || '点击查看完整内容'}</span>
        </span>
        <span className="dprc-status">{model.status}</span>
        <span className="dprc-chevron" aria-hidden="true">›</span>
      </div>
      {panel}
    </article>
  )
}

/** Install card styles once for the plugin lifecycle. */
function installStyle(): () => void {
  const existing = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_ID}"]`)
  if (existing !== null) return () => {}
  const style = document.createElement('style')
  style.dataset.pluginCss = STYLE_ID
  style.textContent = STYLE_TEXT
  document.head.appendChild(style)
  return () => style.remove()
}

/** One quick-finder row: the call identity plus its latest replay-derived model. */
interface FloatingCardEntry {
  callId: string
  /** Durable call-event seq when known; missing entries count as pending newest. */
  callSeq?: number | undefined
  model: ResultCardViewModel
}

/** Persisted free-floating geometry of the quick finder or its list. */
interface FloatingPosition {
  left: number
  top: number
}

/** Read a persisted viewport position without trusting stale or malformed storage. */
function loadFloatingPosition(key: string): FloatingPosition | undefined {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? '') as Partial<FloatingPosition>
    if (typeof saved?.left !== 'number' || !Number.isFinite(saved.left)
      || typeof saved.top !== 'number' || !Number.isFinite(saved.top)) return undefined
    return { left: saved.left, top: saved.top }
  } catch {
    return undefined
  }
}

/** Persist one viewport position, clamped inside the current viewport. */
function saveFloatingPosition(key: string, position: FloatingPosition): void {
  const clamped = {
    left: Math.min(Math.max(position.left, 8), Math.max(window.innerWidth - 56, 8)),
    top: Math.min(Math.max(position.top, 8), Math.max(window.innerHeight - 56, 8)),
  }
  window.localStorage.setItem(key, JSON.stringify(clamped))
}

/** Drop the persisted geometry so the surface returns to its anchored placement. */
function clearFloatingPosition(key: string): void {
  window.localStorage.removeItem(key)
}

/** Clamp a list position so its window stays reachable inside the viewport. */
function clampListPosition(position: FloatingPosition, listWidth: number, listHeight: number): FloatingPosition {
  return {
    left: Math.min(Math.max(position.left, 8), Math.max(window.innerWidth - listWidth - 8, 8)),
    top: Math.min(Math.max(position.top, 8), Math.max(window.innerHeight - Math.min(listHeight, window.innerHeight - 16) - 8, 8)),
  }
}

/**
 * Track the Session-log export capsule's viewport geometry — the quick finder
 * anchors to its left edge. Polling covers layout shifts that neither
 * ResizeObserver nor window resize reports (sidebar toggles repaint the
 * header without resizing it).
 */
function useSessionLogAnchor(enabled: boolean): FloatingPosition | undefined {
  const [anchor, setAnchor] = useState<FloatingPosition>()
  useEffect(() => {
    if (!enabled) return
    /** Read the capsule's rect and mirror it into finder coordinates. */
    const read = (): void => {
      const capsule = document.querySelector<HTMLElement>(SESSION_LOG_BUTTON_SELECTOR)
      if (capsule === null) {
        setAnchor(undefined)
        return
      }
      const rect = capsule.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        setAnchor(undefined)
        return
      }
      setAnchor({ left: rect.left - 40 - FAB_ANCHOR_GAP, top: rect.top + (rect.height - 40) / 2 })
    }
    read()
    const observer = new ResizeObserver(read)
    if (document.querySelector(SESSION_LOG_BUTTON_SELECTOR) !== null) {
      observer.observe(document.querySelector<HTMLElement>(SESSION_LOG_BUTTON_SELECTOR)!)
    }
    const interval = window.setInterval(read, FAB_ANCHOR_POLL_INTERVAL)
    window.addEventListener('resize', read)
    return () => {
      observer.disconnect()
      window.clearInterval(interval)
      window.removeEventListener('resize', read)
    }
  }, [enabled])
  return anchor
}

/** Session-keyed guard so repeated opens never duplicate the durable backfill fetch. */
const backfillInFlight = new Set<string>()

/**
 * Backfill durable cards the conversation has not mounted yet from the host
 * route, and patch the durable call-event seq onto cards that only exist as
 * mounted rows so list surfaces can order by creation time, not publish time.
 */
async function backfillHostCards(sessionId: string): Promise<void> {
  const registry = activeRegistry
  if (registry === undefined || backfillInFlight.has(sessionId)) return
  backfillInFlight.add(sessionId)
  try {
    const response = await fetch(CARDS_ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    if (!response.ok) return
    const data = await response.json() as { cards?: Array<{ callId?: unknown; seq?: unknown; model?: Partial<ResultCardModel> }> }
    for (const card of data.cards ?? []) {
      if (typeof card.callId !== 'string' || card.callId === '') continue
      const callSeq = typeof card.seq === 'number' ? card.seq : undefined
      if (registry.get(sessionId, card.callId) !== undefined) {
        // The row-mounted record stays authoritative; only the durable sort key is patched in.
        if (callSeq !== undefined) registry.attachCallSeq(sessionId, card.callId, callSeq)
        continue
      }
      const model = card.model
      if (typeof model?.title !== 'string' || typeof model.content !== 'string') continue
      const kind: ResultKind = model.kind === 'plan' || model.kind === 'evaluation' || model.kind === 'report' ? model.kind : 'report'
      const state: ResultCardModel['state'] = model.state === 'waiting' || model.state === 'failed'
        || model.state === 'approved' || model.state === 'rejected'
        || model.state === 'adjustment-requested' || model.state === 'cancelled'
        ? model.state
        : 'waiting'
      registry.publish(sessionId, card.callId, {
        model: {
          kind,
          title: model.title,
          summary: typeof model.summary === 'string' ? model.summary : '',
          content: model.content,
          state,
          status: typeof model.status === 'string' ? model.status : WAITING_STATUS,
        },
      }, callSeq)
    }
  } catch {
    // Route unavailable (older host half) or network failure: keep the in-memory
    // registry as-is — cards still appear as their message rows mount.
  } finally {
    backfillInFlight.delete(sessionId)
  }
}

/** Floating quick finder anchored left of the Session-log capsule, listing every known card newest-first by durable call-event seq. */
function FloatingCardList(): JSX.Element | null {
  const registry = activeRegistry
  const sessionId = useCurrentSessionId()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<FloatingCardEntry[]>([])
  const [panelCallId, setPanelCallIdState] = useState<string>()
  const panelCallIdRef = useRef<string>()
  /** Free position the user dragged the list to; undefined = pop up under the finder. */
  const [freeList, setFreeList] = useState<FloatingPosition | undefined>(() => loadFloatingPosition(LIST_POSITION_STORAGE_KEY))
  const [draggingList, setDraggingList] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseLeft: number; baseTop: number }>()
  const anchor = useSessionLogAnchor(true)

  /** Keep the ref aligned so panel-exclusivity listeners always read the live value. */
  const setPanelCallId = useCallback((callId: string | undefined) => {
    panelCallIdRef.current = callId
    setPanelCallIdState(callId)
  }, [])

  /** Re-read the registry snapshot on every mutation and session switch. */
  const sync = useCallback(() => {
    if (registry === undefined) return
    setEntries(registry.records(sessionId ?? '').map((ref) => ({ callId: ref.callId, callSeq: ref.callSeq, model: ref.record.model })))
  }, [registry, sessionId])

  useEffect(() => {
    if (registry === undefined) return
    sync()
    return registry.subscribeChanges(sync)
  }, [registry, sync])

  useEffect(() => {
    if (sessionId === undefined) return
    /** Fill the list with durable history even before the message rows mount. */
    void backfillHostCards(sessionId)
  }, [sessionId])

  useEffect(() => {
    if (sessionId === undefined) return
    /**
     * Sweep cards still missing their durable seq — freshly mounted rows or a
     * previously failed fetch — so the list order settles on the stable sort
     * key. A failed fetch changes no state, so this cannot loop.
     */
    if (!entries.some((entry) => entry.callSeq === undefined)) return
    void backfillHostCards(sessionId)
  }, [sessionId, entries])

  useEffect(() => {
    if (!open) return
    /** Close the dropdown on outside presses or Escape without stealing focus. */
    const closeOnOutsidePointer = (event: globalThis.PointerEvent): void => {
      if ((event.target as Element | null)?.closest?.('[data-dprc-floating]') === null) setOpen(false)
    }
    const closeFromEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeFromEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeFromEscape)
    }
  }, [open])

  useEffect(() => {
    /** Card-row panels outrank the finder panel: close when any other panel opens. */
    const closeForCardPanel = (event: Event): void => {
      if ((event as CustomEvent<string>).detail !== panelCallIdRef.current) setPanelCallId(undefined)
    }
    window.addEventListener(PANEL_OPEN_EVENT, closeForCardPanel)
    return () => window.removeEventListener(PANEL_OPEN_EVENT, closeForCardPanel)
  }, [setPanelCallId])

  /** Start dragging the list from its header with pointer capture. */
  const startListDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const list = listRef.current
    if (list === null || event.button !== 0) return
    const rect = list.getBoundingClientRect()
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, baseLeft: rect.left, baseTop: rect.top }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraggingList(true)
  }
  /** Move the list freely within viewport-safe bounds while dragging. */
  const moveListDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    const list = listRef.current
    if (drag === undefined || list === null || drag.pointerId !== event.pointerId) return
    const rect = list.getBoundingClientRect()
    const next = clampListPosition({ left: drag.baseLeft + event.clientX - drag.startX, top: drag.baseTop + event.clientY - drag.startY }, rect.width, rect.height)
    list.style.left = `${next.left}px`
    list.style.top = `${next.top}px`
  }
  /** Persist the final free position when the drag ends. */
  const finishListDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current
    const list = listRef.current
    if (drag === undefined || list === null || drag.pointerId !== event.pointerId) return
    dragRef.current = undefined
    setDraggingList(false)
    const rect = list.getBoundingClientRect()
    const next = clampListPosition({ left: rect.left, top: rect.top }, rect.width, rect.height)
    setFreeList(next)
    saveFloatingPosition(LIST_POSITION_STORAGE_KEY, next)
  }
  /** Drop the persisted list geometry and pop the list back under the finder. */
  const resetListPosition = (): void => {
    dragRef.current = undefined
    setDraggingList(false)
    setFreeList(undefined)
    clearFloatingPosition(LIST_POSITION_STORAGE_KEY)
  }

  /** Open one card: sidebar first, then reveal the mounted row, else read in place. */
  const openCard = useCallback((entry: FloatingCardEntry): void => {
    setOpen(false)
    if (sessionId !== undefined && activeContext !== undefined
      && openResultSidebar(activeContext, sessionId, entry.callId, entry.model.title)) return
    window.dispatchEvent(new CustomEvent(PANEL_OPEN_EVENT, { detail: entry.callId }))
    const row = document.querySelector<HTMLElement>(`[data-dprc-call-id="${CSS.escape(entry.callId)}"]`)
    if (row !== null) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.dispatchEvent(new CustomEvent(REMOTE_OPEN_EVENT, { detail: entry.callId }))
      setPanelCallId(undefined)
      return
    }
    setPanelCallId(entry.callId)
  }, [sessionId, setPanelCallId])

  /** Open the list and retry a pending seq backfill right before the user reads it. */
  const toggleList = (): void => {
    const next = !open
    setOpen(next)
    if (next && sessionId !== undefined && entries.some((entry) => entry.callSeq === undefined)) {
      void backfillHostCards(sessionId)
    }
  }

  if (registry === undefined || sessionId === undefined || entries.length === 0) return null

  const panelRecord = panelCallId === undefined ? undefined : registry.get(sessionId, panelCallId)
  const anchored = anchor !== undefined
  const fabStyle = anchored
    ? ({ '--dprc-fab-left': `${anchor.left}px`, '--dprc-fab-top': `${anchor.top}px`, '--dprc-fab-right': 'auto' } as CSSProperties)
    : undefined
  const listStyle = freeList !== undefined
    ? ({ left: `${freeList.left}px`, top: `${freeList.top}px` } as CSSProperties)
    : undefined
  return (
    <>
      <div className="dprc-fab-layer" data-dprc-floating="" data-anchored={anchored || undefined} style={fabStyle}>
        {open && (
          <div ref={listRef} className="dprc-fab-list" role="group" aria-label="结果卡片列表" style={listStyle}>
            <div
              className="dprc-fab-list-header"
              data-dragging={draggingList || undefined}
              onPointerDown={startListDrag}
              onPointerMove={moveListDrag}
              onPointerUp={finishListDrag}
              onPointerCancel={finishListDrag}
            >
              <span>结果卡片（{entries.length}）</span>
              {freeList !== undefined && <button type="button" className="dprc-fab-list-reset" aria-label="列表位置复位" title="复位列表位置" onClick={resetListPosition}>复位</button>}
            </div>
            <ul className="dprc-fab-items">
              {entries.slice().reverse().map((entry) => (
                <li key={entry.callId}>
                  <button type="button" className="dprc-fab-item" data-state={entry.model.state} onClick={() => openCard(entry)}>
                    <span className="dprc-icon" aria-hidden="true">▤</span>
                    <span className="dprc-fab-item-copy">
                      <span className="dprc-fab-item-heading">
                        <span className="dprc-kind">{RESULT_KIND_LABELS[entry.model.kind]}</span>
                        <span className="dprc-fab-item-title">{entry.model.title}</span>
                      </span>
                      <span className="dprc-fab-item-summary">{entry.model.summary || '点击查看完整内容'}</span>
                    </span>
                    <span className="dprc-status">{entry.model.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button type="button" className="dprc-fab" aria-label="结果卡片列表" aria-expanded={open} onClick={toggleList}>
          ▤{entries.length > 0 && <span className="dprc-fab-badge">{entries.length}</span>}
        </button>
      </div>
      {panelCallId !== undefined && panelRecord !== undefined && createPortal(
        <ResultPanel
          model={panelRecord.model}
          inspect={panelRecord.inspect}
          onClose={() => setPanelCallId(undefined)}
          onReview={focusReview}
        />,
        document.body,
      )}
    </>
  )
}

/** Register the keyed card renderer and optional unified-sidebar result page. */
export function apply(ctx: ClientContext): void {
  const registry = new ResultCardRegistry()
  activeContext = ctx
  activeRegistry = registry
  registerResultSidebar(ctx, ResultCardSidebarView)
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: RESULT_CARD_TOOL }, ResultCard))
  ctx.effect(installStyle, 'dsh-plan-review-card: stylesheet')
  ctx.effect(() => {
    /** Mount the floating quick finder on a body-level host the plugin lifecycle owns. */
    const host = document.createElement('div')
    host.dataset.dprcFloatingHost = ''
    document.body.appendChild(host)
    const root = createRoot(host)
    root.render(<FloatingCardList />)
    return () => {
      root.unmount()
      host.remove()
    }
  }, 'dsh-plan-review-card: floating finder host')
  ctx.effect(() => () => {
    registry.clear()
    if (activeRegistry === registry) activeRegistry = undefined
    if (activeContext === ctx) activeContext = undefined
  }, 'dsh-plan-review-card: client state')
}

export const inject = ['slots', 'sessions']
