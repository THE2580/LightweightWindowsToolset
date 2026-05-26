import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, Zap, Pin, MessageSquare, Settings, PanelLeftClose, PanelLeft
} from 'lucide-react'
import { usePluginStore } from '@/stores/pluginStore'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'home', label: '首页', icon: Home, path: '/' },
  { id: 'stamina-capture', label: '体力捕获', icon: Zap, path: '/tool/stamina-capture' },
  { id: 'window-pinner', label: '置顶窗口', icon: Pin, path: '/tool/window-pinner' },
]

function Sidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    sidebarCollapsed, toggleSidebar, isToolEnabled, toggleToolEnabled, isToolUpcoming
  } = usePluginStore()

  const isActive = (item: (typeof NAV_ITEMS)[number]): boolean => {
    if (item.id === 'home') return location.pathname === '/'
    return location.pathname === item.path
  }

  const handleToolClick = (item: (typeof NAV_ITEMS)[number]): void => {
    if (item.id === 'home') {
      usePluginStore.getState().activatePlugin('home')
      navigate('/')
      return
    }
    if (!isToolEnabled(item.id)) return
    usePluginStore.getState().activatePlugin(item.id)
    navigate(item.path)
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
        {NAV_ITEMS.map((item) => {
          const upcoming = isToolUpcoming(item.id)
          const enabled = item.id === 'home' || isToolEnabled(item.id)
          const active = isActive(item)

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center rounded-md text-sm transition-all duration-150',
                sidebarCollapsed && 'justify-center',
                !enabled && 'opacity-40'
              )}
            >
              {/* Main button area */}
              <button
                onClick={() => handleToolClick(item)}
                disabled={!enabled}
                className={cn(
                  'flex items-center gap-3 flex-1 px-3 py-2.5 rounded-md',
                  active && enabled
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                  !enabled && 'cursor-not-allowed',
                  sidebarCollapsed && 'justify-center px-2'
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={18} />
                {!sidebarCollapsed && (
                  <span className="truncate flex-1">{item.label}</span>
                )}
              </button>

              {/* Toggle or upcoming badge */}
              {!sidebarCollapsed && item.id !== 'home' && (
                upcoming ? (
                  <span className="text-[10px] text-muted-foreground/60 px-2 flex-shrink-0">
                    待开发
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleToolEnabled(item.id)
                    }}
                    className={cn(
                      'w-8 h-5 rounded-full transition-colors duration-200 flex-shrink-0 mx-1',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      enabled
                        ? 'bg-primary'
                        : 'bg-muted-foreground/30'
                    )}
                    aria-label={`${enabled ? 'Disable' : 'Enable'} ${item.label}`}
                    title={enabled ? `禁用 ${item.label}` : `启用 ${item.label}`}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200',
                        enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                )
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col gap-1 px-2 pb-3">
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
