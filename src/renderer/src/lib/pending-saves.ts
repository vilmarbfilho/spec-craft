/** Registry of open editors' flush functions, so other features can save before reading disk. */
const flushers = new Set<() => Promise<void>>()

export function registerFlusher(fn: () => Promise<void>): () => void {
  flushers.add(fn)
  return () => flushers.delete(fn)
}

export async function flushAllEditors(): Promise<void> {
  await Promise.all([...flushers].map((fn) => fn().catch(() => undefined)))
}
