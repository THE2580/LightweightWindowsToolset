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
    tray: {
      onTrayCapture: (callback: () => void) => void
      onNavigate: (callback: (path: string) => void) => void
      onToolToggle: (callback: (toolId: string) => void) => void
    }
  }
}
