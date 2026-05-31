import { app, ipcMain } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { createInterface } from 'readline'

export interface KeyStatsSnapshot {
  today: string
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
  if (app.isPackaged) return join(process.resourcesPath, 'keystats.exe')
  return join(app.getAppPath(), '..', 'keystats', 'bin', 'Release', 'net9.0-windows', 'win-x64', 'publish', 'keystats.exe')
}

function getPersistencePath(): string {
  return join(app.getPath('userData'), 'keystats.json')
}

function processQueue(): void {
  if (queueRunning || queue.length === 0) return
  if (!proc || proc.killed || proc.exitCode !== null || !proc.stdin) {
    while (queue.length > 0) queue.shift()!.reject(new Error('keystats not running'))
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
    item.reject(new Error('keystats command timeout'))
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

export function startKeyStats(): void {
  if (proc) return
  shutdownInitiated = false
  const executable = getExecutablePath()
  const persistence = getPersistencePath()
  console.log('[keystats] Starting:', executable)
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
      if (line.startsWith('@KEYSTATS_LOG ')) {
        const content = line.substring('@KEYSTATS_LOG '.length)
        const split = content.indexOf(' ')
        const level = split >= 0 ? content.substring(0, split) : 'info'
        const message = split >= 0 ? content.substring(split + 1) : content
        if (level === 'error') console.error('[keystats/native]', message)
        else if (level === 'warn') console.warn('[keystats/native]', message)
        else console.info('[keystats/native]', message)
      } else console.warn('[keystats/native] Unrecognized stderr:', line)
    }
  })
  proc.on('error', (error) => {
    console.error('[keystats] Spawn error:', error.message)
    proc = null
    rl = null
  })
  proc.on('exit', (code, signal) => {
    console.log(`[keystats] Exited: code=${code} signal=${signal}`)
    proc = null
    rl = null
    if (pendingTimeout) clearTimeout(pendingTimeout)
    pendingReject?.(new Error('keystats exited'))
    pendingResolve = null
    pendingReject = null
    pendingTimeout = null
    queueRunning = false
    if (stderrBuffer.trim()) console.warn('[keystats/native] Trailing stderr:', stderrBuffer.trim())
    stderrBuffer = ''
    if (!shutdownInitiated) setTimeout(() => { if (!shutdownInitiated) startKeyStats() }, 2000)
  })
}

export function stopKeyStats(): void {
  shutdownInitiated = true
  if (!proc || proc.killed || proc.exitCode !== null) return
  sendCommand('SHUTDOWN').catch(() => {
    try { proc?.kill() } catch { /* already stopped */ }
  })
  setTimeout(() => {
    if (proc && !proc.killed && proc.exitCode === null) proc.kill()
  }, 2000)
}

export function registerKeyStatsIpc(): void {
  ipcMain.handle('keystats:snapshot', async (): Promise<KeyStatsSnapshot> => {
    try {
      const raw = await sendCommand('SNAPSHOT')
      const start = raw.indexOf('{')
      if (start >= 0) return JSON.parse(raw.slice(start)) as KeyStatsSnapshot
    } catch { /* use empty snapshot */ }
    return { today: '', days: {} }
  })
  ipcMain.handle('keystats:ping', async () => {
    try { return await sendCommand('PING') }
    catch { return 'ERR' }
  })
}
