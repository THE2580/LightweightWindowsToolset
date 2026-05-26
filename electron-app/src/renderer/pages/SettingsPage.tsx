import { useEffect, useState, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDeepseekStore } from '@/stores/deepseekStore'
import { applyTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Eye, EyeOff, Monitor, Sun, Moon, Wrench, Keyboard, RotateCcw } from 'lucide-react'

type TabId = 'general' | 'api' | 'hotkey'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'general', label: '通用', icon: Monitor },
  { id: 'api', label: 'API 设置', icon: Wrench },
  { id: 'hotkey', label: '快捷键', icon: Keyboard },
]

const DEFAULT_TITLE = '轻量化工具集'

function parseAccelerator(acc: string): string[] {
  return acc.split('+')
}

function SettingsPage(): React.JSX.Element {
  const {
    theme, autoStart, chatClickOutsideToClose, backendUrl, deepseekModel, windowTitle, closeBehavior,
    captureHotkey, chatHotkey,
    setTheme, setAutoStart, setChatClickOutsideToClose, setBackendUrl, setDeepseekModel,
    setWindowTitle, setCloseBehavior, setCaptureHotkey, setChatHotkey,
    load
  } = useSettingsStore()

  const { apiKey, loadApiKey } = useDeepseekStore()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [titleDraft, setTitleDraft] = useState(windowTitle)

  // Hotkey recording state
  const [recordingCapture, setRecordingCapture] = useState(false)
  const [recordingChat, setRecordingChat] = useState(false)

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

  const handleResetTitle = async (): Promise<void> => {
    setTitleDraft(DEFAULT_TITLE)
    await setWindowTitle(DEFAULT_TITLE)
  }

  const handleHotkeyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, forAction: 'capture' | 'chat') => {
      e.preventDefault()
      e.stopPropagation()

      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl')
      if (e.shiftKey) parts.push('Shift')
      if (e.altKey) parts.push('Alt')

      const key = e.key
      // Skip modifier-only keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return

      const upperKey = key.length === 1 ? key.toUpperCase() : key
      parts.push(upperKey)

      const accelerator = parts.join('+')

      if (forAction === 'capture') {
        setRecordingCapture(false)
        setCaptureHotkey(accelerator)
      } else {
        setRecordingChat(false)
        setChatHotkey(accelerator)
      }
    },
    [setCaptureHotkey, setChatHotkey]
  )

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-4">设置</h1>

      <div className="flex border-b border-border mb-5 sticky -top-5 z-10 bg-background -mx-5 px-5 pt-1 pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="py-3 border-b border-border/60">
              <Label className="text-sm">主窗口标题</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">显示在窗口标题栏的文字</p>
              <div className="flex gap-2">
                <Input
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder={DEFAULT_TITLE}
                  className="max-w-[200px] h-8 text-xs"
                />
                <Button onClick={handleSaveTitle} size="sm" className="h-8 text-xs">保存</Button>
                <Button
                  onClick={handleResetTitle}
                  size="sm"
                  variant="outline"
                  className="h-8"
                  title="重置为默认标题"
                >
                  <RotateCcw size={12} />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border/60">
              <div>
                <Label className="text-sm">开机自启</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">应用启动时自动运行</p>
              </div>
              <button
                onClick={() => setAutoStart(!autoStart)}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  autoStart ? 'bg-primary' : 'bg-muted-foreground/25'
                )}
                aria-label={autoStart ? '禁用开机自启' : '启用开机自启'}
              >
                <div
                  className={cn(
                    'w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200',
                    autoStart ? 'translate-x-5.5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border/60">
              <div>
                <Label className="text-sm">主题模式</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">切换深色/浅色外观</p>
              </div>
              <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
                {(['system', 'light', 'dark'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setTheme(mode)}
                    className={cn(
                      'px-2.5 py-1 rounded text-[11px] font-medium transition-all',
                      theme === mode
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {mode === 'system' && <Monitor size={12} className="inline mr-0.5" />}
                    {mode === 'light' && <Sun size={12} className="inline mr-0.5" />}
                    {mode === 'dark' && <Moon size={12} className="inline mr-0.5" />}
                    {mode === 'system' ? '跟随系统' : mode === 'light' ? '浅色' : '深色'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border/60">
              <div>
                <Label className="text-sm">关闭应用时</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">点击关闭按钮的行为</p>
              </div>
              <select
                value={closeBehavior}
                onChange={(e) => setCloseBehavior(e.target.value as 'quit' | 'tray')}
                className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="quit">直接退出</option>
                <option value="tray">缩小到托盘</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border/60">
              <div>
                <Label className="text-sm">AI 聊天点击外部关闭</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">点击聊天面板外区域自动折叠</p>
              </div>
              <button
                onClick={() => setChatClickOutsideToClose(!chatClickOutsideToClose)}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  chatClickOutsideToClose ? 'bg-primary' : 'bg-muted-foreground/25'
                )}
                aria-label={chatClickOutsideToClose ? '禁用外部点击关闭' : '启用外部点击关闭'}
              >
                <div
                  className={cn(
                    'w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200',
                    chatClickOutsideToClose ? 'translate-x-5.5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-4">
            <div className="py-3 border-b border-border/60">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <Label className="text-sm">DeepSeek API Key</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">用于 AI 解析和聊天功能</p>
                </div>
                <Button onClick={handleSaveApiKey} size="sm" className="h-8 text-xs">保存</Button>
              </div>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="pr-8 h-8 text-xs"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="py-3 border-b border-border/60">
              <Label className="text-sm">AI 模型</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">DeepSeek 模型名称</p>
              <Input
                value={deepseekModel}
                onChange={(e) => setDeepseekModel(e.target.value)}
                placeholder="deepseek-v4-flash"
                className="max-w-[240px] h-8 text-xs"
              />
            </div>

            <div className="py-3 border-b border-border/60">
              <Label className="text-sm">后端 API 地址</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">体力数据后端服务</p>
              <Input
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="http://100.70.198.102:8000"
                className="max-w-[240px] h-8 text-xs"
              />
            </div>
          </div>
        )}

        {activeTab === 'hotkey' && (
          <div className="space-y-4">
            {/* Capture hotkey */}
            <div className="py-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">体力捕获</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">后台截图识别体力值</p>
                </div>
                <button
                  onClick={() => { setRecordingCapture(true); setRecordingChat(false) }}
                  onKeyDown={(e) => { if (recordingCapture) handleHotkeyKeyDown(e, 'capture') }}
                  className={cn(
                    'flex items-center gap-1 h-7 px-2 rounded border text-[11px] font-mono transition-colors',
                    recordingCapture
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted hover:border-muted-foreground/30'
                  )}
                >
                  {recordingCapture ? (
                    <span className="animate-pulse">按下组合键...</span>
                  ) : (
                    parseAccelerator(captureHotkey).map((part, i) => (
                      <span key={i}>
                        {i > 0 && <span className="text-muted-foreground mx-0.5">+</span>}
                        <kbd className="px-1 py-0.5 rounded border border-border bg-background">{part}</kbd>
                      </span>
                    ))
                  )}
                </button>
              </div>
            </div>

            {/* Chat hotkey */}
            <div className="py-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">AI 聊天</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">呼出或折叠 AI 聊天面板</p>
                </div>
                <button
                  onClick={() => { setRecordingChat(true); setRecordingCapture(false) }}
                  onKeyDown={(e) => { if (recordingChat) handleHotkeyKeyDown(e, 'chat') }}
                  className={cn(
                    'flex items-center gap-1 h-7 px-2 rounded border text-[11px] font-mono transition-colors',
                    recordingChat
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted hover:border-muted-foreground/30'
                  )}
                >
                  {recordingChat ? (
                    <span className="animate-pulse">按下组合键...</span>
                  ) : (
                    parseAccelerator(chatHotkey).map((part, i) => (
                      <span key={i}>
                        {i > 0 && <span className="text-muted-foreground mx-0.5">+</span>}
                        <kbd className="px-1 py-0.5 rounded border border-border bg-background">{part}</kbd>
                      </span>
                    ))
                  )}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground pt-1">
              点击快捷键区域进入录制模式，然后按下组合键完成绑定。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPage
