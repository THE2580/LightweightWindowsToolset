import { create } from 'zustand'

interface DeepSeekState {
  apiKey: string | null
  apiKeyLoaded: boolean

  setApiKey: (key: string) => void
  loadApiKey: () => Promise<void>
}

export const useDeepseekStore = create<DeepSeekState>((set, get) => ({
  apiKey: null,
  apiKeyLoaded: false,

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
  }
}))
