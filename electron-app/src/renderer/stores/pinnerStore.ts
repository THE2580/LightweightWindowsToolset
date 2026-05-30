import { create } from 'zustand'

export interface PinnedWindowInfo {
  hwnd: number
  processName: string
  windowTitle: string
  pinnedAt: number
  order: number
}

interface PinnerStore {
  pinnedWindows: PinnedWindowInfo[]
  maxWindows: number
  borderColor: string
  hotkeyEnabled: boolean
  isLoaded: boolean

  setPinnedWindows: (list: PinnedWindowInfo[]) => void
  setMaxWindows: (n: number) => void
  setBorderColor: (color: string) => void
  setHotkeyEnabled: (v: boolean) => void
  loadSettings: () => Promise<void>
  togglePin: () => Promise<void>
  unpinWindow: (hwnd: number) => Promise<void>
  unpinAll: () => Promise<void>
  updateBorderColor: (color: string) => Promise<void>
}

export const usePinnerStore = create<PinnerStore>((set, get) => ({
  pinnedWindows: [],
  maxWindows: 5,
  borderColor: '#2563EB',
  hotkeyEnabled: true,
  isLoaded: false,

  setPinnedWindows: (list) => set({ pinnedWindows: list }),
  setMaxWindows: (n) => {
    set({ maxWindows: n })
    window.api.settings.set('pinnerMaxWindows', n)
  },
  setBorderColor: (color) => set({ borderColor: color }),
  setHotkeyEnabled: (v) => {
    set({ hotkeyEnabled: v })
    window.api.settings.set('pinnerHotkeyEnabled', v)
  },

  loadSettings: async () => {
    try {
      const maxWindows = (await window.api.settings.get('pinnerMaxWindows')) as number
      const borderColor = (await window.api.settings.get('pinnerBorderColor')) as string
      const hotkeyEnabled = (await window.api.settings.get('pinnerHotkeyEnabled')) as boolean
      set({
        maxWindows: maxWindows || 5,
        borderColor: borderColor || '#2563EB',
        hotkeyEnabled: hotkeyEnabled ?? true,
        isLoaded: true
      })
    } catch {
      set({ isLoaded: true })
    }
  },

  togglePin: async () => {
    const { maxWindows, borderColor } = get()
    try {
      const result = await window.api.pinner.toggle(maxWindows, borderColor)
      if (!result.success) {
        console.warn('[Pinner] Toggle failed:', result.message)
      }
    } catch (e) {
      console.error('[Pinner] Toggle error:', e)
    }
  },

  unpinWindow: async (hwnd: number) => {
    try {
      await window.api.pinner.unpin(hwnd)
    } catch (e) {
      console.error('[Pinner] Unpin error:', e)
    }
  },

  unpinAll: async () => {
    try {
      await window.api.pinner.unpinAll()
    } catch (e) {
      console.error('[Pinner] Unpin all error:', e)
    }
  },

  updateBorderColor: async (color: string) => {
    set({ borderColor: color })
    await window.api.settings.set('pinnerBorderColor', color)
    try {
      await window.api.pinner.setBorderColor(color)
    } catch (e) {
      console.error('[Pinner] Update border color error:', e)
    }
  }
}))
