import { contextBridge, ipcRenderer } from 'electron'

// Types for pinman communication
export interface PinEntry {
  hwnd: number
  title: string
  color: string
}

export interface PinStatus {
  pinned: number
  maxPins: number
  hotkeyActive: boolean
  windows: PinEntry[]
}

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
    getAll: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('settings:getAll'),
    getStoragePath: (): Promise<string> => ipcRenderer.invoke('settings:get-storage-path'),
    setStoragePath: (newPath: string): Promise<{ success: boolean; error?: string; newPath?: string }> =>
      ipcRenderer.invoke('settings:set-storage-path', newPath),
    selectFolder: (): Promise<string | null> => ipcRenderer.invoke('settings:select-folder')
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
    getLatest: (): Promise<{ id: number; game_name: string; resource_type: string; current_resource: number; max_resource: number; capture_time: string; platform: string }[]> =>
      ipcRenderer.invoke('backend:get-latest')
  },
  logs: {
    get: (): Promise<{ id: number; timestamp: string; level: 'log' | 'info' | 'warn' | 'error'; source: 'main' | 'renderer'; message: string }[]> =>
      ipcRenderer.invoke('logs:get'),
    clear: (): Promise<void> => ipcRenderer.invoke('logs:clear'),
    append: (level: 'log' | 'info' | 'warn' | 'error', args: unknown[]): void =>
      ipcRenderer.send('logs:append-renderer', level, args),
    onEntry: (callback: (entry: { id: number; timestamp: string; level: 'log' | 'info' | 'warn' | 'error'; source: 'main' | 'renderer'; message: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, entry: { id: number; timestamp: string; level: 'log' | 'info' | 'warn' | 'error'; source: 'main' | 'renderer'; message: string }) => callback(entry)
      ipcRenderer.on('logs:entry', handler)
      return () => { ipcRenderer.removeListener('logs:entry', handler) }
    },
    onCleared: (callback: () => void): (() => void) => {
      const handler = () => callback()
      ipcRenderer.on('logs:cleared', handler)
      return () => { ipcRenderer.removeListener('logs:cleared', handler) }
    }
  },
  keystats: {
    snapshot: (): Promise<{ today: string; days: Record<string, Record<string, number>> }> =>
      ipcRenderer.invoke('keystats:snapshot'),
    ping: (): Promise<string> => ipcRenderer.invoke('keystats:ping')
  },
  appstats: {
    snapshot: (): Promise<{ today: string; activeProcess: string | null; isAfk: boolean; afkThresholdSec: number; days: Record<string, Record<string, number>> }> =>
      ipcRenderer.invoke('appstats:snapshot'),
    ping: (): Promise<string> => ipcRenderer.invoke('appstats:ping'),
    clear: (): Promise<string> => ipcRenderer.invoke('appstats:clear'),
    configAfk: (thresholdSec: number): Promise<string> => ipcRenderer.invoke('appstats:config-afk', thresholdSec)
  },
  timer: {
    getSnapshot: (): Promise<unknown> => ipcRenderer.invoke('timer:get-snapshot'),
    create: (input: unknown): Promise<unknown> => ipcRenderer.invoke('timer:create', input),
    update: (id: string, patch: unknown): Promise<unknown> => ipcRenderer.invoke('timer:update', id, patch),
    delete: (id: string): Promise<unknown> => ipcRenderer.invoke('timer:delete', id),
    start: (id: string): Promise<unknown> => ipcRenderer.invoke('timer:start', id),
    pause: (id: string): Promise<unknown> => ipcRenderer.invoke('timer:pause', id),
    reset: (id: string): Promise<unknown> => ipcRenderer.invoke('timer:reset', id),
    resetPaused: (): Promise<unknown> => ipcRenderer.invoke('timer:reset-paused'),
    reorder: (ids: string[]): Promise<unknown> => ipcRenderer.invoke('timer:reorder', ids),
    pauseAll: (): Promise<unknown> => ipcRenderer.invoke('timer:pause-all'),
    openFloating: (id: string): Promise<unknown> => ipcRenderer.invoke('timer:open-floating', id),
    closeFloating: (id: string): Promise<unknown> => ipcRenderer.invoke('timer:close-floating', id),
    closeAllFloating: (): Promise<unknown> => ipcRenderer.invoke('timer:close-all-floating'),
    onSnapshot: (callback: (snapshot: unknown) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) => callback(snapshot)
      ipcRenderer.on('timer:snapshot', handler)
      return () => { ipcRenderer.removeListener('timer:snapshot', handler) }
    }
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
  updater: {
    getState: (): Promise<unknown> => ipcRenderer.invoke('updater:get-state'),
    check: (): Promise<unknown> => ipcRenderer.invoke('updater:check'),
    download: (): Promise<unknown> => ipcRenderer.invoke('updater:download'),
    apply: (): Promise<void> => ipcRenderer.invoke('updater:apply'),
    openRelease: (): Promise<void> => ipcRenderer.invoke('updater:open-release'),
    onState: (callback: (state: unknown) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: unknown) => callback(state)
      ipcRenderer.on('updater:state', handler)
      return () => { ipcRenderer.removeListener('updater:state', handler) }
    }
  },
  pinman: {
    toggle: (): Promise<string> => ipcRenderer.invoke('pinman:toggle'),
    pinHwnd: (hwnd: number): Promise<string> => ipcRenderer.invoke('pinman:pin-hwnd', hwnd),
    unpin: (hwnd: number): Promise<string> => ipcRenderer.invoke('pinman:unpin', hwnd),
    unpinAll: (): Promise<string> => ipcRenderer.invoke('pinman:unpin-all'),
    status: (): Promise<PinStatus> => ipcRenderer.invoke('pinman:status'),
    config: (key: string, value: string): Promise<string> => ipcRenderer.invoke('pinman:config', key, value),
    ping: (): Promise<string> => ipcRenderer.invoke('pinman:ping'),
    onEvent: (callback: (event: { type: string; hwnd: number; title?: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { type: string; hwnd: number; title?: string }) => callback(data)
      ipcRenderer.on('pinman:event', handler)
      return () => { ipcRenderer.removeListener('pinman:event', handler) }
    },
  },
  hotkey: {
    onHotkey: (callback: (action: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
      ipcRenderer.on('hotkey:resource-capture', () => handler(null as any, 'resource-capture'))
      ipcRenderer.on('hotkey:ai-chat', () => handler(null as any, 'ai-chat'))
      // window-pinner hotkey is now handled directly by pinman.exe (no Electron IPC needed)
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
