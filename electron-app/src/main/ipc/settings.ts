import { app, ipcMain, safeStorage, dialog } from 'electron'
import { execFile } from 'child_process'
import Store from 'electron-store'
import { getStorageDir, getStoragePathDisplay, setStoragePath } from '../utils/storage-path'

const store = new Store({
  cwd: getStorageDir(),
  defaults: {
    theme: 'system',
    autoStart: false,
    backendUrl: 'http://100.70.198.102:8000',
    deepseekModel: 'deepseek-v4-flash',
    windowTitle: '轻量化工具集',
    closeBehavior: 'quit',
    captureHotkey: '',
    chatHotkey: '',
    chatClickOutsideToClose: false,
    chatAutoExpand: false,
    chatExpandZoneVisible: false,
    chatExpandZoneWidth: 20,
    chatExpandZoneHeight: 100,
    chatAutoExpandDelay: 300,
    captureHotkeyEnabled: true,
    chatHotkeyEnabled: true,
    developerMode: false,
  }
})

const ENCRYPTED_KEYS = new Set(['deepseekApiKey'])
const WINDOWS_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const STALE_DEV_LOGIN_ITEM = 'electron.app.Electron'
const STALE_PACKAGED_LOGIN_ITEM = 'electron.app.轻量化工具集'

function cleanupStaleLoginItem(name: string): void {
  if (process.platform !== 'win32') return
  execFile('reg.exe', ['query', WINDOWS_RUN_KEY, '/v', name], (queryError, stdout) => {
    if (queryError || !stdout.toLowerCase().includes(process.execPath.toLowerCase())) return
    execFile('reg.exe', ['delete', WINDOWS_RUN_KEY, '/v', name, '/f'], (deleteError) => {
      if (deleteError) console.warn('[settings] Failed to remove stale login item:', name, deleteError.message)
      else console.info('[settings] Removed stale login item:', name)
    })
  })
}

export function syncAutoStartWithOs(): void {
  const autoStart = store.get('autoStart', false) as boolean
  // Never register node_modules/electron.exe as a Windows login item.
  // Calling this with false in development also removes stale entries
  // created by older development builds.
  app.setLoginItemSettings({ openAtLogin: app.isPackaged && autoStart })
  if (app.isPackaged) cleanupStaleLoginItem(STALE_PACKAGED_LOGIN_ITEM)
  else cleanupStaleLoginItem(STALE_DEV_LOGIN_ITEM)
}

export function getStore(): Store {
  return store
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (_event, key: string) => {
    const value = store.get(key)
    if (ENCRYPTED_KEYS.has(key) && typeof value === 'string' && value) {
      try {
        const buffer = Buffer.from(value, 'hex')
        if (safeStorage.isEncryptionAvailable()) {
          return safeStorage.decryptString(buffer)
        }
      } catch { /* fall through */ }
    }
    return value
  })

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    if (ENCRYPTED_KEYS.has(key) && typeof value === 'string' && value) {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(value)
        store.set(key, encrypted.toString('hex'))
        return
      }
    }
    store.set(key, value)

    // Apply autoStart setting to the OS
    if (key === 'autoStart') {
      app.setLoginItemSettings({ openAtLogin: app.isPackaged && !!value })
    }
  })

  ipcMain.handle('settings:getAll', () => {
    const all = { ...store.store }
    for (const key of ENCRYPTED_KEYS) {
      const value = all[key]
      if (typeof value === 'string' && value) {
        try {
          const buffer = Buffer.from(value, 'hex')
          if (safeStorage.isEncryptionAvailable()) {
            all[key] = safeStorage.decryptString(buffer)
          }
        } catch { /* keep as-is */ }
      }
    }
    return all
  })

  ipcMain.handle('settings:get-storage-path', () => {
    return getStoragePathDisplay()
  })

  ipcMain.handle('settings:set-storage-path', (_event, newPath: string) => {
    return setStoragePath(newPath)
  })

  ipcMain.handle('settings:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'select data dir'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('settings:delete', (_event, key: string) => {
    store.delete(key)
  })
}
