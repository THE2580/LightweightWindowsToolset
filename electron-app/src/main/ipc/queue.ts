import { ipcMain } from 'electron'
import { getStore } from './settings'

export interface QueuedResourcePayload {
  game_name: string
  resource_type: string
  current_resource: number
  max_resource: number
  capture_time: string
  platform: string
}

const QUEUE_KEY = 'pendingResourceQueue'

export function loadQueue(): QueuedResourcePayload[] {
  const raw = getStore().get(QUEUE_KEY)
  if (Array.isArray(raw)) return raw as QueuedResourcePayload[]
  // Migration: load from old key if present
  const legacy = getStore().get('pendingStaminaQueue')
  if (Array.isArray(legacy)) {
    getStore().set(QUEUE_KEY, legacy)
    getStore().delete('pendingStaminaQueue')
    return legacy as QueuedResourcePayload[]
  }
  return []
}

export function saveQueue(queue: QueuedResourcePayload[]): void {
  getStore().set(QUEUE_KEY, queue)
}

export function registerQueueIpc(): void {
  ipcMain.handle('queue:add', (_event, payload: QueuedResourcePayload) => {
    const queue = loadQueue()
    queue.push(payload)
    saveQueue(queue)
  })

  ipcMain.handle('queue:getCount', () => {
    return loadQueue().length
  })

  ipcMain.handle('queue:drain', () => {
    const queue = loadQueue()
    saveQueue([])
    return queue
  })

  ipcMain.handle('queue:removeFirst', () => {
    const queue = loadQueue()
    if (queue.length === 0) return false
    queue.shift()
    saveQueue(queue)
    return true
  })
}
