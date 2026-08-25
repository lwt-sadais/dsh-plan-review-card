import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { UserQuestionError } from '@deepseek-ai/dsh-user-questions'
import {
  ADJUST_LABEL,
  APPROVE_LABEL,
  REJECT_LABEL,
  RESULT_CARD_TOOL,
  REVIEW_QUESTION_ID,
  resolveReview,
} from './contract.js'

const PROMPT_SECTION = `When the user asks for an implementation plan, proposal, evaluation, assessment, comparison report, feasibility study, audit report, or other substantial structured analysis as the final deliverable, present the final result by calling ${RESULT_CARD_TOOL} instead of pasting the complete document as ordinary assistant text.

Use kind "plan" for implementation plans and proposals, "evaluation" for assessments and comparisons, and "report" for other structured analysis. Supply a concise title and summary plus the COMPLETE Markdown document in content. Make ${RESULT_CARD_TOOL} the only and final tool call in that assistant response.

The user reviews the card interactively. If the tool result outcome is "approved", acknowledge briefly and stop. If it is "rejected", do not proceed unless the user later asks again. If it is "adjustment-requested", incorporate feedback, regenerate the complete document, and call ${RESULT_CARD_TOOL} again. Do not use this tool for short factual answers, routine progress updates, or ordinary conversational replies. When the session is in plan mode, obey its stricter workflow and use exit_plan_mode instead of this tool.`

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
    description: 'One or two sentences summarizing the result for the collapsed card.',
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
      enum: ['approved', 'rejected', 'adjustment-requested'],
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
            detail: args.content,
            options: [
              { label: APPROVE_LABEL, description: '接受当前完整内容并结束本次审查。' },
              { label: ADJUST_LABEL, description: '保持任务运行，并通过自定义输入给出修改意见。' },
              { label: REJECT_LABEL, description: '拒绝当前结果，不再继续修订。' },
            ],
          }],
        })
        const item = answer.answers.find((candidate) => candidate.id === REVIEW_QUESTION_ID)
        if (item === undefined) return { outcome: 'adjustment-requested' as const }
        return resolveReview(item.selected, item.custom)
      } catch (error) {
        if (error instanceof UserQuestionError && error.code === 'ASK_CANCELLED') {
          return { outcome: 'adjustment-requested' as const, feedback: '用户关闭了审查卡片，准备通过普通消息补充意见。' }
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
