import { create } from 'zustand'

export interface PinnedWindowInfo {
  hwnd: number
  processName: string
  windowTitle: string
  pinnedAt: number
}

interface PinnerStore {
  pinnedWindow: PinnedWindowInfo | null
  borderColor: string
  hotkeyEnabled: boolean
  isLoaded: boolean

  setPinnedWindow: (info: PinnedWindowInfo | null) => void
  setBorderColor: (color: string) => void
  setHotkeyEnabled: (v: boolean) => void
  loadSettings: () => Promise<void>
  togglePin: () => Promise<void>
  unpin: () => Promise<void>
  updateBorderColor: (color: string) => Promise<void>
}

export const usePinnerStore = create<PinnerStore>((set, get) => ({
  pinnedWindow: null,
  borderColor: '#2563EB',
  hotkeyEnabled: true,
  isLoaded: false,

  setPinnedWindow: (info) => set({ pinnedWindow: info }),
  setBorderColor: (color) => set({ borderColor: color }),
  setHotkeyEnabled: (v) => {
    set({ hotkeyEnabled: v })
    window.api.settings.set('pinnerHotkeyEnabled', v)
  },

  loadSettings: async () => {
    try {
      const borderColor = (await window.api.settings.get('pinnerBorderColor')) as string
      const hotkeyEnabled = (await window.api.settings.get('pinnerHotkeyEnabled')) as boolean
      set({
        borderColor: borderColor || '#2563EB',
        hotkeyEnabled: hotkeyEnabled ?? true,
        isLoaded: true
      })
    } catch {
      set({ isLoaded: true })
    }
  },

  togglePin: async () => {
    const { borderColor } = get()
    try {
      const result = await window.api.pinner.toggle(borderColor)
      if (!result.success) {
        console.warn('[Pinner] Toggle failed:', result.message)
      }
    } catch (e) {
      console.error('[Pinner] Toggle error:', e)
    }
  },

  unpin: async () => {
    try {
      await window.api.pinner.unpin()
    } catch (e) {
      console.error('[Pinner] Unpin error:', e)
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
