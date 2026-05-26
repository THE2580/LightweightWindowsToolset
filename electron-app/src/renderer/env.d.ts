/// <reference types="vite/client" />

interface Window {
  api: {
    window: {
      minimize: () => void
      close: () => void
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
    }
  }
}
