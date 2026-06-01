import { create } from 'zustand'

export interface AppStatsSnapshot {
  today: string
  activeProcess: string | null
  isAfk: boolean
  afkThresholdSec: number
  days: Record<string, Record<string, number>>
}

interface AppStatsStore {
  snapshot: AppStatsSnapshot
  isRunning: boolean
  aliases: Record<string, string>
  aliasesLoaded: boolean
  refresh: () => Promise<void>
  clear: () => Promise<void>
  setAfkThreshold: (thresholdSec: number) => Promise<void>
  loadAliases: () => Promise<void>
  setAlias: (processName: string, alias: string) => Promise<void>
}

export const useAppStatsStore = create<AppStatsStore>((set, get) => ({
  snapshot: { today: '', activeProcess: null, isAfk: false, afkThresholdSec: 300, days: {} },
  isRunning: false,
  aliases: {},
  aliasesLoaded: false,

  refresh: async () => {
    try {
      const ping = await window.api.appstats.ping()
      if (ping !== 'PONG') {
        set({ isRunning: false })
        return
      }
      const snapshot = await window.api.appstats.snapshot()
      set({ snapshot, isRunning: true })
    } catch {
      set({ isRunning: false })
    }
  },

  clear: async () => {
    await window.api.appstats.clear()
    await get().refresh()
  },

  setAfkThreshold: async (thresholdSec) => {
    await window.api.appstats.configAfk(thresholdSec)
    await get().refresh()
  },

  loadAliases: async () => {
    if (get().aliasesLoaded) return
    try {
      const stored = await window.api.settings.get('appStatsAliases')
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        const aliases = Object.fromEntries(
          Object.entries(stored as Record<string, unknown>)
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0)
            .map(([processName, alias]) => [processName, alias.trim()])
        )
        set({ aliases, aliasesLoaded: true })
        return
      }
    } catch { /* use empty aliases */ }
    set({ aliasesLoaded: true })
  },

  setAlias: async (processName, alias) => {
    const aliases = { ...get().aliases }
    const normalized = alias.trim().slice(0, 60)
    if (normalized) aliases[processName] = normalized
    else delete aliases[processName]
    await window.api.settings.set('appStatsAliases', aliases)
    set({ aliases })
  },
}))
