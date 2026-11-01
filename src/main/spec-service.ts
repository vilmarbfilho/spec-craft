import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { composeDocument, nowIso, parseFrontmatter, splitFrontmatter } from '@shared/frontmatter'
import { validateSlug } from '@shared/slug'
import { computeProgress } from '@shared/tasks'
import {
  SPEC_FILE_KINDS,
  SPEC_STATUSES,
  SPECS_DIR,
  TEMPLATES_DIR,
  type CreateSpecInput,
  type Language,
  type ProjectState,
  type SpecFile,
  type SpecFileKind,
  type SpecFrontmatter,
  type SpecStatus,
  type SpecSummary,
  type TemplateInfo,
  type WriteResult,
  type WriteSpecFileInput
} from '@shared/types'
import { BUILTIN_TEMPLATES, EMPTY_FILE_BODIES, renderTemplate } from './builtin-templates'
import { AppError } from './errors'
import { atomicWrite, isDirectory, pathExists, safeJoin } from './fs-utils'

const DEFAULT_VERSION = '1.0.0'
const TEMPLATE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/

function isSpecStatus(value: unknown): value is SpecStatus {
  return typeof value === 'string' && (SPEC_STATUSES as readonly string[]).includes(value)
}

function isSpecFileKind(value: unknown): value is SpecFileKind {
  return typeof value === 'string' && (SPEC_FILE_KINDS as readonly string[]).includes(value)
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

/**
 * Owns the currently opened project. All disk access for specs goes through
 * this class; inputs coming from the renderer are validated here.
 */
export class SpecService {
  private root: string | null = null
  /** Last content written by the app per absolute path — used to ignore our own watcher events. */
  private readonly selfWrites = new Map<string, string>()

  get projectRoot(): string | null {
    return this.root
  }

  get specsDir(): string | null {
    return this.root ? join(this.root, SPECS_DIR) : null
  }

  // ---------------------------------------------------------------- project

  async open(root: string): Promise<ProjectState> {
    const abs = resolve(root)
    if (!(await isDirectory(abs))) throw new AppError('NOT_FOUND', `Folder not found: ${abs}`)
    this.root = abs
    this.selfWrites.clear()
    return this.getState()
  }

  close(): void {
    this.root = null
    this.selfWrites.clear()
  }

  async getState(): Promise<ProjectState> {
    const root = this.requireRoot()
    const specsDir = join(root, SPECS_DIR)
    const specsExists = await isDirectory(specsDir)
    return {
      root,
      name: basename(root),
      specsDir,
      specsExists,
      specs: specsExists ? await this.listSpecs(specsDir) : []
    }
  }

  async initSpecs(): Promise<ProjectState> {
    const root = this.requireRoot()
    await mkdir(join(root, SPECS_DIR), { recursive: true })
    return this.getState()
  }

  private async listSpecs(specsDir: string): Promise<SpecSummary[]> {
    const entries = await readdir(specsDir, { withFileTypes: true })
    const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    const summaries = await Promise.all(
      dirs.map((d) => this.summarize(d.name).catch(() => null))
    )
    return summaries
      .filter((s): s is SpecSummary => s !== null)
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  private async summarize(slug: string): Promise<SpecSummary | null> {
    const dir = join(this.requireSpecsDir(), slug)
    const contents = await Promise.all(
      SPEC_FILE_KINDS.map((k) => readIfExists(join(dir, `${k}.md`)))
    )
    // Folders without any of the three files are not spec modules.
    if (contents.every((c) => c === null)) return null

    const files = Object.fromEntries(
      SPEC_FILE_KINDS.map((k, i) => [k, contents[i] !== null])
    ) as Record<SpecFileKind, boolean>
    const metas = contents.map((c) => (c === null ? null : parseFrontmatter(c).data))
    // requirements.md is the primary metadata source, then design.md, then tasks.md.
    const pick = <T>(key: string, guard: (v: unknown) => v is T): T | undefined => {
      for (const meta of metas) if (meta && guard(meta[key])) return meta[key] as T
      return undefined
    }
    const isString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
    const tasks = contents[2]

    return {
      slug,
      title: pick('title', isString) ?? slug,
      status: pick('status', isSpecStatus) ?? 'draft',
      version: pick('version', isString) ?? DEFAULT_VERSION,
      updatedAt: pick('updated_at', isString) ?? null,
      files,
      progress: tasks ? computeProgress(parseFrontmatter(tasks).body) : { done: 0, total: 0 }
    }
  }

  // ------------------------------------------------------------------ files

  async readSpecFile(slug: string, kind: SpecFileKind): Promise<SpecFile> {
    const path = this.filePath(slug, kind)
    const raw = await readIfExists(path)
    if (raw === null) {
      return { slug, kind, exists: false, frontmatter: null, body: '', bodyLineOffset: 0, mtimeMs: null }
    }
    const { mtimeMs } = await stat(path)
    const { data, body } = parseFrontmatter(raw)
    return {
      slug,
      kind,
      exists: true,
      frontmatter: data as Partial<SpecFrontmatter> | null,
      body,
      bodyLineOffset: lineOffsetOf(raw, body),
      mtimeMs
    }
  }

  async writeSpecFile(input: WriteSpecFileInput): Promise<WriteResult> {
    const { slug, kind, body } = input
    const path = this.filePath(slug, kind)
    const current = await readIfExists(path)
    const currentMtime = current !== null ? (await stat(path)).mtimeMs : null

    if (!input.force) {
      const changedOnDisk =
        input.expectedMtimeMs === null
          ? current !== null
          : currentMtime === null || Math.trunc(currentMtime) !== Math.trunc(input.expectedMtimeMs)
      // A changed mtime alone is not a conflict if the body is identical (e.g. `touch`).
      if (changedOnDisk && (current === null || parseFrontmatter(current).body.trim() !== body.trim())) {
        throw new AppError('CONFLICT', `${slug}/${kind}.md changed on disk`)
      }
    }

    const yaml = current !== null ? splitFrontmatter(current).yaml : null
    const defaults = yaml === null ? await this.defaultFrontmatter(slug) : {}
    const content = composeDocument(yaml, { ...defaults, updated_at: nowIso() }, body)
    await this.write(path, content)
    return { mtimeMs: (await stat(path)).mtimeMs }
  }

  /** Updates the status in every existing file of the module so metadata stays consistent. */
  async setStatus(slug: string, status: SpecStatus): Promise<void> {
    if (!isSpecStatus(status)) throw new AppError('IO', `Invalid status: ${String(status)}`)
    let touched = 0
    for (const kind of SPEC_FILE_KINDS) {
      const path = this.filePath(slug, kind)
      const current = await readIfExists(path)
      if (current === null) continue
      const { yaml, body } = splitFrontmatter(current)
      const defaults = yaml === null ? await this.defaultFrontmatter(slug) : {}
      await this.write(path, composeDocument(yaml, { ...defaults, status, updated_at: nowIso() }, body))
      touched++
    }
    if (touched === 0) throw new AppError('NOT_FOUND', `Module not found: ${slug}`)
  }

  async createSpec(input: CreateSpecInput): Promise<SpecSummary> {
    const specsDir = this.requireSpecsDir()
    if (!(await isDirectory(specsDir))) throw new AppError('SPECS_MISSING', 'specs/ folder does not exist')

    const title = input.title.trim()
    const existing = (await readdir(specsDir, { withFileTypes: true })).map((e) => e.name)
    const slugError = validateSlug(input.slug, existing)
    if (slugError === 'exists') throw new AppError('MODULE_EXISTS', `Module already exists: ${input.slug}`)
    if (slugError) throw new AppError('INVALID_SLUG', `Invalid module name (${slugError})`)
    if (!title) throw new AppError('IO', 'Title is required')

    const bodies = await this.loadTemplateBodies(input.templateId, input.language)
    const dir = safeJoin(specsDir, input.slug)
    const now = nowIso()
    const vars = {
      module: input.slug,
      title,
      date: now.slice(0, 10),
      requirements: input.requirements.map((r) => r.trim()).filter(Boolean)
    }
    const meta: SpecFrontmatter = {
      module: input.slug,
      title,
      status: 'draft',
      version: DEFAULT_VERSION,
      updated_at: now
    }

    await mkdir(dir, { recursive: false })
    try {
      for (const kind of SPEC_FILE_KINDS) {
        const { yaml, body } = bodies[kind]
        await this.write(join(dir, `${kind}.md`), composeDocument(yaml, meta, renderTemplate(body, vars)))
      }
    } catch (err) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined)
      throw err
    }
    const summary = await this.summarize(input.slug)
    if (!summary) throw new AppError('IO', 'Failed to create module')
    return summary
  }

  // -------------------------------------------------------------- templates

  async listTemplates(language: Language): Promise<TemplateInfo[]> {
    const builtins: TemplateInfo[] = BUILTIN_TEMPLATES.map((t) => ({
      id: `builtin:${t.name}`,
      name: t.name,
      source: 'builtin',
      description: t.description[language],
      files: { requirements: true, design: true, tasks: true }
    }))
    const dir = this.templatesDir()
    if (!dir || !(await isDirectory(dir))) return builtins

    const entries = await readdir(dir, { withFileTypes: true })
    const locals = await Promise.all(
      entries
        .filter((e) => e.isDirectory() && TEMPLATE_NAME_RE.test(e.name))
        .map(async (e): Promise<TemplateInfo | null> => {
          const files = Object.fromEntries(
            await Promise.all(
              SPEC_FILE_KINDS.map(async (k) => [k, await pathExists(join(dir, e.name, `${k}.template.md`))])
            )
          ) as Record<SpecFileKind, boolean>
          if (!Object.values(files).some(Boolean)) return null
          return { id: `local:${e.name}`, name: e.name, source: 'local', description: '', files }
        })
    )
    return [...locals.filter((t): t is TemplateInfo => t !== null), ...builtins]
  }

  /** Copies a built-in template into `specs/.templates/<name>/` so it can be customized. */
  async ejectBuiltinTemplate(builtinId: string, name: string, language: Language): Promise<void> {
    const builtin = BUILTIN_TEMPLATES.find((t) => `builtin:${t.name}` === builtinId)
    if (!builtin) throw new AppError('INVALID_TEMPLATE', `Unknown template: ${builtinId}`)
    if (!TEMPLATE_NAME_RE.test(name)) throw new AppError('INVALID_SLUG', `Invalid template name: ${name}`)
    if (!(await isDirectory(this.requireSpecsDir()))) throw new AppError('SPECS_MISSING', 'specs/ folder does not exist')
    const target = safeJoin(this.requireTemplatesDir(), name)
    if (await pathExists(target)) throw new AppError('MODULE_EXISTS', `Template already exists: ${name}`)
    await mkdir(target, { recursive: true })
    for (const kind of SPEC_FILE_KINDS) {
      await this.write(join(target, `${kind}.template.md`), builtin.files[language][kind])
    }
  }

  async deleteLocalTemplate(templateId: string): Promise<void> {
    const name = templateId.startsWith('local:') ? templateId.slice('local:'.length) : ''
    if (!TEMPLATE_NAME_RE.test(name)) throw new AppError('INVALID_TEMPLATE', `Not a local template: ${templateId}`)
    await rm(safeJoin(this.requireTemplatesDir(), name), { recursive: true, force: true })
  }

  /** Absolute path of a module or template folder, for "reveal in file manager". */
  resolveRevealPath(target: { slug?: string; templates?: boolean }): string {
    if (target.templates) return this.requireTemplatesDir()
    if (target.slug) return this.moduleDir(target.slug)
    return this.requireSpecsDir()
  }

  private async loadTemplateBodies(
    templateId: string,
    language: Language
  ): Promise<Record<SpecFileKind, { yaml: string | null; body: string }>> {
    if (templateId.startsWith('builtin:')) {
      const builtin = BUILTIN_TEMPLATES.find((t) => `builtin:${t.name}` === templateId)
      if (!builtin) throw new AppError('INVALID_TEMPLATE', `Unknown template: ${templateId}`)
      const files = builtin.files[language]
      return {
        requirements: { yaml: null, body: files.requirements },
        design: { yaml: null, body: files.design },
        tasks: { yaml: null, body: files.tasks }
      }
    }
    if (templateId.startsWith('local:')) {
      const name = templateId.slice('local:'.length)
      if (!TEMPLATE_NAME_RE.test(name)) throw new AppError('INVALID_TEMPLATE', `Invalid template: ${templateId}`)
      const dir = safeJoin(this.requireTemplatesDir(), name)
      const result = {} as Record<SpecFileKind, { yaml: string | null; body: string }>
      for (const kind of SPEC_FILE_KINDS) {
        const raw = await readIfExists(join(dir, `${kind}.template.md`))
        result[kind] = raw === null ? { yaml: null, body: EMPTY_FILE_BODIES[kind] } : splitFrontmatter(raw)
      }
      return result
    }
    throw new AppError('INVALID_TEMPLATE', `Unknown template: ${templateId}`)
  }

  // ---------------------------------------------------------------- watcher

  /** True when `content` at `path` is exactly what this app last wrote there. */
  isSelfWrite(path: string, content: string): boolean {
    return this.selfWrites.get(path) === content
  }

  forgetSelfWrite(path: string): void {
    this.selfWrites.delete(path)
  }

  // ---------------------------------------------------------------- helpers

  private async write(path: string, content: string): Promise<void> {
    this.selfWrites.set(path, content)
    try {
      await atomicWrite(path, content)
    } catch (err) {
      this.selfWrites.delete(path)
      throw err
    }
  }

  /** Frontmatter for a file that has none, derived from its sibling files. */
  private async defaultFrontmatter(slug: string): Promise<Omit<SpecFrontmatter, 'updated_at'>> {
    const summary = await this.summarize(slug).catch(() => null)
    return {
      module: slug,
      title: summary?.title ?? slug,
      status: summary?.status ?? 'draft',
      version: summary?.version ?? DEFAULT_VERSION
    }
  }

  private requireRoot(): string {
    if (!this.root) throw new AppError('NO_PROJECT', 'No project is open')
    return this.root
  }

  private requireSpecsDir(): string {
    return join(this.requireRoot(), SPECS_DIR)
  }

  private templatesDir(): string | null {
    return this.root ? join(this.root, SPECS_DIR, TEMPLATES_DIR) : null
  }

  private requireTemplatesDir(): string {
    return join(this.requireSpecsDir(), TEMPLATES_DIR)
  }

  private moduleDir(slug: string): string {
    if (validateSlug(slug) !== null && !/^[^./\\][^/\\]*$/.test(slug)) {
      throw new AppError('INVALID_SLUG', `Invalid module: ${slug}`)
    }
    return safeJoin(this.requireSpecsDir(), slug)
  }

  private filePath(slug: string, kind: SpecFileKind): string {
    if (!isSpecFileKind(kind)) throw new AppError('INVALID_PATH', `Invalid file kind: ${String(kind)}`)
    return join(this.moduleDir(slug), `${kind}.md`)
  }
}

/** Number of lines that precede `body` inside `raw`. */
function lineOffsetOf(raw: string, body: string): number {
  const prefix = raw.slice(0, raw.length - body.length)
  return prefix.length === 0 ? 0 : prefix.split(/\r?\n/).length - 1
}
