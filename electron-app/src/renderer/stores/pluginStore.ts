import { create } from 'zustand'
import { BUILTIN_PLUGINS } from '@/lib/plugin-registry'

interface PluginInfo {
  id: string
  name: string
  version: string
  description: string
  icon: string
  entry: string
  source: 'tools' | 'features'
  dirPath: string
}

export type ToolStatus = 'stable' | 'upcoming'

// Tools that are not yet implemented — cannot be enabled
const UPCOMING_TOOLS = new Set<string>(
  BUILTIN_PLUGINS.filter((p) => p.status === 'upcoming').map((p) => p.id)
)

interface PluginState {
  plugins: PluginInfo[]
  activePluginId: string | null
  sidebarCollapsed: boolean
  disabledTools: Set<string>
  disabledToolsLoaded: boolean
  chatOpen: boolean

  setPlugins: (plugins: PluginInfo[]) => void
  activatePlugin: (id: string) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  toggleToolEnabled: (id: string) => void
  isToolEnabled: (id: string) => boolean
  isToolUpcoming: (id: string) => boolean
  getToolStatus: (id: string) => ToolStatus
  loadDisabledTools: () => Promise<void>
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  activePluginId: null,
  sidebarCollapsed: false,
  disabledTools: new Set<string>([]),
  disabledToolsLoaded: false,
  chatOpen: false,

  setPlugins: (plugins) => set({ plugins }),

  activatePlugin: (id) => set({ activePluginId: id }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setChatOpen: (open) => set({ chatOpen: open }),

  toggleToolEnabled: (id) => {
    if (UPCOMING_TOOLS.has(id)) return
    const next = new Set(get().disabledTools)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    set({ disabledTools: next })
    const enabled = !next.has(id)
    // Persist disabled state
    window.api.settings.set('disabledTools', JSON.stringify([...next]))
    // Notify main process to unregister/re-register hotkey
    window.api.tool.setEnabled(id, enabled)
  },

  isToolEnabled: (id) => {
    if (UPCOMING_TOOLS.has(id)) return false
    return !get().disabledTools.has(id)
  },

  isToolUpcoming: (id) => UPCOMING_TOOLS.has(id),

  getToolStatus: (id) => UPCOMING_TOOLS.has(id) ? 'upcoming' : 'stable',

  loadDisabledTools: async () => {
    try {
      const raw = await window.api.settings.get('disabledTools') as string | undefined
      if (raw) {
        const arr: string[] = JSON.parse(raw)
        set({ disabledTools: new Set(arr), disabledToolsLoaded: true })
      } else {
        set({ disabledToolsLoaded: true })
      }
    } catch {
      set({ disabledToolsLoaded: true })
    }
  }
}))

export function initPluginStore(): void {
  const store = usePluginStore.getState()
  if (store.plugins.length > 0) return

  store.setPlugins(
    BUILTIN_PLUGINS.filter((p) => p.status === 'stable').map((p) => ({
      id: p.id,
      name: p.name,
      version: '1.0.0',
      description: p.description,
      icon: p.icon,
      entry: p.entry,
      source: 'features' as const,
      dirPath: ''
    }))
  )
}
