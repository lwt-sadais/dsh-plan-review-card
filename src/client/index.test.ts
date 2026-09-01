import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('complete result panel mount boundary', () => {
  it('portals the fixed reading panel to document.body so ToolRow overflow cannot clip it', async () => {
    const source = await readFile(new URL('./index.tsx', import.meta.url), 'utf8')
    expect(source).toContain("import { createPortal } from 'react-dom'")
    expect(source).toMatch(/const panel = open \? createPortal\([\s\S]+document\.body,[\s\S]+\) : null/u)
  })
})
