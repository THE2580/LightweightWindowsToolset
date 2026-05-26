import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDeepseekStore } from '@/stores/deepseekStore'
import { applyTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Monitor, Sun, Moon, Wrench, Keyboard } from 'lucide-react'

type TabId = 'general' | 'api' | 'hotkey'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'general', label: '通用', icon: Monitor },
  { id: 'api', label: 'API 设置', icon: Wrench },
  { id: 'hotkey', label: '快捷键', icon: Keyboard },
]

function SettingsPage(): React.JSX.Element {
  const {
    theme, autoStart, aiChatPosition, backendUrl, deepseekModel, windowTitle,
    setTheme, setAutoStart, setAiChatPosition, setBackendUrl, setDeepseekModel, setWindowTitle,
    load
  } = useSettingsStore()

  const { apiKey, loadApiKey } = useDeepseekStore()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [titleDraft, setTitleDraft] = useState(windowTitle)

  useEffect(() => {
    load()
    loadApiKey()
  }, [load, loadApiKey])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (apiKey) setApiKeyInput(apiKey)
  }, [apiKey])

  useEffect(() => {
    setTitleDraft(windowTitle)
  }, [windowTitle])

  const handleSaveApiKey = async (): Promise<void> => {
    useDeepseekStore.getState().setApiKey(apiKeyInput)
    await window.api.settings.set('deepseekApiKey', apiKeyInput)
  }

  const handleSaveTitle = async (): Promise<void> => {
    const trimmed = titleDraft.trim()
    if (!trimmed) {
      setTitleDraft(windowTitle)
      return
    }
    await setWindowTitle(trimmed)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">设置</h1>

      <div className="flex border-b border-border mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Window Title */}
            <div className="py-4 border-b border-border/60">
              <Label className="text-base">主窗口标题</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">显示在窗口标题栏的文字</p>
              <div className="flex gap-2">
                <Input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="轻量化工具集"
                  className="max-w-xs"
                />
                <Button onClick={handleSaveTitle} size="sm">保存</Button>
              </div>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-border/60">
              <div>
                <Label className="text-base">开机自启</Label>
                <p className="text-xs text-muted-foreground mt-0.5">应用启动时自动运行</p>
              </div>
              <button
                onClick={() => setAutoStart(!autoStart)}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  autoStart ? 'bg-primary' : 'bg-muted-foreground/25'
                )}
                aria-label={autoStart ? '禁用开机自启' : '启用开机自启'}
              >
                <div
                  className={cn(
                    'w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 mt-0.5',
                    autoStart ? 'translate-x-5.5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-border/60">
              <div>
                <Label className="text-base">主题模式</Label>
                <p className="text-xs text-muted-foreground mt-0.5">切换深色/浅色外观</p>
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                {(['system', 'light', 'dark'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTheme(mode)}
                    className={cn(
                      'px-3 py-1.5 rounded text-xs font-medium transition-all',
                      theme === mode
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {mode === 'system' && <Monitor size={14} className="inline mr-1" />}
                    {mode === 'light' && <Sun size={14} className="inline mr-1" />}
                    {mode === 'dark' && <Moon size={14} className="inline mr-1" />}
                    {mode === 'system' ? '跟随系统' : mode === 'light' ? '浅色' : '深色'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-border/60">
              <div>
                <Label className="text-base">AI 聊天面板位置</Label>
                <p className="text-xs text-muted-foreground mt-0.5">聊天侧边栏从哪侧滑出</p>
              </div>
              <select
                value={aiChatPosition}
                onChange={(e) => setAiChatPosition(e.target.value as 'left' | 'right')}
                className="h-9 w-28 rounded-md border border-border bg-background px-3 text-sm
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="right">右侧</option>
                <option value="left">左侧</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="py-4 border-b border-border/60">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <Label className="text-base">DeepSeek API Key</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">用于 AI 解析和聊天功能</p>
                </div>
                <Button onClick={handleSaveApiKey} size="sm">保存</Button>
              </div>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="py-4 border-b border-border/60">
              <Label className="text-base">AI 模型</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">DeepSeek 模型名称</p>
              <Input
                value={deepseekModel}
                onChange={(e) => setDeepseekModel(e.target.value)}
                placeholder="deepseek-v4-flash"
                className="max-w-sm"
              />
            </div>

            <div className="py-4 border-b border-border/60">
              <Label className="text-base">后端 API 地址</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">体力数据后端服务</p>
              <Input
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="http://100.70.198.102:8000"
                className="max-w-sm"
              />
            </div>
          </div>
        )}

        {activeTab === 'hotkey' && (
          <div className="space-y-6">
            <div className="py-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">体力捕获</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">快速截图识别体力值</p>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border font-mono">
                    Ctrl
                  </kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border font-mono">
                    Shift
                  </kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border font-mono">
                    D
                  </kbd>
                </div>
              </div>
            </div>

            <div className="py-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">AI 聊天</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">呼出 AI 聊天面板</p>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border font-mono">
                    Ctrl
                  </kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border font-mono">
                    Shift
                  </kbd>
                  <span className="text-muted-foreground text-xs">+</span>
                  <kbd className="px-2 py-1 text-xs bg-muted rounded border border-border font-mono">
                    A
                  </kbd>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground pt-2">
              自定义快捷键配置即将上线。点击快捷键区域可重新绑定按键。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPage
