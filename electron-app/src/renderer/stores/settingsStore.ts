import { create } from 'zustand'

type ThemeMode = 'system' | 'light' | 'dark'
type CloseBehavior = 'quit' | 'tray'

interface SettingsState {
  theme: ThemeMode
  autoStart: boolean
  chatClickOutsideToClose: boolean
  chatAutoExpand: boolean
  chatExpandZoneVisible: boolean
  chatExpandZoneWidth: number
  chatExpandZoneHeight: number
  chatExpandZonePreview: { w: number; h: number } | null
  backendUrl: string
  deepseekModel: string
  windowTitle: string
  closeBehavior: CloseBehavior
  captureHotkey: string
  chatHotkey: string
  captureHotkeyEnabled: boolean
  chatHotkeyEnabled: boolean
  isLoaded: boolean

  load: () => Promise<void>
  setTheme: (theme: ThemeMode) => Promise<void>
  setAutoStart: (v: boolean) => Promise<void>
  setChatClickOutsideToClose: (v: boolean) => Promise<void>
  setChatAutoExpand: (v: boolean) => Promise<void>
  setChatExpandZoneVisible: (v: boolean) => Promise<void>
  setChatExpandZoneWidth: (w: number) => Promise<void>
  setChatExpandZoneHeight: (h: number) => Promise<void>
  setChatExpandZonePreview: (p: { w: number; h: number } | null) => void
  setBackendUrl: (url: string) => Promise<void>
  setDeepseekModel: (m: string) => Promise<void>
  setWindowTitle: (t: string) => Promise<void>
  setCloseBehavior: (b: CloseBehavior) => Promise<void>
  setCaptureHotkey: (hk: string) => Promise<void>
  setChatHotkey: (hk: string) => Promise<void>
  setCaptureHotkeyEnabled: (v: boolean) => Promise<void>
  setChatHotkeyEnabled: (v: boolean) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'system',
  autoStart: false,
  chatClickOutsideToClose: false,
  chatAutoExpand: false,
  chatExpandZoneVisible: false,
  chatExpandZoneWidth: 20,
  chatExpandZoneHeight: 100,
  chatExpandZonePreview: null,
  backendUrl: 'http://100.70.198.102:8000',
  deepseekModel: 'deepseek-v4-flash',
  windowTitle: '轻量化工具集',
  closeBehavior: 'quit',
  captureHotkey: '',
  chatHotkey: '',
  captureHotkeyEnabled: true,
  chatHotkeyEnabled: true,
  isLoaded: false,

  load: async () => {
    if (get().isLoaded) return
    try {
      const all = await window.api.settings.getAll()
      set({
        theme: (all.theme as ThemeMode) || 'system',
        autoStart: (all.autoStart as boolean) || false,
        chatClickOutsideToClose: (all.chatClickOutsideToClose as boolean) || false,
        chatAutoExpand: (all.chatAutoExpand as boolean) || false,
        chatExpandZoneVisible: (all.chatExpandZoneVisible as boolean) || false,
        chatExpandZoneWidth: (all.chatExpandZoneWidth as number) || 20,
        chatExpandZoneHeight: (all.chatExpandZoneHeight as number) || 100,
        backendUrl: (all.backendUrl as string) || 'http://100.70.198.102:8000',
        deepseekModel: (all.deepseekModel as string) || 'deepseek-v4-flash',
        windowTitle: (all.windowTitle as string) || '轻量化工具集',
        closeBehavior: (all.closeBehavior as CloseBehavior) || 'quit',
        captureHotkey: (all.captureHotkey as string) || '',
        chatHotkey: (all.chatHotkey as string) || '',
        captureHotkeyEnabled: (all.captureHotkeyEnabled as boolean) ?? true,
        chatHotkeyEnabled: (all.chatHotkeyEnabled as boolean) ?? true,
        isLoaded: true
      })
    } catch {
      set({ isLoaded: true })
    }
  },

  setTheme: async (theme) => { await window.api.settings.set('theme', theme); set({ theme }) },
  setAutoStart: async (v) => { await window.api.settings.set('autoStart', v); set({ autoStart: v }) },
  setChatClickOutsideToClose: async (v) => { await window.api.settings.set('chatClickOutsideToClose', v); set({ chatClickOutsideToClose: v }) },
  setChatAutoExpand: async (v) => { await window.api.settings.set('chatAutoExpand', v); set({ chatAutoExpand: v }) },
  setChatExpandZoneVisible: async (v) => { await window.api.settings.set('chatExpandZoneVisible', v); set({ chatExpandZoneVisible: v }) },
  setChatExpandZoneWidth: async (w) => { await window.api.settings.set('chatExpandZoneWidth', w); set({ chatExpandZoneWidth: w }) },
  setChatExpandZoneHeight: async (h) => { await window.api.settings.set('chatExpandZoneHeight', h); set({ chatExpandZoneHeight: h }) },
  setChatExpandZonePreview: (p) => set({ chatExpandZonePreview: p }),
  setBackendUrl: async (url) => { await window.api.settings.set('backendUrl', url); set({ backendUrl: url }) },
  setDeepseekModel: async (m) => { await window.api.settings.set('deepseekModel', m); set({ deepseekModel: m }) },
  setWindowTitle: async (t) => { await window.api.settings.set('windowTitle', t); await window.api.window.setTitle(t); set({ windowTitle: t }) },
  setCloseBehavior: async (b) => { await window.api.settings.set('closeBehavior', b); set({ closeBehavior: b }) },
  setCaptureHotkey: async (hk) => { await window.api.settings.set('captureHotkey', hk); await window.api.hotkey.updateHotkey('stamina-capture', hk); set({ captureHotkey: hk }) },
  setChatHotkey: async (hk) => { await window.api.settings.set('chatHotkey', hk); await window.api.hotkey.updateHotkey('ai-chat', hk); set({ chatHotkey: hk }) },
  setCaptureHotkeyEnabled: async (v) => { await window.api.settings.set('captureHotkeyEnabled', v); await window.api.hotkey.setHotkeyEnabled('stamina-capture', v); set({ captureHotkeyEnabled: v }) },
  setChatHotkeyEnabled: async (v) => { await window.api.settings.set('chatHotkeyEnabled', v); await window.api.hotkey.setHotkeyEnabled('ai-chat', v); set({ chatHotkeyEnabled: v }) }
}))
