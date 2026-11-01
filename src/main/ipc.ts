import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell } from 'electron'
import type { IpcArgs, IpcChannel, IpcReturn } from '@shared/ipc'
import { FS_EVENT_CHANNEL } from '@shared/ipc'
import type { FsEvent, IpcResult } from '@shared/types'
import { toErrorShape } from './errors'
import { settingsStore } from './settings-store'
import { SpecService } from './spec-service'
import { SpecsWatcher } from './watcher'

type Handler<C extends IpcChannel> = (...args: IpcArgs<C>) => IpcReturn<C> | Promise<IpcReturn<C>>

/** Registers a typed handler whose errors are returned as data (keeps error codes intact). */
function handle<C extends IpcChannel>(channel: C, fn: Handler<C>): void {
  ipcMain.handle(channel, async (_event, ...args): Promise<IpcResult<IpcReturn<C>>> => {
    try {
      return { ok: true, data: await fn(...(args as IpcArgs<C>)) }
    } catch (err) {
      const shape = toErrorShape(err)
      if (shape.code === 'IO') console.error(`[ipc:${channel}]`, err)
      return { ok: false, error: shape }
    }
  })
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  const service = new SpecService()
  const emit = (event: FsEvent): void => getWindow()?.webContents.send(FS_EVENT_CHANNEL, event)
  const watcher = new SpecsWatcher(service, emit)

  app.on('before-quit', () => void watcher.stop())

  handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    systemLocale: app.getLocale()
  }))

  handle('settings:get', () => settingsStore.get())
  handle('settings:update', (patch) => {
    const next = settingsStore.update(patch)
    nativeTheme.themeSource = next.theme
    return next
  })
  handle('recents:remove', (path) => settingsStore.removeRecent(path))

  handle('project:pick', async () => {
    const win = getWindow()
    const options = { properties: ['openDirectory', 'createDirectory'] } as Electron.OpenDialogOptions
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })
  handle('project:open', async (path) => {
    const state = await service.open(path)
    settingsStore.addRecent(state.root)
    await watcher.start(state.root)
    return state
  })
  handle('project:close', async () => {
    await watcher.stop()
    service.close()
    settingsStore.update({ lastProject: null })
  })
  handle('project:state', () => service.getState())
  handle('project:initSpecs', () => service.initSpecs())
  handle('project:reveal', async (target) => {
    const path = service.resolveRevealPath(target)
    const error = await shell.openPath(path)
    if (error) throw new Error(error)
  })

  handle('spec:read', (slug, kind) => service.readSpecFile(slug, kind))
  handle('spec:write', (input) => service.writeSpecFile(input))
  handle('spec:setStatus', (slug, status) => service.setStatus(slug, status))
  handle('spec:create', (input) => service.createSpec(input))

  handle('templates:list', (language) => service.listTemplates(language))
  handle('templates:eject', (id, name, language) => service.ejectBuiltinTemplate(id, name, language))
  handle('templates:delete', (id) => service.deleteLocalTemplate(id))

  handle('clipboard:write', (text) => clipboard.writeText(String(text)))
}
