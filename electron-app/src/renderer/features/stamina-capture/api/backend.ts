const DEFAULT_BACKEND_URL = 'http://100.70.198.102:8000'
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000

let backendUrl = DEFAULT_BACKEND_URL

export function setBackendUrl(url: string): void {
  backendUrl = url || DEFAULT_BACKEND_URL
}

export interface StaminaRecordPayload {
  game_name: string
  package_name: string
  remaining_stamina: number
  max_stamina: number
  capture_time: string
  source: 'windows'
}

export interface StaminaRecord {
  id: number
  game_name: string
  remaining_stamina: number
  max_stamina: number
  capture_time: string
  source: string
}

export async function getPendingCount(): Promise<number> {
  return window.api.queue.getCount()
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options)
      return response
    } catch (err) {
      if (attempt === retries) throw err
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function postStaminaRecord(payload: StaminaRecordPayload): Promise<StaminaRecord> {
  try {
    const response = await fetchWithRetry(`${backendUrl}/api/stamina/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`)
    }
    return response.json()
  } catch {
    // Persist to electron-store via IPC so records survive app restart
    await window.api.queue.add(payload)
    throw new Error('Backend unreachable — record queued for retry')
  }
}

export async function getTodayRecord(gameName: string): Promise<StaminaRecord | null> {
  const response = await fetchWithRetry(
    `${backendUrl}/api/stamina/today/${encodeURIComponent(gameName)}`
  )
  if (response.status === 204) return null
  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`)
  }
  return response.json()
}

export async function getAllTodayRecords(): Promise<StaminaRecord[]> {
  const response = await fetchWithRetry(`${backendUrl}/api/stamina/today`)
  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`)
  }
  return response.json()
}
