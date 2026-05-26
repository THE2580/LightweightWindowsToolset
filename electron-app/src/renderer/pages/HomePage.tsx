import { useNavigate } from 'react-router-dom'
import { Zap, Pin, Clock, MessageSquare } from 'lucide-react'
import { usePluginStore } from '@/stores/pluginStore'
import { BUILTIN_PLUGINS } from '@/lib/plugin-registry'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  'zap': Zap,
  'pin': Pin,
  'message-square': MessageSquare,
  'clock': Clock
}

function HomePage(): React.JSX.Element {
  const navigate = useNavigate()
  const isToolEnabled = usePluginStore((s) => s.isToolEnabled)

  const isGrayed = (plugin: (typeof BUILTIN_PLUGINS)[number]): boolean => {
    if (plugin.status === 'upcoming') return true
    return !isToolEnabled(plugin.id)
  }

  const isClickable = (plugin: (typeof BUILTIN_PLUGINS)[number]): boolean => {
    if (plugin.status === 'upcoming') return false
    return isToolEnabled(plugin.id)
  }

  const getBadge = (plugin: (typeof BUILTIN_PLUGINS)[number]): string | null => {
    if (plugin.status === 'upcoming') return '即将推出'
    if (plugin.status === 'stable' && !isToolEnabled(plugin.id)) return '已禁用'
    return null
  }

  return (
    <div>
      {/* Title: Chinese large on top, English small underneath */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">轻量化工具集</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium">
          Lightweight Windows Toolset
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {BUILTIN_PLUGINS.map((plugin) => {
          const clickable = isClickable(plugin)
          const grayed = isGrayed(plugin)
          const badge = getBadge(plugin)
          const Icon = ICON_MAP[plugin.icon] || Clock

          return (
            <div
              key={plugin.id}
              className={`
                relative rounded-lg border bg-card
                transition-all duration-150
                ${grayed
                  ? 'border-border/40 opacity-50'
                  : 'border-border hover:scale-[1.02] hover:shadow-md hover:border-primary/30 cursor-pointer'
                }
              `}
            >
              {badge && (
                <span className="
                  absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-medium
                  bg-muted text-muted-foreground
                ">
                  {badge}
                </span>
              )}

              <button
                onClick={() => clickable && navigate(`/tool/${plugin.id}`)}
                disabled={!clickable}
                className="w-full p-7 text-left disabled:cursor-default"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`
                    p-2.5 rounded-md transition-colors
                    ${grayed
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-primary/10 text-primary'
                    }
                  `}>
                    <Icon size={22} />
                  </div>
                  <span className="font-semibold text-base">{plugin.name}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {plugin.description}
                </p>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default HomePage
