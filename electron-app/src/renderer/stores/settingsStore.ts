import { create } from 'zustand'

type ThemeMode = 'system' | 'light' | 'dark'
type CloseBehavior = 'quit' | 'tray'

interface SettingsState {
  theme: ThemeMode
  autoStart: boolean
  chatClickOutsideToClose: boolean
  backendUrl: string
  deepseekModel: string
  windowTitle: string
  closeBehavior: CloseBehavior
  captureHotkey: string
  chatHotkey: string
  isLoaded: boolean

  load: () => Promise<void>
  setTheme: (theme: ThemeMode) => Promise<void>
  setAutoStart: (autoStart: boolean) => Promise<void>
  setChatClickOutsideToClose: (v: boolean) => Promise<void>
  setBackendUrl: (url: string) => Promise<void>
  setDeepseekModel: (model: string) => Promise<void>
  setWindowTitle: (title: string) => Promise<void>
  setCloseBehavior: (behavior: CloseBehavior) => Promise<void>
  setCaptureHotkey: (hk: string) => Promise<void>
  setChatHotkey: (hk: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'system',
  autoStart: false,
  chatClickOutsideToClose: false,
  backendUrl: 'http://100.70.198.102:8000',
  deepseekModel: 'deepseek-v4-flash',
  windowTitle: '轻量化工具集',
  closeBehavior: 'quit',
  captureHotkey: 'CommandOrControl+Shift+D',
  chatHotkey: 'CommandOrControl+Shift+A',
  isLoaded: false,

  load: async () => {
    if (get().isLoaded) return
    try {
      const all = await window.api.settings.getAll()
      set({
        theme: (all.theme as ThemeMode) || 'system',
        autoStart: (all.autoStart as boolean) || false,
        chatClickOutsideToClose: (all.chatClickOutsideToClose as boolean) || false,
        backendUrl: (all.backendUrl as string) || 'http://100.70.198.102:8000',
        deepseekModel: (all.deepseekModel as string) || 'deepseek-v4-flash',
        windowTitle: (all.windowTitle as string) || '轻量化工具集',
        closeBehavior: (all.closeBehavior as CloseBehavior) || 'quit',
        captureHotkey: (all.captureHotkey as string) || 'CommandOrControl+Shift+D',
        chatHotkey: (all.chatHotkey as string) || 'CommandOrControl+Shift+A',
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

  setChatClickOutsideToClose: async (v) => {
    await window.api.settings.set('chatClickOutsideToClose', v)
    set({ chatClickOutsideToClose: v })
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
  },

  setCloseBehavior: async (behavior) => {
    await window.api.settings.set('closeBehavior', behavior)
    set({ closeBehavior: behavior })
  },

  setCaptureHotkey: async (hk) => {
    await window.api.settings.set('captureHotkey', hk)
    await window.api.hotkey.updateHotkey('stamina-capture', hk)
    set({ captureHotkey: hk })
  },

  setChatHotkey: async (hk) => {
    await window.api.settings.set('chatHotkey', hk)
    await window.api.hotkey.updateHotkey('ai-chat', hk)
    set({ chatHotkey: hk })
  }
}))
