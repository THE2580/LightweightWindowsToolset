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

interface SidebarProps {
  onToggleChat: () => void
}

function Sidebar({ onToggleChat }: SidebarProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    sidebarCollapsed, toggleSidebar, isToolEnabled, toggleToolEnabled, isToolUpcoming
  } = usePluginStore()

  const isActive = (path: string): boolean => {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path
  }

  const handleNav = (path: string, id: string): void => {
    if (id !== 'home' && !isToolEnabled(id)) return
    usePluginStore.getState().activatePlugin(id === 'home' ? 'home' : id)
    navigate(path)
  }

  const btnCls = (active: boolean, enabled: boolean): string =>
    cn(
      'flex items-center gap-1.5 w-full px-1.5 py-1.5 rounded-md text-xs transition-colors duration-150',
      active && enabled
        ? 'bg-primary text-primary-foreground'
        : 'text-foreground hover:bg-muted',
      !enabled && 'cursor-not-allowed opacity-40'
    )

  return (
    <div
      className={cn(
        'flex flex-col bg-secondary border-r border-border flex-shrink-0 overflow-hidden',
        'transition-[width] duration-200 ease-out',
        sidebarCollapsed ? 'w-11' : 'w-[155px]'
      )}
    >
      {/* Collapse toggle - right-aligned when expanded, slides toward center on collapse */}
      <div className="flex justify-end px-1.5 pt-1.5 pb-0.5">
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-md hover:bg-muted transition-colors"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* Tool nav items */}
      <nav className="flex-1 flex flex-col gap-0.5 px-1.5">
        {/* Home */}
        <button
          onClick={() => handleNav('/', 'home')}
          className={btnCls(isActive('/'), true)}
          title={sidebarCollapsed ? '首页' : undefined}
        >
          <span className="w-5 flex-shrink-0 flex justify-center"><Home size={15} /></span>
          <span className="truncate">首页</span>
        </button>

        {BUILTIN_PLUGINS.map((plugin) => {
          const upcoming = isToolUpcoming(plugin.id)
          const enabled = !upcoming && isToolEnabled(plugin.id)
          const active = isActive(`/tool/${plugin.id}`)
          const Icon = ICON_MAP[plugin.icon] || Zap
          const path = `/tool/${plugin.id}`

          return (
            <div key={plugin.id} className="flex items-center gap-0.5">
              <button
                onClick={() => handleNav(path, plugin.id)}
                disabled={!enabled}
                className={cn(btnCls(active, enabled), 'flex-1 min-w-0')}
                title={sidebarCollapsed ? plugin.name : undefined}
              >
                <span className="w-5 flex-shrink-0 flex justify-center"><Icon size={15} /></span>
                <span className="truncate">{plugin.name}</span>
              </button>

              {!sidebarCollapsed && (
                upcoming ? (
                  <span className="text-[9px] text-muted-foreground/60 flex-shrink-0">待开发</span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleToolEnabled(plugin.id) }}
                    className={cn(
                      'w-7 h-4 rounded-full transition-colors duration-200 flex-shrink-0',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      enabled ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                    aria-label={`${enabled ? 'Disable' : 'Enable'} ${plugin.name}`}
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

      {/* Bottom: AI Chat + Settings */}
      <div className="flex flex-col gap-0.5 px-1.5 pb-2">
        <button
          onClick={onToggleChat}
          className={cn(btnCls(false, true), 'min-w-0')}
          title={sidebarCollapsed ? 'AI 聊天' : undefined}
        >
          <span className="w-5 flex-shrink-0 flex justify-center"><MessageSquare size={15} /></span>
          <span className="truncate">AI 聊天</span>
        </button>

        <button
          onClick={() => {
            usePluginStore.getState().activatePlugin(null)
            navigate('/settings')
          }}
          className={cn(
            btnCls(isActive('/settings'), true),
            'min-w-0'
          )}
          title={sidebarCollapsed ? '设置' : undefined}
        >
          <span className="w-5 flex-shrink-0 flex justify-center"><Settings size={15} /></span>
          <span className="truncate">设置</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar
