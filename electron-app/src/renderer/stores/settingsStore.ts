import { create } from 'zustand'

type ThemeMode = 'system' | 'light' | 'dark'
type CloseBehavior = 'quit' | 'tray'

interface SettingsState {
  theme: ThemeMode
  autoStart: boolean
  autoCheckUpdates: boolean
  showUpdateNotification: boolean
  chatClickOutsideToClose: boolean
  chatAutoExpand: boolean
  chatExpandZoneVisible: boolean
  chatExpandZoneWidth: number
  chatExpandZoneHeight: number
  chatAutoExpandDelay: number
  chatExpandZonePreview: { w: number; h: number } | null
  backendUrl: string
  deepseekModel: string
  windowTitle: string
  closeBehavior: CloseBehavior
  captureHotkey: string
  chatHotkey: string
  captureHotkeyEnabled: boolean
  chatHotkeyEnabled: boolean
  pinnerHotkey: string
  pinnerHotkeyEnabled: boolean
  pinnerAutoPinApp: boolean
  pinnerTopmostSelf: boolean
  captureRefreshInterval: number
  storagePath: string
  developerMode: boolean
  isLoaded: boolean

  load: () => Promise<void>
  setTheme: (theme: ThemeMode) => Promise<void>
  setAutoStart: (v: boolean) => Promise<void>
  setAutoCheckUpdates: (v: boolean) => Promise<void>
  setShowUpdateNotification: (v: boolean) => Promise<void>
  setChatClickOutsideToClose: (v: boolean) => Promise<void>
  setChatAutoExpand: (v: boolean) => Promise<void>
  setChatExpandZoneVisible: (v: boolean) => Promise<void>
  setChatExpandZoneWidth: (w: number) => Promise<void>
  setChatExpandZoneHeight: (h: number) => Promise<void>
  setChatAutoExpandDelay: (delay: number) => Promise<void>
  setChatExpandZonePreview: (p: { w: number; h: number } | null) => void
  setBackendUrl: (url: string) => Promise<void>
  setDeepseekModel: (m: string) => Promise<void>
  setWindowTitle: (t: string) => Promise<void>
  setCloseBehavior: (b: CloseBehavior) => Promise<void>
  setCaptureHotkey: (keys: string[]) => Promise<void>
  setChatHotkey: (keys: string[]) => Promise<void>
  setCaptureHotkeyEnabled: (v: boolean) => Promise<void>
  setChatHotkeyEnabled: (v: boolean) => Promise<void>
  setPinnerHotkey: (keys: string[]) => Promise<void>
  setPinnerHotkeyEnabled: (v: boolean) => Promise<void>
  setPinnerAutoPinApp: (v: boolean) => Promise<void>
  setPinnerTopmostSelf: (v: boolean) => Promise<void>
  setCaptureRefreshInterval: (v: number) => Promise<void>
  setDeveloperMode: (v: boolean) => Promise<void>
  loadStoragePath: () => Promise<void>
  setStoragePath: (path: string) => Promise<{ success: boolean; error?: string }>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'system',
  autoStart: false,
  autoCheckUpdates: true,
  showUpdateNotification: true,
  chatClickOutsideToClose: false,
  chatAutoExpand: false,
  chatExpandZoneVisible: false,
  chatExpandZoneWidth: 20,
  chatExpandZoneHeight: 100,
  chatAutoExpandDelay: 300,
  chatExpandZonePreview: null,
  backendUrl: 'http://100.70.198.102:8000',
  deepseekModel: 'deepseek-v4-flash',
  windowTitle: '轻量化工具集',
  closeBehavior: 'quit',
  captureHotkey: '',
  chatHotkey: '',
  captureHotkeyEnabled: true,
  chatHotkeyEnabled: true,
  pinnerHotkey: '',
  pinnerHotkeyEnabled: true,
  pinnerAutoPinApp: false,
  pinnerTopmostSelf: false,
  captureRefreshInterval: 2,
  storagePath: '',
  developerMode: false,
  isLoaded: false,

  load: async () => {
    if (get().isLoaded) return
    try {
      const all = await window.api.settings.getAll()
      set({
        theme: (all.theme as ThemeMode) || 'system',
        autoStart: (all.autoStart as boolean) || false,
        autoCheckUpdates: (all.autoCheckUpdates as boolean) ?? true,
        showUpdateNotification: (all.showUpdateNotification as boolean) ?? true,
        chatClickOutsideToClose: (all.chatClickOutsideToClose as boolean) || false,
        chatAutoExpand: (all.chatAutoExpand as boolean) || false,
        chatExpandZoneVisible: (all.chatExpandZoneVisible as boolean) || false,
        chatExpandZoneWidth: (all.chatExpandZoneWidth as number) || 20,
        chatExpandZoneHeight: (all.chatExpandZoneHeight as number) || 100,
        chatAutoExpandDelay: (all.chatAutoExpandDelay as number) ?? 300,
        backendUrl: (all.backendUrl as string) || 'http://100.70.198.102:8000',
        deepseekModel: (all.deepseekModel as string) || 'deepseek-v4-flash',
        windowTitle: (all.windowTitle as string) || '轻量化工具集',
        closeBehavior: (all.closeBehavior as CloseBehavior) || 'quit',
        captureHotkey: (all.captureHotkey as string) || '',
        chatHotkey: (all.chatHotkey as string) || '',
        captureHotkeyEnabled: (all.captureHotkeyEnabled as boolean) ?? true,
        chatHotkeyEnabled: (all.chatHotkeyEnabled as boolean) ?? true,
        pinnerHotkey: (all.pinnerHotkey as string) || '',
        pinnerHotkeyEnabled: (all.pinnerHotkeyEnabled as boolean) ?? true,
        pinnerAutoPinApp: (all.pinnerAutoPinApp as boolean) ?? false,
        pinnerTopmostSelf: (all.pinnerTopmostSelf as boolean) ?? false,
        captureRefreshInterval: (all.captureRefreshInterval as number) || 2,
        developerMode: (all.developerMode as boolean) ?? false,
        isLoaded: true
      })
    } catch {
      set({ isLoaded: true })
    }
  },

