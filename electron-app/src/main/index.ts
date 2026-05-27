import { app, BrowserWindow, shell, globalShortcut, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createTray, destroyTray } from './tray'
import { registerIpcHandlers } from './ipc/window'
import { registerSettingsIpc, getStore } from './ipc/settings'
import { registerCaptureIpc } from './ipc/capture'
import { registerQueueIpc, loadQueue, saveQueue } from './ipc/queue'
import { registerTavilyIpc } from './ipc/tavily'

let isQuitting = false

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

const hotkeyActions = new Map<string, { accelerator: string; enabled: boolean }>()

function registerSingleHotkey(action: string, accelerator: string, mainWindow: BrowserWindow): boolean {
  try {
    const registered = globalShortcut.register(accelerator, () => {
      mainWindow.webContents.send(`hotkey:${action}`, action)
    })
    if (registered) {
      hotkeyActions.set(action, { accelerator, enabled: true })
    }
    return registered
  } catch (e) {
    console.error(`Error registering hotkey ${accelerator}:`, e)
    return false
  }
}

function unregisterSingleHotkey(action: string): void {
  const existing = hotkeyActions.get(action)
  if (existing) {
    globalShortcut.unregister(existing.accelerator)
  }
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
      event.preventDefault()
      isQuitting = true
      destroyTray()
      app.quit()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

async function flushPendingQueue(): Promise<{ flushed: number; remaining: number }> {
  const queue = loadQueue()
  if (queue.length === 0) return { flushed: 0, remaining: 0 }

  const backendUrl = (getStore().get('backendUrl') as string) || 'http://100.70.198.102:8000'
  const remaining: typeof queue = []
  let flushed = 0

  for (const item of queue) {
    try {
      const resp = await fetch(`${backendUrl}/api/stamina/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      })
      if (resp.ok) {
        flushed++
      } else {
        remaining.push(item)
      }
    } catch {
      remaining.push(item)
    }
  }

  saveQueue(remaining)
  return { flushed, remaining: remaining.length }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.lightweight.toolset')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('before-quit', () => {
    isQuitting = true
    destroyTray()
    globalShortcut.unregisterAll()
  })

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

  const captureHk = (getStore().get('captureHotkey') as string) || 'CommandOrControl+Shift+D'
  const chatHk = (getStore().get('chatHotkey') as string) || 'CommandOrControl+Shift+A'
  const captureEnabled = (getStore().get('captureHotkeyEnabled') as boolean) ?? true
  const chatEnabled = (getStore().get('chatHotkeyEnabled') as boolean) ?? true

  if (captureEnabled) registerSingleHotkey('stamina-capture', captureHk, mainWindow)
  else hotkeyActions.set('stamina-capture', { accelerator: captureHk, enabled: false })

  if (chatEnabled) registerSingleHotkey('ai-chat', chatHk, mainWindow)
  else hotkeyActions.set('ai-chat', { accelerator: chatHk, enabled: false })

  ipcMain.handle('hotkey:update', (_event, action: string, accelerator: string) => {
    unregisterSingleHotkey(action)
    const info = hotkeyActions.get(action)
    if (info?.enabled !== false) {
      registerSingleHotkey(action, accelerator, mainWindow)
    } else {
      hotkeyActions.set(action, { accelerator, enabled: false })
    }
  })

  ipcMain.handle('hotkey:set-enabled', (_event, action: string, enabled: boolean) => {
    const info = hotkeyActions.get(action)
    if (enabled) {
      const acc = info?.accelerator || (action === 'stamina-capture' ? 'CommandOrControl+Shift+D' : 'CommandOrControl+Shift+A')
      registerSingleHotkey(action, acc, mainWindow)
    } else {
      unregisterSingleHotkey(action)
      hotkeyActions.set(action, { accelerator: info?.accelerator || '', enabled: false })
    }
  })

  ipcMain.handle('hotkey:disable-all', () => {
    for (const [action] of hotkeyActions) {
      unregisterSingleHotkey(action)
    }
  })

  ipcMain.handle('hotkey:enable-all', () => {
    for (const [action, info] of hotkeyActions) {
      if (info.enabled !== false) {
        registerSingleHotkey(action, info.accelerator, mainWindow)
      }
    }
  })

  ipcMain.handle('hotkey:check-conflict', (_event, accelerator: string, excludeAction: string) => {
    for (const [action, info] of hotkeyActions) {
      if (action === excludeAction) continue
      if (info.accelerator === accelerator) return action
    }
    return null
  })

  registerIpcHandlers(mainWindow)
  registerSettingsIpc()
  registerCaptureIpc()
  registerQueueIpc()
  registerTavilyIpc()

  // queue:flush handler — invoked by renderer after a successful capture
  ipcMain.handle('queue:flush', async () => {
    return flushPendingQueue()
  })

  // Startup flush: attempt to send queued records from a previous (offline) session
  setTimeout(() => {
    flushPendingQueue()
      .then((result) => {
        if (result.flushed > 0) {
          console.log(`[Queue] Startup flush: ${result.flushed} sent, ${result.remaining} remain`)
        }
      })
      .catch((e) => {
        console.error('[Queue] Startup flush error:', e)
      })
  }, 3000)

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
