import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Zap, Pin, MessageSquare, Settings, PanelLeftClose, PanelLeft } from 'lucide-react'
import { usePluginStore } from '@/stores/pluginStore'
import { cn } from '@/lib/utils'

// Hardcoded navigation items matching known plugins
const NAV_ITEMS = [
  { id: 'home', label: '首页', icon: Home, path: '/' },
  { id: 'stamina-capture', label: '体力捕获', icon: Zap, path: '/tool/stamina-capture' },
  { id: 'window-pinner', label: '置顶窗口', icon: Pin, path: '/tool/window-pinner', disabled: true },
]

function Sidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar, activePluginId } = usePluginStore()

  const isActive = (item: typeof NAV_ITEMS[number]): boolean => {
    if (item.id === 'home') return location.pathname === '/'
    return location.pathname === item.path
  }

  return (
    <div
      className={cn(
        'flex flex-col bg-secondary border-r border-border flex-shrink-0 transition-all duration-200',
        sidebarCollapsed ? 'w-14' : 'w-[220px]'
      )}
    >
      {/* Collapse toggle */}
      <div className="flex justify-end p-2">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (!item.disabled) {
                usePluginStore.getState().activatePlugin(item.id === 'home' ? null : item.id)
                navigate(item.path)
              }
            }}
            disabled={item.disabled}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150',
              isActive(item)
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted',
              item.disabled && 'opacity-40 cursor-not-allowed',
              sidebarCollapsed && 'justify-center px-2'
            )}
            title={sidebarCollapsed ? item.label : undefined}
          >
            <item.icon size={18} />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col gap-1 px-2 pb-3">
        {/* AI Chat toggle */}
        <button
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150 hover:bg-muted',
            sidebarCollapsed && 'justify-center px-2'
          )}
          title={sidebarCollapsed ? 'AI 聊天' : undefined}
        >
          <MessageSquare size={18} />
          {!sidebarCollapsed && <span>AI 聊天</span>}
        </button>

        {/* Settings */}
        <button
          onClick={() => {
            usePluginStore.getState().activatePlugin(null)
            navigate('/settings')
          }}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150',
            location.pathname === '/settings'
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground hover:bg-muted',
            sidebarCollapsed && 'justify-center px-2'
          )}
          title={sidebarCollapsed ? '设置' : undefined}
        >
          <Settings size={18} />
          {!sidebarCollapsed && <span>设置</span>}
        </button>
      </div>
    </div>
  )
}

export default Sidebar
