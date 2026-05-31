/**
 * IPC module for pinman.exe — native window pinning daemon.
 * Communicates via stdin/stdout (child process).
 */
import { ipcMain, app, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { createInterface } from 'readline'
import { existsSync } from 'fs'

// ---- Types ----

export interface PinEntry {
  hwnd: number
  title: string
}

export interface PinStatus {
  pinned: number
  maxPins: number
  hotkeyActive: boolean
  windows: PinEntry[]
}

// ---- State ----

let proc: ChildProcess | null = null
let pendingResolve: ((value: string) => void) | null = null
let rl: ReturnType<typeof createInterface> | null = null
let shutdownInitiated = false

let currentMaxPins = 10
let currentHotkey = 'Alt+P'
let currentTopmostSelf = false
let mainWindow: BrowserWindow | null = null
let stderrBuffer = ''

// ---- Helpers ----

function getPinmanPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'pinman.exe')
  }
  const publishedPath = join(app.getAppPath(), '..', 'pinman', 'bin', 'Release', 'net9.0-windows', 'win-x64', 'publish', 'pinman.exe')
  if (existsSync(publishedPath)) return publishedPath

  const resourcePath = join(app.getAppPath(), 'resources', 'pinman.exe')
  console.warn('[pinman] Local publish output missing, falling back to resource copy:', resourcePath)
  return resourcePath
}

interface QueueItem {
  cmd: string
  resolve: (v: string) => void
  reject: (e: Error) => void
  fire: boolean
}
let cmdQueue: QueueItem[] = []
let queueRunning = false
let discardNextResponse = false

// ---- Notification popup (replaces balloon) ----

