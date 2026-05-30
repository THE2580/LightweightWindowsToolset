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
      trigger: () => Promise<{
        ocrText: string
        imageBase64: string
        success: boolean
        errorCode?: string
        errorMessage?: string
      }>
      detectForeground: () => Promise<{ processName: string; resolvedGameId: string | null; isDesktop: boolean }>
      notify: (title: string, body: string, isSuccess?: boolean) => Promise<void>
    }
    overlay: {
      create: (a: string, b: string[], c?: boolean) => Promise<void>
      update: (a: { s: string; l: string }[], b: string) => Promise<void>
      result: (a: { s: string; l: string }[], b: string, c: string, d: boolean) => Promise<void>
      close: () => Promise<void>
    }
    queue: {
      add: (payload: unknown) => Promise<void>
      getCount: () => Promise<number>
      flush: () => Promise<{ flushed: number; remaining: number }>
    }
    backend: {
      postRecord: (payload: { game_name: string; resource_type: string; current_resource: number; max_resource: number; capture_time: string; platform: string }) => Promise<{ id: number; game_name: string; resource_type: string; current_resource: number; max_resource: number; capture_time: string; platform: string }>
      getToday: () => Promise<{ id: number; game_name: string; resource_type: string; current_resource: number; max_resource: number; capture_time: string; platform: string }[]>
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
    pinner: {
      toggle: (borderColor: string) => Promise<{ success: boolean; action?: string; hwnd?: number; processName?: string; windowTitle?: string; reason?: string; message?: string }>
      unpin: () => Promise<{ success: boolean }>
      getState: () => Promise<{ hwnd: number; processName: string; windowTitle: string; pinnedAt: number } | null>
      setBorderColor: (color: string) => Promise<{ success: boolean }>
      onStateUpdate: (callback: (info: { hwnd: number; processName: string; windowTitle: string; pinnedAt: number } | null) => void) => (() => void)
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
