import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createTray, destroyTray } from './tray'
import { registerIpcHandlers } from './ipc/window'
import { registerSettingsIpc, getStore } from './ipc/settings'
import { registerCaptureIpc } from './ipc/capture'

let isQuitting = false

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

function createWindow(): BrowserWindow {
  const storedTitle = (getStore().get('windowTitle') as string) || '轻量化工具集'

  const mainWindow = new BrowserWindow({
    width: 676,
    height: 444,
    minWidth: 676,
    minHeight: 444,
    maxWidth: 676,
    maxHeight: 444,
    resizable: false,
    frame: false,
    show: false,
    icon: join(__dirname, '../../resources/tray-icon.png'),
    title: storedTitle,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) return

    const closeBehavior = getStore().get('closeBehavior', 'quit') as string
    if (closeBehavior === 'tray') {
      event.preventDefault()
      mainWindow.hide()
    } else {
      // 'quit' mode: destroy tray, then quit
      isQuitting = true
      destroyTray()
      // Let the window close — will trigger window-all-closed
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.lightweight.toolset')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('before-quit', () => {
    isQuitting = true
    destroyTray()
  })

  // Focus existing instance when second launch attempted
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  const mainWindow = createWindow()
  createTray(mainWindow)

  registerIpcHandlers(mainWindow)
  registerSettingsIpc()
  registerCaptureIpc()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

export {}
