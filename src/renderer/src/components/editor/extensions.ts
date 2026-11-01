import { Extension, type AnyExtension } from '@tiptap/core'
import Text from '@tiptap/extension-text'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Markdown } from 'tiptap-markdown'

export const CALLOUT_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'] as const
const CALLOUT_RE = new RegExp(`^\\[!(${CALLOUT_TYPES.join('|')})\\]`, 'i')

/**
 * Text node whose Markdown serialization does not HTML-escape `<` / `>`.
 * Raw HTML parsing is disabled, so `<role>` round-trips as literal text
 * instead of being saved as `&lt;role&gt;`.
 */
const PlainText = Text.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: { text: (t: string) => void }, node: PMNode) {
          state.text(node.text ?? '')
        }
      }
    }
  }
})

/**
 * Custom block rendering for GitHub-style alerts (`> [!NOTE]`, `> [!WARNING]`…).
 * Implemented as decorations so the document stays plain Markdown on disk.
 */
const Callouts = Extension.create({
  name: 'callouts',
  addProseMirrorPlugins() {
    const build = (doc: PMNode): DecorationSet => {
      const decorations: Decoration[] = []
      doc.descendants((node, pos) => {
        if (node.type.name !== 'blockquote') return true
        const first = node.firstChild
        const match = first?.type.name === 'paragraph' ? CALLOUT_RE.exec(first.textContent) : null
        if (match) {
          const kind = match[1].toLowerCase()
          decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: `callout callout-${kind}` }))
          const start = pos + 2 // blockquote open + paragraph open
          decorations.push(Decoration.inline(start, start + match[0].length, { class: 'callout-marker' }))
        }
        return false
      })
      return DecorationSet.create(doc, decorations)
    }
    return [
      new Plugin({
        key: new PluginKey('callouts'),
        state: {
          init: (_, { doc }) => build(doc),
          apply: (tr, old) => (tr.docChanged ? build(tr.doc) : old)
        },
        props: {
          decorations(state) {
            return this.getState(state)
          }
        }
      })
    ]
  }
})

export function createExtensions(placeholder: string): AnyExtension[] {
  return [
    StarterKit.configure({
      text: false,
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: false },
      underline: false
    }),
    PlainText,
    TaskList,
    TaskItem.configure({ nested: true, HTMLAttributes: { 'data-type': 'taskItem' } }),
    Placeholder.configure({ placeholder }),
    Callouts,
    Markdown.configure({
      html: false,
      tightLists: true,
      bulletListMarker: '-',
      linkify: false,
      breaks: false,
      transformPastedText: true,
      transformCopiedText: true
    })
  ]
}

const CALLOUT_GROUP = `(${CALLOUT_TYPES.join('|')})`
const TASK_LINE = /^(\s*[-*+] \[[ xX]\] .*)\n\n(?=\s*[-*+] \[[ xX]\] )/gm

/**
 * Post-processes serializer output so files stay idiomatic Markdown:
 * - un-escapes GitHub alert markers (`\[!NOTE\]` → `[!NOTE]`) and keeps them on their own line;
 * - keeps consecutive checklist items tight (no blank line between them);
 * - strips trailing whitespace and collapses runs of blank lines.
 */
export function normalizeMarkdown(markdown: string): string {
  let out = markdown
    .replace(new RegExp(`^([ \\t]*>[ \\t]*)\\\\\\[!${CALLOUT_GROUP}\\\\\\]`, 'gim'), '$1[!$2]')
    .replace(new RegExp(`^([ \\t]*>[ \\t]*)\\[!${CALLOUT_GROUP}\\][ \\t]+(\\S.*)$`, 'gim'), '$1[!$2]\n$1$3')
    .replace(/[ \t]+$/gm, '')
  // Repeat until stable: each pass can only join one pair per overlapping match.
  for (let prev = ''; prev !== out; ) {
    prev = out
    out = out.replace(TASK_LINE, '$1\n')
  }
  return out.replace(/\n{3,}/g, '\n\n').trimEnd().concat('\n')
}
