// DeepSeek API client for game resource parsing (non-streaming)
// Multi-resource prompt adapted from Android pipeline

import { useDeepseekStore } from '@/stores/deepseekStore'
import type { GameConfig, ResourceTypeConfig } from '@/stores/captureStore'

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'
const PARSE_TIMEOUT_MS = 30_000

export interface ParseResult {
  remaining_resource: number
  max_resource: number
}

/**
 * Build a multi-resource AI prompt listing all resources for a game with their caps.
 * Aligned with Android pipeline's prompt structure.
 * JSON keys use current_resource / max_resource to match backend API.
 */
function buildPrompt(ocrText: string, gameConfig: GameConfig): string {
  const resourceLines = gameConfig.resourceTypes
    .map((rt) => `- ${rt.label}: cap ${rt.cap} (match "数字/${rt.cap}")`)
    .join('\n')

  return `You are a precise game data parser. Find resource data from the OCR text below.
Game: ${gameConfig.name}
Resources to find:
${resourceLines}

Recognize formats: "number/max" or "number / max" (with spaces).

OCR text:
${ocrText}

Return ONLY a JSON array. For each resource found, include both current and max:
[{"current_resource": <number>, "max_resource": <matched_max>}, ...]
If no resource data is found, return: []
Do NOT include any other text.`
}

/**
 * Parse ALL resources for a game from OCR text via DeepSeek.
 * Returns an array of ParseResult, one per identified resource.
 * Throws a clear error message on timeout (AbortError).
 */
export async function parseResourcesViaAI(
  ocrText: string,
  gameConfig: GameConfig
): Promise<ParseResult[]> {
  const { apiKey } = useDeepseekStore.getState()
  const model = (await window.api.settings.get('deepseekModel')) as string
  const modelName = model || 'deepseek-v4-flash'

  if (!apiKey) {
    throw new Error('DeepSeek API Key not configured')
  }

  const userPrompt = buildPrompt(ocrText, gameConfig)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error('[DeepSeek Parse] Request timed out after', PARSE_TIMEOUT_MS, 'ms')
    controller.abort()
  }, PARSE_TIMEOUT_MS)

  try {
    console.log('[DeepSeek Parse] Sending request, model:', modelName, 'ocr length:', ocrText.length)
    const response = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a precise game data parser. Return ONLY a JSON array.' },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
        stream: false
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '')
      console.error('[DeepSeek Parse] API error:', response.status, errorBody.substring(0, 200))
      throw new Error(`DeepSeek API error: ${response.status}`)
    }

    const data = await response.json()
    const content: string = data.choices?.[0]?.message?.content || ''
    console.log('[DeepSeek Parse] Response received, content length:', content.length, 'preview:', JSON.stringify(content.substring(0, 150)))

    // Try parsing as JSON array first
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        const filtered = parsed
          .filter((r: Record<string, unknown>) => typeof r.current_resource === 'number' && typeof r.max_resource === 'number')
          .map((r: Record<string, unknown>) => ({
            remaining_resource: r.current_resource as number,
            max_resource: r.max_resource as number
          }))
        console.log('[DeepSeek Parse] Parsed', filtered.length, 'resources from JSON array')
        return filtered
      }
      console.log('[DeepSeek Parse] Parsed content is not an array, falling back to regex')
    } catch (parseErr) {
      console.log('[DeepSeek Parse] JSON parse failed, falling back to regex:', parseErr instanceof Error ? parseErr.message : String(parseErr))
    }

    // Fallback: regex extraction from non-JSON response
    const matches = content.matchAll(
      /\{"current_resource"\s*:\s*(\d+)[^}]*"max_resource"\s*:\s*(\d+)[^}]*\}|\{"remaining_resource"\s*:\s*(\d+)[^}]*"max_resource"\s*:\s*(\d+)[^}]*\}/g
    )
    const results: ParseResult[] = []
    for (const m of matches) {
      const current = m[1] || m[3]
      const max = m[2] || m[4]
      results.push({
        remaining_resource: parseInt(current, 10),
        max_resource: parseInt(max, 10)
      })
    }
    console.log('[DeepSeek Parse] Regex extracted', results.length, 'resources')
    return results
  } catch (err) {
    // Re-throw AbortError with a clear timeout message
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`AI 解析超时 (${PARSE_TIMEOUT_MS / 1000}s)`)
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

// Backward-compatible single-resource export
/** @deprecated Use parseResourcesViaAI for multi-resource capture */
export async function parseResourceViaAI(
  ocrText: string,
  gameName: string,
  resourceLabel: string
): Promise<ParseResult & { remaining_resource: number | null; max_resource: number | null }> {
  const { apiKey } = useDeepseekStore.getState()
  const model = await window.api.settings.get('deepseekModel')

  if (!apiKey) {
    throw new Error('DeepSeek API Key not configured')
  }

  const userPrompt = `You are a precise game data parser. Find resource data from the OCR text below.
Game: ${gameName}
Resource: ${resourceLabel}

Recognize formats: "number/max" or "number / max" (with spaces).

OCR text:
${ocrText}

Return ONLY: {"current_resource": <number>, "max_resource": <number>}
If nothing found: {"current_resource": null, "max_resource": null}`

  const response = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: (model as string) || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: 'You are a precise game data parser. Return ONLY JSON.' },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.7,
      stream: false
    })
  })

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`)
  }

  const data = await response.json()
  const content: string = data.choices[0].message.content

  // Support both old and new key names in response
  const match = content.match(
    /\{"(?:current_resource|remaining_resource)"\s*:\s*(\d+|null)[^}]*"(?:max_resource|max_resource)"\s*:\s*(\d+|null)[^}]*\}/
  )
  if (!match) {
    return { remaining_resource: null, max_resource: null }
  }

  return {
    remaining_resource: match[1] !== 'null' ? parseInt(match[1], 10) : null,
    max_resource: match[2] !== 'null' ? parseInt(match[2], 10) : null
  }
}
