import { ipcMain } from 'electron'
import { getStore } from './settings'

const DEFAULT_BACKEND_URL = 'http://100.70.198.102:8000'

function getBackendUrl(): string {
  const stored = getStore().get('backendUrl')
  if (typeof stored === 'string' && stored.trim()) return stored.trim()
  return DEFAULT_BACKEND_URL
}

async function backendFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const baseUrl = getBackendUrl()
  const url = `${baseUrl}${path}`
  const headers: Record<string, string> = {}
  let bodyStr: string | undefined

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    bodyStr = JSON.stringify(options.body)
  }

  // Use Node.js http/https (NOT Chromium fetch) to avoid proxy issues
  const httpModule = url.startsWith('https') ? require('https') : require('http')
  const urlObj = new URL(url)

  return new Promise((resolve, reject) => {
    const req = httpModule.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (url.startsWith('https') ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers,
        timeout: 10000
      },
      (res: { statusCode?: number; on: (e: string, cb: (d: Buffer) => void) => void }) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const data = Buffer.concat(chunks).toString('utf-8')
          console.log('[Backend] Response status:', res.statusCode, 'body length:', data.length)
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = data ? JSON.parse(data) : null
              console.log('[Backend] POST success, parsed:', typeof parsed)
              resolve(parsed)
            } catch (e) {
              console.error('[Backend] JSON parse failed:', String(e).substring(0, 100))
              resolve(null)
            }
          } else {
            console.error('[Backend] HTTP error:', res.statusCode, data.substring(0, 200)); reject(new Error(`Backend HTTP ${res.statusCode}: ${data.substring(0, 200)}`))
          }
        })
      }
    )

    req.on('error', (err: Error) => { console.error('[Backend] Request error:', err.message); reject(err) })
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Backend request timeout'))
    })

    console.log('[Backend] Request:', options.method || 'GET', url)
    if (bodyStr) {
      req.write(bodyStr)
    }
    req.end()
  })
}

export function registerBackendIpc(): void {
  ipcMain.handle('backend:post-record', async (_event, payload: {
    game_name: string
    resource_type: string
    current_resource: number
    max_resource: number
    capture_time: string
    platform: string
  }) => {
    return backendFetch('/api/resource/record', { method: 'POST', body: payload })
  })

  ipcMain.handle('backend:get-today', async () => {
    return backendFetch('/api/resource/today')
  })
}
