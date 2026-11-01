import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  ListChecksIcon,
  ListIcon,
  ListOrderedIcon,
  MessageSquareWarningIcon,
  QuoteIcon,
  Redo2Icon,
  SquareCodeIcon,
  StrikethroughIcon,
  Undo2Icon,
  type LucideIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolbarButton {
  key: string
  icon: LucideIcon
  run: (e: Editor) => void
  active?: (e: Editor) => boolean
  disabled?: (e: Editor) => boolean
}

const GROUPS: ToolbarButton[][] = [
  [
    { key: 'undo', icon: Undo2Icon, run: (e) => e.chain().focus().undo().run(), disabled: (e) => !e.can().undo() },
    { key: 'redo', icon: Redo2Icon, run: (e) => e.chain().focus().redo().run(), disabled: (e) => !e.can().redo() }
  ],
  [
    { key: 'h1', icon: Heading1Icon, run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(), active: (e) => e.isActive('heading', { level: 1 }) },
    { key: 'h2', icon: Heading2Icon, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
    { key: 'h3', icon: Heading3Icon, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive('heading', { level: 3 }) }
  ],
  [
    { key: 'bold', icon: BoldIcon, run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
    { key: 'italic', icon: ItalicIcon, run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
    { key: 'strike', icon: StrikethroughIcon, run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive('strike') },
    { key: 'code', icon: CodeIcon, run: (e) => e.chain().focus().toggleCode().run(), active: (e) => e.isActive('code') }
  ],
  [
    { key: 'bulletList', icon: ListIcon, run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
    { key: 'orderedList', icon: ListOrderedIcon, run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
    { key: 'taskList', icon: ListChecksIcon, run: (e) => e.chain().focus().toggleTaskList().run(), active: (e) => e.isActive('taskList') }
  ],
  [
    { key: 'codeBlock', icon: SquareCodeIcon, run: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive('codeBlock') },
    { key: 'quote', icon: QuoteIcon, run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote') },
    {
      key: 'callout',
      icon: MessageSquareWarningIcon,
      run: (e) =>
        e
          .chain()
          .focus()
          .insertContent({
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '[!NOTE]' }] }, { type: 'paragraph' }]
          })
          .run()
    }
  ]
]

export function Toolbar({ editor }: { editor: Editor }) {
  const { t } = useTranslation()
  // Re-render on selection/transaction changes so active states stay accurate.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      Object.fromEntries(
        GROUPS.flat().map((b) => [b.key, { active: b.active?.(e) ?? false, disabled: b.disabled?.(e) ?? false }])
      )
  })

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5 border-r pr-1 mr-1 last:border-r-0">
          {group.map((b) => {
            const s = state[b.key]
            return (
              <button
                key={b.key}
                type="button"
                title={t(`editor.toolbar.${b.key}`)}
                aria-label={t(`editor.toolbar.${b.key}`)}
                aria-pressed={s?.active}
                disabled={s?.disabled}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => b.run(editor)}
                className={cn(
                  'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent',
                  s?.active && 'bg-accent text-foreground'
                )}
              >
                <b.icon className="size-4" />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
