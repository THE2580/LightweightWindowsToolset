import { contextBridge, ipcRenderer } from 'electron'

const api = {
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggleMaximize'),
    setTitle: (title: string): Promise<void> => ipcRenderer.invoke('window:setTitle', title)
  },
  settings: {
    get: (key: string): Promise<unknown> => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value),
    getAll: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('settings:getAll')
  },
  capture: {
    trigger: (): Promise<{ ocrText: string; imageBase64: string }> =>
      ipcRenderer.invoke('capture:trigger')
  },
  queue: {
    add: (payload: unknown): Promise<void> => ipcRenderer.invoke('queue:add', payload),
    getCount: (): Promise<number> => ipcRenderer.invoke('queue:getCount'),
    flush: (): Promise<{ flushed: number; remaining: number }> =>
      ipcRenderer.invoke('queue:flush')
  },
  tavily: {
    search: (query: string, apiKey: string): Promise<unknown> =>
      ipcRenderer.invoke('tavily:search', query, apiKey)
  },
  tray: {
    onTrayCapture: (callback: () => void): (() => void) => {
      ipcRenderer.on('tray:capture', () => callback())
      return () => { ipcRenderer.removeAllListeners('tray:capture') }
    },
    onNavigate: (callback: (path: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, path: string) => callback(path)
      ipcRenderer.on('navigate', handler)
      return () => { ipcRenderer.removeListener('navigate', handler) }
    },
    onToolToggle: (callback: (toolId: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, toolId: string) => callback(toolId)
      ipcRenderer.on('tray:toggle-tool', handler)
      return () => { ipcRenderer.removeListener('tray:toggle-tool', handler) }
    },
    notifyToolState: (toolId: string, enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('tray:update-tool-state', toolId, enabled)
  },
  hotkey: {
    onHotkey: (callback: (action: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
      ipcRenderer.on('hotkey:stamina-capture', () => handler(null as any, 'stamina-capture'))
      ipcRenderer.on('hotkey:ai-chat', () => handler(null as any, 'ai-chat'))
      return () => {
        ipcRenderer.removeAllListeners('hotkey:stamina-capture')
        ipcRenderer.removeAllListeners('hotkey:ai-chat')
      }
    },
    updateHotkey: (action: string, accelerator: string): Promise<void> =>
      ipcRenderer.invoke('hotkey:update', action, accelerator),
    setHotkeyEnabled: (action: string, enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('hotkey:set-enabled', action, enabled),
    disableAllHotkeys: (): Promise<void> =>
      ipcRenderer.invoke('hotkey:disable-all'),
    enableAllHotkeys: (): Promise<void> =>
      ipcRenderer.invoke('hotkey:enable-all'),
    checkConflict: (accelerator: string, excludeAction: string): Promise<string | null> =>
      ipcRenderer.invoke('hotkey:check-conflict', accelerator, excludeAction)
  }
}

contextBridge.exposeInMainWorld('api', api)
