import type { AppErrorCode, AppErrorShape } from './types'

const PREFIX = '§'

export function encodeError(error: AppErrorShape): string {
  return `${PREFIX}${error.code}${PREFIX}${error.message}`
}

/** Recovers `{ code, message }` from an error that crossed the IPC bridge. */
export function parseAppError(err: unknown): AppErrorShape {
  const raw = err instanceof Error ? err.message : String(err)
  const match = new RegExp(`${PREFIX}([A-Z_]+)${PREFIX}([\\s\\S]*)$`).exec(raw)
  if (match) return { code: match[1] as AppErrorCode, message: match[2] }
  return { code: 'IO', message: raw }
}
