import type { AppErrorCode, AppErrorShape } from '@shared/types'

/** Error type carrying a stable code that survives the IPC boundary. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function toErrorShape(err: unknown): AppErrorShape {
  if (err instanceof AppError) return { code: err.code, message: err.message }
  const nodeErr = err as NodeJS.ErrnoException
  if (nodeErr?.code === 'ENOENT') return { code: 'NOT_FOUND', message: nodeErr.message }
  return { code: 'IO', message: err instanceof Error ? err.message : String(err) }
}
