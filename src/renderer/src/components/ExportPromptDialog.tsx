import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, ClipboardCopyIcon, ListTodoIcon, Loader2Icon, SkipForwardIcon, XIcon } from 'lucide-react'
import { buildPrompt, estimateTokens, type PromptStrings } from '@shared/prompt'
import { allPendingSelection, descendantsOf, nextPendingSelection, parseTasks, type ParsedTask } from '@shared/tasks'
import type { SpecFile } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { catalogs } from '@/i18n'
import { api, describeError } from '@/lib/api'
import { flushAllEditors } from '@/lib/pending-saves'
import { cn } from '@/lib/utils'
import { useAppStore, useSelectedSpec } from '@/store/app-store'

export function ExportPromptDialog() {
  const open = useAppStore((s) => s.dialog === 'export')
  const setDialog = useAppStore((s) => s.setDialog)
  return (
    <Dialog open={open} onOpenChange={(o) => setDialog(o ? 'export' : null)}>
      <DialogContent className="flex h-[min(85vh,820px)] flex-col gap-4 sm:max-w-6xl">
        {open && <ExportBody />}
      </DialogContent>
    </Dialog>
  )
}

interface Loaded {
  requirements: SpecFile
  design: SpecFile
  tasks: SpecFile
}

function ExportBody() {
  const { t } = useTranslation()
  const spec = useSelectedSpec()
  const language = useAppStore((s) => s.language)
  const toast = useAppStore((s) => s.toast)
  const [files, setFiles] = useState<Loaded | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [includeReq, setIncludeReq] = useState(true)
  const [includeDesign, setIncludeDesign] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!spec) return
    let cancelled = false
    void (async () => {
      try {
        await flushAllEditors() // make sure unsaved edits are on disk first
        const [requirements, design, tasks] = await Promise.all([
          api.spec.read(spec.slug, 'requirements'),
          api.spec.read(spec.slug, 'design'),
          api.spec.read(spec.slug, 'tasks')
        ])
        if (cancelled) return
        setFiles({ requirements, design, tasks })
        setSelected(new Set(nextPendingSelection(parseTasks(tasks.body))))
        setIncludeReq(requirements.exists)
        setIncludeDesign(design.exists)
      } catch (err) {
        toast(describeError(err), 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [spec?.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const tasks = useMemo(() => (files ? parseTasks(files.tasks.body) : []), [files])
  const pending = tasks.filter((x) => !x.checked)
  const visible = showCompleted ? tasks : tasks.filter((x) => !x.checked || hasPendingDescendant(tasks, x))

  const prompt = useMemo(() => {
    if (!spec || !files || selected.size === 0) return ''
    const strings: PromptStrings = catalogs[language].prompt
    return buildPrompt({
      slug: spec.slug,
      title: spec.title,
      status: spec.status,
      requirements: includeReq ? files.requirements.body : null,
      design: includeDesign ? files.design.body : null,
      tasks,
      selectedIds: [...selected],
      lineOffset: files.tasks.bodyLineOffset,
      strings
    })
  }, [spec, files, selected, includeReq, includeDesign, tasks, language])

  if (!spec) return null

  const toggle = (task: ParsedTask, value: boolean): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      // Selecting a parent brings its pending sub-tasks along; deselecting removes them.
      const ids = [task.id, ...descendantsOf(tasks, task.id).filter((d) => !d.checked).map((d) => d.id)]
      for (const id of ids) {
        if (value) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const copy = async (): Promise<void> => {
    try {
      await api.clipboard.write(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (err) {
      toast(describeError(err), 'error')
    }
  }

  const next = nextPendingSelection(tasks)
  const isNextSelection = next.length > 0 && next.length === selected.size && next.every((id) => selected.has(id))
  const isAllSelection = pending.length > 0 && pending.length === selected.size && pending.every((x) => selected.has(x.id))

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('export.title')}</DialogTitle>
        <DialogDescription>
          {t('export.description')} <span className="font-mono">specs/{spec.slug}/</span>
        </DialogDescription>
      </DialogHeader>

      {!files ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,2fr)_3fr] gap-4">
          {/* Left: task selection */}
          <section className="flex min-h-0 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={isNextSelection ? 'default' : 'outline'}
                disabled={next.length === 0}
                onClick={() => setSelected(new Set(next))}
              >
                <SkipForwardIcon /> {t('export.nextTask')}
                <span className="text-[10px] opacity-70">({t('export.recommended')})</span>
              </Button>
              <Button
                size="sm"
                variant={isAllSelection ? 'default' : 'outline'}
                disabled={pending.length === 0}
                onClick={() => setSelected(new Set(allPendingSelection(tasks)))}
              >
                <ListTodoIcon /> {t('export.allPending')} ({pending.length})
              </Button>
              {selected.size > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  <XIcon /> {t('export.clear')}
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium uppercase tracking-wider">
                {t('export.tasks')} · {t('export.selectedCount', { count: selected.size })}
              </span>
              <Label className="text-xs font-normal">
                <Checkbox checked={showCompleted} onCheckedChange={(v) => setShowCompleted(v === true)} />
                {t('export.showCompleted')}
              </Label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
              {tasks.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t('export.noTasks')}</p>}
              {tasks.length > 0 && pending.length === 0 && !showCompleted && (
                <p className="p-4 text-sm text-muted-foreground">{t('export.allDone')}</p>
              )}
              <ul className="py-1">
                {visible.map((task, i) => {
                  const showSection = task.section && task.section !== visible[i - 1]?.section
                  return (
                    <li key={task.id}>
                      {showSection && (
                        <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground">{task.section}</div>
                      )}
                      <label
                        className={cn(
                          'flex items-start gap-2.5 py-1.5 pr-3 text-sm hover:bg-accent/50',
                          task.checked && 'text-muted-foreground line-through'
                        )}
                        style={{ paddingLeft: `${12 + task.depth * 20}px` }}
                      >
                        <Checkbox
                          className="mt-0.5"
                          disabled={task.checked}
                          checked={task.checked || selected.has(task.id)}
                          onCheckedChange={(v) => toggle(task, v === true)}
                        />
                        <span className="flex-1 break-words">{task.text}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          L{task.line + files.tasks.bodyLineOffset}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <Label className="font-normal">
                <Checkbox checked={includeReq} disabled={!files.requirements.exists} onCheckedChange={(v) => setIncludeReq(v === true)} />
                <span className="font-mono text-xs">{t('export.includeRequirements')}</span>
              </Label>
              <Label className="font-normal">
                <Checkbox checked={includeDesign} disabled={!files.design.exists} onCheckedChange={(v) => setIncludeDesign(v === true)} />
                <span className="font-mono text-xs">{t('export.includeDesign')}</span>
              </Label>
            </div>
          </section>

          {/* Right: preview */}
          <section className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{t('export.preview')}</span>
              {prompt && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t('export.stats', { chars: prompt.length.toLocaleString(), tokens: estimateTokens(prompt).toLocaleString() })}
                </span>
              )}
            </div>
            <pre className="min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-5 whitespace-pre-wrap select-text">
              {prompt || <span className="text-muted-foreground">{t('export.selectSomething')}</span>}
            </pre>
            <Button
              size="lg"
              disabled={!prompt}
              onClick={() => void copy()}
              className={cn('transition-colors', copied && 'bg-success hover:bg-success')}
            >
              {copied ? <CheckIcon /> : <ClipboardCopyIcon />}
              {copied ? t('export.copied') : t('export.copy')}
            </Button>
          </section>
        </div>
      )}
    </>
  )
}

function hasPendingDescendant(tasks: readonly ParsedTask[], task: ParsedTask): boolean {
  return descendantsOf(tasks, task.id).some((d) => !d.checked)
}
