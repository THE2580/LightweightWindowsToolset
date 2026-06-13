import { app, BrowserWindow, shell, globalShortcut, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createTray, destroyTray } from './tray'
import { registerIpcHandlers } from './ipc/window'
import { registerSettingsIpc, getStore, syncAutoStartWithOs } from './ipc/settings'
import { registerCaptureIpc } from './ipc/capture'
import { registerQueueIpc, loadQueue, saveQueue } from './ipc/queue'
import { registerBackendIpc } from './ipc/backend'
import { registerPinmanIpc, startPinman, stopPinman, sendCommand, sendCommandFire } from './ipc/pinman'
import { startBackend, stopBackend } from './ipc/backend-process'
import { installMainLogger, registerLogIpc } from './ipc/logs'
import { registerKeyStatsIpc, startKeyStats, stopKeyStats } from './ipc/keystats'
import { registerAppStatsIpc, startAppStats, stopAppStats } from './ipc/appstats'
import { registerUpdaterIpc, scheduleAutoUpdateCheck } from './ipc/updater'
import { registerTimerIpc, stopTimersForDisable, stopTimersForQuit } from './ipc/timer'

let isQuitting = false

installMainLogger()

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

const hotkeyActions = new Map<string, { accelerator: string; enabled: boolean }>()
const disabledTools = new Set<string>()

