/** Rules for spec module folder names (portable across macOS, Windows and Linux). */

export const SLUG_MIN = 2
export const SLUG_MAX = 64
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const WINDOWS_RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
])

export type SlugError = 'required' | 'tooShort' | 'tooLong' | 'invalidChars' | 'reserved' | 'exists'

/**
 * Validates a module slug. Collisions are checked case-insensitively because
 * the default file systems on macOS and Windows are case-insensitive.
 */
export function validateSlug(slug: string, existing: readonly string[] = []): SlugError | null {
  if (!slug) return 'required'
  if (slug.length < SLUG_MIN) return 'tooShort'
  if (slug.length > SLUG_MAX) return 'tooLong'
  if (!SLUG_RE.test(slug)) return 'invalidChars'
  if (WINDOWS_RESERVED.has(slug)) return 'reserved'
  const lower = slug.toLowerCase()
  if (existing.some((s) => s.toLowerCase() === lower)) return 'exists'
  return null
}

/** Converts arbitrary text (e.g. a title in Portuguese) into a valid slug candidate. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return validateSlug(slug) === null
}
