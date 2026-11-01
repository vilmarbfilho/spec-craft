import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { AlertTriangleIcon, CheckIcon, CircleDotIcon, FileWarningIcon, Loader2Icon, RotateCcwIcon } from 'lucide-react'
import type { SpecFile, SpecFileKind } from '@shared/types'
import { Button } from '@/components/ui/button'
import { api, describeError, parseAppError } from '@/lib/api'
import { onFsEvent } from '@/lib/fs-events'
import { registerFlusher } from '@/lib/pending-saves'
import { useAppStore } from '@/store/app-store'
import { createExtensions, normalizeMarkdown } from './extensions'
import { Toolbar } from './Toolbar'

type LoadState = 'loading' | 'ready' | 'missing' | 'error'
type SaveState = 'saved' | 'dirty' | 'saving' | 'error'
type Banner = null | 'conflict' | 'removed'

interface Props {
  slug: string
  kind: SpecFileKind
  title: string
}

function getMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as { markdown: { getMarkdown(): string } }
  return normalizeMarkdown(storage.markdown.getMarkdown())
}

/**
 * Edits one spec file. Markdown on disk is the source of truth:
 * - autosaves (debounced) with optimistic concurrency (mtime check in main);
 * - reloads silently on external changes when there are no local edits;
 * - shows a conflict banner when both sides changed, or when the file vanished.
 */
