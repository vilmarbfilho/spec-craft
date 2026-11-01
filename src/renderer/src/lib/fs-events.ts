import type { FsEvent } from '@shared/types'

type Listener = (event: FsEvent) => void
const listeners = new Set<Listener>()

/** Local pub/sub so components (e.g. open editors) can react to disk changes. */
export function onFsEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function dispatchFsEvent(event: FsEvent): void {
  for (const l of listeners) l(event)
}
