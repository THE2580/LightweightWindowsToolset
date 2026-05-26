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
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  activePluginId: null,
  sidebarCollapsed: false,
  disabledTools: new Set<string>(['window-pinner']),

  setPlugins: (plugins) => set({ plugins }),

  activatePlugin: (id) => set({ activePluginId: id }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  toggleToolEnabled: (id) => {
    const next = new Set(get().disabledTools)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    set({ disabledTools: next })
  },

  isToolEnabled: (id) => !get().disabledTools.has(id)
}))
