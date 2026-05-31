/**
 * Store for window pinning — communicates with pinman.exe via IPC.
 */
import { create } from 'zustand'

export interface PinnedWindowInfo {
  hwnd: number
  title: string
}

interface PinnerStore {
  pinnedWindows: PinnedWindowInfo[]
  maxPins: number
  hotkeyActive: boolean
  selfHwnd: number
  isLoaded: boolean
  isPinmanRunning: boolean

  loadSettings: () => Promise<void>
  refreshStatus: () => Promise<void>
  togglePin: () => Promise<void>
  pinHwnd: (hwnd: number) => Promise<void>
  unpin: (hwnd: number) => Promise<void>
  unpinAll: () => Promise<void>
  setMaxPins: (n: number) => Promise<void>
  setHotkey: (hotkey: string) => Promise<void>
  checkPinman: () => Promise<void>
  listenEvents: () => () => void
  resetRuntimeState: () => void
}

export const usePinnerStore = create<PinnerStore>((set, get) => ({
  pinnedWindows: [],
  maxPins: 10,
  hotkeyActive: false,
  selfHwnd: 0,
  isLoaded: false,
  isPinmanRunning: false,

  loadSettings: async () => {
    try {
      const maxPins = (await window.api.settings.get('pinnerMaxPins') as number) || 10
      set({ maxPins, isLoaded: true })
    } catch { /* settings not available yet */ }
  },

  refreshStatus: async () => {
    try {
      const ping = await window.api.pinman.ping()
      if (ping !== 'PONG') {
        set({ isPinmanRunning: false })
        return
      }
      const status = await window.api.pinman.status()
      set({
        pinnedWindows: status.windows.map(w => ({
          hwnd: w.hwnd,
          title: w.title,
        })),
        maxPins: status.maxPins,
        hotkeyActive: status.hotkeyActive,
        selfHwnd: (status as Record<string, unknown>).selfHwnd as number || 0,
        isPinmanRunning: true,
      })
    } catch {
      set({ isPinmanRunning: false })
    }
  },

  togglePin: async () => {
    try {
      await window.api.pinman.toggle()
      await get().refreshStatus()
    } catch { /* pinman not running */ }
  },

  pinHwnd: async (hwnd: number) => {
    try {
      await window.api.pinman.pinHwnd(hwnd)
      await get().refreshStatus()
    } catch { /* ignore */ }
  },

  unpin: async (hwnd: number) => {
    try {
      await window.api.pinman.unpin(hwnd)
      await get().refreshStatus()
    } catch { /* ignore */ }
  },

  unpinAll: async () => {
    try {
      await window.api.pinman.unpinAll()
      await get().refreshStatus()
    } catch { /* ignore */ }
  },

  setMaxPins: async (n: number) => {
    set({ maxPins: n })
    try {
      await window.api.pinman.config('maxPins', String(n))
      await window.api.settings.set('pinnerMaxPins', n)
    } catch { /* ignore */ }
  },

  setHotkey: async (hotkey: string) => {
    try {
      await window.api.pinman.config('hotkey', hotkey)
    } catch { /* ignore */ }
  },

  checkPinman: async () => {
    try {
      const resp = await window.api.pinman.ping()
      set({ isPinmanRunning: resp === 'PONG' })
    } catch {
      set({ isPinmanRunning: false })
    }
  },

  listenEvents: () => {
    try {
      return window.api.pinman.onEvent((event) => {
        const { type, hwnd, title } = event
        if (type === 'pinned') {
          set((state) => ({
            pinnedWindows: [
              ...state.pinnedWindows.filter((w) => w.hwnd !== hwnd),
              { hwnd, title: title || '' },
            ],
          }))
        } else if (type === 'unpinned') {
          set((state) => ({
            pinnedWindows: state.pinnedWindows.filter((w) => w.hwnd !== hwnd),
          }))
        }
      })
    } catch { return () => {} }
  },

  resetRuntimeState: () => {
    set({
      pinnedWindows: [],
      hotkeyActive: false,
      selfHwnd: 0,
      isPinmanRunning: false,
    })
  },
}))
