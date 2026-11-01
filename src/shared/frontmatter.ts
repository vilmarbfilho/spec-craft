import { isMap, parseDocument, stringify } from 'yaml'

const FRONTMATTER_RE = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export interface SplitDocument {
  /** Raw YAML text (without the `---` fences) or null when absent. */
  yaml: string | null
  body: string
}

/** Splits a Markdown document into its YAML frontmatter and body. */
export function splitFrontmatter(source: string): SplitDocument {
  const match = FRONTMATTER_RE.exec(source)
  if (!match) return { yaml: null, body: source }
  return { yaml: match[1], body: source.slice(match[0].length).replace(/^\r?\n/, '') }
}

/** Parses frontmatter into a plain object; invalid YAML yields `null` instead of throwing. */
export function parseFrontmatter(source: string): { data: Record<string, unknown> | null; body: string } {
  const { yaml, body } = splitFrontmatter(source)
  if (yaml === null) return { data: null, body }
  try {
    const doc = parseDocument(yaml)
    if (doc.errors.length > 0) return { data: null, body }
    const value = doc.toJS() as unknown
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { data: value as Record<string, unknown>, body }
    }
    return { data: null, body }
  } catch {
    return { data: null, body }
  }
}

/**
 * Returns a new document with `patch` merged into the frontmatter. Existing keys,
 * ordering and YAML comments are preserved; the body is replaced by `body`.
 */
export function composeDocument(
  originalYaml: string | null,
  patch: Record<string, unknown>,
  body: string
): string {
  let yamlText: string
  const doc = originalYaml !== null ? parseDocument(originalYaml) : null
  if (doc && doc.errors.length === 0 && (isMap(doc.contents) || doc.contents === null)) {
    for (const [key, value] of Object.entries(patch)) doc.set(key, value)
    yamlText = doc.toString({ lineWidth: 0 })
  } else {
    yamlText = stringify(patch, { lineWidth: 0 })
  }
  const normalizedBody = body.replace(/^\s*\n/, '')
  return `---\n${yamlText.trimEnd()}\n---\n\n${normalizedBody.trimEnd()}\n`
}

/** ISO-8601 timestamp without milliseconds, e.g. `2026-10-31T21:00:00Z`. */
export function nowIso(date: Date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
