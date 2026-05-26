import { create } from 'zustand'

type ThemeMode = 'system' | 'light' | 'dark'
type AiChatPosition = 'left' | 'right'

interface SettingsState {
  theme: ThemeMode
  autoStart: boolean
  aiChatPosition: AiChatPosition
  backendUrl: string
  deepseekModel: string
  windowTitle: string
  isLoaded: boolean

  load: () => Promise<void>
  setTheme: (theme: ThemeMode) => Promise<void>
  setAutoStart: (autoStart: boolean) => Promise<void>
  setAiChatPosition: (pos: AiChatPosition) => Promise<void>
  setBackendUrl: (url: string) => Promise<void>
  setDeepseekModel: (model: string) => Promise<void>
  setWindowTitle: (title: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'system',
  autoStart: false,
  aiChatPosition: 'right',
  backendUrl: 'http://100.70.198.102:8000',
  deepseekModel: 'deepseek-v4-flash',
  windowTitle: '轻量化工具集',
  isLoaded: false,

  load: async () => {
    if (get().isLoaded) return
    try {
      const all = await window.api.settings.getAll()
      set({
        theme: (all.theme as ThemeMode) || 'system',
        autoStart: (all.autoStart as boolean) || false,
        aiChatPosition: (all.aiChatPosition as AiChatPosition) || 'right',
        backendUrl: (all.backendUrl as string) || 'http://100.70.198.102:8000',
        deepseekModel: (all.deepseekModel as string) || 'deepseek-v4-flash',
        windowTitle: (all.windowTitle as string) || '轻量化工具集',
        isLoaded: true
      })
    } catch {
      set({ isLoaded: true })
    }
  },

  setTheme: async (theme) => {
    await window.api.settings.set('theme', theme)
    set({ theme })
  },

  setAutoStart: async (autoStart) => {
    await window.api.settings.set('autoStart', autoStart)
    set({ autoStart })
  },

  setAiChatPosition: async (pos) => {
    await window.api.settings.set('aiChatPosition', pos)
    set({ aiChatPosition: pos })
  },

  setBackendUrl: async (url) => {
    await window.api.settings.set('backendUrl', url)
    set({ backendUrl: url })
  },

  setDeepseekModel: async (model) => {
    await window.api.settings.set('deepseekModel', model)
    set({ deepseekModel: model })
  },

  setWindowTitle: async (title) => {
    await window.api.settings.set('windowTitle', title)
    await window.api.window.setTitle(title)
    set({ windowTitle: title })
  }
}))
