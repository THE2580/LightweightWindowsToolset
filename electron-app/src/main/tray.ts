import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): Tray {
  // Create a 16x16 tray icon (simple colored placeholder)
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('LightweightWindowsToolset')

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: (): void => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: '快速截图 (体力捕获)',
      click: (): void => {
        mainWindow.webContents.send('tray:capture')
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: (): void => {
        mainWindow.show()
        mainWindow.focus()
        mainWindow.webContents.send('navigate', '/settings')
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: (): void => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  return tray
}
