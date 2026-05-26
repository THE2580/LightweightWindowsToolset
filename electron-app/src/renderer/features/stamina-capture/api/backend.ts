// Backend API client for stamina records
const DEFAULT_BACKEND_URL = 'http://100.70.198.102:8000'

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

export async function postStaminaRecord(payload: StaminaRecordPayload): Promise<StaminaRecord> {
  const response = await fetch(`${backendUrl}/api/stamina/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`)
  }
  return response.json()
}

export async function getTodayRecord(gameName: string): Promise<StaminaRecord | null> {
  const response = await fetch(`${backendUrl}/api/stamina/today/${encodeURIComponent(gameName)}`)
  if (response.status === 204) return null
  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`)
  }
  return response.json()
}

export async function getAllTodayRecords(): Promise<StaminaRecord[]> {
  const response = await fetch(`${backendUrl}/api/stamina/today`)
  if (!response.ok) {
    throw new Error(`Backend error: ${response.status}`)
  }
  return response.json()
}
