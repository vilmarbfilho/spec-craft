import { watch, type FSWatcher } from 'chokidar'
import { readFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { SPEC_FILE_KINDS, SPECS_DIR, type FsEvent, type SpecFileKind } from '@shared/types'
import type { SpecService } from './spec-service'

const DEBOUNCE_MS = 150

type RawEvent = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'

/**
 * Watches `<project>/specs` (including its creation/removal) and emits
 * coalesced, de-duplicated events. Writes performed by the app itself are
 * recognized by content and not reported as external changes.
 */
export class SpecsWatcher {
  private watcher: FSWatcher | null = null
  private timer: NodeJS.Timeout | null = null
  private pending = new Map<string, RawEvent>()

  constructor(
    private readonly service: SpecService,
    private readonly emit: (event: FsEvent) => void
  ) {}

  async start(root: string): Promise<void> {
    await this.stop()
    const specsDir = join(root, SPECS_DIR)
    this.watcher = watch(root, {
      ignoreInitial: true,
      depth: 3,
      // Only the project root itself and anything under specs/ are relevant.
      ignored: (path: string) =>
        !(path === root || path === specsDir || path.startsWith(specsDir + sep)),
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 }
    })
    const watcher = this.watcher
    watcher.on('all', (event, path) => this.queue(event as RawEvent, path))
    watcher.on('error', (err) => console.error('[watcher]', err))
    // Resolve only once the initial scan is done; events before that are lost
    // (noticeably on Windows, where the scan is slower).
    await new Promise<void>((resolve) => watcher.once('ready', () => resolve()))
  }

  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.pending.clear()
    const w = this.watcher
    this.watcher = null
    if (w) await w.close()
  }

  private queue(event: RawEvent, path: string): void {
    // Ignore our own temporary files used for atomic writes.
    if (/\.tmp$/.test(path)) return
    this.pending.set(path, event)
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), DEBOUNCE_MS)
  }

  private async flush(): Promise<void> {
    const batch = this.pending
    this.pending = new Map()
    this.timer = null
    const specsDir = this.service.specsDir
    if (!specsDir) return

    const events: FsEvent[] = []
    for (const [path, event] of batch) {
      const target = parseSpecFile(specsDir, path)
      if (!target) continue
      if (event === 'unlink') {
        this.service.forgetSelfWrite(path)
        events.push({ type: 'file-removed', ...target })
      } else if (event === 'add' || event === 'change') {
        const content = await readFile(path, 'utf8').catch(() => null)
        if (content === null || this.service.isSelfWrite(path, content)) continue
        events.push({ type: 'file-changed', ...target })
      }
    }
    // Any change may affect the sidebar (titles, statuses, progress, new/removed modules).
    this.emit({ type: 'specs-changed' })
    for (const e of events) this.emit(e)
  }
}

function parseSpecFile(specsDir: string, path: string): { slug: string; kind: SpecFileKind } | null {
  const parts = relative(specsDir, path).split(sep)
  if (parts.length !== 2 || parts[0].startsWith('.')) return null
  const match = /^(.+)\.md$/.exec(parts[1])
  if (!match || !(SPEC_FILE_KINDS as readonly string[]).includes(match[1])) return null
  return { slug: parts[0], kind: match[1] as SpecFileKind }
}
