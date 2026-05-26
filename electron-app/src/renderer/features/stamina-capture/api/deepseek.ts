// DeepSeek API client for stamina parsing (non-streaming)
import { useDeepseekStore } from '@/stores/deepseekStore'

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'

interface ParseResult {
  remaining_stamina: number | null
  max_stamina: number | null
}

export async function parseStaminaViaAI(
  ocrText: string,
  gameName: string,
  staminaName: string
): Promise<ParseResult> {
  const { apiKey } = useDeepseekStore.getState()
  const model = await window.api.settings.get('deepseekModel')

  if (!apiKey) {
    throw new Error('DeepSeek API Key not configured')
  }

  const userPrompt = `你是一个精确的游戏数据解析助手。请处理以下OCR识别到的游戏体力信息。
请找出类似"29/200"格式的文字。
其中"/"前面的数字(29)是剩余体力，"/"后面的数字(200)是最大体力。

游戏: ${gameName}
体力名称: ${staminaName}

OCR结果:
${ocrText}

只返回JSON: {"remaining_stamina": <剩余体力数字>, "max_stamina": <最大体力数字>}
如果找不到xx/yy格式的体力数字，返回: {"remaining_stamina": null, "max_stamina": null}`

  const response = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: (model as string) || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: '你是一个精确的游戏数据解析助手。只返回JSON。' },
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

  // Parse JSON from response
  const match = content.match(
    /\{"remaining_stamina"\s*:\s*(\d+|null)[^}]*"max_stamina"\s*:\s*(\d+|null)[^}]*\}/
  )
  if (!match) {
    return { remaining_stamina: null, max_stamina: null }
  }

  return {
    remaining_stamina: match[1] !== 'null' ? parseInt(match[1], 10) : null,
    max_stamina: match[2] !== 'null' ? parseInt(match[2], 10) : null
  }
}
