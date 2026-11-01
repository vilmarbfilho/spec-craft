import { useTranslation } from 'react-i18next'
import { FolderOpenIcon, FolderPlusIcon, Loader2Icon, PlusIcon, ScrollTextIcon, WifiOffIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { baseName } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="app-drag h-11 shrink-0" />
      <div className="flex flex-1 items-center justify-center p-8">{children}</div>
    </div>
  )
}

export function WelcomeScreen() {
  const { t } = useTranslation()
  const settings = useAppStore((s) => s.settings)
  const loading = useAppStore((s) => s.projectLoading)
  const { openProject, removeRecent } = useAppStore.getState()
  const recents = settings?.recentProjects ?? []

  return (
    <Shell>
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ScrollTextIcon className="size-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t('welcome.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('welcome.description')}</p>
        </div>
        <Button size="lg" onClick={() => void openProject()} disabled={loading}>
          {loading ? <Loader2Icon className="animate-spin" /> : <FolderOpenIcon />}
          {t('welcome.openFolder')}
        </Button>

        <div className="w-full text-left">
          <h2 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t('welcome.recents')}
          </h2>
          {recents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('welcome.noRecents')}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {recents.map((path) => (
                <li key={path} className="group flex items-center gap-3 px-3 py-2 hover:bg-accent/50">
                  <button className="flex min-w-0 flex-1 flex-col text-left" onClick={() => void openProject(path)}>
                    <span className="truncate text-sm font-medium">{baseName(path)}</span>
                    <span className="truncate font-mono text-[11px] text-muted-foreground">{path}</span>
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100"
                    aria-label={t('common.remove')}
                    onClick={() => void removeRecent(path)}
                  >
                    <XIcon className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <WifiOffIcon className="size-3.5" /> {t('welcome.offline')}
        </p>
      </div>
    </Shell>
  )
}

export function SpecsMissing() {
  const { t } = useTranslation()
  const project = useAppStore((s) => s.project)
  const initSpecs = useAppStore((s) => s.initSpecs)
  return (
    <Shell>
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center">
        <FolderPlusIcon className="size-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t('specsMissing.title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('specsMissing.description', { path: project?.specsDir ?? 'specs/' })}
        </p>
        <Button onClick={() => void initSpecs()}>
          <FolderPlusIcon /> {t('specsMissing.action')}
        </Button>
      </div>
    </Shell>
  )
}

export function NoSelection() {
  const { t } = useTranslation()
  const project = useAppStore((s) => s.project)
  const removedSlug = useAppStore((s) => s.removedSlug)
  const setDialog = useAppStore((s) => s.setDialog)
  const empty = (project?.specs.length ?? 0) === 0
  return (
    <Shell>
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {removedSlug && (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            {t('workspace.moduleRemoved', { slug: removedSlug })}
          </p>
        )}
        <ScrollTextIcon className="size-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{t(empty ? 'workspace.emptyNoSpecs' : 'workspace.empty')}</p>
        <Button variant={empty ? 'default' : 'outline'} onClick={() => setDialog('wizard')}>
          <PlusIcon /> {t('sidebar.newSpec')}
        </Button>
      </div>
    </Shell>
  )
}
