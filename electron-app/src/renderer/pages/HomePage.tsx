import { useNavigate } from 'react-router-dom'
import { Zap, Pin, Clock, Keyboard, BarChart3 } from 'lucide-react'
import { usePluginStore } from '@/stores/pluginStore'
import { BUILTIN_PLUGINS } from '@/lib/plugin-registry'
import AnimatedRoute from '@/components/shared/AnimatedRoute'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  'zap': Zap,
  'pin': Pin,
  'keyboard': Keyboard,
  'chart': BarChart3,
  'clock': Clock
}

function HomePage(): React.JSX.Element {
  const navigate = useNavigate()
  const disabledTools = usePluginStore((s) => s.disabledTools)
  const isToolUpcoming = usePluginStore((s) => s.isToolUpcoming)

  const isEnabled = (id: string): boolean => !disabledTools.has(id)

  const isGrayed = (plugin: (typeof BUILTIN_PLUGINS)[number]): boolean => {
    if (plugin.status === 'upcoming') return true
    return !isEnabled(plugin.id)
  }

  const isClickable = (plugin: (typeof BUILTIN_PLUGINS)[number]): boolean => {
    if (plugin.status === 'upcoming') return false
    return isEnabled(plugin.id)
  }

  const getBadge = (plugin: (typeof BUILTIN_PLUGINS)[number]): string | null => {
    if (plugin.status === 'upcoming') return '即将推出'
    if (plugin.status === 'stable' && !isEnabled(plugin.id)) return '已禁用'
    return null
  }

  return (
    <AnimatedRoute>
      <div className="home-page-enter">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">轻量化工具集</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium">
            Lightweight Windows Toolset
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {BUILTIN_PLUGINS.map((plugin) => {
            const clickable = isClickable(plugin)
            const grayed = isGrayed(plugin)
            const badge = getBadge(plugin)
            const Icon = ICON_MAP[plugin.icon] || Clock

            return (
              <div
                key={plugin.id}
                className={`
                  group relative overflow-hidden rounded-lg border bg-card
                  transition-[border-color,box-shadow,transform] duration-200 ease-out
                  ${grayed
                    ? 'border-border/40 opacity-50'
                    : 'border-border cursor-pointer hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/10 active:translate-y-0 active:shadow-md'
                  }
                `}
              >
                {badge && (
                  <span className="
                    absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium
                    bg-muted text-muted-foreground
                  ">
                    {badge}
                  </span>
                )}

                <button
                  onClick={() => clickable && navigate(`/tool/${plugin.id}`)}
                  disabled={!clickable}
                  className="w-full p-5 text-left disabled:cursor-default"
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`
                      p-2 rounded-md transition-[background-color,color,transform] duration-200 ease-out
                      ${grayed
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary group-hover:-translate-y-0.5 group-hover:scale-105 group-hover:bg-primary/15'
                      }
                    `}>
                      <Icon size={18} />
                    </div>
                    <span className="font-semibold text-sm">{plugin.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {plugin.description}
                  </p>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </AnimatedRoute>
  )
}

export default HomePage
