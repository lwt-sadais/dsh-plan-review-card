import { useMemo, useState, type KeyboardEvent } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'

const TOOL_NAME = 'exit_plan_mode'
const STYLE_ID = 'dsh-plan-review-card'
const STYLE_TEXT = `
.dprc-card{margin:4px 0 4px 4px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-specific-tip);color:var(--dsw-alias-label-primary)}
.dprc-card[data-state="waiting"]{border-color:var(--dsw-alias-state-warn-secondary)}
.dprc-card[data-state="approved"]{border-color:var(--dsw-alias-state-success-secondary,var(--dsw-alias-border-l1))}
.dprc-summary-row{display:flex;min-height:48px;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;outline:none}
.dprc-summary-row:hover,.dprc-summary-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}
.dprc-icon{display:grid;width:24px;height:24px;flex:none;place-items:center;border-radius:7px;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary);font-size:15px}
.dprc-copy{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}
.dprc-title{overflow:hidden;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:20px;text-overflow:ellipsis;white-space:nowrap}
.dprc-summary{overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;text-overflow:ellipsis;white-space:nowrap}
.dprc-status{flex:none;border-radius:999px;padding:2px 8px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}
.dprc-card[data-state="waiting"] .dprc-status{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary)}
.dprc-card[data-state="approved"] .dprc-status{background:var(--dsw-alias-state-success-tertiary);color:var(--dsw-alias-state-success-primary)}
.dprc-card[data-state="adjusting"] .dprc-status,.dprc-card[data-state="failed"] .dprc-status{background:var(--dsw-alias-state-error-tertiary);color:var(--dsw-alias-state-error-primary)}
.dprc-chevron{width:16px;flex:none;color:var(--dsw-alias-label-tertiary);text-align:center}
.dprc-detail{border-top:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
.dprc-markdown{max-height:min(56vh,560px);padding:16px 18px;overflow:auto;font-size:14px;line-height:24px}
.dprc-actions{display:flex;justify-content:flex-end;gap:8px;border-top:1px solid var(--dsw-alias-border-l1);padding:10px 12px}
.dprc-button{min-height:32px;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;padding:5px 12px;font:inherit;font-size:12px}
.dprc-button-secondary{background:transparent;color:var(--dsw-alias-label-secondary)}
.dprc-button-primary{border-color:transparent;background:var(--dsw-alias-state-business-primary);color:white}
.dprc-button:hover{filter:brightness(.96)}
@media(max-width:720px){.dprc-summary{display:none}.dprc-status{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dprc-actions{flex-direction:column-reverse}.dprc-button{width:100%}}
`

type ToolState = 'waiting' | 'approved' | 'adjusting' | 'cancelled' | 'failed'

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
  error?: { code?: string }
  content: ContentBlock[]
  call?: { argsRaw?: string }
}

type ToolBlock = RunningToolBlock | SettledToolBlock

interface PlanToolRowProps {
  block: ToolBlock
  inspect?: () => void
}

interface SlotRegistry {
  inject(name: string, factory: () => unknown): void
  register(options: { name: string; key: string }, component: (props: PlanToolRowProps) => JSX.Element): unknown
}

interface ClientContext {
  slots: SlotRegistry
  effect(callback: () => () => void, label: string): () => void
}

interface PlanArgs {
  plan: string
}

interface PlanCardModel {
  plan: string
  title: string
  summary: string
  state: ToolState
  status: string
}

/** Read the complete plan from either a running or settled tool-call snapshot. */
function parsePlan(block: ToolBlock): string {
  const raw = 'kind' in block ? block.call?.argsRaw : block.argsRaw
  if (raw === undefined || raw === '') return ''
  try {
    const value = JSON.parse(raw) as Partial<PlanArgs>
    return typeof value.plan === 'string' ? value.plan : ''
  } catch {
    return ''
  }
}

/** Derive a readable title from the plan's first Markdown heading. */
function planTitle(plan: string): string {
  for (const line of plan.split('\n')) {
    const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line)
    if (heading?.[1] !== undefined) return heading[1]
  }
  return '执行方案'
}

