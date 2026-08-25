import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { RESULT_CARD_TOOL, type ResultCardArgs, type ResultKind, type ReviewOutcome } from '../contract.js'

const STYLE_ID = 'dsh-plan-review-card'
const KIND_LABELS: Record<ResultKind, string> = {
  plan: '实施方案',
  evaluation: '评估报告',
  report: '分析报告',
}
const STYLE_TEXT = `
.dprc-card{margin:4px 0 4px 4px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-primary)}
.dprc-card[data-state="waiting"]{border-color:var(--dsw-alias-state-warn-secondary)}
.dprc-card[data-state="approved"]{border-color:var(--dsw-alias-state-success-secondary,var(--dsw-alias-border-l1))}
.dprc-summary-row{display:flex;min-height:52px;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;outline:none}
.dprc-summary-row:hover,.dprc-summary-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dprc-icon{display:grid;width:28px;height:28px;flex:none;place-items:center;border-radius:8px;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);font-size:15px}
.dprc-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.dprc-heading{display:flex;align-items:center;gap:7px;min-width:0}
.dprc-kind{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:18px}.dprc-title{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.dprc-summary{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}.dprc-status{flex:none;border-radius:999px;padding:2px 8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}
.dprc-card[data-state="waiting"] .dprc-status{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary)}.dprc-card[data-state="approved"] .dprc-status{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}
.dprc-card[data-state="adjustment-requested"] .dprc-status,.dprc-card[data-state="rejected"] .dprc-status,.dprc-card[data-state="failed"] .dprc-status{background:var(--dsw-alias-state-error-tertiary);color:var(--dsw-alias-state-error-primary)}
.dprc-chevron{width:16px;flex:none;color:var(--dsw-alias-label-tertiary);text-align:center}.dprc-detail{border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
.dprc-markdown{max-height:min(60vh,620px);padding:16px 18px;overflow:auto;font-size:14px;line-height:24px}.dprc-actions{display:flex;justify-content:flex-end;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding:10px 12px}
.dprc-button{min-height:32px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:5px 12px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px}.dprc-button-primary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:white}.dprc-button:hover{filter:brightness(.96)}
@media(max-width:720px){.dprc-summary{display:none}.dprc-status{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dprc-actions{flex-wrap:wrap}.dprc-button-primary{width:100%}}
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

interface ClientContext {
  slots: SlotRegistry
  effect(callback: () => () => void, label: string): () => void
}

interface CardModel extends ResultCardArgs {
  state: CardState
  status: string
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
    if (value.outcome === 'approved' || value.outcome === 'rejected' || value.outcome === 'adjustment-requested') return value.outcome
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

/** Prevent action buttons from toggling their parent disclosure row. */
function isolate(event: MouseEvent<HTMLButtonElement>): void {
  event.stopPropagation()
}

/** Render a persistent structured-result card for one present_result_card call. */
function ResultCard({ block, inspect }: ToolRowProps): JSX.Element {
  const model = useMemo(() => cardModel(block), [block])
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const toggle = (): void => setExpanded((value) => !value)
  const toggleFromKeyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggle()
  }
  const copy = (event: MouseEvent<HTMLButtonElement>): void => {
    isolate(event)
    copyMarkdown(model.content).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }).catch(() => setCopied(false))
  }
  const download = (event: MouseEvent<HTMLButtonElement>): void => {
    isolate(event)
    downloadMarkdown(model.title, model.content)
  }
  const review = (event: MouseEvent<HTMLButtonElement>): void => {
    isolate(event)
    focusReview()
  }

  return (
    <article className="dprc-card" data-state={model.state} data-tool={RESULT_CARD_TOOL}>
      <div className="dprc-summary-row" role="button" tabIndex={0} aria-expanded={expanded} onClick={toggle} onKeyDown={toggleFromKeyboard}>
        <span className="dprc-icon" aria-hidden="true">▤</span>
        <span className="dprc-copy">
          <span className="dprc-heading"><span className="dprc-kind">{KIND_LABELS[model.kind]}</span><span className="dprc-title">{model.title}</span></span>
          {!expanded && <span className="dprc-summary">{model.summary || '点击查看完整内容'}</span>}
        </span>
        <span className="dprc-status">{model.status}</span>
        <span className="dprc-chevron" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
      </div>
      {expanded && (
        <div className="dprc-detail">
          <div className="dprc-markdown">{model.content === '' ? '无法读取完整内容。' : <MarkdownText text={model.content} />}</div>
          <div className="dprc-actions">
            {inspect !== undefined && <button type="button" className="dprc-button" onClick={(event) => { isolate(event); inspect() }}>查看调用</button>}
            <button type="button" className="dprc-button" onClick={copy}>{copied ? '已复制' : '复制 Markdown'}</button>
            <button type="button" className="dprc-button" onClick={download}>导出 Markdown</button>
            {model.state === 'waiting' && <button type="button" className="dprc-button dprc-button-primary" onClick={review}>批准、拒绝或批注</button>}
          </div>
        </div>
      )}
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

/** Register the keyed card renderer through DSH's public client Slot boundary. */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: RESULT_CARD_TOOL }, ResultCard))
  ctx.effect(installStyle, 'dsh-plan-review-card: stylesheet')
}

export const inject = ['slots']