  setTheme: async (theme) => { await window.api.settings.set('theme', theme); set({ theme }) },
  setAutoStart: async (v) => { await window.api.settings.set('autoStart', v); set({ autoStart: v }) },
  setAutoCheckUpdates: async (v) => { await window.api.settings.set('autoCheckUpdates', v); set({ autoCheckUpdates: v }) },
  setShowUpdateNotification: async (v) => { await window.api.settings.set('showUpdateNotification', v); set({ showUpdateNotification: v }) },
  setChatClickOutsideToClose: async (v) => { await window.api.settings.set('chatClickOutsideToClose', v); set({ chatClickOutsideToClose: v }) },
  setChatAutoExpand: async (v) => { await window.api.settings.set('chatAutoExpand', v); set({ chatAutoExpand: v }) },
  setChatExpandZoneVisible: async (v) => { await window.api.settings.set('chatExpandZoneVisible', v); set({ chatExpandZoneVisible: v }) },
  setChatExpandZoneWidth: async (w) => { await window.api.settings.set('chatExpandZoneWidth', w); set({ chatExpandZoneWidth: w }) },
  setChatExpandZoneHeight: async (h) => { await window.api.settings.set('chatExpandZoneHeight', h); set({ chatExpandZoneHeight: h }) },
  setChatAutoExpandDelay: async (delay) => { await window.api.settings.set('chatAutoExpandDelay', delay); set({ chatAutoExpandDelay: delay }) },
  setChatExpandZonePreview: (p) => set({ chatExpandZonePreview: p }),
  setBackendUrl: async (url) => { await window.api.settings.set('backendUrl', url); set({ backendUrl: url }) },
  setDeepseekModel: async (m) => { await window.api.settings.set('deepseekModel', m); set({ deepseekModel: m }) },
  setWindowTitle: async (t) => { await window.api.settings.set('windowTitle', t); await window.api.window.setTitle(t); set({ windowTitle: t }) },
  setCloseBehavior: async (b) => { await window.api.settings.set('closeBehavior', b); set({ closeBehavior: b }) },
  setCaptureHotkey: async (keys) => { const jsonStr = JSON.stringify(keys); const acc = keys.join('+'); await window.api.settings.set('captureHotkey', jsonStr); await window.api.hotkey.updateHotkey('resource-capture', acc); set({ captureHotkey: jsonStr }) },
  setChatHotkey: async (keys) => { const jsonStr = JSON.stringify(keys); const acc = keys.join('+'); await window.api.settings.set('chatHotkey', jsonStr); await window.api.hotkey.updateHotkey('ai-chat', acc); set({ chatHotkey: jsonStr }) },
  setCaptureHotkeyEnabled: async (v) => { await window.api.settings.set('captureHotkeyEnabled', v); await window.api.hotkey.setHotkeyEnabled('resource-capture', v); set({ captureHotkeyEnabled: v }) },
  setChatHotkeyEnabled: async (v) => { await window.api.settings.set('chatHotkeyEnabled', v); await window.api.hotkey.setHotkeyEnabled('ai-chat', v); set({ chatHotkeyEnabled: v }) },
  setPinnerHotkey: async (keys) => { const jsonStr = JSON.stringify(keys); const acc = keys.join('+'); await window.api.settings.set('pinnerHotkey', jsonStr); await window.api.hotkey.updateHotkey('window-pinner', acc); set({ pinnerHotkey: jsonStr }) },
  setPinnerHotkeyEnabled: async (v) => { await window.api.settings.set('pinnerHotkeyEnabled', v); await window.api.hotkey.setHotkeyEnabled('window-pinner', v); set({ pinnerHotkeyEnabled: v }) },
  setPinnerAutoPinApp: async (v) => { await window.api.settings.set('pinnerAutoPinApp', v); set({ pinnerAutoPinApp: v }) },
  setPinnerTopmostSelf: async (v) => { await window.api.settings.set('pinnerTopmostSelf', v); await window.api.pinman.config('topmostSelf', v ? '1' : '0'); set({ pinnerTopmostSelf: v }) },
  setCaptureRefreshInterval: async (v) => { await window.api.settings.set('captureRefreshInterval', v); set({ captureRefreshInterval: v }) },
  setDeveloperMode: async (v) => { await window.api.settings.set('developerMode', v); set({ developerMode: v }) },

  loadStoragePath: async () => {
    try {
      const p = await window.api.settings.getStoragePath()
      set({ storagePath: p })
    } catch { /* keep default */ }
  },

  setStoragePath: async (newPath) => {
    const result = await window.api.settings.setStoragePath(newPath)
    if (result.success && result.newPath) {
      set({ storagePath: result.newPath })
    }
    return result
  },
}))
