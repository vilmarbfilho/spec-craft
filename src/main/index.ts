import { app, BrowserWindow, nativeTheme, session, shell } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { settingsStore } from './settings-store'

let mainWindow: BrowserWindow | null = null
const devServerUrl = process.env['ELECTRON_RENDERER_URL']

/**
 * Enforces the "100% offline" rule: the renderer may only load local
 * resources (and the Vite dev server during development).
 */
function enforceOffline(): void {
  const devOrigin = devServerUrl ? new URL(devServerUrl) : null
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url)
    const local = ['file:', 'devtools:', 'data:', 'blob:', 'chrome-extension:'].includes(url.protocol)
    const dev = devOrigin !== null && url.hostname === devOrigin.hostname && url.port === devOrigin.port
    callback({ cancel: !(local || dev) })
  })
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'SpecCraft',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0b' : '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))

  // Never open new windows or navigate away; external links go to the OS browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!devServerUrl || !url.startsWith(devServerUrl)) event.preventDefault()
  })

  if (devServerUrl) void mainWindow.loadURL(devServerUrl)
  else void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.focus()
  })

  app.whenReady().then(() => {
    settingsStore.load()
    nativeTheme.themeSource = settingsStore.get().theme
    enforceOffline()
    registerIpc(() => mainWindow)
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
