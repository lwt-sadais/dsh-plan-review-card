import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { UserQuestionError } from '@deepseek-ai/dsh-user-questions'
import {
  ADJUST_LABEL,
  APPROVE_LABEL,
  REJECT_LABEL,
  RESULT_CARD_TOOL,
  REVIEW_QUESTION_ID,
  formatReviewDetail,
  resolveReview,
} from './contract.js'

const PROMPT_SECTION = `When the user's requested final deliverable is an implementation plan, proposal, evaluation, assessment, comparison, feasibility study, audit, investigation report, root-cause analysis, code-review report, architecture analysis, or any other complete structured analysis, you MUST present it by calling ${RESULT_CARD_TOOL} instead of sending the document as ordinary assistant text.

Classify by the nature of the work, not by the final response length. A concise conclusion still counts as a structured report when it is the final result of multi-step investigation, cross-file or cross-repository analysis, source-code tracing, commit/history inspection, test analysis, incident diagnosis, or evidence-backed comparison. In particular, a final root-cause conclusion that includes evidence and remediation or verification advice MUST use ${RESULT_CARD_TOOL} even if it fits in a short response.

Use kind "plan" for implementation plans, migration plans, proposals, and technical designs; kind "evaluation" for assessments, feasibility studies, comparisons, risk reviews, and option selection; and kind "report" for root-cause analyses, investigation findings, audits, code-review findings, architecture analyses, and other evidence-backed reports.

Before sending any final answer containing headings, multiple findings, evidence, root causes, risks, recommendations, remediation steps, or verification advice, perform this mandatory check: "Is this the requested final deliverable of an investigation, evaluation, plan, or structured analysis?" If yes, call ${RESULT_CARD_TOOL}. Do not paste the complete deliverable as assistant text before or after the tool call. Make ${RESULT_CARD_TOOL} the only and final action in that assistant response.

Do NOT use ${RESULT_CARD_TOOL} for a single fact, a brief clarification, a direct yes/no answer, routine execution progress, a blocker notice, a request for missing information, or ordinary conversation when no structured final deliverable was requested.

Positive examples that MUST use the card:
- "Analyze why this bug occurs across the frontend and backend and give the final conclusion."
- "Trace the code and commit history, then provide the root cause and remediation advice."
- "Review this implementation and report risks and recommendations."
- "Compare these approaches and recommend one."

Negative examples that must remain ordinary text:
- "What does this error message mean?"
- "Which file did you change?"
- "The test is still running."
- "I need the server address before continuing."

Supply a concise title and summary plus the COMPLETE Markdown document in content. The user reviews the card interactively. If the tool result outcome is "approved", acknowledge briefly and stop. If it is "rejected", do not proceed unless the user later asks again. If it is "cancelled", stop and wait for the user's next message without treating it as revision feedback. If it is "adjustment-requested", incorporate the feedback, regenerate the COMPLETE document, and call ${RESULT_CARD_TOOL} again. When the session is in plan mode, obey its stricter workflow and use exit_plan_mode instead.`

const parameters = {
  kind: {
    type: 'string',
    enum: ['plan', 'evaluation', 'report'],
    required: true,
    description: 'Structured result category: plan, evaluation, or report.',
  },
  title: {
    type: 'string',
    required: true,
    description: 'Concise user-facing card title.',
  },
  summary: {
    type: 'string',
    required: true,
    description: 'One or two concise sentences, preferably 80–120 Chinese characters and never more than 160 characters.',
  },
  content: {
    type: 'string',
    required: true,
    description: 'The complete result as Markdown; never omit sections or replace them with a summary.',
  },
} as const

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    outcome: {
      type: 'string',
      enum: ['approved', 'rejected', 'adjustment-requested', 'cancelled'],
      required: true,
    },
    feedback: { type: 'string' },
  },
} as const

/** Register the structured-result tool and its model-facing semantic trigger guidance. */
export const inject = ['tools', 'systemPrompt', 'userQuestions']

export function apply(ctx: Context): void {
  ctx.systemPrompt.section({
    name: 'result-card:policy',
    order: 160,
    text: PROMPT_SECTION,
  })

  ctx.tools.register(defineTool({
    name: RESULT_CARD_TOOL,
    description: 'Present a complete implementation plan, evaluation, or structured analysis as a persistent review card and wait for the user to approve, reject, or request adjustments.',
    parameters,
    output: {
      schema: outputSchema,
      render: (_args, value) => [{
        type: 'text',
        text: JSON.stringify(value),
      }],
    },
    execute: async (args, exec) => {
      if (exec.agent === undefined) throw new Error(`${RESULT_CARD_TOOL} requires a live calling agent`)
      try {
        const answer = await ctx.userQuestions.ask({
          agent: exec.agent,
          signal: exec.signal,
          questions: [{
            id: REVIEW_QUESTION_ID,
            header: args.kind === 'plan' ? '方案审查' : args.kind === 'evaluation' ? '评估审查' : '报告审查',
            question: `如何处理“${args.title}”？`,
            detail: formatReviewDetail(args.title, args.summary),
            options: [
              { label: APPROVE_LABEL, description: '接受当前完整内容并结束本次审查。' },
              { label: ADJUST_LABEL, description: '保持任务运行，并通过自定义输入给出修改意见。' },
              { label: REJECT_LABEL, description: '拒绝当前结果，不再继续修订。' },
            ],
          }],
        })
        const item = answer.answers.find((candidate) => candidate.id === REVIEW_QUESTION_ID)
        if (item === undefined) return { outcome: 'cancelled' as const }
        return resolveReview(item.selected, item.custom)
      } catch (error) {
        if (error instanceof UserQuestionError && error.code === 'ASK_CANCELLED') {
          return { outcome: 'cancelled' as const }
        }
        throw error
      }
    },
    presentCall: (args) => ({
      card: 'generic',
      title: args.title,
      kind: 'other',
      content: [{ type: 'text', text: args.content }],
    }),
    presentResult: (args, result) => ({
      card: 'generic',
      title: args.title,
      content: result.content,
    }),
  }))
}
