// Backend API via IPC (main-process Node.js http — bypasses Chromium proxy)

export interface ResourceRecordPayload {
  game_name: string
  resource_type: string
  current_resource: number
  max_resource: number
  capture_time: string
  platform: string
}

export interface ResourceRecord {
  id: number
  game_name: string
  resource_type: string
  current_resource: number
  max_resource: number
  capture_time: string
  platform: string
  created_at?: string
}

export async function postResourceRecord(payload: ResourceRecordPayload): Promise<ResourceRecord> {
  try {
    return await window.api.backend.postRecord(payload)
  } catch (err) {
    // Queue for retry via electron-store
    await window.api.queue.add(payload)
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Backend unreachable — record queued for retry`)
  }
}

export async function getAllLatestRecords(): Promise<ResourceRecord[]> {
  return window.api.backend.getLatest()
}

/** @deprecated Legacy alias */
export function setBackendUrl(_url: string): void {
  // Backend URL is now managed in main process (settings store)
}
