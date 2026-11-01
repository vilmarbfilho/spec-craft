// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { createExtensions, normalizeMarkdown } from '../src/renderer/src/components/editor/extensions'

function roundTrip(md: string): string {
  const editor = new Editor({ extensions: createExtensions(''), content: md })
  const storage = editor.storage as unknown as { markdown: { getMarkdown(): string } }
  const out = normalizeMarkdown(storage.markdown.getMarkdown())
  editor.destroy()
  return out
}

describe('markdown round-trip', () => {
  it('keeps task lists, nesting, code blocks and callouts', () => {
    const md = [
      '# Tasks',
      '',
      '## Phase 1',
      '',
      '- [x] Done',
      '- [ ] Pending with `code`',
      '  - [ ] Nested',
      '',
      '```ts',
      'const a = 1 < 2',
      '```',
      '',
      '> [!IMPORTANT]',
      '> Follow the rules',
      '',
      '- **As a** <role>, **I want** x',
      ''
    ].join('\n')
    const out = roundTrip(md)
    expect(out).toContain('- [x] Done')
    expect(out).toContain('- [ ] Pending with `code`')
    expect(out).toMatch(/\n\s+- \[ \] Nested/)
    expect(out).toContain('```ts\nconst a = 1 < 2\n```')
    expect(out).toContain('> [!IMPORTANT]\n> Follow the rules')
    expect(out).toContain('- [x] Done\n- [ ] Pending')
    expect(out).not.toMatch(/[ \t]$/m)
    expect(out).toContain('<role>')
    expect(roundTrip(out)).toBe(out)
  })
})
