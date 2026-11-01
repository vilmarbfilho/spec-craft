import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { FS_EVENT_CHANNEL, type IpcArgs, type IpcChannel, type IpcReturn } from '@shared/ipc'
import { encodeError } from '@shared/errors'
import type { FsEvent, IpcResult } from '@shared/types'

async function invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcReturn<C>> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<IpcReturn<C>>
  if (result.ok) return result.data
  // contextBridge only preserves an Error's message, so the code is encoded into it
  // (decoded by `parseAppError` in the renderer).
  throw new Error(encodeError(result.error))
}

const api = {
  app: {
    info: () => invoke('app:info')
  },
  settings: {
    get: () => invoke('settings:get'),
    update: (patch: IpcArgs<'settings:update'>[0]) => invoke('settings:update', patch),
    removeRecent: (path: string) => invoke('recents:remove', path)
  },
  project: {
    pick: () => invoke('project:pick'),
    open: (path: string) => invoke('project:open', path),
    close: () => invoke('project:close'),
    state: () => invoke('project:state'),
    initSpecs: () => invoke('project:initSpecs'),
    reveal: (target: IpcArgs<'project:reveal'>[0]) => invoke('project:reveal', target)
  },
  spec: {
    read: (...args: IpcArgs<'spec:read'>) => invoke('spec:read', ...args),
    write: (input: IpcArgs<'spec:write'>[0]) => invoke('spec:write', input),
    setStatus: (...args: IpcArgs<'spec:setStatus'>) => invoke('spec:setStatus', ...args),
    create: (input: IpcArgs<'spec:create'>[0]) => invoke('spec:create', input)
  },
  templates: {
    list: (...args: IpcArgs<'templates:list'>) => invoke('templates:list', ...args),
    eject: (...args: IpcArgs<'templates:eject'>) => invoke('templates:eject', ...args),
    remove: (...args: IpcArgs<'templates:delete'>) => invoke('templates:delete', ...args)
  },
  clipboard: {
    write: (text: string) => invoke('clipboard:write', text)
  },
  /** Subscribes to file-system events; returns an unsubscribe function. */
  onFsEvent: (listener: (event: FsEvent) => void): (() => void) => {
    const wrapped = (_e: IpcRendererEvent, event: FsEvent): void => listener(event)
    ipcRenderer.on(FS_EVENT_CHANNEL, wrapped)
    return () => ipcRenderer.removeListener(FS_EVENT_CHANNEL, wrapped)
  }
}

export type SpecCraftApi = typeof api

contextBridge.exposeInMainWorld('api', api)