export function SpecDocument({ slug, kind, title }: Props) {
  const { t } = useTranslation()
  const toast = useAppStore((s) => s.toast)
  const [load, setLoad] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [save, setSave] = useState<SaveState>('saved')
  const [banner, setBanner] = useState<Banner>(null)

  const mtimeRef = useRef<number | null>(null)
  const baselineRef = useRef<string>('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bannerRef = useRef<Banner>(null)
  const savingRef = useRef<Promise<void> | null>(null)
  bannerRef.current = banner

  const extensions = useMemo(() => createExtensions(t('editor.placeholder')), [t])
  const editor = useEditor(
    {
      extensions,
      content: '',
      editable: false,
      immediatelyRender: true,
      editorProps: { attributes: { class: 'max-w-3xl mx-auto px-10 pt-6', spellcheck: 'true' } },
      onUpdate: ({ editor: e }) => onChange(e)
    },
    [] // the parent keys this component by slug/kind, so one editor per file
  )
  const editorRef = useRef(editor)
  editorRef.current = editor

  const isDirty = (): boolean => {
    const e = editorRef.current
    return !!e && getMarkdown(e) !== baselineRef.current
  }

  const applyFile = useCallback((file: SpecFile) => {
    const e = editorRef.current
    if (!e) return
    mtimeRef.current = file.mtimeMs
    e.commands.setContent(file.body, { emitUpdate: false })
    baselineRef.current = getMarkdown(e)
    e.setEditable(true)
    setSave('saved')
    setBanner(null)
    setLoad(file.exists ? 'ready' : 'missing')
  }, [])

  const reload = useCallback(async () => {
    try {
      applyFile(await api.spec.read(slug, kind))
    } catch (err) {
      setLoadError(describeError(err))
      setLoad('error')
    }
  }, [slug, kind, applyFile])

  /** Persists the current content. `force` overwrites external changes. */
  const flush = useCallback(
    async (force = false): Promise<void> => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = null
      const e = editorRef.current
      if (!e || e.isDestroyed || (!force && bannerRef.current)) return
      // Capture synchronously: on unmount the editor is destroyed right after.
      const body = getMarkdown(e)
      if (savingRef.current) await savingRef.current
      if (!force && body === baselineRef.current) return

      const run = (async () => {
        setSave('saving')
        try {
          const res = await api.spec.write({ slug, kind, body, expectedMtimeMs: mtimeRef.current, force })
          mtimeRef.current = res.mtimeMs
          baselineRef.current = body
          setBanner(null)
          setLoad('ready')
          setSave(getMarkdown(e) === body ? 'saved' : 'dirty')
        } catch (err) {
          if (parseAppError(err).code === 'CONFLICT') {
            setBanner('conflict')
            setSave('dirty')
          } else {
            setSave('error')
            toast(describeError(err), 'error')
          }
        }
      })()
      savingRef.current = run
      await run
      savingRef.current = null
    },
    [slug, kind, toast]
  )
  const flushRef = useRef(flush)
  flushRef.current = flush

  function onChange(e: Editor): void {
    if (getMarkdown(e) === baselineRef.current) {
      setSave('saved')
      return
    }
    setSave('dirty')
    if (bannerRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    // Checkbox toggles in tasks.md are saved almost immediately.
    timerRef.current = setTimeout(() => void flushRef.current(), kind === 'tasks' ? 250 : 800)
  }

  // Initial load (and when the file identity changes).
  useEffect(() => {
    setLoad('loading')
    void reload()
  }, [reload])

  // Flush pending edits when leaving the document (tab switch, module change, unmount).
  useEffect(() => () => void flushRef.current(), [slug, kind])

  // React to external modifications.
  useEffect(
    () =>
      onFsEvent(async (event) => {
        if (event.type === 'specs-changed' || event.slug !== slug || event.kind !== kind) return
        if (event.type === 'file-changed') {
          if (load === 'missing' || !isDirty()) {
            await reload()
            toast(t('editor.reloaded', { file: `${kind}.md` }))
          } else {
            setBanner('conflict')
          }
        } else {
          // Confirm the deletion: atomic replaces by other tools may emit unlink+add.
          const file = await api.spec.read(slug, kind).catch(() => null)
          if (file && file.exists) return
          mtimeRef.current = null
          setBanner('removed')
        }
      }),
    [slug, kind, load, reload, toast, t]
  )

  useEffect(() => registerFlusher(() => flushRef.current()), [])

  // Cmd/Ctrl+S saves immediately.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 's') {
        ev.preventDefault()
        void flushRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const createMissing = async (): Promise<void> => {
    const e = editorRef.current
    if (!e) return
    if (e.isEmpty) {
      const heading = kind === 'requirements' ? title : `${title} — ${t(`files.${kind}`)}`
      e.commands.setContent(`# ${heading}\n\n${kind === 'tasks' ? '- [ ] \n' : ''}`, { emitUpdate: false })
    }
    await flush(true)
  }

  if (load === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <AlertTriangleIcon className="size-6 text-destructive" />
        <p>{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          <RotateCcwIcon /> {t('common.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-1.5">
        {editor && <Toolbar editor={editor} />}
        <SaveIndicator state={save} />
      </div>

      {banner && (
        <div className="flex items-center gap-3 border-b bg-warning/10 px-4 py-2 text-sm">
          <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-medium">{t(banner === 'conflict' ? 'editor.conflictTitle' : 'editor.removedTitle')}</p>
            <p className="text-xs text-muted-foreground">
              {t(banner === 'conflict' ? 'editor.conflictDescription' : 'editor.removedDescription')}
            </p>
          </div>
          {banner === 'conflict' && (
            <Button size="sm" variant="outline" onClick={() => void reload()}>
              {t('editor.reloadFromDisk')}
            </Button>
          )}
          <Button size="sm" onClick={() => void flush(true)}>
            {t(banner === 'conflict' ? 'editor.keepMine' : 'editor.restore')}
          </Button>
        </div>
      )}

      {load === 'missing' && !banner && (
        <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <FileWarningIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">{t('editor.missingTitle', { file: `${kind}.md` })}</p>
          <p className="text-sm text-muted-foreground">{t('editor.missingDescription')}</p>
          <Button onClick={() => void createMissing()}>{t('editor.createFile', { file: `${kind}.md` })}</Button>
        </div>
      )}

      <div
        className={load === 'missing' && !banner ? 'hidden' : 'min-h-0 flex-1 overflow-y-auto'}
        onClick={(ev) => {
          if (ev.target === ev.currentTarget) editor?.commands.focus('end')
        }}
      >
        {load === 'loading' ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" />
          </div>
        ) : null}
        <EditorContent editor={editor} className={load === 'loading' ? 'hidden' : 'h-full'} />
      </div>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  const { t } = useTranslation()
  const map = {
    saved: { icon: CheckIcon, label: t('editor.saved'), cls: 'text-muted-foreground' },
    dirty: { icon: CircleDotIcon, label: t('editor.unsaved'), cls: 'text-warning' },
    saving: { icon: Loader2Icon, label: t('editor.saving'), cls: 'text-muted-foreground [&_svg]:animate-spin' },
    error: { icon: AlertTriangleIcon, label: t('editor.saveError'), cls: 'text-destructive' }
  }[state]
  return (
    <span className={`ml-auto flex shrink-0 items-center gap-1 text-xs ${map.cls}`}>
      <map.icon className="size-3.5" /> {map.label}
    </span>
  )
}
