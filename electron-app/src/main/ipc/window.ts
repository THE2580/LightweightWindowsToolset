import { ipcMain, BrowserWindow } from 'electron'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.handle('window:close', () => {
    mainWindow.close()
  })

  ipcMain.handle('window:isMaximized', () => {
    return false
  })

  ipcMain.handle('window:toggleMaximize', () => {
    return false
  })

  ipcMain.handle('window:setTitle', (_event, title: string) => {
    mainWindow.setTitle(title)
  })
}
