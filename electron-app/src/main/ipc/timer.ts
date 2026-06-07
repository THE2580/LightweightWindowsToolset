import { BrowserWindow, Notification, app, ipcMain } from 'electron'
import { join } from 'path'
import { getStore } from './settings'

export type TimerType = 'stopwatch' | 'countdown'
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface TimerBounds {
  x: number
  y: number
}

export interface TimerItem {
  id: string
  name: string
  note: string
  type: TimerType
  status: TimerStatus
  createdAt: number
  order: number
  totalMs: number
  elapsedMs: number
  remainingMs: number
  lastStartedAt: number | null
  notifyOnFinish: boolean
  floatingBounds?: TimerBounds
}

interface CreateTimerInput {
  name?: string
  note?: string
  type: TimerType
  totalMs?: number
  notifyOnFinish?: boolean
}

interface UpdateTimerInput {
  name?: string
  note?: string
  totalMs?: number
  notifyOnFinish?: boolean
}

export interface TimerSnapshot {
  timers: TimerItem[]
  floatingIds: string[]
}

const STORE_KEY = 'timers'
const MAX_TIMERS = 20
const MAX_NAME_LENGTH = 24
const MAX_COUNTDOWN_MS = ((99 * 60 * 60) + (59 * 60) + 59) * 1000
const FLOATING_WIDTH = 168
const FLOATING_HEIGHT = 92

let mainWindow: BrowserWindow | null = null
let timers: TimerItem[] = []
let tickHandle: NodeJS.Timeout | null = null
const floatingWindows = new Map<string, BrowserWindow>()

function cloneTimer(timer: TimerItem): TimerItem {
  return {
    ...timer,
    floatingBounds: timer.floatingBounds ? { ...timer.floatingBounds } : undefined
  }
}

function nowMs(): number {
  return Date.now()
}

