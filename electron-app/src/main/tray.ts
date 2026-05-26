import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import { join } from 'path'

const TOOLS = [
  { id: 'stamina-capture', label: '体力捕获' },
  { id: 'window-pinner', label: '置顶窗口' },
  { id: 'ai-chat', label: 'AI 聊天' },
]

let tray: Tray | null = null

function buildToolSubmenu(mainWindow: BrowserWindow): Electron.MenuItemConstructorOptions[] {
  return TOOLS.map((tool) => ({
    label: tool.label,
    type: 'checkbox' as const,
    checked: true, // default; will be overridden by the renderer if needed
    click: (): void => {
      mainWindow.webContents.send('tray:toggle-tool', tool.id)
    }
  }))
}

export function createTray(mainWindow: BrowserWindow): Tray {
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

  const buildMenu = (): Electron.Menu => {
    return Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: (): void => {
          mainWindow.show()
          mainWindow.focus()
        }
      },
      { type: 'separator' },
      {
        label: '工具管理',
        submenu: buildToolSubmenu(mainWindow)
      },
      { type: 'separator' },
      {
        label: '设置',
        click: (): void => {
          mainWindow.show()
          mainWindow.focus()
          // Small delay to ensure window is ready before navigating
          setTimeout(() => {
            mainWindow.webContents.send('navigate', '/settings')
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

  tray.setContextMenu(buildMenu())
  return tray
}
