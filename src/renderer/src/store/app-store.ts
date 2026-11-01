import { create } from 'zustand'
import type {
  AppInfo,
  Language,
  ProjectState,
  Settings,
  SpecFileKind,
  SpecSummary
} from '@shared/types'
import { api, describeError } from '@/lib/api'
import i18n, { resolveLanguage } from '@/i18n'

export interface Toast {
  id: number
  message: string
  variant: 'default' | 'success' | 'error'
}

type DialogName = 'wizard' | 'export' | 'settings' | 'templates'

interface AppState {
  ready: boolean
  appInfo: AppInfo | null
  settings: Settings | null
  language: Language
  project: ProjectState | null
  projectLoading: boolean
  selectedSlug: string | null
  activeTab: SpecFileKind
  /** Slug of the selected module when it vanished from disk (shows a notice). */
  removedSlug: string | null
  dialog: DialogName | null
  toasts: Toast[]

  init: () => Promise<void>
  openProject: (path?: string) => Promise<void>
  closeProject: () => Promise<void>
  refreshProject: () => Promise<void>
  initSpecs: () => Promise<void>
  select: (slug: string | null) => void
  setTab: (tab: SpecFileKind) => void
  setDialog: (dialog: DialogName | null) => void
  updateSettings: (patch: Partial<Settings>) => Promise<void>
  removeRecent: (path: string) => Promise<void>
  toast: (message: string, variant?: Toast['variant']) => void
  dismissToast: (id: number) => void
  selectedSpec: () => SpecSummary | null
}

let toastSeq = 0

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  appInfo: null,
  settings: null,
  language: 'en',
  project: null,
  projectLoading: false,
  selectedSlug: null,
  activeTab: 'requirements',
  removedSlug: null,
  dialog: null,
  toasts: [],

  init: async () => {
    const [appInfo, settings] = await Promise.all([api.app.info(), api.settings.get()])
    const language = resolveLanguage(settings.language, appInfo.systemLocale)
    await i18n.changeLanguage(language)
    set({ appInfo, settings, language, ready: true })
    if (settings.lastProject) {
      await get().openProject(settings.lastProject)
    }
  },

  openProject: async (path) => {
    const target = path ?? (await api.project.pick())
    if (!target) return
    set({ projectLoading: true })
    try {
      const project = await api.project.open(target)
      const settings = await api.settings.get()
      set({ project, settings, selectedSlug: project.specs[0]?.slug ?? null, removedSlug: null })
    } catch (err) {
      get().toast(i18n.t('errors.openProject', { message: describeError(err) }), 'error')
      // A stale "last project" (moved/deleted folder) shouldn't be retried at every launch.
      if (get().settings?.lastProject === target) await get().updateSettings({ lastProject: null })
    } finally {
      set({ projectLoading: false })
    }
  },

  closeProject: async () => {
    await api.project.close()
    set({ project: null, selectedSlug: null, removedSlug: null, settings: await api.settings.get() })
  },

  refreshProject: async () => {
    if (!get().project) return
    try {
      const project = await api.project.state()
      const { selectedSlug } = get()
      const stillExists = selectedSlug ? project.specs.some((s) => s.slug === selectedSlug) : true
      set({
        project,
        ...(stillExists ? {} : { selectedSlug: null, removedSlug: selectedSlug })
      })
    } catch (err) {
      get().toast(describeError(err), 'error')
    }
  },

  initSpecs: async () => {
    try {
      set({ project: await api.project.initSpecs() })
    } catch (err) {
      get().toast(describeError(err), 'error')
    }
  },

  select: (slug) => set({ selectedSlug: slug, removedSlug: null }),
  setTab: (tab) => set({ activeTab: tab }),
  setDialog: (dialog) => set({ dialog }),

  updateSettings: async (patch) => {
    const settings = await api.settings.update(patch)
    const systemLocale = get().appInfo?.systemLocale ?? navigator.language
    const language = resolveLanguage(settings.language, systemLocale)
    if (language !== i18n.language) await i18n.changeLanguage(language)
    set({ settings, language })
  },

  removeRecent: async (path) => {
    set({ settings: await api.settings.removeRecent(path) })
  },

  toast: (message, variant = 'default') => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }))
    setTimeout(() => get().dismissToast(id), variant === 'error' ? 6000 : 3000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  selectedSpec: () => {
    const { project, selectedSlug } = get()
    return project?.specs.find((s) => s.slug === selectedSlug) ?? null
  }
}))

/** Reactive selector for the currently selected spec summary. */
export function useSelectedSpec(): SpecSummary | null {
  return useAppStore((s) => s.project?.specs.find((x) => x.slug === s.selectedSlug) ?? null)
}
