import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDeepseekStore } from '@/stores/deepseekStore'
import { applyTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

function SettingsPage(): React.JSX.Element {
  const {
    theme, autoStart, aiChatPosition, backendUrl, deepseekModel,
    setTheme, setAutoStart, setAiChatPosition, setBackendUrl, setDeepseekModel,
    load
  } = useSettingsStore()

  const { apiKey, loadApiKey } = useDeepseekStore()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)

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

  const handleSaveApiKey = async (): Promise<void> => {
    useDeepseekStore.getState().setApiKey(apiKeyInput)
    await window.api.settings.set('deepseekApiKey', apiKeyInput)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <h1 className="text-2xl font-bold">设置</h1>

      {/* General Settings */}
      <Card>
        <CardHeader><CardTitle>通用</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>开机自启</Label>
            <input
              type="checkbox"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>主题模式</Label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <Label>AI 聊天面板位置</Label>
            <select
              value={aiChatPosition}
              onChange={(e) => setAiChatPosition(e.target.value as 'left' | 'right')}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="right">右侧</option>
              <option value="left">左侧</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* API Settings */}
      <Card>
        <CardHeader><CardTitle>API 设置</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>DeepSeek API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button onClick={handleSaveApiKey} size="sm">保存</Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>模型</Label>
            <Input
              value={deepseekModel}
              onChange={(e) => setDeepseekModel(e.target.value)}
              placeholder="deepseek-v4-flash"
            />
          </div>

          <div className="space-y-2">
            <Label>后端 API 地址</Label>
            <Input
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="http://100.70.198.102:8000"
            />
          </div>
        </CardContent>
      </Card>

      {/* Hotkey Settings Placeholder */}
      <Card>
        <CardHeader><CardTitle>快捷键设置</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            体力捕获: Ctrl+Shift+D | AI 聊天: Ctrl+Shift+A (可自定义配置即将上线)
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsPage
