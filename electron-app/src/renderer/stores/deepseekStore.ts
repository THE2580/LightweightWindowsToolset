import { create } from 'zustand'

interface DeepSeekState {
  apiKey: string | null
  apiKeyLoaded: boolean
  webSearchEnabled: boolean
  tavilyApiKeyLoaded: boolean
  lastSearchRaw: string | null

  setApiKey: (key: string) => void
  loadApiKey: () => Promise<void>
  setWebSearchEnabled: (enabled: boolean) => void
  loadTavilyApiKey: () => Promise<void>
  setLastSearchRaw: (raw: string | null) => void
}

export const useDeepseekStore = create<DeepSeekState>((set, get) => ({
  apiKey: null,
  apiKeyLoaded: false,
  webSearchEnabled: false,
  tavilyApiKeyLoaded: false,
  lastSearchRaw: null,

  setApiKey: (key) => {
    set({ apiKey: key })
  },

  loadApiKey: async () => {
    if (get().apiKeyLoaded) return
    try {
      const key = await window.api.settings.get('deepseekApiKey')
      if (typeof key === 'string') {
        set({ apiKey: key, apiKeyLoaded: true })
      } else {
        set({ apiKeyLoaded: true })
      }
    } catch {
      set({ apiKeyLoaded: true })
    }
  },

  setWebSearchEnabled: (enabled) => {
    set({ webSearchEnabled: enabled })
  },

  loadTavilyApiKey: async () => {
    if (get().tavilyApiKeyLoaded) return
    try {
      const key = await window.api.settings.get('tavilyApiKey')
      set({ tavilyApiKeyLoaded: true })
      return key as string | null
    } catch {
      set({ tavilyApiKeyLoaded: true })
      return null
    }
  },

  setLastSearchRaw: (raw) => {
    set({ lastSearchRaw: raw })
  }
}))
