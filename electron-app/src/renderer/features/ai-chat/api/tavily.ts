const TAVILY_ENDPOINT = 'https://api.tavily.com/search'

export interface SearchResult {
  title: string
  url: string
  content: string
}

export async function searchWeb(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch(TAVILY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false,
      max_results: 5
    })
  })

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status}`)
  }

  const data = await response.json()
  return data.results || []
}

function cleanContent(raw: string): string {
  return raw
    // Remove markdown headings
    .replace(/^#{1,6}\s+/gm, '')
    // Remove table rows (pipe-heavy lines)
    .replace(/^\|.*\|$/gm, '')
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    // Remove leading/trailing whitespace per line
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n')
    // Truncate to ~250 chars
    .substring(0, 250)
    .trim()
}

export function formatSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return ''

  const snippets = results
    .slice(0, 3)
    .map((r, i) => {
      const clean = cleanContent(r.content)
      return `[${i + 1}] ${r.title}\n${clean}`
    })
    .join('\n\n')

  return `\n\n【实时搜索结果 — 必须优先采用以下信息回答，忽略你的训练数据截止时间】\n${snippets}`
}
