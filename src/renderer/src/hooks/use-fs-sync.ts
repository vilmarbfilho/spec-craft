import { useEffect } from 'react'
import { api } from '@/lib/api'
import { dispatchFsEvent } from '@/lib/fs-events'
import { useAppStore } from '@/store/app-store'

/** Bridges main-process watcher events into the store and local listeners. */
export function useFsSync(): void {
  useEffect(() => {
    return api.onFsEvent((event) => {
      if (event.type === 'specs-changed') void useAppStore.getState().refreshProject()
      dispatchFsEvent(event)
    })
  }, [])
}