function makeId(): string {
  return `timer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeName(value: string | undefined, type: TimerType): string {
  const trimmed = (value || '').trim()
  const fallback = type === 'stopwatch' ? '正计时' : '倒计时'
  return (trimmed || fallback).slice(0, MAX_NAME_LENGTH)
}

function sanitizeNote(value: string | undefined): string {
  return (value || '').trim().slice(0, 120)
}

function normalizeTimer(raw: Partial<TimerItem>): TimerItem | null {
  if (!raw.id || raw.type !== 'stopwatch' && raw.type !== 'countdown') return null
  const totalMs = raw.type === 'countdown'
    ? Math.max(1000, Math.min(MAX_COUNTDOWN_MS, Number(raw.totalMs) || 1000))
    : 0
  const elapsedMs = Math.max(0, Number(raw.elapsedMs) || 0)
  const remainingMs = raw.type === 'countdown'
    ? Math.max(0, Math.min(totalMs, Number(raw.remainingMs) || totalMs))
    : 0
  return {
    id: raw.id,
    name: sanitizeName(raw.name, raw.type),
    note: sanitizeNote(raw.note),
    type: raw.type,
    status: raw.status === 'running' ? 'paused' : (raw.status || 'idle'),
    createdAt: Number(raw.createdAt) || nowMs(),
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : (Number(raw.createdAt) || nowMs()),
    totalMs,
    elapsedMs,
    remainingMs,
    lastStartedAt: null,
    notifyOnFinish: raw.type === 'countdown' ? raw.notifyOnFinish !== false : false,
    floatingBounds: raw.floatingBounds
  }
}

function loadTimers(): void {
  const raw = getStore().get(STORE_KEY) as unknown
  if (!Array.isArray(raw)) {
    timers = []
    return
  }
  timers = raw
    .map((item) => normalizeTimer(item as Partial<TimerItem>))
    .filter((item): item is TimerItem => Boolean(item))
    .slice(0, MAX_TIMERS)
  saveTimers()
}

function saveTimers(): void {
  getStore().set(STORE_KEY, timers.map(cloneTimer))
}

function snapshot(): TimerSnapshot {
  return {
    timers: timers.map(cloneTimer),
    floatingIds: [...floatingWindows.keys()]
  }
}

function broadcast(): void {
  const data = snapshot()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('timer:snapshot', data)
  }
}

function findTimer(id: string): TimerItem | undefined {
  return timers.find((timer) => timer.id === id)
}

function settleTimer(timer: TimerItem, timestamp = nowMs()): boolean {
  if (timer.status !== 'running' || timer.lastStartedAt === null) return false
  const delta = Math.max(0, timestamp - timer.lastStartedAt)
  timer.lastStartedAt = timestamp
  if (timer.type === 'stopwatch') {
    timer.elapsedMs += delta
    return false
  }

  timer.remainingMs = Math.max(0, timer.remainingMs - delta)
  if (timer.remainingMs <= 0) {
    timer.status = 'finished'
    timer.remainingMs = timer.totalMs
    timer.lastStartedAt = null
    if (timer.notifyOnFinish) {
      new Notification({
        title: '计时器已结束',
        body: timer.name
      }).show()
    }
    return true
  }
  return false
}

function ensureTick(): void {
  const hasRunning = timers.some((timer) => timer.status === 'running')
  if (hasRunning && tickHandle === null) {
    tickHandle = setInterval(() => {
      let changed = false
      for (const timer of timers) {
        changed = settleTimer(timer) || changed
      }
      if (changed) saveTimers()
      broadcast()
      ensureTick()
    }, 1000)
  } else if (!hasRunning && tickHandle !== null) {
    clearInterval(tickHandle)
    tickHandle = null
  }
}

function pauseTimerInternal(timer: TimerItem): void {
  if (timer.status !== 'running') return
  settleTimer(timer)
  if (timer.status === 'running') timer.status = 'paused'
  timer.lastStartedAt = null
}

function pauseAllInternal(): void {
  for (const timer of timers) pauseTimerInternal(timer)
  saveTimers()
  ensureTick()
  broadcast()
}

function closeFloatingInternal(id: string): void {
  const win = floatingWindows.get(id)
  if (!win) return
  floatingWindows.delete(id)
  if (!win.isDestroyed()) win.close()
}

function closeAllFloatingInternal(): void {
  for (const id of [...floatingWindows.keys()]) closeFloatingInternal(id)
  broadcast()
}

function defaultFloatingBounds(): TimerBounds {
  const display = BrowserWindow.getFocusedWindow()?.getBounds()
  if (display) return { x: display.x + display.width - FLOATING_WIDTH - 24, y: display.y + 72 }
  return { x: 120, y: 120 }
}

function openFloatingInternal(id: string): TimerSnapshot {
  const timer = findTimer(id)
  if (!timer) throw new Error('timer not found')

  if (floatingWindows.has(id)) {
    closeFloatingInternal(id)
    return snapshot()
  }

  const bounds = timer.floatingBounds || defaultFloatingBounds()
  const win = new BrowserWindow({
    width: FLOATING_WIDTH,
    height: FLOATING_HEIGHT,
    x: bounds.x,
    y: bounds.y,
    minWidth: FLOATING_WIDTH,
    minHeight: FLOATING_HEIGHT,
    maxWidth: FLOATING_WIDTH,
    maxHeight: FLOATING_HEIGHT,
    resizable: false,
    frame: false,
    show: false,
    alwaysOnTop: true,
    backgroundColor: '#ffffff',
    skipTaskbar: true,
    title: timer.name,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  floatingWindows.set(id, win)
  win.on('ready-to-show', () => {
    win.show()
    win.setAlwaysOnTop(true, 'floating')
  })
  win.on('moved', () => {
    const current = findTimer(id)
    if (!current || win.isDestroyed()) return
    const [x, y] = win.getPosition()
    current.floatingBounds = { x, y }
    saveTimers()
  })
  win.on('closed', () => {
    floatingWindows.delete(id)
    broadcast()
  })

  const floatingUrl = `timer-floating/${encodeURIComponent(id)}`
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/${floatingUrl}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: floatingUrl })
  }
  return snapshot()
}

function createTimer(input: CreateTimerInput): TimerSnapshot {
  if (timers.length >= MAX_TIMERS) throw new Error('timer limit reached')
  const type = input.type
  if (type !== 'stopwatch' && type !== 'countdown') throw new Error('invalid timer type')
  const totalMs = type === 'countdown'
    ? Math.max(1000, Math.min(MAX_COUNTDOWN_MS, Number(input.totalMs) || 0))
    : 0
  if (type === 'countdown' && totalMs <= 0) throw new Error('countdown duration required')
  const timer: TimerItem = {
    id: makeId(),
    name: sanitizeName(input.name, type),
    note: sanitizeNote(input.note),
    type,
    status: 'idle',
    createdAt: nowMs(),
    order: timers.reduce((max, item) => Math.max(max, item.order), 0) + 1,
    totalMs,
    elapsedMs: 0,
    remainingMs: type === 'countdown' ? totalMs : 0,
    lastStartedAt: null,
    notifyOnFinish: type === 'countdown' ? input.notifyOnFinish !== false : false
  }
  timers.push(timer)
  saveTimers()
  broadcast()
  return snapshot()
}

function updateTimer(id: string, patch: UpdateTimerInput): TimerSnapshot {
  const timer = findTimer(id)
  if (!timer) throw new Error('timer not found')
  if (patch.name !== undefined) timer.name = sanitizeName(patch.name, timer.type)
  if (patch.note !== undefined) timer.note = sanitizeNote(patch.note)
  if (timer.type === 'countdown' && patch.notifyOnFinish !== undefined) {
    timer.notifyOnFinish = Boolean(patch.notifyOnFinish)
  }
  if (timer.type === 'countdown' && patch.totalMs !== undefined) {
    if (timer.status === 'running') throw new Error('cannot edit duration while running')
    const totalMs = Math.max(1000, Math.min(MAX_COUNTDOWN_MS, Number(patch.totalMs) || 0))
    timer.totalMs = totalMs
    timer.remainingMs = totalMs
    if (timer.status === 'finished') timer.status = 'idle'
  }
  saveTimers()
  broadcast()
  return snapshot()
}

function deleteTimer(id: string): TimerSnapshot {
  closeFloatingInternal(id)
  timers = timers.filter((timer) => timer.id !== id)
  saveTimers()
  ensureTick()
  broadcast()
  return snapshot()
}

function startTimer(id: string): TimerSnapshot {
  const timer = findTimer(id)
  if (!timer) throw new Error('timer not found')
  if (timer.status === 'running') return snapshot()
  if (timer.type === 'countdown' && (timer.status === 'finished' || timer.remainingMs <= 0)) {
    timer.remainingMs = timer.totalMs
  }
  timer.status = 'running'
  timer.lastStartedAt = nowMs()
  saveTimers()
  ensureTick()
  broadcast()
  return snapshot()
}

function pauseTimer(id: string): TimerSnapshot {
  const timer = findTimer(id)
  if (!timer) throw new Error('timer not found')
  pauseTimerInternal(timer)
  saveTimers()
  ensureTick()
  broadcast()
  return snapshot()
}

function resetTimer(id: string): TimerSnapshot {
  const timer = findTimer(id)
  if (!timer) throw new Error('timer not found')
  timer.status = 'idle'
  timer.lastStartedAt = null
  timer.elapsedMs = 0
  if (timer.type === 'countdown') timer.remainingMs = timer.totalMs
  saveTimers()
  ensureTick()
  broadcast()
  return snapshot()
}

function resetPausedTimers(): TimerSnapshot {
  for (const timer of timers) {
    if (timer.status !== 'paused') continue
    timer.status = 'idle'
    timer.lastStartedAt = null
    timer.elapsedMs = 0
    if (timer.type === 'countdown') timer.remainingMs = timer.totalMs
  }
  saveTimers()
  ensureTick()
  broadcast()
  return snapshot()
}

function reorderTimers(ids: string[]): TimerSnapshot {
  const requested = ids
    .map((id) => findTimer(id))
    .filter((timer): timer is TimerItem => Boolean(timer))
  const groups: TimerItem[][] = [
    requested.filter((timer) => timer.status === 'running'),
    requested.filter((timer) => timer.status !== 'running')
  ]
  let order = 1
  for (const group of groups) {
    for (const timer of group) {
      timer.order = order
      order += 1
    }
  }
  saveTimers()
  broadcast()
  return snapshot()
}

export function stopTimersForDisable(): void {
  pauseAllInternal()
  closeAllFloatingInternal()
}

export function stopTimersForQuit(): void {
  pauseAllInternal()
  closeAllFloatingInternal()
  if (tickHandle !== null) {
    clearInterval(tickHandle)
    tickHandle = null
  }
}

export function registerTimerIpc(win: BrowserWindow): void {
  mainWindow = win
  loadTimers()
  ensureTick()

  ipcMain.handle('timer:get-snapshot', () => snapshot())
  ipcMain.handle('timer:create', (_event, input: CreateTimerInput) => createTimer(input))
  ipcMain.handle('timer:update', (_event, id: string, patch: UpdateTimerInput) => updateTimer(id, patch))
  ipcMain.handle('timer:delete', (_event, id: string) => deleteTimer(id))
  ipcMain.handle('timer:start', (_event, id: string) => startTimer(id))
  ipcMain.handle('timer:pause', (_event, id: string) => pauseTimer(id))
  ipcMain.handle('timer:reset', (_event, id: string) => resetTimer(id))
  ipcMain.handle('timer:reset-paused', () => resetPausedTimers())
  ipcMain.handle('timer:reorder', (_event, ids: string[]) => reorderTimers(Array.isArray(ids) ? ids : []))
  ipcMain.handle('timer:pause-all', () => {
    pauseAllInternal()
    return snapshot()
  })
  ipcMain.handle('timer:open-floating', (_event, id: string) => {
    const data = openFloatingInternal(id)
    broadcast()
    return data
  })
  ipcMain.handle('timer:close-floating', (_event, id: string) => {
    closeFloatingInternal(id)
    broadcast()
    return snapshot()
  })
  ipcMain.handle('timer:close-all-floating', () => {
    closeAllFloatingInternal()
    return snapshot()
  })
}
