import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { MarkdownText, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import { RESULT_CARD_TOOL, type ResultCardArgs, type ResultKind, type ReviewOutcome } from '../contract.js'
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
const KIND_LABELS: Record<ResultKind, string> = {
  plan: '实施方案',
  evaluation: '评估报告',
  report: '分析报告',
}
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
`

type CardState = 'waiting' | ReviewOutcome | 'failed'

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

interface CardModel extends ResultCardArgs, ResultCardViewModel {
  state: CardState
  status: string
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
    const value = JSON.parse(raw ?? '') as Partial<ResultCardArgs>
    const kind = value.kind === 'plan' || value.kind === 'evaluation' || value.kind === 'report' ? value.kind : 'report'
    return {
      kind,
      title: typeof value.title === 'string' && value.title.trim() !== '' ? value.title : KIND_LABELS[kind],
      summary: typeof value.summary === 'string' ? value.summary : '',
      content: typeof value.content === 'string' ? value.content : '',
    }
  } catch {
    return { kind: 'report', title: '结构化结果', summary: '', content: '' }
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
function cardModel(block: ToolBlock): CardModel {
  const args = parseArgs(block)
  if (!('kind' in block)) return { ...args, state: 'waiting', status: '等待审查' }
  if (block.isError) return { ...args, state: 'failed', status: '审查中断' }
  const outcome = settledOutcome(block)
  if (outcome === 'approved') return { ...args, state: outcome, status: '已批准' }
  if (outcome === 'rejected') return { ...args, state: outcome, status: '已拒绝' }
  if (outcome === 'adjustment-requested') return { ...args, state: outcome, status: '需调整' }
  if (outcome === 'cancelled') return { ...args, state: outcome, status: '已取消' }
  return { ...args, state: 'failed', status: '审查未完成' }
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
          <span className="dprc-kind">{KIND_LABELS[record.model.kind]}</span>
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

/** Render a persistent structured-result card that opens its complete content in a side panel. */
function ResultCard({ block, inspect }: ToolRowProps): JSX.Element {
  const model = useMemo(() => cardModel(block), [block])
  const sessionId = useCurrentSessionId()
  const [open, setOpen] = useState(false)
  const [panelWidth, setPanelWidth] = useState(initialPanelWidth)
  const [resizing, setResizing] = useState(false)
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number }>()
  const panelId = `dprc-panel-${block.callId}`
  const panelTitleId = `${panelId}-title`

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
    setPanelWidth(initialPanelWidth())
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

  useEffect(() => {
    /** Keep only one result panel visible across all persistent card instances. */
    const closeForAnotherCard = (event: Event): void => {
      if ((event as CustomEvent<string>).detail !== block.callId) setOpen(false)
    }
    window.addEventListener(PANEL_OPEN_EVENT, closeForAnotherCard)
    return () => window.removeEventListener(PANEL_OPEN_EVENT, closeForAnotherCard)
  }, [block.callId])

  useEffect(() => {
    if (!open) return
    /** Keep Escape available without changing focus or blocking native input. */
    const closeFromEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') closePanel()
    }
    /** Re-clamp a saved or dragged width when the application viewport shrinks. */
    const fitToViewport = (): void => setPanelWidth((current) => clampPanelWidth(current))
    document.addEventListener('keydown', closeFromEscape)
    window.addEventListener('resize', fitToViewport)
    return () => {
      document.removeEventListener('keydown', closeFromEscape)
      window.removeEventListener('resize', fitToViewport)
    }
  }, [open])

  const panelStyle = { '--dprc-panel-width': `${panelWidth}px` } as CSSProperties
  const panel = open ? createPortal(
    <div className="dprc-panel-layer" style={panelStyle}>
      <aside id={panelId} className="dprc-panel" role="complementary" aria-labelledby={panelTitleId} data-resizing={resizing || undefined}>
        <div className="dprc-resize-handle" role="separator" tabIndex={0} aria-label="调整完整内容侧栏宽度" aria-orientation="vertical" aria-valuemin={MIN_PANEL_WIDTH} aria-valuemax={Math.min(MAX_PANEL_WIDTH, Math.floor(window.innerWidth * PANEL_VIEWPORT_RATIO))} aria-valuenow={Math.round(panelWidth)} onPointerDown={startResize} onPointerMove={resize} onPointerUp={finishResize} onPointerCancel={finishResize} onKeyDown={resizeFromKeyboard} onDoubleClick={resetPanelWidth} />
        <header className="dprc-panel-header">
          <span className="dprc-icon" aria-hidden="true">▤</span>
          <span className="dprc-panel-copy">
            <span className="dprc-kind">{KIND_LABELS[model.kind]}</span>
            <span id={panelTitleId} className="dprc-panel-title">{model.title}</span>
            {model.summary !== '' && <span className="dprc-panel-summary">{model.summary}</span>}
          </span>
          <span className="dprc-status">{model.status}</span>
          <button type="button" className="dprc-close" aria-label="关闭完整内容" onClick={closePanel}>×</button>
        </header>
        <ResultContent
          model={model}
          inspect={inspect}
          onReview={() => {
            setOpen(false)
            window.setTimeout(focusReview, 0)
          }}
        />
      </aside>
    </div>,
    document.body,
  ) : null

  return (
    <article className="dprc-card" data-state={model.state} data-tool={RESULT_CARD_TOOL}>
      <div className="dprc-summary-row" role="button" tabIndex={0} aria-controls={panelId} aria-expanded={open} onClick={showPanel} onKeyDown={openFromKeyboard}>
        <span className="dprc-icon" aria-hidden="true">▤</span>
        <span className="dprc-copy">
          <span className="dprc-heading"><span className="dprc-kind">{KIND_LABELS[model.kind]}</span><span className="dprc-title">{model.title}</span></span>
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

/** Register the keyed card renderer and optional unified-sidebar result page. */
export function apply(ctx: ClientContext): void {
  const registry = new ResultCardRegistry()
  activeContext = ctx
  activeRegistry = registry
  registerResultSidebar(ctx, ResultCardSidebarView)
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: RESULT_CARD_TOOL }, ResultCard))
  ctx.effect(installStyle, 'dsh-plan-review-card: stylesheet')
  ctx.effect(() => () => {
    registry.clear()
    if (activeRegistry === registry) activeRegistry = undefined
    if (activeContext === ctx) activeContext = undefined
  }, 'dsh-plan-review-card: client state')
}

export const inject = ['slots', 'sessions']
