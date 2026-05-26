import { ipcMain } from 'electron'
import Store from 'electron-store'

const store = new Store({
  defaults: {
    theme: 'system',
    autoStart: false,
    aiChatPosition: 'right',
    backendUrl: 'http://100.70.198.102:8000',
    deepseekModel: 'deepseek-v4-flash'
  }
})

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (_event, key: string) => {
    return store.get(key)
  })

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    store.set(key, value)
  })

  ipcMain.handle('settings:getAll', () => {
    return store.store
  })

  ipcMain.handle('settings:delete', (_event, key: string) => {
    store.delete(key)
  })
}
