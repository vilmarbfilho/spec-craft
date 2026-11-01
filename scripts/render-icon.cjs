// Renders build/icon.svg to build/icon.png (1024×1024, transparent) using Electron.
// Usage: npx electron scripts/render-icon.cjs
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const SIZE = 1024
const buildDir = join(__dirname, '..', 'build')

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  const svg = readFileSync(join(buildDir, 'icon.svg'), 'utf8')
  const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  win.webContents.setZoomFactor(1)
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((resolve) => setTimeout(resolve, 300))
  let image = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE })
  if (image.getSize().width !== SIZE) image = image.resize({ width: SIZE, height: SIZE, quality: 'best' })
  writeFileSync(join(buildDir, 'icon.png'), image.toPNG())
  console.log('build/icon.png', image.getSize())
  app.quit()
})
