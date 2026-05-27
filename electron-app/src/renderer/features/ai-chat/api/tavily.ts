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

export function formatSearchContext(results: SearchResult[]): string {
  if (results.length === 0) return ''

  const snippets = results
    .slice(0, 3)
    .map((r, i) => `[${i + 1}] ${r.title}
${r.content}`)
    .join('\n\n')

  return `\n\n以下是来自互联网的实时搜索结果，请基于这些信息回答用户问题（引用来源时标注编号）：\n${snippets}`
}
