import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Settings } from '@shared/types'
import { SUPPORTED_LANGUAGES } from '@shared/types'
import { atomicWrite } from './fs-utils'

const MAX_RECENTS = 10

const DEFAULTS: Settings = {
  language: 'system',
  theme: 'system',
  recentProjects: [],
  lastProject: null
}

/**
 * Minimal persistent JSON settings store (an `electron-store` equivalent with
 * no ESM/CJS interop concerns). Stored in the OS user-data directory.
 */
class SettingsStore {
  private data: Settings = { ...DEFAULTS }
  private readonly file = join(app.getPath('userData'), 'settings.json')
  private writeChain: Promise<void> = Promise.resolve()

  load(): void {
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Settings>
      this.data = sanitize({ ...DEFAULTS, ...raw })
    } catch {
      this.data = { ...DEFAULTS }
    }
  }

  get(): Settings {
    return structuredClone(this.data)
  }

  update(patch: Partial<Settings>): Settings {
    this.data = sanitize({ ...this.data, ...patch })
    this.persist()
    return this.get()
  }

  addRecent(projectPath: string): Settings {
    const recents = [projectPath, ...this.data.recentProjects.filter((p) => p !== projectPath)]
    return this.update({ recentProjects: recents.slice(0, MAX_RECENTS), lastProject: projectPath })
  }

  removeRecent(projectPath: string): Settings {
    return this.update({
      recentProjects: this.data.recentProjects.filter((p) => p !== projectPath),
      lastProject: this.data.lastProject === projectPath ? null : this.data.lastProject
    })
  }

  private persist(): void {
    const snapshot = JSON.stringify(this.data, null, 2)
    // Serialize writes so concurrent updates never interleave on disk.
    this.writeChain = this.writeChain
      .then(() => atomicWrite(this.file, snapshot))
      .catch((err) => console.error('[settings] failed to persist', err))
  }
}

function sanitize(s: Settings): Settings {
  const languages: readonly string[] = ['system', ...SUPPORTED_LANGUAGES]
  return {
    language: languages.includes(s.language) ? s.language : 'system',
    theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : 'system',
    recentProjects: Array.isArray(s.recentProjects)
      ? s.recentProjects.filter((p): p is string => typeof p === 'string').slice(0, MAX_RECENTS)
      : [],
    lastProject: typeof s.lastProject === 'string' ? s.lastProject : null
  }
}

export const settingsStore = new SettingsStore()
