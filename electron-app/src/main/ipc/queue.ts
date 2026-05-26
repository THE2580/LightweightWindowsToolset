import { ipcMain } from 'electron'
import { getStore } from './settings'

export interface QueuedStaminaPayload {
  game_name: string
  package_name: string
  remaining_stamina: number
  max_stamina: number
  capture_time: string
  source: 'windows'
}

const QUEUE_KEY = 'pendingStaminaQueue'

export function loadQueue(): QueuedStaminaPayload[] {
  const raw = getStore().get(QUEUE_KEY)
  if (Array.isArray(raw)) return raw as QueuedStaminaPayload[]
  return []
}

export function saveQueue(queue: QueuedStaminaPayload[]): void {
  getStore().set(QUEUE_KEY, queue)
}

export function registerQueueIpc(): void {
  ipcMain.handle('queue:add', (_event, payload: QueuedStaminaPayload) => {
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
