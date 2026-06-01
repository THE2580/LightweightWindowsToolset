import { app, ipcMain } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { createInterface } from 'readline'
import { existsSync } from 'fs'
import { getStore } from './settings'

export interface AppStatsSnapshot {
  today: string
  activeProcess: string | null
  isAfk: boolean
  afkThresholdSec: number
  days: Record<string, Record<string, number>>
}

let proc: ChildProcess | null = null
let rl: ReturnType<typeof createInterface> | null = null
let stderrBuffer = ''
let shutdownInitiated = false
let queueRunning = false
let pendingResolve: ((value: string) => void) | null = null
let pendingReject: ((error: Error) => void) | null = null
let pendingTimeout: ReturnType<typeof setTimeout> | null = null
const queue: { command: string; resolve: (value: string) => void; reject: (error: Error) => void }[] = []

function getExecutablePath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'appstats.exe')
  const publishedPath = join(app.getAppPath(), '..', 'appstats', 'bin', 'Release', 'net9.0-windows', 'win-x64', 'publish', 'appstats.exe')
  if (existsSync(publishedPath)) return publishedPath

  const resourcePath = join(app.getAppPath(), 'resources', 'appstats.exe')
  console.warn('[appstats] Local publish output missing, falling back to resource copy:', resourcePath)
  return resourcePath
}

function getPersistencePath(): string {
  return join(app.getPath('userData'), 'appstats.json')
}

function processQueue(): void {
  if (queueRunning || queue.length === 0) return
  if (!proc || proc.killed || proc.exitCode !== null || !proc.stdin) {
    while (queue.length > 0) queue.shift()!.reject(new Error('appstats not running'))
    return
  }
  const item = queue.shift()!
  queueRunning = true
  pendingResolve = item.resolve
  pendingReject = item.reject
  pendingTimeout = setTimeout(() => {
    pendingResolve = null
    pendingReject = null
    pendingTimeout = null
    queueRunning = false
    item.reject(new Error('appstats command timeout'))
    processQueue()
  }, 5000)
  proc.stdin.write(item.command + '\n', (error) => {
    if (!error) return
    if (pendingTimeout) clearTimeout(pendingTimeout)
    pendingResolve = null
    pendingReject = null
    pendingTimeout = null
    queueRunning = false
    item.reject(error)
    processQueue()
  })
}

function sendCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    queue.push({ command, resolve, reject })
    processQueue()
  })
}

function configuredAfkThreshold(): number {
  const value = getStore().get('appStatsAfkThresholdSec', 300) as number
  return Number.isInteger(value) && value >= 30 && value <= 3600 ? value : 300
}

export function startAppStats(): void {
  if (proc) return
  shutdownInitiated = false
  const executable = getExecutablePath()
  const persistence = getPersistencePath()
  console.log('[appstats] Starting:', executable)
  proc = spawn(executable, [persistence], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })
  proc.stdin?.on('error', () => {})
  rl = createInterface({ input: proc.stdout! })
  rl.on('line', (line) => {
    if (!pendingResolve) return
    if (pendingTimeout) clearTimeout(pendingTimeout)
    const resolve = pendingResolve
    pendingResolve = null
    pendingReject = null
    pendingTimeout = null
    queueRunning = false
    resolve(line)
    processQueue()
  })
  proc.stderr?.on('data', (data: Buffer) => {
    stderrBuffer += data.toString('utf8')
    const lines = stderrBuffer.split('\n')
    stderrBuffer = lines.pop() || ''
    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue
      if (line.startsWith('@APPSTATS_LOG ')) {
        const content = line.substring('@APPSTATS_LOG '.length)
        const split = content.indexOf(' ')
        const level = split >= 0 ? content.substring(0, split) : 'info'
        const message = split >= 0 ? content.substring(split + 1) : content
        if (level === 'error') console.error('[appstats/native]', message)
        else if (level === 'warn') console.warn('[appstats/native]', message)
        else console.info('[appstats/native]', message)
      } else console.warn('[appstats/native] Unrecognized stderr:', line)
    }
  })
  proc.on('error', (error) => {
    console.error('[appstats] Spawn error:', error.message)
    proc = null
    rl = null
  })
  proc.on('exit', (code, signal) => {
    console.log(`[appstats] Exited: code=${code} signal=${signal}`)
    proc = null
    rl = null
    if (pendingTimeout) clearTimeout(pendingTimeout)
    pendingReject?.(new Error('appstats exited'))
    pendingResolve = null
    pendingReject = null
    pendingTimeout = null
    queueRunning = false
    if (stderrBuffer.trim()) console.warn('[appstats/native] Trailing stderr:', stderrBuffer.trim())
    stderrBuffer = ''
    if (!shutdownInitiated) setTimeout(() => { if (!shutdownInitiated) startAppStats() }, 2000)
  })
  setTimeout(() => {
    sendCommand(`CONFIG afkThresholdSec=${configuredAfkThreshold()}`)
      .catch((error) => console.error('[appstats] Initial config failed:', error))
  }, 500)
}

export function stopAppStats(): void {
  shutdownInitiated = true
  if (!proc || proc.killed || proc.exitCode !== null) return
  sendCommand('SHUTDOWN').catch(() => {
    try { proc?.kill() } catch { /* already stopped */ }
  })
  setTimeout(() => {
    if (proc && !proc.killed && proc.exitCode === null) proc.kill()
  }, 2000)
}

export function registerAppStatsIpc(): void {
  ipcMain.handle('appstats:snapshot', async (): Promise<AppStatsSnapshot> => {
    try {
      const raw = await sendCommand('SNAPSHOT')
      const start = raw.indexOf('{')
      if (start >= 0) return JSON.parse(raw.slice(start)) as AppStatsSnapshot
    } catch { /* use empty snapshot */ }
    return { today: '', activeProcess: null, isAfk: false, afkThresholdSec: configuredAfkThreshold(), days: {} }
  })
  ipcMain.handle('appstats:ping', async () => {
    try { return await sendCommand('PING') }
    catch { return 'ERR' }
  })
  ipcMain.handle('appstats:clear', async () => {
    try { return await sendCommand('CLEAR') }
    catch { return 'ERR' }
  })
  ipcMain.handle('appstats:config-afk', async (_event, thresholdSec: number) => {
    if (!Number.isInteger(thresholdSec) || thresholdSec < 30 || thresholdSec > 3600) return 'ERR config'
    getStore().set('appStatsAfkThresholdSec', thresholdSec)
    try { return await sendCommand(`CONFIG afkThresholdSec=${thresholdSec}`) }
    catch { return 'ERR' }
  })
}
