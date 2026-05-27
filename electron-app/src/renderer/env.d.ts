/// <reference types="vite/client" />

interface Window {
  api: {
    window: {
      minimize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      toggleMaximize: () => Promise<void>
      setTitle: (title: string) => Promise<void>
    }
    settings: {
      get: (key: string) => Promise<unknown>
      set: (key: string, value: unknown) => Promise<void>
      getAll: () => Promise<Record<string, unknown>>
    }
    capture: {
      trigger: () => Promise<{ ocrText: string; imageBase64: string }>
    }
    queue: {
      add: (payload: unknown) => Promise<void>
      getCount: () => Promise<number>
      flush: () => Promise<{ flushed: number; remaining: number }>
    }
    tray: {
      onTrayCapture: (callback: () => void) => (() => void)
      onNavigate: (callback: (path: string) => void) => (() => void)
      onToolToggle: (callback: (toolId: string) => void) => (() => void)
      notifyToolState: (toolId: string, enabled: boolean) => Promise<void>
    }
    tool: {
      setEnabled: (toolId: string, enabled: boolean) => Promise<void>
    }
    hotkey: {
      onHotkey: (callback: (action: string) => void) => (() => void)
      updateHotkey: (action: string, accelerator: string) => Promise<void>
      setHotkeyEnabled: (action: string, enabled: boolean) => Promise<void>
      disableAllHotkeys: () => Promise<void>
      enableAllHotkeys: () => Promise<void>
      checkConflict: (accelerator: string, excludeAction: string) => Promise<string | null>
      getAllAccelerators: () => Promise<Record<string, string>>
    }
  }
}
