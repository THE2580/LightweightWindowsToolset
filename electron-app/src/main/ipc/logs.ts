import { app, BrowserWindow, ipcMain } from 'electron'
import { inspect } from 'util'

export type LogLevel = 'log' | 'info' | 'warn' | 'error'

export interface LogEntry {
  id: number
  timestamp: string
  level: LogLevel
  source: 'main' | 'renderer'
  message: string
}

const MAX_LOG_ENTRIES = 500
const entries: LogEntry[] = []
let nextId = 1
let installed = false

function formatArg(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack || value.message
  return inspect(value, { depth: 4, breakLength: 120, compact: true })
}

function appendLog(level: LogLevel, source: LogEntry['source'], args: unknown[]): void {
  const entry: LogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    level,
    source,
    message: args.map(formatArg).join(' ')
  }
  entries.push(entry)
  if (entries.length > MAX_LOG_ENTRIES) entries.splice(0, entries.length - MAX_LOG_ENTRIES)
  if (!app.isReady()) return
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('logs:entry', entry)
  }
}

export function installMainLogger(): void {
  if (installed) return
  installed = true
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      appendLog(level, 'main', args)
    }
  }
  console.info('[Logs] Main-process logger initialized')
}

export function registerLogIpc(): void {
  ipcMain.handle('logs:get', () => [...entries])
  ipcMain.handle('logs:clear', () => {
    entries.length = 0
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('logs:cleared')
    }
  })
  ipcMain.on('logs:append-renderer', (_event, level: LogLevel, args: unknown[]) => {
    appendLog(level, 'renderer', args)
  })
}
