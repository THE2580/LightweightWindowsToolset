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

  setPlugins: (plugins: PluginInfo[]) => void
  activatePlugin: (id: string) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  activePluginId: null,
  sidebarCollapsed: false,

  setPlugins: (plugins) => set({ plugins }),

  activatePlugin: (id) => set({ activePluginId: id }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed })
}))
