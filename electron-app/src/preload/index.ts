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
    trigger: (): Promise<{ ocrText: string; imageBase64: string; success: boolean; errorCode?: string; errorMessage?: string }> => ipcRenderer.invoke('capture:trigger'),
    detectForeground: (): Promise<{ processName: string; resolvedGameId: string | null; isDesktop: boolean }> => ipcRenderer.invoke('capture:detect-foreground'),
    notify: (title: string, body: string, isSuccess?: boolean): Promise<void> =>
      ipcRenderer.invoke('notify:show', title, body, isSuccess)
  },
  overlay: {
    create: (a: string, b: string[], c?: boolean): Promise<void> => ipcRenderer.invoke('overlay:create', a, b, c),
    update: (a: { s: string; l: string }[], b: string): Promise<void> => ipcRenderer.invoke('overlay:update', a, b),
    result: (a: { s: string; l: string }[], b: string, c: string, d: boolean): Promise<void> => ipcRenderer.invoke('overlay:result', a, b, c, d),
    close: (): Promise<void> => ipcRenderer.invoke('overlay:close')
  },
  queue: {
    add: (payload: unknown): Promise<void> => ipcRenderer.invoke('queue:add', payload),
    getCount: (): Promise<number> => ipcRenderer.invoke('queue:getCount'),
    flush: (): Promise<{ flushed: number; remaining: number }> =>
      ipcRenderer.invoke('queue:flush')
  },
  backend: {
    postRecord: (payload: { game_name: string; resource_type: string; current_resource: number; max_resource: number; capture_time: string; platform: string }): Promise<{ id: number; game_name: string; resource_type: string; current_resource: number; max_resource: number; capture_time: string; platform: string }> =>
      ipcRenderer.invoke('backend:post-record', payload),
    getToday: (): Promise<{ id: number; game_name: string; resource_type: string; current_resource: number; max_resource: number; capture_time: string; platform: string }[]> =>
      ipcRenderer.invoke('backend:get-today')
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
  tool: {
    setEnabled: (toolId: string, enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('tool:set-enabled', toolId, enabled)
  },
  pinner: {
    toggle: (maxWindows: number, borderColor: string): Promise<{ success: boolean; action?: string; hwnd?: number; processName?: string; windowTitle?: string; reason?: string; message?: string }> =>
      ipcRenderer.invoke('pinner:toggle', maxWindows, borderColor),
    unpin: (hwnd: number): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('pinner:unpin', hwnd),
    unpinAll: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('pinner:unpin-all'),
    getList: (): Promise<{ hwnd: number; processName: string; windowTitle: string; pinnedAt: number; order: number }[]> =>
      ipcRenderer.invoke('pinner:get-list'),
    setBorderColor: (color: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('pinner:set-border-color', color),
    onListUpdate: (callback: (list: { hwnd: number; processName: string; windowTitle: string; pinnedAt: number; order: number }[]) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, list: unknown) => callback(list as { hwnd: number; processName: string; windowTitle: string; pinnedAt: number; order: number }[])
      ipcRenderer.on('pinner:list-update', handler)
      return () => { ipcRenderer.removeListener('pinner:list-update', handler) }
    },
  },
  hotkey: {
    onHotkey: (callback: (action: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
      ipcRenderer.on('hotkey:resource-capture', () => handler(null as any, 'resource-capture'))
      ipcRenderer.on('hotkey:ai-chat', () => handler(null as any, 'ai-chat'))
      ipcRenderer.on('hotkey:window-pinner', () => handler(null as any, 'window-pinner'))
      return () => {
        ipcRenderer.removeAllListeners('hotkey:resource-capture')
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
      ipcRenderer.invoke('hotkey:check-conflict', accelerator, excludeAction),
    getAllAccelerators: (): Promise<Record<string, string>> =>
      ipcRenderer.invoke('hotkey:get-all-accelerators')
  }
}

contextBridge.exposeInMainWorld('api', api)
