/**
 * Types shared between the main process, the preload bridge and the renderer.
 * Everything here must be serializable through Electron's structured clone.
 */

export const SPEC_STATUSES = ['draft', 'in-progress', 'completed'] as const
export type SpecStatus = (typeof SPEC_STATUSES)[number]

export const SPEC_FILE_KINDS = ['requirements', 'design', 'tasks'] as const
export type SpecFileKind = (typeof SPEC_FILE_KINDS)[number]

export const SUPPORTED_LANGUAGES = ['pt-BR', 'en', 'es'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export type LanguagePreference = Language | 'system'
export type ThemePreference = 'system' | 'light' | 'dark'

/** Name of the specs root folder inside a project. */
export const SPECS_DIR = 'specs'
/** Name of the project-local templates folder inside `specs/`. */
export const TEMPLATES_DIR = '.templates'

export interface SpecFrontmatter {
  module: string
  title: string
  status: SpecStatus
  version: string
  updated_at: string
  [key: string]: unknown
}

export interface TaskProgress {
  done: number
  total: number
}

/** Lightweight description of a spec module, used by the sidebar. */
export interface SpecSummary {
  slug: string
  title: string
  status: SpecStatus
  version: string
  updatedAt: string | null
  files: Record<SpecFileKind, boolean>
  progress: TaskProgress
}

export interface ProjectState {
  root: string
  name: string
  specsDir: string
  specsExists: boolean
  specs: SpecSummary[]
}

export interface SpecFile {
  slug: string
  kind: SpecFileKind
  exists: boolean
  /** Parsed frontmatter, or null when the file has none / is missing. */
  frontmatter: Partial<SpecFrontmatter> | null
  /** Markdown body without the frontmatter block. */
  body: string
  /** Number of lines occupied by the frontmatter (to map body lines to file lines). */
  bodyLineOffset: number
  /** Modification time used for optimistic concurrency control. */
  mtimeMs: number | null
}

export interface WriteSpecFileInput {
  slug: string
  kind: SpecFileKind
  body: string
  /** mtime observed when the file was last read; null means "file did not exist". */
  expectedMtimeMs: number | null
  /** Overwrite even if the file changed on disk since it was read. */
  force?: boolean
}

export interface WriteResult {
  mtimeMs: number
}

export type TemplateSource = 'builtin' | 'local'

export interface TemplateInfo {
  /** `builtin:<name>` or `local:<folder>` */
  id: string
  name: string
  source: TemplateSource
  description: string
  /** Which of the three template files are present (built-ins always have all). */
  files: Record<SpecFileKind, boolean>
}

export interface CreateSpecInput {
  slug: string
  title: string
  templateId: string
  requirements: string[]
  /** Language used to pick localized built-in templates. */
  language: Language
}

export interface Settings {
  language: LanguagePreference
  theme: ThemePreference
  recentProjects: string[]
  lastProject: string | null
}

export interface AppInfo {
  version: string
  platform: string
  systemLocale: string
}

/** File-system notifications pushed from main to renderer. */
export type FsEvent =
  | { type: 'specs-changed' }
  | { type: 'file-changed'; slug: string; kind: SpecFileKind }
  | { type: 'file-removed'; slug: string; kind: SpecFileKind }

export type AppErrorCode =
  | 'NO_PROJECT'
  | 'SPECS_MISSING'
  | 'INVALID_SLUG'
  | 'MODULE_EXISTS'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_TEMPLATE'
  | 'INVALID_PATH'
  | 'IO'

export interface AppErrorShape {
  code: AppErrorCode
  message: string
}

/** Envelope used by every IPC handler so errors keep their code across the bridge. */
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: AppErrorShape }
