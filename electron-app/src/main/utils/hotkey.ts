import { globalShortcut, BrowserWindow } from 'electron'

interface HotkeyConfig {
  accelerator: string
  action: string
  pluginId: string
}

export function registerHotkeys(
  mainWindow: BrowserWindow,
  hotkeys: HotkeyConfig[]
): void {
  hotkeys.forEach((hk) => {
    try {
      const registered = globalShortcut.register(hk.accelerator, () => {
        mainWindow.webContents.send(`hotkey:${hk.action}`, hk.pluginId)
      })
      if (!registered) {
        console.warn(`Failed to register hotkey: ${hk.accelerator}`)
      }
    } catch (e) {
      console.error(`Error registering hotkey ${hk.accelerator}:`, e)
    }
  })
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll()
}
