export interface ResultCardViewModel {
  kind: 'plan' | 'evaluation' | 'report'
  title: string
  summary: string
  content: string
  state: 'waiting' | 'approved' | 'rejected' | 'adjustment-requested' | 'cancelled' | 'failed'
  status: string
}

export interface ResultCardRecord {
  model: ResultCardViewModel
  inspect?: () => void
}

interface ResultCardEntry {
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

  /** Publish the latest replay-derived model and notify the corresponding sidebar view. */
  publish(sessionId: string, callId: string, record: ResultCardRecord): void {
    const key = recordKey(sessionId, callId)
    const current = this.entries.get(key)
    if (current === undefined) {
      this.entries.set(key, { record, listeners: new Set() })
      return
    }
    current.record = record
    for (const listener of current.listeners) listener()
  }

  /** Read the latest model for one session and tool-call identity. */
  get(sessionId: string, callId: string): ResultCardRecord | undefined {
    return this.entries.get(recordKey(sessionId, callId))?.record
  }

  /** Subscribe to model changes for one sidebar result tab. */
  subscribe(sessionId: string, callId: string, listener: () => void): () => void {
    const key = recordKey(sessionId, callId)
    let entry = this.entries.get(key)
    if (entry === undefined) {
      entry = { listeners: new Set() }
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
  }

  /** Clear all transient records and notify mounted views before lifecycle disposal. */
  clear(): void {
    for (const entry of this.entries.values()) {
      delete entry.record
      for (const listener of entry.listeners) listener()
    }
    this.entries.clear()
  }
}
