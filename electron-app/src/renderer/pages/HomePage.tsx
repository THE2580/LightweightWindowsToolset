import { useNavigate } from 'react-router-dom'
import { Zap, Pin, Settings } from 'lucide-react'

const TOOLS = [
  {
    id: 'stamina-capture',
    name: '体力捕获',
    description: '截图识别游戏体力值，自动记录并同步',
    icon: Zap,
  },
  {
    id: 'window-pinner',
    name: '置顶窗口',
    description: '将任意窗口固定在屏幕最上层',
    icon: Pin,
    disabled: true,
  },
]

function HomePage(): React.JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">LightweightWindowsToolset</h1>
      <p className="text-muted-foreground mb-8">轻量化 Windows 桌面工具集</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => !tool.disabled && navigate(`/tool/${tool.id}`)}
            disabled={tool.disabled}
            className={`
              group p-6 rounded-lg border border-border text-left
              transition-all duration-150
              ${tool.disabled
                ? 'opacity-40 cursor-not-allowed'
                : 'hover:scale-[1.02] hover:shadow-md hover:border-primary/30 bg-card'
              }
            `}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <tool.icon size={20} />
              </div>
              <span className="font-semibold">
                {tool.name}
                {tool.disabled && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">待定</span>
                )}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export default HomePage
