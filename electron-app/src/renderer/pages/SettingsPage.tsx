import { useEffect, useState, useCallback } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDeepseekStore } from '@/stores/deepseekStore'
import { applyTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Eye, EyeOff, Monitor, Sun, Moon, Wrench, Keyboard, RotateCcw,
  Plus, AlertTriangle
} from 'lucide-react'

type TabId = 'general' | 'api' | 'hotkey'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'general', label: '通用', icon: Monitor },
  { id: 'api', label: 'API 设置', icon: Wrench },
  { id: 'hotkey', label: '快捷键', icon: Keyboard },
]

const DEFAULT_TITLE = '轻量化工具集'

function parseAccelerator(acc: string): string[] {
  if (!acc) return []
  return acc.split('+')
}

function keysToAccelerator(keys: string[]): string {
  return keys.join('+')
}

function SettingsPage(): React.JSX.Element {
  const {
    theme, autoStart, chatClickOutsideToClose, chatAutoExpand,
    chatExpandZoneWidth, chatExpandZoneHeight,
    backendUrl, deepseekModel, windowTitle, closeBehavior,
    captureHotkey, chatHotkey, captureHotkeyEnabled, chatHotkeyEnabled,
    setTheme, setAutoStart, setChatClickOutsideToClose, setChatAutoExpand,
    setChatExpandZoneWidth, setChatExpandZoneHeight, setChatExpandZonePreview,
    setBackendUrl, setDeepseekModel, setWindowTitle, setCloseBehavior,
    setCaptureHotkey, setChatHotkey, setCaptureHotkeyEnabled, setChatHotkeyEnabled,
    load
  } = useSettingsStore()

  const { apiKey, loadApiKey } = useDeepseekStore()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [titleDraft, setTitleDraft] = useState(windowTitle)

  const [recordingCapture, setRecordingCapture] = useState(false)
  const [recordingChat, setRecordingChat] = useState(false)
  const [captureKeys, setCaptureKeys] = useState<string[]>([])
  const [chatKeys, setChatKeys] = useState<string[]>([])
  const [conflictMsg, setConflictMsg] = useState<string | null>(null)

  const [zoneWDraft, setZoneWDraft] = useState(chatExpandZoneWidth)
  const [zoneHDraft, setZoneHDraft] = useState(chatExpandZoneHeight)

  useEffect(() => { load(); loadApiKey() }, [load, loadApiKey])
  useEffect(() => { applyTheme(theme) }, [theme])
  useEffect(() => { if (apiKey) setApiKeyInput(apiKey) }, [apiKey])
  useEffect(() => { setTitleDraft(windowTitle) }, [windowTitle])
  useEffect(() => { setZoneWDraft(chatExpandZoneWidth); setZoneHDraft(chatExpandZoneHeight) }, [chatExpandZoneWidth, chatExpandZoneHeight])
  useEffect(() => { if (captureHotkey) setCaptureKeys(parseAccelerator(captureHotkey)) }, [captureHotkey])
  useEffect(() => { if (chatHotkey) setChatKeys(parseAccelerator(chatHotkey)) }, [chatHotkey])
  useEffect(() => { if (conflictMsg) { const t = setTimeout(() => setConflictMsg(null), 3000); return () => clearTimeout(t) } }, [conflictMsg])

  const handleSaveApiKey = async () => {
    useDeepseekStore.getState().setApiKey(apiKeyInput)
    await window.api.settings.set('deepseekApiKey', apiKeyInput)
  }

  const handleSaveTitle = async () => {
    const trimmed = titleDraft.trim()
    if (!trimmed) { setTitleDraft(windowTitle); return }
    await setWindowTitle(trimmed)
  }

  const handleResetTitle = async () => { setTitleDraft(DEFAULT_TITLE); await setWindowTitle(DEFAULT_TITLE) }

  const startRecording = useCallback(async (which: 'capture' | 'chat') => {
    await window.api.hotkey.disableAllHotkeys()
    if (which === 'capture') { setRecordingCapture(true); setRecordingChat(false); setCaptureKeys([]) }
    else { setRecordingChat(true); setRecordingCapture(false); setChatKeys([]) }
  }, [])

  const getIncompleteKeys = (keys: string[], eMod: boolean, eShift: boolean, eAlt: boolean): string[] => {
    const result = [...keys]
    if (eMod && !result.includes('CommandOrControl')) result.push('CommandOrControl')
    if (eShift && !result.includes('Shift')) result.push('Shift')
    if (eAlt && !result.includes('Alt')) result.push('Alt')
    return result
  }

  const handleRecordKey = useCallback(async (e: React.KeyboardEvent, which: 'capture' | 'chat') => {
    e.preventDefault(); e.stopPropagation()
    const key = e.key
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return
    const currentKeys = which === 'capture' ? [...captureKeys] : [...chatKeys]
    const keys = getIncompleteKeys(currentKeys, e.ctrlKey || e.metaKey, e.shiftKey, e.altKey)
    const upperKey = key.length === 1 ? key.toUpperCase() : key
    if (!keys.includes(upperKey)) keys.push(upperKey)
    if (which === 'capture') setCaptureKeys(keys)
    else setChatKeys(keys)
  }, [captureKeys, chatKeys])

  const confirmRecording = useCallback(async (which: 'capture' | 'chat') => {
    const keys = which === 'capture' ? captureKeys : chatKeys
    if (keys.length === 0) return
    const accelerator = keysToAccelerator(keys)
    const excludeAction = which === 'capture' ? 'ai-chat' : 'stamina-capture'
    const conflictAction = await window.api.hotkey.checkConflict(accelerator, excludeAction)
    if (conflictAction) {
      setConflictMsg('当前快捷键与"' + (conflictAction === 'stamina-capture' ? '体力捕获' : 'AI 聊天') + '"冲突，快捷键无法操作')
      await window.api.hotkey.enableAllHotkeys()
      if (which === 'capture') setRecordingCapture(false); else setRecordingChat(false)
      return
    }
    if (which === 'capture') { await setCaptureHotkey(accelerator); setRecordingCapture(false) }
    else { await setChatHotkey(accelerator); setRecordingChat(false) }
    await window.api.hotkey.enableAllHotkeys()
  }, [captureKeys, chatKeys, setCaptureHotkey, setChatHotkey])

  const cancelRecording = useCallback(async (which: 'capture' | 'chat') => {
    if (which === 'capture') { setRecordingCapture(false); setCaptureKeys(parseAccelerator(captureHotkey)) }
    else { setRecordingChat(false); setChatKeys(parseAccelerator(chatHotkey)) }
    await window.api.hotkey.enableAllHotkeys()
  }, [captureHotkey, chatHotkey])

  const getKeyConflictClass = (key: string, otherKeys: string[]): string => {
    if (otherKeys.includes(key)) return 'bg-yellow-500/20 border-yellow-500'
    return ''
  }

  const getRecordingConflictClass = (keys: string[], otherAcc: string): string => {
    if (keys.length === 0) return ''
    if (keysToAccelerator(keys) === otherAcc) return 'ring-2 ring-red-500 rounded'
    return ''
  }

  const getOtherConflictClass = (recordingKeys: string[], otherAcc: string): string => {
    if (recordingKeys.length === 0) return ''
    const acc = keysToAccelerator(recordingKeys)
    if (acc === otherAcc) return 'border-red-500 bg-red-500/10'
    const otherParts = parseAccelerator(otherAcc)
    if (recordingKeys.some((k) => otherParts.includes(k))) return 'border-yellow-500 bg-yellow-500/10'
    return ''
  }

  const handleZoneWChange = (w: number) => { setZoneWDraft(w); setChatExpandZonePreview({ w, h: zoneHDraft }) }
  const handleZoneHChange = (h: number) => { setZoneHDraft(h); setChatExpandZonePreview({ w: zoneWDraft, h }) }
  const handleZoneWCommit = async () => { await setChatExpandZoneWidth(zoneWDraft); setChatExpandZonePreview(null) }
  const handleZoneHCommit = async () => { await setChatExpandZoneHeight(zoneHDraft); setChatExpandZonePreview(null) }

  // --- RENDER ---

  const renderGeneral = () => (
    <div className="space-y-4">
      <div className="py-3 border-b border-border/60">
        <Label className="text-sm">主窗口标题</Label>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">显示在窗口标题栏的文字</p>
        <div className="flex gap-2">
          <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} placeholder={DEFAULT_TITLE} className="max-w-[200px] h-8 text-xs" />
          <Button onClick={handleSaveTitle} size="sm" className="h-8 text-xs">保存</Button>
          <Button onClick={handleResetTitle} size="sm" variant="outline" className="h-8" title="重置"><RotateCcw size={12} /></Button>
        </div>
      </div>

      <div className="flex items-center justify-between py-3 border-b border-border/60">
        <div><Label className="text-sm">开机自启</Label><p className="text-[11px] text-muted-foreground mt-0.5">应用启动时自动运行</p></div>
        <button onClick={() => setAutoStart(!autoStart)} className={cn('w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', autoStart ? 'bg-primary' : 'bg-muted-foreground/25')}>
          <div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', autoStart ? 'translate-x-5.5' : 'translate-x-0.5')} />
        </button>
      </div>

      <div className="flex items-center justify-between py-3 border-b border-border/60">
        <div><Label className="text-sm">主题模式</Label><p className="text-[11px] text-muted-foreground mt-0.5">切换深色/浅色外观</p></div>
        <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
          {(['system', 'light', 'dark'] as const).map((mode) => (
            <button key={mode} onClick={() => setTheme(mode)} className={cn('px-2.5 py-1 rounded text-[11px] font-medium transition-all', theme === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {mode === 'system' && <Monitor size={12} className="inline mr-0.5" />}{mode === 'light' && <Sun size={12} className="inline mr-0.5" />}{mode === 'dark' && <Moon size={12} className="inline mr-0.5" />}{mode === 'system' ? '跟随系统' : mode === 'light' ? '浅色' : '深色'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between py-3 border-b border-border/60">
        <div><Label className="text-sm">关闭应用时</Label><p className="text-[11px] text-muted-foreground mt-0.5">点击关闭按钮的行为</p></div>
        <select value={closeBehavior} onChange={(e) => setCloseBehavior(e.target.value as 'quit' | 'tray')} className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="quit">直接退出</option>
          <option value="tray">缩小到托盘</option>
        </select>
      </div>

      <div className="flex items-center justify-between py-3 border-b border-border/60">
        <div><Label className="text-sm">AI 聊天点击外部关闭</Label><p className="text-[11px] text-muted-foreground mt-0.5">点击聊天面板外区域自动折叠</p></div>
        <button onClick={() => setChatClickOutsideToClose(!chatClickOutsideToClose)} className={cn('w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', chatClickOutsideToClose ? 'bg-primary' : 'bg-muted-foreground/25')}>
          <div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', chatClickOutsideToClose ? 'translate-x-5.5' : 'translate-x-0.5')} />
        </button>
      </div>

      <div className="py-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div><Label className="text-sm">AI 聊天自动展开</Label><p className="text-[11px] text-muted-foreground mt-0.5">鼠标移入窗口右侧检测区域自动滑出</p></div>
          <button onClick={() => setChatAutoExpand(!chatAutoExpand)} className={cn('w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', chatAutoExpand ? 'bg-primary' : 'bg-muted-foreground/25')}>
            <div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', chatAutoExpand ? 'translate-x-5.5' : 'translate-x-0.5')} />
          </button>
        </div>
        {chatAutoExpand && (
          <div className="mt-3 space-y-3 pl-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">水平检测宽度</span>
                <span className="text-[11px] font-mono text-muted-foreground">{zoneWDraft}px</span>
              </div>
              <input type="range" min={5} max={60} step={1} value={zoneWDraft} onChange={(e) => handleZoneWChange(Number(e.target.value))} onMouseUp={handleZoneWCommit} onTouchEnd={handleZoneWCommit} className="w-full h-1.5 accent-primary" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">竖直检测高度</span>
                <span className="text-[11px] font-mono text-muted-foreground">{zoneHDraft}%</span>
              </div>
              <input type="range" min={10} max={100} step={5} value={zoneHDraft} onChange={(e) => handleZoneHChange(Number(e.target.value))} onMouseUp={handleZoneHCommit} onTouchEnd={handleZoneHCommit} className="w-full h-1.5 accent-primary" />
            </div>
            <p className="text-[10px] text-muted-foreground">拖动滑块实时预览检测区域（半透明蓝色），松开鼠标保存。</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderApi = () => (
    <div className="space-y-4">
      <div className="py-3 border-b border-border/60">
        <div className="flex items-end justify-between mb-2">
          <div><Label className="text-sm">DeepSeek API Key</Label><p className="text-[11px] text-muted-foreground mt-0.5">用于 AI 解析和聊天功能</p></div>
          <Button onClick={handleSaveApiKey} size="sm" className="h-8 text-xs">保存</Button>
        </div>
        <div className="relative">
          <Input type={showKey ? 'text' : 'password'} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="sk-..." className="pr-8 h-8 text-xs" />
          <button onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      <div className="py-3 border-b border-border/60">
        <Label className="text-sm">AI 模型</Label><p className="text-[11px] text-muted-foreground mt-0.5 mb-2">DeepSeek 模型名称</p>
        <Input value={deepseekModel} onChange={(e) => setDeepseekModel(e.target.value)} placeholder="deepseek-v4-flash" className="max-w-[240px] h-8 text-xs" />
      </div>
      <div className="py-3 border-b border-border/60">
        <Label className="text-sm">后端 API 地址</Label><p className="text-[11px] text-muted-foreground mt-0.5 mb-2">体力数据后端服务</p>
        <Input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} placeholder="http://100.70.198.102:8000" className="max-w-[240px] h-8 text-xs" />
      </div>
    </div>
  )

  const renderHotkey = () => (
    <div className="space-y-4" onKeyDown={(e) => { if (recordingCapture) handleRecordKey(e, 'capture'); else if (recordingChat) handleRecordKey(e, 'chat') }}>
      {/* Capture hotkey */}
      <div className={cn('py-3 border-b border-border/60 transition-colors rounded px-2 -mx-2', recordingChat ? getOtherConflictClass(chatKeys, captureHotkey) : '')}>
        <div className="flex items-center justify-between mb-1.5">
          <div><Label className="text-sm">体力捕获</Label><p className="text-[11px] text-muted-foreground mt-0.5">后台截图识别体力值</p></div>
          <button onClick={() => setCaptureHotkeyEnabled(!captureHotkeyEnabled)} className={cn('w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0', captureHotkeyEnabled ? 'bg-primary' : 'bg-muted-foreground/25')}>
            <div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', captureHotkeyEnabled ? 'translate-x-5.5' : 'translate-x-0.5')} />
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className={cn('flex items-center gap-0.5 flex-1 min-w-0', getRecordingConflictClass(captureKeys, chatHotkey))}>
            {captureHotkeyEnabled ? (recordingCapture ? captureKeys : parseAccelerator(captureHotkey)).map((part, i) => (
              <span key={i} className="flex items-center gap-0.5">
                {i > 0 && <span className="text-muted-foreground text-[11px]">+</span>}
                <kbd className={cn('px-1.5 py-0.5 text-[11px] rounded border bg-background font-mono', recordingCapture ? getKeyConflictClass(part, chatKeys) : '')}>{part}</kbd>
              </span>
            )) : <span className="text-[11px] text-muted-foreground italic">已禁用</span>}
          </div>
          {captureHotkeyEnabled && (recordingCapture ? (
            <><Button size="sm" className="h-6 text-[10px] px-2" onClick={() => confirmRecording('capture')}>确认</Button><Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => cancelRecording('capture')}>取消</Button></>
          ) : (
            <button onClick={() => startRecording('capture')} disabled={recordingChat} className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-30" title="追加快捷键"><Plus size={14} /></button>
          ))}
        </div>
      </div>

      {/* Chat hotkey */}
      <div className={cn('py-3 border-b border-border/60 transition-colors rounded px-2 -mx-2', recordingCapture ? getOtherConflictClass(captureKeys, chatHotkey) : '')}>
        <div className="flex items-center justify-between mb-1.5">
          <div><Label className="text-sm">AI 聊天</Label><p className="text-[11px] text-muted-foreground mt-0.5">呼出或折叠 AI 聊天面板</p></div>
          <button onClick={() => setChatHotkeyEnabled(!chatHotkeyEnabled)} className={cn('w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0', chatHotkeyEnabled ? 'bg-primary' : 'bg-muted-foreground/25')}>
            <div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', chatHotkeyEnabled ? 'translate-x-5.5' : 'translate-x-0.5')} />
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className={cn('flex items-center gap-0.5 flex-1 min-w-0', getRecordingConflictClass(chatKeys, captureHotkey))}>
            {chatHotkeyEnabled ? (recordingChat ? chatKeys : parseAccelerator(chatHotkey)).map((part, i) => (
              <span key={i} className="flex items-center gap-0.5">
                {i > 0 && <span className="text-muted-foreground text-[11px]">+</span>}
                <kbd className={cn('px-1.5 py-0.5 text-[11px] rounded border bg-background font-mono', recordingChat ? getKeyConflictClass(part, captureKeys) : '')}>{part}</kbd>
              </span>
            )) : <span className="text-[11px] text-muted-foreground italic">已禁用</span>}
          </div>
          {chatHotkeyEnabled && (recordingChat ? (
            <><Button size="sm" className="h-6 text-[10px] px-2" onClick={() => confirmRecording('chat')}>确认</Button><Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => cancelRecording('chat')}>取消</Button></>
          ) : (
            <button onClick={() => startRecording('chat')} disabled={recordingCapture} className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-30" title="追加快捷键"><Plus size={14} /></button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground pt-1">点击 + 进入追加模式，按下组合键逐键追加。冲突时弹窗提示，组合冲突标红，单个按键重叠标黄。</p>
    </div>
  )

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-4">设置</h1>
      {conflictMsg && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs">
          <AlertTriangle size={14} />{conflictMsg}
        </div>
      )}
      <div className="flex border-b border-border mb-5 sticky -top-5 z-10 bg-background -mx-5 px-5 pt-1 pb-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px', activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30')}>
            <tab.icon size={14} />{tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-[300px]">
        {activeTab === 'general' && renderGeneral()}
        {activeTab === 'api' && renderApi()}
        {activeTab === 'hotkey' && renderHotkey()}
      </div>
    </div>
  )
}

export default SettingsPage
