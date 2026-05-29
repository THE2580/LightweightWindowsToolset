// DeepSeek API client for game resource parsing (non-streaming)
// Multi-resource prompt adapted from Android pipeline

import { useDeepseekStore } from '@/stores/deepseekStore'
import type { GameConfig, ResourceTypeConfig } from '@/stores/captureStore'

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'

export interface ParseResult {
  remaining_stamina: number
  max_stamina: number
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
 */
export async function parseResourcesViaAI(
  ocrText: string,
  gameConfig: GameConfig
): Promise<ParseResult[]> {
  const { apiKey } = useDeepseekStore.getState()
  const model = await window.api.settings.get('deepseekModel')

  if (!apiKey) {
    throw new Error('DeepSeek API Key not configured')
  }

  const userPrompt = buildPrompt(ocrText, gameConfig)

  const response = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: (model as string) || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: 'You are a precise game data parser. Return ONLY a JSON array.' },
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

  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((r: Record<string, unknown>) => typeof r.current_resource === 'number' && typeof r.max_resource === 'number')
        .map((r: Record<string, unknown>) => ({
          remaining_stamina: r.current_resource as number,
          max_stamina: r.max_resource as number
        }))
    }
  } catch {
    // Fall through to regex extraction
  }

  // Fallback: regex extraction from non-JSON response (supports both old and new key names)
  const matches = content.matchAll(
    /\{"current_resource"\s*:\s*(\d+)[^}]*"max_resource"\s*:\s*(\d+)[^}]*\}|\{"remaining_stamina"\s*:\s*(\d+)[^}]*"max_stamina"\s*:\s*(\d+)[^}]*\}/g
  )
  const results: ParseResult[] = []
  for (const m of matches) {
    const current = m[1] || m[3]
    const max = m[2] || m[4]
    results.push({
      remaining_stamina: parseInt(current, 10),
      max_stamina: parseInt(max, 10)
    })
  }
  return results
}

// Backward-compatible single-resource export
/** @deprecated Use parseResourcesViaAI for multi-resource capture */
export async function parseStaminaViaAI(
  ocrText: string,
  gameName: string,
  resourceLabel: string
): Promise<ParseResult & { remaining_stamina: number | null; max_stamina: number | null }> {
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
    /\{"(?:current_resource|remaining_stamina)"\s*:\s*(\d+|null)[^}]*"(?:max_resource|max_stamina)"\s*:\s*(\d+|null)[^}]*\}/
  )
  if (!match) {
    return { remaining_stamina: null, max_stamina: null }
  }

  return {
    remaining_stamina: match[1] !== 'null' ? parseInt(match[1], 10) : null,
    max_stamina: match[2] !== 'null' ? parseInt(match[2], 10) : null
  }
}
