import { useTranslation } from 'react-i18next'
import { FileTextIcon, FolderOpenIcon, ListChecksIcon, PenToolIcon, SparklesIcon, TriangleAlertIcon } from 'lucide-react'
import { SPEC_FILE_KINDS, SPEC_STATUSES, type SpecFileKind, type SpecStatus } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SpecDocument } from '@/components/editor/SpecDocument'
import { api, describeError } from '@/lib/api'
import { cn, formatRelative } from '@/lib/utils'
import { useAppStore, useSelectedSpec } from '@/store/app-store'

const TAB_ICONS: Record<SpecFileKind, typeof FileTextIcon> = {
  requirements: FileTextIcon,
  design: PenToolIcon,
  tasks: ListChecksIcon
}

const STATUS_DOT: Record<SpecStatus, string> = {
  draft: 'bg-muted-foreground/60',
  'in-progress': 'bg-warning',
  completed: 'bg-success'
}

export function Workspace() {
  const { t, i18n } = useTranslation()
  const spec = useSelectedSpec()
  const activeTab = useAppStore((s) => s.activeTab)
  const { setTab, setDialog, toast, refreshProject } = useAppStore.getState()

  if (!spec) return null

  const changeStatus = async (status: SpecStatus): Promise<void> => {
    try {
      await api.spec.setStatus(spec.slug, status)
      await refreshProject()
    } catch (err) {
      toast(describeError(err), 'error')
    }
  }

  const { done, total } = spec.progress

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="app-drag flex shrink-0 flex-col gap-3 border-b px-6 pt-4 pb-3">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{spec.title}</h1>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">specs/{spec.slug}/</span>
              <span>·</span>
              <span>{t('workspace.version', { version: spec.version })}</span>
              <span>·</span>
              <span>{t('workspace.updated', { date: formatRelative(spec.updatedAt, i18n.language) })}</span>
            </p>
          </div>
          <div className="app-no-drag flex items-center gap-2">
            <Select value={spec.status} onValueChange={(v) => void changeStatus(v as SpecStatus)}>
              <SelectTrigger size="sm" aria-label={t('workspace.status')} className="min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {SPEC_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className={cn('size-2 rounded-full', STATUS_DOT[s])} />
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon-sm"
              title={t('workspace.reveal')}
              aria-label={t('workspace.reveal')}
              onClick={() => void api.project.reveal({ slug: spec.slug }).catch((e) => toast(describeError(e), 'error'))}
            >
              <FolderOpenIcon />
            </Button>
            <Button size="sm" onClick={() => setDialog('export')}>
              <SparklesIcon /> {t('workspace.exportPrompt')}
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setTab(v as SpecFileKind)}>
          <TabsList className="app-no-drag">
            {SPEC_FILE_KINDS.map((kind) => {
              const Icon = TAB_ICONS[kind]
              return (
                <TabsTrigger key={kind} value={kind} className="px-3 font-mono text-xs">
                  <Icon />
                  {kind}.md
                  {!spec.files[kind] && <TriangleAlertIcon className="!size-3 text-warning" />}
                  {kind === 'tasks' && total > 0 && (
                    <span className="rounded bg-muted px-1 font-sans text-[10px] tabular-nums text-muted-foreground">
                      {done}/{total}
                    </span>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </header>

      <div className="min-h-0 flex-1">
        <SpecDocument key={`${spec.slug}/${activeTab}`} slug={spec.slug} kind={activeTab} title={spec.title} />
      </div>
    </div>
  )
}
