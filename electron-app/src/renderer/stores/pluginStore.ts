import { create } from 'zustand'

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
const UPCOMING_TOOLS = new Set<string>(['window-pinner'])

interface PluginState {
  plugins: PluginInfo[]
  activePluginId: string | null
  sidebarCollapsed: boolean
  disabledTools: Set<string>

  setPlugins: (plugins: PluginInfo[]) => void
  activatePlugin: (id: string) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleToolEnabled: (id: string) => void
  isToolEnabled: (id: string) => boolean
  isToolUpcoming: (id: string) => boolean
  getToolStatus: (id: string) => ToolStatus
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  activePluginId: null,
  sidebarCollapsed: false,
  disabledTools: new Set<string>([]),

  setPlugins: (plugins) => set({ plugins }),

  activatePlugin: (id) => set({ activePluginId: id }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  toggleToolEnabled: (id) => {
    // Upcoming tools cannot be toggled
    if (UPCOMING_TOOLS.has(id)) return
    const next = new Set(get().disabledTools)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    set({ disabledTools: next })
  },

  isToolEnabled: (id) => {
    // Upcoming tools are never enabled
    if (UPCOMING_TOOLS.has(id)) return false
    return !get().disabledTools.has(id)
  },

  isToolUpcoming: (id) => UPCOMING_TOOLS.has(id),

  getToolStatus: (id) => UPCOMING_TOOLS.has(id) ? 'upcoming' : 'stable'
}))
