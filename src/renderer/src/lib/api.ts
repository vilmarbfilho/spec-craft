import { parseAppError } from '@shared/errors'
import type { AppErrorShape } from '@shared/types'
import i18n from '@/i18n'

/** Typed bridge to the main process (see src/preload/index.ts). */
export const api = window.api

export { parseAppError }

/** Human-friendly, localized message for an error coming from the bridge. */
export function describeError(err: unknown): string {
  const { code, message }: AppErrorShape = parseAppError(err)
  return code === 'IO' ? i18n.t('errors.IO', { message }) : i18n.t(`errors.${code}`)
}
