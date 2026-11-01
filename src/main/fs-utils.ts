import { randomBytes } from 'node:crypto'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, isAbsolute } from 'node:path'
import { AppError } from './errors'

/**
 * Writes a file atomically (temp file + rename) so external watchers and
 * editors never observe a half-written file.
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const dir = dirname(filePath)
  await mkdir(dir, { recursive: true })
  const tmp = join(dir, `.${basename(filePath)}.${randomBytes(6).toString('hex')}.tmp`)
  try {
    await writeFile(tmp, content, 'utf8')
    await rename(tmp, filePath)
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => undefined)
    throw err
  }
}

export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

export async function isDirectory(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory()
  } catch {
    return false
  }
}

/** Resolves `segments` under `base` and refuses anything that escapes it (path traversal guard). */
export function safeJoin(base: string, ...segments: string[]): string {
  const target = resolve(base, ...segments)
  const rel = relative(base, target)
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return target
  throw new AppError('INVALID_PATH', `Path escapes project: ${segments.join('/')}`)
}
