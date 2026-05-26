import { useNavigate } from 'react-router-dom'
import { Zap, Pin, Clock } from 'lucide-react'
import { usePluginStore } from '@/stores/pluginStore'

interface ToolCard {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ size?: number }>
  status: 'stable' | 'upcoming'
}

const TOOLS: ToolCard[] = [
  {
    id: 'stamina-capture',
    name: '体力捕获',
    description: '截图识别游戏体力值，自动记录并同步',
    icon: Zap,
    status: 'stable',
  },
  {
    id: 'window-pinner',
    name: '置顶窗口',
    description: '将任意窗口固定在屏幕最上层',
    icon: Pin,
    status: 'upcoming',
  },
  {
    id: 'future-1',
    name: '数据看板',
    description: '体力趋势图表与统计分析',
    icon: Clock,
    status: 'upcoming',
  },
  {
    id: 'future-2',
    name: '窗口管理',
    description: '批量窗口布局与分屏管理',
    icon: Clock,
    status: 'upcoming',
  },
]

function HomePage(): React.JSX.Element {
  const navigate = useNavigate()
  const disabledTools = usePluginStore((s) => s.disabledTools)
  const isToolEnabled = usePluginStore((s) => s.isToolEnabled)

  // Tool is grayed if: upcoming (never implemented) OR stable but disabled by user
  const isGrayed = (tool: ToolCard): boolean => {
    if (tool.status === 'upcoming') return true
    // stable tools: grayed only if user has disabled them
    return !isToolEnabled(tool.id)
  }

  const isClickable = (tool: ToolCard): boolean => {
    if (tool.status === 'upcoming') return false
    return isToolEnabled(tool.id)
  }

  const getBadge = (tool: ToolCard): string | null => {
    if (tool.status === 'upcoming') return '即将推出'
    if (tool.status === 'stable' && !isToolEnabled(tool.id)) return '已禁用'
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
        {TOOLS.map((tool) => {
          const clickable = isClickable(tool)
          const grayed = isGrayed(tool)
          const badge = getBadge(tool)

          return (
            <div
              key={tool.id}
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
                onClick={() => clickable && navigate(`/tool/${tool.id}`)}
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
                    <tool.icon size={22} />
                  </div>
                  <span className="font-semibold text-base">{tool.name}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {tool.description}
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
