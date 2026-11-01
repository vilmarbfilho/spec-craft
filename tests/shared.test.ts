import { describe, expect, it } from 'vitest'
import { composeDocument, parseFrontmatter, splitFrontmatter } from '@shared/frontmatter'
import { slugify, validateSlug } from '@shared/slug'
import { allPendingSelection, computeProgress, nextPendingSelection, parseTasks } from '@shared/tasks'
import { buildPrompt, type PromptStrings } from '@shared/prompt'
import { encodeError, parseAppError } from '@shared/errors'

const doc = `---
module: "auth-service"
title: "Autenticação e Sessão"
status: "draft" # draft | in-progress | completed
version: "1.0.0"
updated_at: "2026-10-31T21:00:00Z"
---

# Body
`

describe('frontmatter', () => {
  it('splits and parses', () => {
    const { data, body } = parseFrontmatter(doc)
    expect(data?.title).toBe('Autenticação e Sessão')
    expect(data?.status).toBe('draft')
    expect(body).toBe('# Body\n')
  })
  it('handles missing and broken frontmatter', () => {
    expect(parseFrontmatter('# Hi').data).toBeNull()
    expect(parseFrontmatter('---\n: : bad: [\n---\nx').data).toBeNull()
  })
  it('patches while preserving comments and order', () => {
    const { yaml } = splitFrontmatter(doc)
    const out = composeDocument(yaml, { status: 'completed' }, '# New\n')
    expect(out).toContain('# draft | in-progress | completed')
    expect(out).toMatch(/status: "?completed"?/)
    expect(out.indexOf('module')).toBeLessThan(out.indexOf('title'))
    expect(out.endsWith('# New\n')).toBe(true)
    expect(parseFrontmatter(out).data?.status).toBe('completed')
  })
  it('creates frontmatter when absent', () => {
    const out = composeDocument(null, { module: 'x', title: 'X' }, 'body')
    expect(parseFrontmatter(out).data).toEqual({ module: 'x', title: 'X' })
  })
})

describe('slug', () => {
  it('validates', () => {
    expect(validateSlug('user-management')).toBeNull()
    expect(validateSlug('')).toBe('required')
    expect(validateSlug('a')).toBe('tooShort')
    expect(validateSlug('User Mgmt')).toBe('invalidChars')
    expect(validateSlug('a--b')).toBe('invalidChars')
    expect(validateSlug('-ab')).toBe('invalidChars')
    expect(validateSlug('con')).toBe('reserved')
    expect(validateSlug('auth', ['Auth'])).toBe('exists')
  })
  it('slugifies accented titles', () => {
    expect(slugify('Autenticação e Sessão!')).toBe('autenticacao-e-sessao')
  })
})

const tasksMd = `# Tasks
## Phase 1
- [x] Done one
- [ ] Pending A
  - [x] Sub done
  - [ ] Sub pending
- [ ] Pending B

\`\`\`md
- [ ] not a task
\`\`\`
## Phase 2
* [X] Upper done
1. [ ] Numbered
`

describe('tasks', () => {
  const tasks = parseTasks(tasksMd)
  it('parses tasks, nesting and sections, skipping code fences', () => {
    expect(tasks.map((t) => t.text)).toEqual([
      'Done one', 'Pending A', 'Sub done', 'Sub pending', 'Pending B', 'Upper done', 'Numbered'
    ])
    expect(tasks[3].depth).toBe(1)
    expect(tasks[3].parentId).toBe(tasks[1].id)
    expect(tasks[5].section).toBe('Phase 2')
    expect(tasks[5].checked).toBe(true)
  })
  it('computes progress', () => {
    expect(computeProgress(tasksMd)).toEqual({ done: 3, total: 7 })
  })
  it('selects next pending with pending children', () => {
    expect(nextPendingSelection(tasks).map((id) => tasks.find((t) => t.id === id)?.text)).toEqual([
      'Pending A', 'Sub pending'
    ])
    expect(allPendingSelection(tasks)).toHaveLength(4)
  })
})

describe('prompt', () => {
  const strings: PromptStrings = {
    heading: 'Implement {title} ({slug})',
    intro: 'Intro',
    contextHeading: 'Context',
    moduleLine: 'Module {slug} / {title} / {status}',
    requirementsHeading: 'Requirements ({path})',
    designHeading: 'Design ({path})',
    rulesHint: 'Follow rules',
    tasksHeading: 'Tasks',
    tasksIntro: 'Only these',
    lineLabel: 'line {line}',
    sectionLabel: 'Section',
    completionHeading: 'Completion',
    completionRules: ['Mark done in {path}'],
    emptyDocument: '(empty)'
  }
  it('builds a prompt with exact tasks and file line numbers', () => {
    const tasks = parseTasks(tasksMd)
    const out = buildPrompt({
      slug: 'auth', title: 'Auth', status: 'draft', requirements: 'REQ', design: null,
      tasks, selectedIds: nextPendingSelection(tasks), lineOffset: 7, strings
    })
    expect(out).toContain('<requirements>\nREQ\n</requirements>')
    expect(out).not.toContain('<design>')
    expect(out).toContain('- [ ] Pending A  _(line 11)_')
    expect(out).toContain('  - [ ] Sub pending')
    expect(out).not.toContain('Pending B')
    expect(out).toContain('Mark done in specs/auth/tasks.md')
  })
})

describe('errors', () => {
  it('round-trips codes through messages', () => {
    const msg = 'Error invoking remote method: ' + encodeError({ code: 'CONFLICT', message: 'changed' })
    expect(parseAppError(new Error(msg))).toEqual({ code: 'CONFLICT', message: 'changed' })
  })
})
