import type { ResultCardModel } from '../contract.js'

/** Replay-stable card presentation shared with the host route (kept for client call sites). */
export type ResultCardViewModel = ResultCardModel

export interface ResultCardRecord {
  model: ResultCardViewModel
  inspect?: () => void
}

/** One listed card: the call identity plus its latest known record. */
export interface ResultCardEntryRef {
  callId: string
  /** Seq of the card's first tool/call event; undefined while the durable route has not supplied it yet. */
  callSeq?: number | undefined
  record: ResultCardRecord
}

interface ResultCardEntry {
  sessionId: string
  callId: string
  /** Stable creation-order key from the durable call event, independent of publish timing. */
  callSeq?: number | undefined
  record?: ResultCardRecord
  listeners: Set<() => void>
}

/** Build the collision-free in-memory identity of one session-owned result card. */
function recordKey(sessionId: string, callId: string): string {
  return JSON.stringify([sessionId, callId])
}

/** In-memory bridge between durable ToolRow models and better-sidebar tab views. */
export class ResultCardRegistry {
  private readonly entries = new Map<string, ResultCardEntry>()
  private readonly changeListeners = new Set<() => void>()

  /** Publish the latest replay-derived model and notify the corresponding sidebar view. */
  publish(sessionId: string, callId: string, record: ResultCardRecord, callSeq?: number): void {
    const key = recordKey(sessionId, callId)
    const current = this.entries.get(key)
    if (current === undefined) {
      this.entries.set(key, { sessionId, callId, ...(callSeq === undefined ? {} : { callSeq }), record, listeners: new Set() })
      this.notifyChanges()
      return
    }
    if (callSeq !== undefined) current.callSeq = callSeq
    current.record = record
    for (const listener of current.listeners) listener()
    this.notifyChanges()
  }

  /** Read the latest model for one session and tool-call identity. */
  get(sessionId: string, callId: string): ResultCardRecord | undefined {
    return this.entries.get(recordKey(sessionId, callId))?.record
  }

  /**
   * List the known cards of one session oldest-first by the durable call-event
   * seq. Entries still missing a seq — a just-created card or an unreachable
   * route — sort first as pending newest; an all-missing list keeps registry
   * insertion order through the stable sort.
   */
  records(sessionId: string): ResultCardEntryRef[] {
    const refs: ResultCardEntryRef[] = []
    for (const entry of this.entries.values()) {
      if (entry.sessionId !== sessionId || entry.record === undefined) continue
      refs.push({ callId: entry.callId, callSeq: entry.callSeq, record: entry.record })
    }
    return refs.sort((left, right) => {
      if (left.callSeq !== undefined && right.callSeq !== undefined) return left.callSeq - right.callSeq
      if (left.callSeq !== undefined) return 1
      if (right.callSeq !== undefined) return -1
      return 0
    })
  }

  /** Patch the durable call-event seq onto an already-known card without touching its record. */
  attachCallSeq(sessionId: string, callId: string, callSeq: number): void {
    const entry = this.entries.get(recordKey(sessionId, callId))
    if (entry === undefined || entry.callSeq === callSeq) return
    entry.callSeq = callSeq
    for (const listener of entry.listeners) listener()
    this.notifyChanges()
  }

  /** Subscribe to every registry mutation so list surfaces re-read their snapshot. */
  subscribeChanges(listener: () => void): () => void {
    this.changeListeners.add(listener)
    return () => {
      this.changeListeners.delete(listener)
    }
  }

  /** Notify list surfaces after a mutation completes. */
  private notifyChanges(): void {
    for (const listener of this.changeListeners) listener()
  }

  /** Subscribe to model changes for one sidebar result tab. */
  subscribe(sessionId: string, callId: string, listener: () => void): () => void {
    const key = recordKey(sessionId, callId)
    let entry = this.entries.get(key)
    if (entry === undefined) {
      entry = { sessionId, callId, listeners: new Set() }
      this.entries.set(key, entry)
    }
    entry.listeners.add(listener)
    return () => {
      entry?.listeners.delete(listener)
      if (entry !== undefined && entry.listeners.size === 0 && entry.record === undefined) {
        this.entries.delete(key)
      }
    }
  }

  /** Remove a ToolRow-bound inspect callback while retaining its durable display model. */
  removeInspect(sessionId: string, callId: string, inspect: () => void): void {
    const entry = this.entries.get(recordKey(sessionId, callId))
    if (entry?.record?.inspect !== inspect) return
    const { inspect: _inspect, ...record } = entry.record
    void _inspect
    entry.record = record
    for (const listener of entry.listeners) listener()
    this.notifyChanges()
  }

  /** Clear all transient records and notify mounted views before lifecycle disposal. */
  clear(): void {
    for (const entry of this.entries.values()) {
      delete entry.record
      for (const listener of entry.listeners) listener()
    }
    this.entries.clear()
    this.notifyChanges()
  }
}