const NOTIFY_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;background:transparent;overflow:hidden;-webkit-app-region:no-drag}
  .container{background:rgba(15,23,42,0.94);border:1px solid rgba(59,130,246,0.35);border-radius:8px;padding:10px 14px;margin:2px;backdrop-filter:blur(12px);animation:fadeIn .2s ease-out}
  @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeOut{from{opacity:1}to{opacity:0}}
  .container.leaving{animation:fadeOut .25s ease-out forwards}
  .label{color:#93c5fd;font-size:10px;font-weight:600;margin-bottom:4px}
  .title{color:#e2e8f0;font-size:12px;font-weight:500;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style></head>
<body><div class="container" id="c"><div class="label" id="label"></div><div class="title" id="t"></div></div>
<script>
  window._init=function(label,title){document.getElementById('label').textContent=label;document.getElementById('t').textContent=title}
  window._leave=function(){var c=document.getElementById('c');c.classList.add('leaving');c.addEventListener('animationend',function(){window.close()},{once:true})}
</script></body></html>`

let notifyWin: BrowserWindow | null = null

function showPinNotification(label: string, title: string): void {
  // Destroy any existing notification first
  if (notifyWin && !notifyWin.isDestroyed()) {
    try { notifyWin.close() } catch { /* ok */ }
    notifyWin = null
  }
  try {
    const { screen } = require('electron')
    const primary = screen.getPrimaryDisplay()
    const { width: screenW, height: screenH } = primary.workAreaSize
    const winW = 300; const winH = 62
    const x = Math.round((screenW - winW) / 2)
    const y = Math.round(screenH * 0.12)
    notifyWin = new BrowserWindow({
      width: winW, height: winH, x, y,
      frame: false, transparent: true, alwaysOnTop: true,
      skipTaskbar: true, resizable: false, show: false,
      focusable: false, hasShadow: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false }
    })
    notifyWin.setAlwaysOnTop(true, 'screen-saver')
    notifyWin.setIgnoreMouseEvents(true)
    notifyWin.setVisibleOnAllWorkspaces(true)
    notifyWin.on('ready-to-show', () => { notifyWin?.show() })
    notifyWin.webContents.on('did-finish-load', () => {
      notifyWin?.webContents.executeJavaScript(`window._init("${label.replace(/"/g,'\\"')}","${title.replace(/"/g,'\\"')}")`)
      // Re-assert topmost to appear above any newly-pinned HWND_TOPMOST window
      notifyWin?.setAlwaysOnTop(true, 'screen-saver')
      // Auto-close after 2.5s
      setTimeout(() => {
        if (notifyWin && !notifyWin.isDestroyed()) {
          notifyWin.webContents.executeJavaScript('window._leave()').catch(() => {})
          setTimeout(() => { if (notifyWin && !notifyWin.isDestroyed()) { notifyWin.close(); notifyWin = null } }, 400)
        }
      }, 2500)
    })
    notifyWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(NOTIFY_HTML)}`)
  } catch { /* notification is non-critical */ }
}

function processQueue(): void {
  if (queueRunning || cmdQueue.length === 0) return
  if (!proc || proc.killed || proc.exitCode !== null || !proc.stdin) {
    while (cmdQueue.length > 0) {
      const q = cmdQueue.shift()!
      q.reject(new Error('pinman not running'))
    }
    return
  }
  queueRunning = true
  const item = cmdQueue.shift()!

  if (item.fire) {
    discardNextResponse = true
    try {
      proc.stdin.write(item.cmd + '\n', (err) => {
        if (err) {
          discardNextResponse = false
          queueRunning = false
          item.reject(err)
          processQueue()
        }
      })
    } catch (e) {
      discardNextResponse = false
      queueRunning = false
      item.reject(e as Error)
      processQueue()
    }
    return
  }

  pendingResolve = item.resolve
  const timeout = setTimeout(() => {
    if (pendingResolve === item.resolve) {
      pendingResolve = null
      item.reject(new Error('pinman command timeout'))
      queueRunning = false
      processQueue()
    }
  }, 5000)
  try {
    proc.stdin.write(item.cmd + '\n', (err) => {
      if (err) {
        clearTimeout(timeout)
        pendingResolve = null
        item.reject(err)
        queueRunning = false
        processQueue()
      }
    })
  } catch (e) {
    clearTimeout(timeout)
    pendingResolve = null
    item.reject(e as Error)
    queueRunning = false
    processQueue()
  }
}

export function sendCommand(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cmdQueue.push({ cmd, resolve, reject, fire: false })
    processQueue()
  })
}

export function sendCommandFire(cmd: string): void {
  cmdQueue.push({ cmd, resolve: () => {}, reject: () => {}, fire: true })
  processQueue()
}

// ---- Start / Stop ----

export function startPinman(win?: BrowserWindow, hotkey?: string): void {
  if (proc) return
  shutdownInitiated = false
  if (win) mainWindow = win
  if (hotkey) currentHotkey = hotkey

  const exePath = getPinmanPath()
  console.log('[pinman] Starting:', exePath)

  proc = spawn(exePath, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })

  rl = createInterface({ input: proc.stdout! })

  rl.on('line', (line: string) => {
    if (discardNextResponse) {
      discardNextResponse = false
      queueRunning = false
      processQueue()
      return
    }
    if (pendingResolve) {
      const r = pendingResolve
      pendingResolve = null
      r(line)
      queueRunning = false
      processQueue()
    }
  })

  // Parse stderr line protocol. Keep partial chunks buffered because native writes
  // and Node stream chunks do not have a one-to-one relationship.
  proc.stderr?.on('data', (data: Buffer) => {
    stderrBuffer += data.toString('utf8')
    const lines = stderrBuffer.split('\n')
    stderrBuffer = lines.pop() || ''
    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue
      if (line.startsWith('@PINMAN_LOG ')) {
        const afterPrefix = line.substring('@PINMAN_LOG '.length)
        const spaceIdx = afterPrefix.indexOf(' ')
        const level = spaceIdx >= 0 ? afterPrefix.substring(0, spaceIdx) : 'info'
        const message = spaceIdx >= 0 ? afterPrefix.substring(spaceIdx + 1) : afterPrefix
        const output = `[pinman/native] ${message}`
        if (level === 'error') console.error(output)
        else if (level === 'warn') console.warn(output)
        else if (level === 'info') console.info(output)
        else console.log(output)
      } else if (line.startsWith('@PINMAN_EVENT')) {
        const afterPrefix = line.substring('@PINMAN_EVENT '.length)
        const spaceIdx = afterPrefix.indexOf(' ')
        if (spaceIdx < 0) continue
        const type = afterPrefix.substring(0, spaceIdx)
        const json = afterPrefix.substring(spaceIdx + 1)
        try {
          const data = JSON.parse(json)
          mainWindow?.webContents.send('pinman:event', { type, ...data })
          // Show popup notification for pin/unpin events
          if (type === 'pinned') {
            const t = (data as { title?: string }).title || ''
            showPinNotification('已置顶窗口', t)
          } else if (type === 'unpinned') {
            const t = (data as { title?: string }).title || ''
            showPinNotification('已取消置顶', t)
          }
        } catch { console.warn('[pinman] Malformed native event:', line) }
      } else console.warn('[pinman/native] Unrecognized stderr:', line)
    }
  })

  proc.on('error', (err: Error) => {
    console.error('[pinman] Spawn error:', err.message)
    proc = null; rl = null
    if (!shutdownInitiated) {
      setTimeout(() => { if (!shutdownInitiated) startPinman() }, 3000)
    }
  })
  proc.stdin?.on('error', () => {})

  proc.on('exit', (code, signal) => {
    console.log(`[pinman] Exited: code=${code} signal=${signal}`)
    proc = null; rl = null
    pendingResolve = null; discardNextResponse = false
    if (stderrBuffer.trim()) console.warn('[pinman/native] Trailing stderr:', stderrBuffer.trim())
    stderrBuffer = ''
    if (!shutdownInitiated) {
      setTimeout(() => { if (!shutdownInitiated) startPinman() }, 2000)
    }
  })

  // Apply initial config (including hotkey from settings)
  setTimeout(async () => {
    try {
      await sendCommand(`CONFIG maxPins=${currentMaxPins}`)
      await sendCommand(`CONFIG hotkey=${currentHotkey}`)
      console.log('[pinman] Initial config applied, hotkey:', currentHotkey)
    } catch (e) {
      console.error('[pinman] Init config failed:', e)
    }
  }, 1000)
}

export function stopPinman(): void {
  shutdownInitiated = true
  if (proc && !proc.killed && proc.exitCode === null) {
    try {
      proc.stdin?.write('SHUTDOWN\n')
      setTimeout(() => {
        if (proc && !proc.killed && proc.exitCode === null) proc.kill()
      }, 2000)
    } catch {
      try { proc.kill() } catch { /* already dead */ }
    }
  }
}

// ---- IPC Handlers ----

export function registerPinmanIpc(): void {
  ipcMain.handle('pinman:toggle', async () => {
    try { return await sendCommand('TOGGLE') }
    catch { return 'ERR pinman not running' }
  })

  ipcMain.handle('pinman:pin-hwnd', async (_e, hwnd: number) => {
    try { return await sendCommand(`PIN ${hwnd}`) }
    catch { return 'ERR' }
  })

  ipcMain.handle('pinman:status', async (): Promise<PinStatus> => {
    try {
      const raw = await sendCommand('STATUS')
      const jsonStart = raw.indexOf('{')
      if (jsonStart >= 0) {
        return JSON.parse(raw.slice(jsonStart))
      }
      return { pinned: 0, maxPins: 10, hotkeyActive: false, windows: [] }
    } catch {
      return { pinned: 0, maxPins: 10, hotkeyActive: false, windows: [] }
    }
  })

  ipcMain.handle('pinman:unpin', async (_e, hwnd: number) => {
    try { return await sendCommand(`UNPIN ${hwnd}`) }
    catch { return 'ERR' }
  })

  ipcMain.handle('pinman:unpin-all', async () => {
    try { return await sendCommand('UNPINALL') }
    catch { return 'ERR' }
  })

  ipcMain.handle('pinman:config', async (_e, key: string, value: string) => {
    try {
      const result = await sendCommand(`CONFIG ${key}=${value}`)
      if (key.toUpperCase() === 'MAXPINS') currentMaxPins = parseInt(value)
      else if (key.toUpperCase() === 'HOTKEY') currentHotkey = value
      else if (key.toUpperCase() === 'TOPMOSTSELF') currentTopmostSelf = value === '1'
      return result
    } catch { return 'ERR' }
  })

  ipcMain.handle('pinman:ping', async () => {
    try { return await sendCommand('PING') }
    catch { return 'ERR' }
  })
}
