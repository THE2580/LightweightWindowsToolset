import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
let mainWindowRef: BrowserWindow | null = null

function buildMenu(): Electron.Menu {
  if (!mainWindowRef) return Menu.buildFromTemplate([])

  return Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: (): void => {
        mainWindowRef!.show()
        mainWindowRef!.focus()
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: (): void => {
        mainWindowRef!.show()
        mainWindowRef!.focus()
        setTimeout(() => {
          mainWindowRef!.webContents.send('navigate', '/settings')
        }, 100)
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
}

export function createTray(mainWindow: BrowserWindow): Tray {
  mainWindowRef = mainWindow

  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('轻量化工具集')

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // Rebuild menu on right-click to reflect current tool states
  tray.on('right-click', () => {
    if (tray) {
      tray.setContextMenu(buildMenu())
    }
  })

  tray.setContextMenu(buildMenu())

  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
  mainWindowRef = null
}
