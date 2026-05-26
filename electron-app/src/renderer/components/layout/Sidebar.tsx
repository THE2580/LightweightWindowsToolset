import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home, Zap, Pin, MessageSquare, Settings, PanelLeftClose, PanelLeft
} from 'lucide-react'
import { usePluginStore } from '@/stores/pluginStore'
import { BUILTIN_PLUGINS } from '@/lib/plugin-registry'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  'home': Home,
  'zap': Zap,
  'pin': Pin,
  'message-square': MessageSquare,
  'clock': Home,
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
        'flex flex-col bg-secondary border-r border-border flex-shrink-0 transition-all duration-200 overflow-hidden',
        sidebarCollapsed ? 'w-11' : 'w-[155px]'
      )}
    >
      <div className="flex justify-end p-1">
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-md hover:bg-muted transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft size={13} /> : <PanelLeftClose size={13} />}
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 px-1">
        {navItems.map((item) => {
          const upcoming = isToolUpcoming(item.id)
          const enabled = item.id === 'home' || isToolEnabled(item.id)
          const active = isActive(item)

          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center rounded-md text-xs transition-all duration-150',
                sidebarCollapsed && 'justify-center',
                !enabled && 'opacity-40'
              )}
            >
              <button
                onClick={() => handleToolClick(item)}
                disabled={!enabled}
                className={cn(
                  'flex items-center gap-[5px] flex-1 px-2 py-1.5 rounded-md text-xs min-w-0',
                  active && enabled
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                  !enabled && 'cursor-not-allowed',
                  sidebarCollapsed && 'justify-center px-1'
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon size={15} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>

              {!sidebarCollapsed && item.id !== 'home' && (
                upcoming ? (
                  <span className="text-[9px] text-muted-foreground/60 px-1 flex-shrink-0">
                    待开发
                  </span>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleToolEnabled(item.id)
                    }}
                    className={cn(
                      'w-7 h-4 rounded-full transition-colors duration-200 flex-shrink-0 mx-0.5',
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
                        'w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200',
                        enabled ? 'translate-x-3' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                )
              )}
            </div>
          )
        })}
      </nav>

      <div className="flex flex-col gap-0.5 px-1 pb-1.5">
        <button
          className={cn(
            'flex items-center gap-[5px] px-2 py-1.5 rounded-md text-xs transition-all duration-150 hover:bg-muted min-w-0',
            sidebarCollapsed && 'justify-center px-1'
          )}
          title={sidebarCollapsed ? 'AI 聊天' : undefined}
        >
          <MessageSquare size={15} className="flex-shrink-0" />
          <span className="truncate">AI 聊天</span>
        </button>

        <button
          onClick={() => {
            usePluginStore.getState().activatePlugin(null)
            navigate('/settings')
          }}
          className={cn(
            'flex items-center gap-[5px] px-2 py-1.5 rounded-md text-xs transition-all duration-150 min-w-0',
            location.pathname === '/settings'
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground hover:bg-muted',
            sidebarCollapsed && 'justify-center px-1'
          )}
          title={sidebarCollapsed ? '设置' : undefined}
        >
          <Settings size={15} className="flex-shrink-0" />
          <span className="truncate">设置</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar
