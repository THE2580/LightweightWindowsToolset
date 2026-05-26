import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, Zap, Pin, MessageSquare, Settings, PanelLeftClose, PanelLeft
} from 'lucide-react'
import { usePluginStore } from '@/stores/pluginStore'
import { BUILTIN_PLUGINS } from '@/lib/plugin-registry'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

// Map icon string names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  'home': Home,
  'zap': Zap,
  'pin': Pin,
  'message-square': MessageSquare,
  'clock': Home, // fallback
  'settings': Settings
}

interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  path: string
}

function getNavItems(): NavItem[] {
  const items: NavItem[] = [
    { id: 'home', label: '首页', icon: Home, path: '/' }
  ]

  // Add all built-in plugins
  for (const plugin of BUILTIN_PLUGINS) {
    items.push({
      id: plugin.id,
      label: plugin.name,
      icon: ICON_MAP[plugin.icon] || Zap,
      path: `/tool/${plugin.id}`
    })
  }

  return items
}

function Sidebar(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    sidebarCollapsed, toggleSidebar, isToolEnabled, toggleToolEnabled, isToolUpcoming
  } = usePluginStore()

  const navItems = getNavItems()

  const isActive = (item: NavItem): boolean => {
    if (item.id === 'home') return location.pathname === '/'
    return location.pathname === item.path
  }

  const handleToolClick = (item: NavItem): void => {
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
      <div className="flex justify-end p-2">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2">
        {navItems.map((item) => {
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
              <button
                onClick={() => handleToolClick(item)}
                disabled={!enabled}
                className={cn(
                  'flex items-center gap-[5px] flex-1 px-3 py-2.5 rounded-md text-sm',
                  active && enabled
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                  !enabled && 'cursor-not-allowed',
                  sidebarCollapsed && 'justify-center px-2'
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={18} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>

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

      <div className="flex flex-col gap-1 px-2 pb-3">
        <button
          className={cn(
            'flex items-center gap-[5px] px-3 py-2.5 rounded-md text-sm transition-all duration-150 hover:bg-muted',
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
            'flex items-center gap-[5px] px-3 py-2.5 rounded-md text-sm transition-all duration-150',
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
