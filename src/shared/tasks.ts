/** Parsing utilities for GitHub-style task lists inside `tasks.md`. */

export interface ParsedTask {
  /** Stable within one parse: the 0-based line index in the body. */
  id: number
  /** 1-based line number inside the Markdown body (frontmatter excluded). */
  line: number
  /** Nesting depth (0 = top level). */
  depth: number
  text: string
  checked: boolean
  /** Closest preceding Markdown heading, if any. */
  section: string | null
  parentId: number | null
  childIds: number[]
}

const TASK_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/
const HEADING_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/
const FENCE_RE = /^\s*(```|~~~)/

/** Extracts all checklist items, ignoring anything inside fenced code blocks. */
export function parseTasks(markdown: string): ParsedTask[] {
  const lines = markdown.split(/\r?\n/)
  const tasks: ParsedTask[] = []
  const stack: { indent: number; id: number }[] = []
  let section: string | null = null
  let fence: string | null = null

  lines.forEach((raw, index) => {
    const fenceMatch = FENCE_RE.exec(raw)
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1]
      else if (fenceMatch[1] === fence) fence = null
      return
    }
    if (fence !== null) return

    const heading = HEADING_RE.exec(raw)
    if (heading) {
      section = heading[1].trim()
      stack.length = 0
      return
    }

    const match = TASK_RE.exec(raw)
    if (!match) return
    const indent = match[1].replace(/\t/g, '    ').length
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop()
    const parent = stack.length > 0 ? stack[stack.length - 1] : null

    const task: ParsedTask = {
      id: index,
      line: index + 1,
      depth: stack.length,
      text: match[3].trim(),
      checked: match[2].toLowerCase() === 'x',
      section,
      parentId: parent ? parent.id : null,
      childIds: []
    }
    if (parent) tasks.find((t) => t.id === parent.id)?.childIds.push(task.id)
    tasks.push(task)
    stack.push({ indent, id: task.id })
  })

  return tasks
}

export function computeProgress(markdown: string): { done: number; total: number } {
  const tasks = parseTasks(markdown)
  return { done: tasks.filter((t) => t.checked).length, total: tasks.length }
}

/** All descendants of a task, depth-first, in document order. */
export function descendantsOf(tasks: readonly ParsedTask[], id: number): ParsedTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const out: ParsedTask[] = []
  const visit = (taskId: number): void => {
    const task = byId.get(taskId)
    if (!task) return
    for (const childId of task.childIds) {
      const child = byId.get(childId)
      if (child) {
        out.push(child)
        visit(childId)
      }
    }
  }
  visit(id)
  return out
}

/**
 * The recommended next unit of work: the first pending task in document order
 * plus its pending sub-tasks. Returns the ids to select.
 */
export function nextPendingSelection(tasks: readonly ParsedTask[]): number[] {
  const first = tasks.find((t) => !t.checked)
  if (!first) return []
  return [first.id, ...descendantsOf(tasks, first.id).filter((t) => !t.checked).map((t) => t.id)]
}

export function allPendingSelection(tasks: readonly ParsedTask[]): number[] {
  return tasks.filter((t) => !t.checked).map((t) => t.id)
}
