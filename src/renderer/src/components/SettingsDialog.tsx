import { useTranslation } from 'react-i18next'
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import type { LanguagePreference, ThemePreference } from '@shared/types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'

const LANGUAGES: { value: LanguagePreference; label?: string }[] = [
  { value: 'system' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' }
]

export function SettingsDialog() {
  const { t } = useTranslation()
  const open = useAppStore((s) => s.dialog === 'settings')
  const settings = useAppStore((s) => s.settings)
  const appInfo = useAppStore((s) => s.appInfo)
  const { setDialog, updateSettings } = useAppStore.getState()

  const themes: { value: ThemePreference; icon: typeof SunIcon; label: string }[] = [
    { value: 'system', icon: MonitorIcon, label: t('settings.themeSystem') },
    { value: 'light', icon: SunIcon, label: t('settings.themeLight') },
    { value: 'dark', icon: MoonIcon, label: t('settings.themeDark') }
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => setDialog(o ? 'settings' : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription>{t('settings.about', { version: appInfo?.version ?? '' })}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label>{t('settings.language')}</Label>
          <Select
            value={settings?.language ?? 'system'}
            onValueChange={(v) => void updateSettings({ language: v as LanguagePreference })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label ?? t('settings.languageSystem')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>{t('settings.theme')}</Label>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {themes.map(({ value, icon: Icon, label }) => {
              const active = (settings?.theme ?? 'system') === value
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => void updateSettings({ theme: value })}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors hover:bg-accent',
                    active && 'border-primary bg-primary/5 text-primary'
                  )}
                >
                  <Icon className="size-5" />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
