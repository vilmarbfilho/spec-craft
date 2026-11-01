import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderClosedIcon,
  FolderOpenIcon,
  HistoryIcon,
  LayoutTemplateIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  XIcon
} from 'lucide-react'
import { SPEC_STATUSES, type SpecStatus, type SpecSummary } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { baseName, cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'

const STATUS_DOT: Record<SpecStatus, string> = {
  draft: 'bg-muted-foreground/50',
  'in-progress': 'bg-warning',
  completed: 'bg-success'
}

export function Sidebar() {
  const { t } = useTranslation()
  const project = useAppStore((s) => s.project)
  const settings = useAppStore((s) => s.settings)
  const appInfo = useAppStore((s) => s.appInfo)
  const { openProject, closeProject, removeRecent, setDialog } = useAppStore.getState()
  const [filter, setFilter] = useState('')
  const [collapsed, setCollapsed] = useState<Record<SpecStatus, boolean>>({
    draft: false,
    'in-progress': false,
    completed: false
  })

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const specs = (project?.specs ?? []).filter(
      (s) => !q || s.title.toLowerCase().includes(q) || s.slug.includes(q)
    )
    return SPEC_STATUSES.map((status) => ({ status, specs: specs.filter((s) => s.status === status) }))
  }, [project, filter])

  const recents = (settings?.recentProjects ?? []).filter((p) => p !== project?.root)
  const canCreate = Boolean(project?.specsExists)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-sidebar">
      {/* Title-bar spacer for macOS traffic lights */}
      <div className={cn('app-drag shrink-0', appInfo?.platform === 'darwin' ? 'h-11' : 'h-2')} />

      <div className="flex flex-col gap-2 px-3 pb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="app-no-drag flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent">
              <FolderOpenIcon className="size-4 text-primary" />
              <span className="flex-1 truncate text-sm font-semibold">
                {project?.name ?? t('sidebar.openProject')}
              </span>
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onSelect={() => void openProject()}>
              <FolderOpenIcon /> {t('sidebar.openProject')}
            </DropdownMenuItem>
            {recents.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-1.5">
                  <HistoryIcon className="size-3" /> {t('sidebar.recents')}
                </DropdownMenuLabel>
                {recents.map((path) => (
                  <DropdownMenuItem key={path} onSelect={() => void openProject(path)} className="group" title={path}>
                    <FolderClosedIcon />
                    <span className="flex-1 truncate">{baseName(path)}</span>
                    <span
                      role="button"
                      aria-label={t('common.remove')}
                      className="opacity-0 group-focus:opacity-60 hover:!opacity-100"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        void removeRecent(path)
                      }}
                    >
                      <XIcon className="size-3.5" />
                    </span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {project && (
              <>
                <DropdownMenuSeparator />
                {project.specsExists && (
                  <DropdownMenuItem onSelect={() => void api.project.reveal({})}>
                    <FolderClosedIcon /> {t('sidebar.revealSpecs')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => void closeProject()}>
                  <XIcon /> {t('sidebar.closeProject')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {project && (
          <Button className="app-no-drag w-full" disabled={!canCreate} onClick={() => setDialog('wizard')}>
            <PlusIcon /> {t('sidebar.newSpec')}
          </Button>
        )}

        {project && project.specs.length > 4 && (
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('sidebar.filter')}
              className="h-8 pl-8 text-xs"
            />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {project?.specsExists && project.specs.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t('sidebar.noSpecs')}</p>
        )}
        {project?.specsExists &&
          groups.map(({ status, specs }) =>
            specs.length === 0 ? null : (
              <section key={status} className="mb-2">
                <button
                  className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
                  onClick={() => setCollapsed((c) => ({ ...c, [status]: !c[status] }))}
                >
                  {collapsed[status] ? <ChevronRightIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
                  <span className={cn('size-1.5 rounded-full', STATUS_DOT[status])} />
                  {t(`status.${status}`)}
                  <span className="ml-auto font-normal tabular-nums">{specs.length}</span>
                </button>
                {!collapsed[status] && (
                  <ul className="mt-0.5 flex flex-col gap-0.5">
                    {specs.map((spec) => (
                      <SpecItem key={spec.slug} spec={spec} />
                    ))}
                  </ul>
                )}
              </section>
            )
          )}
      </nav>

      <footer className="flex items-center gap-1 border-t px-2 py-2">
        <Button variant="ghost" size="sm" className="flex-1 justify-start" onClick={() => setDialog('settings')}>
          <SettingsIcon /> {t('sidebar.settings')}
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 justify-start" onClick={() => setDialog('templates')}>
          <LayoutTemplateIcon /> {t('sidebar.templates')}
        </Button>
      </footer>
    </aside>
  )
}

function SpecItem({ spec }: { spec: SpecSummary }) {
  const { t } = useTranslation()
  const selected = useAppStore((s) => s.selectedSlug === spec.slug)
  const select = useAppStore((s) => s.select)
  const { done, total } = spec.progress
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <li>
      <button
        onClick={() => select(spec.slug)}
        className={cn(
          'flex w-full flex-col gap-1.5 rounded-md px-3 py-2 text-left transition-colors',
          selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
        )}
      >
        <div className="flex w-full items-center gap-2">
          <span className="flex-1 truncate text-sm font-medium">{spec.title}</span>
          {total > 0 && <span className="text-[11px] text-muted-foreground tabular-nums">{pct}%</span>}
        </div>
        <div className="flex w-full items-center gap-2">
          <span className="truncate font-mono text-[11px] text-muted-foreground">{spec.slug}</span>
        </div>
        <div className="flex w-full items-center gap-2">
          <Progress
            value={pct}
            className="h-1 flex-1"
            indicatorClassName={pct === 100 ? 'bg-success' : undefined}
          />
          <span className="text-[10px] whitespace-nowrap text-muted-foreground tabular-nums">
            {total > 0 ? t('sidebar.tasksProgress', { done, total }) : t('sidebar.noTasks')}
          </span>
        </div>
      </button>
    </li>
  )
}
