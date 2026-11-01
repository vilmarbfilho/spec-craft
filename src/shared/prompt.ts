import type { ParsedTask } from './tasks'
import { SPECS_DIR } from './types'

/** Localized fragments used to assemble the prompt. `{x}` placeholders are interpolated. */
export interface PromptStrings {
  heading: string // "{title}" / "{slug}"
  intro: string
  contextHeading: string
  moduleLine: string // "{slug}" "{title}" "{status}"
  requirementsHeading: string // "{path}"
  designHeading: string // "{path}"
  rulesHint: string
  tasksHeading: string
  tasksIntro: string
  lineLabel: string // "{line}"
  sectionLabel: string
  completionHeading: string
  completionRules: string[] // may contain "{path}"
  emptyDocument: string
}

export interface BuildPromptInput {
  slug: string
  title: string
  status: string
  requirements: string | null
  design: string | null
  tasks: readonly ParsedTask[]
  selectedIds: readonly number[]
  /** Lines before the body in the real file (frontmatter), so line refs match the file. */
  lineOffset?: number
  strings: PromptStrings
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole
  )
}

function block(tag: string, content: string | null, empty: string): string {
  const text = content && content.trim() ? content.trim() : empty
  return `<${tag}>\n${text}\n</${tag}>`
}

/** Builds a self-contained prompt for an AI coding agent. Pure and deterministic. */
export function buildPrompt(input: BuildPromptInput): string {
  const { strings: s, slug } = input
  const base = `${SPECS_DIR}/${slug}`
  const tasksPath = `${base}/tasks.md`
  const selected = new Set(input.selectedIds)
  const chosen = input.tasks.filter((t) => selected.has(t.id))
  const minDepth = chosen.reduce((min, t) => Math.min(min, t.depth), Infinity)

  const out: string[] = []
  out.push(`# ${fill(s.heading, { title: input.title, slug })}`, '', s.intro, '')

  out.push(`## 1. ${s.contextHeading}`, '')
  out.push(fill(s.moduleLine, { slug, title: input.title, status: input.status }), '')
  if (input.requirements !== null) {
    out.push(`### ${fill(s.requirementsHeading, { path: `${base}/requirements.md` })}`, '')
    out.push(block('requirements', input.requirements, s.emptyDocument), '')
  }
  if (input.design !== null) {
    out.push(`### ${fill(s.designHeading, { path: `${base}/design.md` })}`, '')
    out.push(s.rulesHint, '')
    out.push(block('design', input.design, s.emptyDocument), '')
  }

  out.push(`## 2. ${s.tasksHeading}`, '', s.tasksIntro, '')
  let lastSection: string | null | undefined
  const taskLines: string[] = []
  for (const task of chosen) {
    if (task.section !== lastSection && task.section) {
      taskLines.push(`<!-- ${s.sectionLabel}: ${task.section} -->`)
    }
    lastSection = task.section
    const indent = '  '.repeat(Math.max(0, task.depth - minDepth))
    taskLines.push(`${indent}- [ ] ${task.text}  _(${fill(s.lineLabel, { line: task.line + (input.lineOffset ?? 0) })})_`)
  }
  out.push('<tasks>', ...taskLines, '</tasks>', '')

  out.push(`## 3. ${s.completionHeading}`, '')
  s.completionRules.forEach((rule, i) => out.push(`${i + 1}. ${fill(rule, { path: tasksPath })}`))

  return out.join('\n').trimEnd() + '\n'
}

/** Rough token estimate (~4 chars per token) shown as a hint in the UI. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
