import { contextBridge, ipcRenderer } from 'electron'

const api = {
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggleMaximize')
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
  tray: {
    onTrayCapture: (callback: () => void): void => {
      ipcRenderer.on('tray:capture', () => callback())
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
