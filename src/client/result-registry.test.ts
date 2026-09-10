import { describe, expect, it, vi } from 'vitest'
import { ResultCardRegistry, type ResultCardRecord } from './result-registry.js'

/** Build one concise registry fixture with an overridable review state. */
function record(state: ResultCardRecord['model']['state'] = 'waiting'): ResultCardRecord {
  return {
    model: {
      kind: 'report',
      title: '实现分析',
      summary: '摘要',
      content: '# 完整内容',
      state,
      status: state === 'waiting' ? '等待审查' : '已批准',
    },
  }
}

describe('ResultCardRegistry', () => {
  it('isolates cards by session and call identity', () => {
    const registry = new ResultCardRegistry()
    registry.publish('session-a', 'call-1', record())
    expect(registry.get('session-a', 'call-1')?.model.title).toBe('实现分析')
    expect(registry.get('session-b', 'call-1')).toBeUndefined()
  })

  it('notifies subscribers when a running card settles', () => {
    const registry = new ResultCardRegistry()
    const listener = vi.fn()
    registry.subscribe('session-a', 'call-1', listener)
    registry.publish('session-a', 'call-1', record())
    registry.publish('session-a', 'call-1', record('approved'))
    expect(listener).toHaveBeenCalledTimes(2)
    expect(registry.get('session-a', 'call-1')?.model.state).toBe('approved')
  })

  it('removes a stale inspect callback without dropping display content', () => {
    const registry = new ResultCardRegistry()
    const inspect = vi.fn()
    registry.publish('session-a', 'call-1', { ...record(), inspect })
    registry.removeInspect('session-a', 'call-1', inspect)
    expect(registry.get('session-a', 'call-1')?.inspect).toBeUndefined()
    expect(registry.get('session-a', 'call-1')?.model.content).toBe('# 完整内容')
  })

  it('notifies mounted views before lifecycle clear invalidates their snapshots', () => {
    const registry = new ResultCardRegistry()
    const listener = vi.fn()
    registry.publish('session-a', 'call-1', record())
    registry.subscribe('session-a', 'call-1', listener)
    registry.clear()
    expect(listener).toHaveBeenCalledOnce()
    expect(registry.get('session-a', 'call-1')).toBeUndefined()
  })

  it('lists known cards of one session in first-known order', () => {
    const registry = new ResultCardRegistry()
    registry.publish('session-a', 'call-2', record('approved'))
    registry.publish('session-a', 'call-1', record())
    registry.publish('session-b', 'call-3', record())
    registry.subscribe('session-a', 'call-4', vi.fn())
    const refs = registry.records('session-a')
    expect(refs.map((ref) => ref.callId)).toEqual(['call-2', 'call-1'])
    expect(refs[0]?.record.model.state).toBe('approved')
  })

  it('notifies change subscribers on publish, inspect removal, and clear', () => {
    const registry = new ResultCardRegistry()
    const changes = vi.fn()
    const unsubscribe = registry.subscribeChanges(changes)
    const inspect = vi.fn()
    registry.publish('session-a', 'call-1', { ...record(), inspect })
    registry.removeInspect('session-a', 'call-1', inspect)
    registry.publish('session-b', 'call-2', record())
    expect(changes).toHaveBeenCalledTimes(3)
    unsubscribe()
    registry.clear()
    expect(changes).toHaveBeenCalledTimes(3)
  })
})
