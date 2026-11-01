import { useEffect } from 'react'
import { Loader2Icon } from 'lucide-react'
import { ExportPromptDialog } from '@/components/ExportPromptDialog'
import { NoSelection, SpecsMissing, WelcomeScreen } from '@/components/EmptyStates'
import { NewSpecWizard } from '@/components/NewSpecWizard'
import { SettingsDialog } from '@/components/SettingsDialog'
import { Sidebar } from '@/components/Sidebar'
import { TemplatesDialog } from '@/components/TemplatesDialog'
import { Toaster } from '@/components/Toaster'
import { Workspace } from '@/components/Workspace'
import { useFsSync } from '@/hooks/use-fs-sync'
import { useThemeSync } from '@/hooks/use-theme'
import { useAppStore, useSelectedSpec } from '@/store/app-store'

export default function App() {
  const ready = useAppStore((s) => s.ready)
  const project = useAppStore((s) => s.project)
  const spec = useSelectedSpec()
  const language = useAppStore((s) => s.language)

  useThemeSync()
  useFsSync()

  useEffect(() => {
    void useAppStore.getState().init()
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </div>
    )
  }

  let main: React.ReactNode
  if (!project) main = <WelcomeScreen />
  else if (!project.specsExists) main = <SpecsMissing />
  else if (!spec) main = <NoSelection />
  else main = <Workspace />

  return (
    <div className="flex h-full">
      {project ? <Sidebar /> : null}
      <main className="flex min-w-0 flex-1">{main}</main>
      <NewSpecWizard />
      <ExportPromptDialog />
      <SettingsDialog />
      <TemplatesDialog />
      <Toaster />
    </div>
  )
}