function registerSingleHotkey(action: string, accelerator: string, mainWindow: BrowserWindow): boolean {
  if (!accelerator) return false
  try {
    const registered = globalShortcut.register(accelerator, () => {
      // Block if tool is disabled
      if (action === 'resource-capture' && disabledTools.has('resource-capture')) return
      if (action === 'window-pinner' && disabledTools.has('window-pinner')) return
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
  if (existing && existing.accelerator) {
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
    maximizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    icon: join(__dirname, '../../resources/icon.png'),
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

  mainWindow.on('maximize', () => {
    mainWindow.unmaximize()
  })

  mainWindow.on('enter-full-screen', () => {
    mainWindow.setFullScreen(false)
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
      const resp = await fetch(`${backendUrl}/api/resource/record`, {
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
  syncAutoStartWithOs()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('before-quit', () => {
    isQuitting = true
    // Unpin all windows before quitting
    try {
      const { ipcMain: ipc } = require('electron')
      stopPinman()
      stopBackend()
      stopKeyStats()
      stopAppStats()
      stopTimersForQuit()
    } catch { /* ok */ }
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

  // Convert stored JSON-array (or legacy +-separated string) to Electron accelerator
  const storedToAccelerator = (stored: string): string => {
    if (!stored) return ''
    if (stored.startsWith('[')) {
      try { const keys: string[] = JSON.parse(stored); return keys.join('+') } catch { return stored }
    }
    return stored // backward compat: old +-separated format
  }

  const captureHk = storedToAccelerator((getStore().get('captureHotkey') as string) || '')
  const chatHk = storedToAccelerator((getStore().get('chatHotkey') as string) || '')
  const pinnerHk = storedToAccelerator((getStore().get('pinnerHotkey') as string) || '')
  const captureEnabled = (getStore().get('captureHotkeyEnabled') as boolean) ?? true
  const chatEnabled = (getStore().get('chatHotkeyEnabled') as boolean) ?? true

  // Only register if hotkey is non-empty and enabled
  if (captureEnabled && captureHk) registerSingleHotkey('resource-capture', captureHk, mainWindow)
  else hotkeyActions.set('resource-capture', { accelerator: captureHk, enabled: false })

  if (chatEnabled && chatHk) registerSingleHotkey('ai-chat', chatHk, mainWindow)
  else hotkeyActions.set('ai-chat', { accelerator: chatHk, enabled: false })

  const pinnerEnabled = (getStore().get('pinnerHotkeyEnabled') as boolean) ?? true
  hotkeyActions.set('window-pinner', { accelerator: pinnerHk, enabled: pinnerEnabled })

  const getMainWindowHwnd = (): number | null => {
    const hbuf = mainWindow.getNativeWindowHandle()
    if (!hbuf || hbuf.length < 4) return null
    return hbuf.readInt32LE(0) >>> 0
  }

  const initializePinmanForWindow = (): void => {
    setTimeout(async () => {
      if (disabledTools.has('window-pinner')) return
      try {
        const hwnd = getMainWindowHwnd()
        if (hwnd === null) return
        await sendCommand(`CONFIG selfHwnd=${hwnd}`)
        const topmostSelf = (getStore().get('pinnerTopmostSelf') as boolean) ?? false
        await sendCommand(`CONFIG topmostSelf=${topmostSelf ? '1' : '0'}`)
        console.log('[pinman] Self hwnd config sent:', hwnd, 'topmostSelf:', topmostSelf)
      } catch (e) { console.error('[pinman] Self hwnd config failed:', e) }
    }, 1500)

    const autoPin = (getStore().get('pinnerAutoPinApp') as boolean) ?? false
    if (!autoPin) return
    setTimeout(async () => {
      if (disabledTools.has('window-pinner')) return
      try {
        const hwnd = getMainWindowHwnd()
        if (hwnd === null) return
        console.log('[pinman] Auto-pin app window, hwnd:', hwnd)
        await sendCommand(`PIN ${hwnd}`)
      } catch (e) { console.error('[pinman] Auto-pin failed:', e) }
    }, 2000)
  }

  // Tool disable/enable — directly controls hotkey registration
  ipcMain.handle('tool:set-enabled', (_event, toolId: string, enabled: boolean) => {
    if (enabled) {
      disabledTools.delete(toolId)
      // Re-register hotkey if it was previously disabled and settings allow
      if (toolId === 'resource-capture') {
        const info = hotkeyActions.get('resource-capture')
        const enabledFlag = (getStore().get('captureHotkeyEnabled') as boolean) ?? true
        if (enabledFlag && info?.accelerator) {
          registerSingleHotkey('resource-capture', info.accelerator, mainWindow)
        }
        startBackend()
      }
      if (toolId === 'window-pinner') {
        const info = hotkeyActions.get('window-pinner')
        const enabledFlag = (getStore().get('pinnerHotkeyEnabled') as boolean) ?? true
        // Start pinman if not running
        const pinnerHkTemp = (storedToAccelerator((getStore().get('pinnerHotkey') as string) || '')) || 'Alt+P'
        startPinman(mainWindow, pinnerHkTemp)
        initializePinmanForWindow()
        if (enabledFlag && info?.accelerator) {
          sendCommandFire('CONFIG hotkey=' + info.accelerator)
        }
      }
      if (toolId === 'key-counter') startKeyStats()
      if (toolId === 'app-stats') startAppStats()
    } else {
      disabledTools.add(toolId)
      // Unregister tool's hotkey
      if (toolId === 'resource-capture') {
        unregisterSingleHotkey('resource-capture')
        hotkeyActions.set('resource-capture', {
          accelerator: hotkeyActions.get('resource-capture')?.accelerator || '',
          enabled: false
        })
        stopBackend()
      }
      if (toolId === 'window-pinner') {
        hotkeyActions.set('window-pinner', {
          accelerator: hotkeyActions.get('window-pinner')?.accelerator || '',
          enabled: false
        })
        // Fully stop pinman — kill process, free ~3-5MB
        stopPinman()
      }
      if (toolId === 'key-counter') stopKeyStats()
      if (toolId === 'app-stats') stopAppStats()
      if (toolId === 'timer') stopTimersForDisable()
    }
  })

  ipcMain.handle('hotkey:update', (_event, action: string, accelerator: string) => {
    unregisterSingleHotkey(action)
    // Empty accelerator means clear the shortcut; update hotkeyActions so enableAllHotkeys won't re-register
    if (!accelerator) {
      hotkeyActions.set(action, { accelerator: '', enabled: hotkeyActions.get(action)?.enabled ?? true })
      return
    }
    // Check tool disabled state — blocked tools never register hotkeys
    if (action === 'resource-capture' && disabledTools.has('resource-capture')) return
    if (action === 'window-pinner') {
      if (disabledTools.has('window-pinner')) return
      hotkeyActions.set(action, { accelerator, enabled: true })
      sendCommandFire('CONFIG hotkey=' + accelerator)
      return
    }
    registerSingleHotkey(action, accelerator, mainWindow)
  })

  ipcMain.handle('hotkey:set-enabled', (_event, action: string, enabled: boolean) => {
    const info = hotkeyActions.get(action)
    // Keep the saved accelerator
    const acc = info?.accelerator || ''
    if (enabled && acc) {
      // Don't register if tool is disabled
      if (action === 'resource-capture' && disabledTools.has('resource-capture')) {
        hotkeyActions.set(action, { accelerator: acc, enabled: true })
        return
      }
      if (action === 'window-pinner') {
        hotkeyActions.set(action, { accelerator: acc, enabled })
        if (!disabledTools.has('window-pinner') && enabled) {
          sendCommandFire('CONFIG hotkey=' + acc)
        }
        return
      }
      registerSingleHotkey(action, acc, mainWindow)
    } else {
      unregisterSingleHotkey(action)
      hotkeyActions.set(action, { accelerator: acc, enabled: false })
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
        // Skip if tool is disabled
        if (action === 'resource-capture' && disabledTools.has('resource-capture')) continue
        if (action === 'window-pinner') {
          if (!disabledTools.has('window-pinner') && info.accelerator) {
            sendCommandFire('CONFIG hotkey=' + info.accelerator)
          }
          continue
        }
        if (info.accelerator) {
          registerSingleHotkey(action, info.accelerator, mainWindow)
        }
      }
    }
  })

  ipcMain.handle('hotkey:check-conflict', (_event, accelerator: string, excludeAction: string) => {
    if (!accelerator) return null
    for (const [action, info] of hotkeyActions) {
      if (action === excludeAction) continue
      if (info.accelerator === accelerator) return action
    }
    return null
  })

  // Return all registered accelerators for conflict detection
  ipcMain.handle('hotkey:get-all-accelerators', () => {
    const result: Record<string, string> = {}
    for (const [action, info] of hotkeyActions) {
      result[action] = info.accelerator
    }
    return result
  })

  registerIpcHandlers(mainWindow)
  registerSettingsIpc()
  registerCaptureIpc()
  registerQueueIpc()
  registerBackendIpc()
  registerPinmanIpc()
  registerLogIpc()
  registerKeyStatsIpc()
  registerAppStatsIpc()
  registerUpdaterIpc(mainWindow)
  registerTimerIpc(mainWindow)
  scheduleAutoUpdateCheck()

  // Load persisted disabled-tools state and check window-pinner before starting pinman
  const disabledRaw = getStore().get('disabledTools') as string | undefined
  let disabledList: string[] = []
  if (disabledRaw) {
    try { disabledList = JSON.parse(disabledRaw) } catch { /* ignore */ }
  }
  for (const id of disabledList) disabledTools.add(id)

  // Pass current hotkey to startPinman so the initial config includes it
  const initHotkey = (storedToAccelerator((getStore().get('pinnerHotkey') as string) || '')) || 'Alt+P'
  if (!disabledTools.has('window-pinner')) {
    startPinman(mainWindow, initHotkey)
    initializePinmanForWindow()
  } else {
    console.log('[pinman] Skipped start: window-pinner tool is disabled')
  }

  // Start backend if resource-capture tool is enabled
  if (!disabledTools.has('resource-capture')) {
    startBackend()
  } else {
    console.log('[backend] Skipped start: resource-capture tool is disabled')
  }

  if (!disabledTools.has('key-counter')) {
    startKeyStats()
  } else {
    console.log('[keystats] Skipped start: key-counter tool is disabled')
  }

  if (!disabledTools.has('app-stats')) {
    startAppStats()
  } else {
    console.log('[appstats] Skipped start: app-stats tool is disabled')
  }

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
