import { Tray, Menu, nativeImage, BrowserWindow, app, ipcMain } from 'electron'
import { join } from 'path'

const TOOLS = [
  { id: 'resource-capture', label: '游戏资源捕获' },
]

// Tool enabled states synced from renderer (default: all enabled)
const toolStates = new Map<string, boolean>(
  TOOLS.map((t) => [t.id, true])
)

let tray: Tray | null = null
let mainWindowRef: BrowserWindow | null = null

function buildToolSubmenu(): Electron.MenuItemConstructorOptions[] {
  return TOOLS.map((tool) => ({
    label: tool.label,
    type: 'checkbox' as const,
    checked: toolStates.get(tool.id) ?? true,
    click: (): void => {
      if (mainWindowRef) {
        mainWindowRef.webContents.send('tray:toggle-tool', tool.id)
      }
    }
  }))
}

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
      label: '工具管理',
      submenu: buildToolSubmenu()
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

  // Listen for tool state sync from renderer
  ipcMain.handle('tray:update-tool-state', (_event, toolId: string, enabled: boolean) => {
    toolStates.set(toolId, enabled)
  })

  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
  mainWindowRef = null
}
