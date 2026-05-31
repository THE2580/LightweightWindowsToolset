import { create } from 'zustand'

export interface KeyStatsSnapshot {
  today: string
  days: Record<string, Record<string, number>>
}

interface KeyStatsStore {
  snapshot: KeyStatsSnapshot
  isRunning: boolean
  refresh: () => Promise<void>
}

export const useKeyStatsStore = create<KeyStatsStore>((set) => ({
  snapshot: { today: '', days: {} },
  isRunning: false,

  refresh: async () => {
    try {
      const ping = await window.api.keystats.ping()
      if (ping !== 'PONG') {
        set({ isRunning: false })
        return
      }
      const snapshot = await window.api.keystats.snapshot()
      set({ snapshot, isRunning: true })
    } catch {
      set({ isRunning: false })
    }
  },
}))
