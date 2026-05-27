import { ipcMain } from 'electron'

const TAVILY_ENDPOINT = 'https://api.tavily.com/search'

interface SearchResult {
  title: string
  url: string
  content: string
}

export function registerTavilyIpc(): void {
  ipcMain.handle('tavily:search', async (_event, query: string, apiKey: string) => {
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
    return (data.results || []) as SearchResult[]
  })
}