/** Build a compact plain-text preview without losing the persisted full plan. */
function planSummary(plan: string): string {
  const text = plan
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[`*_>[\]()~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 180 ? `${text.slice(0, 180)}…` : text
}

/** Flatten the settled result into text for lifecycle classification. */
function resultText(block: SettledToolBlock): string {
  return block.content.map((item) => item.type === 'text' ? item.text ?? '' : '').join('\n')
}

/** Map the durable tool lifecycle to the card's user-facing review state. */
function planState(block: ToolBlock): Pick<PlanCardModel, 'state' | 'status'> {
  if (!('kind' in block)) return { state: 'waiting', status: '待审批' }
  if (!block.isError) return { state: 'approved', status: '已批准' }
  const code = block.error?.code
  const text = resultText(block)
  if (code === 'ASK_CANCELLED' || /dismissed|cancelled/i.test(text)) {
    return { state: 'cancelled', status: '已取消，等待用户消息' }
  }
  if (/keep planning|feedback|revise the plan/i.test(text)) {
    return { state: 'adjusting', status: '需调整' }
  }
  return { state: 'failed', status: '审批未完成' }
}

/** Combine call arguments and result state into one immutable render model. */
function planCardModel(block: ToolBlock): PlanCardModel {
  const plan = parsePlan(block)
  return {
    plan,
    title: planTitle(plan),
    summary: planSummary(plan),
    ...planState(block),
  }
}

/** Move focus to DSH's authoritative plan-review Composer without duplicating its response protocol. */
function focusPlanReview(): void {
  const review = document.querySelector<HTMLElement>('[data-plan-review-key]')
  if (review === null) return
  review.scrollIntoView({ behavior: 'smooth', block: 'center' })
  review.querySelector<HTMLElement>('button, textarea, input')?.focus()
}

/** Render a persistent, expandable plan card for one exit_plan_mode tool call. */
function PlanReviewCard({ block, inspect }: PlanToolRowProps): JSX.Element {
  const model = useMemo(() => planCardModel(block), [block])
  const [expanded, setExpanded] = useState(false)
  const actionable = model.state === 'waiting'
  const toggle = (): void => setExpanded((value) => !value)
  const toggleFromKeyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggle()
  }

  return (
    <article className="dprc-card" data-state={model.state} data-tool={TOOL_NAME}>
      <div
        className="dprc-summary-row"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={toggleFromKeyboard}
      >
        <span className="dprc-icon" aria-hidden="true">▤</span>
        <span className="dprc-copy">
          <span className="dprc-title">{model.title}</span>
          {!expanded && <span className="dprc-summary">{model.summary || '模型已提交一份计划供审批。'}</span>}
        </span>
        <span className="dprc-status">{model.status}</span>
        <span className="dprc-chevron" aria-hidden="true">{expanded ? '⌃' : '⌄'}</span>
      </div>

      {expanded && (
        <div className="dprc-detail">
          <div className="dprc-markdown">
            {model.plan === '' ? '无法读取计划内容。' : <MarkdownText text={model.plan} />}
          </div>
          <div className="dprc-actions">
            {inspect !== undefined && (
              <button type="button" className="dprc-button dprc-button-secondary" onClick={inspect}>
                查看调用详情
              </button>
            )}
            {actionable && (
              <button type="button" className="dprc-button dprc-button-primary" onClick={focusPlanReview}>
                前往批准、拒绝或批注
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

/** Install the card stylesheet once and remove it with the plugin lifecycle. */
function installStyle(): () => void {
  const existing = document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_ID}"]`)
  if (existing !== null) return () => {}
  const style = document.createElement('style')
  style.dataset.pluginCss = STYLE_ID
  style.textContent = STYLE_TEXT
  document.head.appendChild(style)
  return () => style.remove()
}

/** Register the exit_plan_mode keyed tool view through DSH's public client Slot boundary. */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: TOOL_NAME,
  }, PlanReviewCard))
  ctx.effect(installStyle, 'dsh-plan-review-card: stylesheet')
}

export const inject = ['slots']
