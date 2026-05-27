import { useEffect, useState, useCallback, useRef } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDeepseekStore } from '@/stores/deepseekStore'
import { applyTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Eye, EyeOff, Monitor, Sun, Moon, Wrench, Keyboard, RotateCcw,
  Plus, Minus
} from 'lucide-react'

type TabId = 'general' | 'api' | 'hotkey'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'general', label: '通用', icon: Monitor },
  { id: 'api', label: 'API 设置', icon: Wrench },
  { id: 'hotkey', label: '快捷键', icon: Keyboard },
]

const DEFAULT_TITLE = '轻量化工具集'

type HotkeyAction = 'capture' | 'chat'
type HotkeyIPC = 'stamina-capture' | 'ai-chat'

function actionToIPC(a: HotkeyAction): HotkeyIPC {
  return a === 'capture' ? 'stamina-capture' : 'ai-chat'
}

/** Normalize a KeyboardEvent to a display key name */
function normalizeKey(e: React.KeyboardEvent): string {
  const key = e.key
  // Single letters: uppercase
  if (key.length === 1) return key.toUpperCase()
  // Space
  if (key === ' ') return 'Space'
  // Arrow keys
  if (key.startsWith('Arrow')) return key
  // Function keys
  if (key.startsWith('F') && key.length <= 3) return key
  // Common named keys
  const named: Record<string, string> = {
    'Control': 'Control', 'Shift': 'Shift', 'Alt': 'Alt', 'Meta': 'CommandOrControl',
    'Enter': 'Enter', 'Escape': 'Escape', 'Tab': 'Tab', 'Backspace': 'Backspace',
    'Delete': 'Delete', 'Insert': 'Insert', 'Home': 'Home', 'End': 'End',
    'PageUp': 'PageUp', 'PageDown': 'PageDown', 'CapsLock': 'CapsLock',
    'NumLock': 'NumLock', 'ScrollLock': 'ScrollLock', 'PrintScreen': 'PrintScreen',
  }
  return named[key] || key
}

function keysToAccelerator(keys: string[]): string {
  return keys.join('+')
}

function parseAccelerator(acc: string): string[] {
  if (!acc) return []
  return acc.split('+')
}

function SettingsPage(): React.JSX.Element {
  const {
    theme, autoStart, chatClickOutsideToClose, chatAutoExpand,
    chatExpandZoneVisible, chatExpandZoneWidth, chatExpandZoneHeight,
    backendUrl, deepseekModel, windowTitle, closeBehavior,
    captureHotkey, chatHotkey, captureHotkeyEnabled, chatHotkeyEnabled,
    setTheme, setAutoStart, setChatClickOutsideToClose, setChatAutoExpand,
    setChatExpandZoneVisible, setChatExpandZoneWidth, setChatExpandZoneHeight,
    setChatExpandZonePreview,
    setBackendUrl, setDeepseekModel, setWindowTitle, setCloseBehavior,
    setCaptureHotkey, setChatHotkey, setCaptureHotkeyEnabled, setChatHotkeyEnabled,
    load
  } = useSettingsStore()

  const { apiKey, loadApiKey } = useDeepseekStore()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [titleDraft, setTitleDraft] = useState(windowTitle)
  const [zoneWDraft, setZoneWDraft] = useState(chatExpandZoneWidth)
  const [zoneHDraft, setZoneHDraft] = useState(chatExpandZoneHeight)
  const [modelDraft, setModelDraft] = useState(deepseekModel)
  const [backendDraft, setBackendDraft] = useState(backendUrl)

  // Hotkey editing state
  const [editingCapture, setEditingCapture] = useState(false)
  const [editingChat, setEditingChat] = useState(false)
  const [captureKeys, setCaptureKeys] = useState<string[]>([])
  const [chatKeys, setChatKeys] = useState<string[]>([])
  const [captureConflict, setCaptureConflict] = useState(false)
  const [chatConflict, setChatConflict] = useState(false)
  const [activeCaptureSlot, setActiveCaptureSlot] = useState<number | null>(null)
  const [activeChatSlot, setActiveChatSlot] = useState<number | null>(null)

  // Refs for the hidden input that captures keyboard events
  const keyCaptureRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load(); loadApiKey() }, [load, loadApiKey])
  useEffect(() => { applyTheme(theme) }, [theme])
  useEffect(() => { if (apiKey) setApiKeyInput(apiKey) }, [apiKey])
  useEffect(() => { setModelDraft(deepseekModel) }, [deepseekModel])
  useEffect(() => { setBackendDraft(backendUrl) }, [backendUrl])
  useEffect(() => { setTitleDraft(windowTitle) }, [windowTitle])
  useEffect(() => { setZoneWDraft(chatExpandZoneWidth); setZoneHDraft(chatExpandZoneHeight) }, [chatExpandZoneWidth, chatExpandZoneHeight])

  // Sync capture hotkey to display when not editing
  useEffect(() => { if (!editingCapture) setCaptureKeys(parseAccelerator(captureHotkey)) }, [captureHotkey, editingCapture])
  useEffect(() => { if (!editingChat) setChatKeys(parseAccelerator(chatHotkey)) }, [chatHotkey, editingChat])

  const handleSaveApiKey = async () => { useDeepseekStore.getState().setApiKey(apiKeyInput); await window.api.settings.set('deepseekApiKey', apiKeyInput) }
  const saveModel = async () => { await setDeepseekModel(modelDraft) }
  const saveBackend = async () => { await setBackendUrl(backendDraft) }
  const handleSaveTitle = async () => { const t = titleDraft.trim(); if (!t) { setTitleDraft(windowTitle); return }; await setWindowTitle(t) }
  const handleResetTitle = async () => { setTitleDraft(DEFAULT_TITLE); await setWindowTitle(DEFAULT_TITLE) }

  const handleZoneWChange = (w: number) => { setZoneWDraft(w); if (!chatExpandZoneVisible) setChatExpandZonePreview({ w, h: zoneHDraft }) }
  const handleZoneHChange = (h: number) => { setZoneHDraft(h); if (!chatExpandZoneVisible) setChatExpandZonePreview({ w: zoneWDraft, h }) }
  const handleZoneWCommit = async () => { await setChatExpandZoneWidth(zoneWDraft); setChatExpandZonePreview(null) }
  const handleZoneHCommit = async () => { await setChatExpandZoneHeight(zoneHDraft); setChatExpandZonePreview(null) }

  // --- Hotkey helpers ---

  const startEdit = useCallback((which: HotkeyAction) => {
    const saved = which === 'capture' ? captureHotkey : chatHotkey
    if (which === 'capture') {
      setEditingCapture(true)
      setEditingChat(false)
      setCaptureKeys(parseAccelerator(saved))
      setCaptureConflict(false)
    } else {
      setEditingChat(true)
      setEditingCapture(false)
      setCaptureKeys([])
      setChatKeys(parseAccelerator(saved))
      setChatConflict(false)
    }
  }, [captureHotkey, chatHotkey])

  const cancelEdit = useCallback((which: HotkeyAction) => {
    if (which === 'capture') {
      setEditingCapture(false)
      setCaptureKeys(parseAccelerator(captureHotkey))
      setCaptureConflict(false)
      setActiveCaptureSlot(null)
    } else {
      setEditingChat(false)
      setChatKeys(parseAccelerator(chatHotkey))
      setChatConflict(false)
      setActiveChatSlot(null)
    }
  }, [captureHotkey, chatHotkey])

  const appendKey = useCallback((which: HotkeyAction) => {
    if (which === 'capture') {
      setCaptureKeys((prev) => {
        // Check last key is non-empty
        if (prev.length > 0 && !prev[prev.length - 1]) return prev
        return [...prev, '']
      })
    } else {
      setChatKeys((prev) => {
        if (prev.length > 0 && !prev[prev.length - 1]) return prev
        return [...prev, '']
      })
    }
  }, [])

  const removeLastKey = useCallback((which: HotkeyAction) => {
    if (which === 'capture') {
      setCaptureKeys((prev) => prev.slice(0, -1))
      setActiveCaptureSlot(null)
    } else {
      setChatKeys((prev) => prev.slice(0, -1))
      setActiveChatSlot(null)
    }
  }, [])

  const updateKey = useCallback((which: HotkeyAction, index: number, value: string) => {
    if (which === 'capture') {
      setCaptureKeys((prev) => { const n = [...prev]; n[index] = value; return n })
      setActiveCaptureSlot(null)
    } else {
      setChatKeys((prev) => { const n = [...prev]; n[index] = value; return n })
      setActiveChatSlot(null)
    }
  }, [])

  // Check conflict against all registered accelerators
  const checkConflict = useCallback(async (which: HotkeyAction, keys: string[]) => {
    const nonEmpty = keys.filter((k) => k)
    if (nonEmpty.length === 0) return false
    const acc = keysToAccelerator(nonEmpty)
    const exclude = actionToIPC(which)
    try {
      const conflict = await window.api.hotkey.checkConflict(acc, exclude)
      return conflict !== null
    } catch {
      return false
    }
  }, [])

  const saveHotkey = useCallback(async (which: HotkeyAction) => {
    const keys = which === 'capture' ? captureKeys : chatKeys
    const nonEmpty = keys.filter((k) => k)
    // Deduplicate: keep first occurrence of each key
    const deduped = nonEmpty.filter((k, i) => nonEmpty.indexOf(k) === i)
    const acc = deduped.length > 0 ? keysToAccelerator(deduped) : ''

    // Disable all hotkeys during recording mode
    try { await window.api.hotkey.disableAllHotkeys() } catch { /* ok */ }

    // Check conflict
    const exclude = actionToIPC(which)
    try {
      const conflict = await window.api.hotkey.checkConflict(acc, exclude)
      if (conflict) {
        if (which === 'capture') setCaptureConflict(true)
        else setChatConflict(true)
        // Re-enable all
        try { await window.api.hotkey.enableAllHotkeys() } catch { /* ok */ }
        return
      }
    } catch { /* ok */ }

    if (which === 'capture') {
      await setCaptureHotkey(acc)
      setEditingCapture(false)
      setCaptureConflict(false)
    } else {
      await setChatHotkey(acc)
      setEditingChat(false)
      setChatConflict(false)
    }

    try { await window.api.hotkey.enableAllHotkeys() } catch { /* ok */ }
  }, [captureKeys, chatKeys, setCaptureHotkey, setChatHotkey])

  // Check conflicts on every key change (debounced via useEffect)
  useEffect(() => {
    if (!editingCapture) return
    const t = setTimeout(async () => {
      const c = await checkConflict('capture', captureKeys)
      setCaptureConflict(c)
    }, 200)
    return () => clearTimeout(t)
  }, [captureKeys, editingCapture, checkConflict])

  useEffect(() => {
    if (!editingChat) return
    const t = setTimeout(async () => {
      const c = await checkConflict('chat', chatKeys)
      setChatConflict(c)
    }, 200)
    return () => clearTimeout(t)
  }, [chatKeys, editingChat, checkConflict])

  const handleKeyCapture = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const normalized = normalizeKey(e)
    if (!normalized) return

    if (editingCapture && activeCaptureSlot !== null) {
      updateKey('capture', activeCaptureSlot, normalized)
    } else if (editingChat && activeChatSlot !== null) {
      updateKey('chat', activeChatSlot, normalized)
    }
  }, [editingCapture, editingChat, activeCaptureSlot, activeChatSlot, updateKey])

  const nonEmptyCount = (keys: string[]): number => keys.filter((k) => k).length

  // --- Render hotkey entry ---

  const renderHotkeyRow = (
    label: string,
    desc: string,
    enabled: boolean,
    setEn: (v: boolean) => Promise<void>,
    saved: string,
    editing: boolean,
    keys: string[],
    conflict: boolean,
    startEditFn: () => void,
    cancelEditFn: () => void,
    activeSlot: number | null,
    which: HotkeyAction
  ) => (
    <div className="py-3 border-b border-border/60">
      {/* Header row: label + toggle + action buttons, all on one line */}
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <Label className="text-sm">{label}</Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {enabled && editing ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-2 bg-green-500/15 hover:bg-green-500/25 border-0"
                onClick={() => { appendKey(which); setActiveCaptureSlot(which === 'capture' ? null : activeSlot); setActiveChatSlot(which === 'chat' ? null : activeSlot) }}
                title="追加按键"
              >
                <Plus size={12} />
              </Button>
              {nonEmptyCount(keys) >= 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 bg-red-500/15 hover:bg-red-500/25 border-0"
                  onClick={() => removeLastKey(which)}
                  title="移除末尾按键"
                >
                  <Minus size={12} />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-3 bg-blue-500/15 hover:bg-blue-500/25 border-0"
                onClick={() => saveHotkey(which)}
              >
                保存
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs px-3 bg-orange-500/15 hover:bg-orange-500/25 border-0"
                onClick={cancelEditFn}
              >
                取消
              </Button>
            </>
          ) : enabled && !editing ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              onClick={startEditFn}
            >
              配置快捷键
            </Button>
          ) : null}
          <button
            onClick={() => setEn(!enabled)}
            className={cn(
              'w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0',
              enabled ? 'bg-primary' : 'bg-muted-foreground/25'
            )}
          >
            <div className={cn(
              'w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200',
              enabled ? 'translate-x-5.5' : 'translate-x-0.5'
            )} />
          </button>
        </div>
      </div>

      {/* Hotkey display row */}
      {!enabled ? (
        <span className="text-[11px] text-muted-foreground italic">已禁用</span>
      ) : editing ? (
        <div>
          {/* Key boxes row */}
          <div className={cn(
            'flex items-center gap-1 flex-wrap p-1 rounded transition-colors',
            conflict && 'bg-red-500/10'
          )}>
            {keys.length === 0 ? (
              <span className="text-[11px] text-muted-foreground italic">点击 + 添加按键</span>
            ) : (
              keys.map((key, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground text-[11px]">+</span>}
                  <span
                    tabIndex={0}
                    role="button"
                    onClick={() => {
                      if (which === 'capture') setActiveCaptureSlot(i)
                      else setActiveChatSlot(i)
                      keyCaptureRef.current?.focus()
                    }}
                    onFocus={() => {
                      if (which === 'capture') setActiveCaptureSlot(i)
                      else setActiveChatSlot(i)
                    }}
                    className={cn(
                      'inline-flex items-center justify-center min-w-[36px] px-2 py-1 text-[11px] rounded border font-mono cursor-pointer transition-colors select-none',
                      (which === 'capture' ? activeCaptureSlot : activeChatSlot) === i
                        ? 'border-orange-500 bg-orange-100 ring-2 ring-orange-500/30'
                        : key
                          ? 'border-yellow-500 bg-white'
                          : 'border-dashed border-muted-foreground/30 bg-muted/50'
                    )}
                  >
                    {key || <span className="text-muted-foreground">?</span>}
                  </span>
                </span>
              ))
            )}
          </div>

          {conflict && (
            <p className="text-[10px] text-red-500 mt-1">此快捷键与其他快捷键冲突，保存后不生效</p>
          )}
        </div>
      ) : (
        saved ? (
          <span className="flex items-center gap-1 flex-wrap">
            {parseAccelerator(saved).map((k, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground text-[11px]">+</span>}
                <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-1 text-[11px] rounded border border-green-300 bg-white font-mono">
                  {k}
                </span>
              </span>
            ))}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">未配置</span>
        )
      )}
    </div>
  )

  return (
    <div className="max-w-xl">
      {/* Hidden input for keyboard capture */}
      <input
        ref={keyCaptureRef}
        type="text"
        className="sr-only"
        onKeyDown={handleKeyCapture}
        aria-hidden="true"
        tabIndex={-1}
      />

      <h1 className="text-xl font-bold mb-4">设置</h1>
      <div className="flex border-b border-border mb-5 sticky -top-5 z-10 bg-background -mx-5 px-5 pt-1 pb-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px', activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30')}>
            <tab.icon size={14} />{tab.label}
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
                <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} placeholder={DEFAULT_TITLE} className="max-w-[200px] h-8 text-xs" />
                <Button onClick={handleSaveTitle} size="sm" className="h-8 text-xs">保存</Button>
                <Button onClick={handleResetTitle} size="sm" variant="outline" className="h-8" title="重置"><RotateCcw size={12} /></Button>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border/60">
              <div><Label className="text-sm">开机自启</Label><p className="text-[11px] text-muted-foreground mt-0.5">应用启动时自动运行</p></div>
              <button onClick={() => setAutoStart(!autoStart)} className={cn('w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', autoStart ? 'bg-primary' : 'bg-muted-foreground/25')}><div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', autoStart ? 'translate-x-5.5' : 'translate-x-0.5')} /></button>
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
              <select value={closeBehavior} onChange={(e) => setCloseBehavior(e.target.value as 'quit' | 'tray')} className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="quit">直接退出</option><option value="tray">缩小到托盘</option></select>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border/60">
              <div><Label className="text-sm">AI 聊天点击外部关闭</Label><p className="text-[11px] text-muted-foreground mt-0.5">点击聊天面板外区域自动折叠</p></div>
              <button onClick={() => setChatClickOutsideToClose(!chatClickOutsideToClose)} className={cn('w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', chatClickOutsideToClose ? 'bg-primary' : 'bg-muted-foreground/25')}><div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', chatClickOutsideToClose ? 'translate-x-5.5' : 'translate-x-0.5')} /></button>
            </div>
            <div className="py-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div><Label className="text-sm">AI 聊天自动展开</Label><p className="text-[11px] text-muted-foreground mt-0.5">鼠标移入窗口右侧检测区域自动滑出</p></div>
                <button onClick={() => setChatAutoExpand(!chatAutoExpand)} className={cn('w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', chatAutoExpand ? 'bg-primary' : 'bg-muted-foreground/25')}><div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', chatAutoExpand ? 'translate-x-5.5' : 'translate-x-0.5')} /></button>
              </div>
              {chatAutoExpand && (
                <div className="mt-3 space-y-3 pl-1">
                  <div className="flex items-center justify-between">
                    <div><span className="text-[11px]">检测区域全局显示</span><p className="text-[10px] text-muted-foreground">始终展示检测区域位置</p></div>
                    <button onClick={() => { setChatExpandZoneVisible(!chatExpandZoneVisible); setChatExpandZonePreview(null) }} className={cn('w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0', chatExpandZoneVisible ? 'bg-primary' : 'bg-muted-foreground/25')}><div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', chatExpandZoneVisible ? 'translate-x-5.5' : 'translate-x-0.5')} /></button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1"><span className="text-[11px] text-muted-foreground">水平检测宽度</span><span className="text-[11px] font-mono text-muted-foreground">{zoneWDraft}px</span></div>
                    <input type="range" min={5} max={60} step={1} value={zoneWDraft} onChange={(e) => handleZoneWChange(Number(e.target.value))} onMouseUp={handleZoneWCommit} onTouchEnd={handleZoneWCommit} className="w-full h-1.5 accent-primary" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1"><span className="text-[11px] text-muted-foreground">竖直检测高度</span><span className="text-[11px] font-mono text-muted-foreground">{zoneHDraft}%</span></div>
                    <input type="range" min={10} max={100} step={5} value={zoneHDraft} onChange={(e) => handleZoneHChange(Number(e.target.value))} onMouseUp={handleZoneHCommit} onTouchEnd={handleZoneHCommit} className="w-full h-1.5 accent-primary" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{chatExpandZoneVisible ? '检测区域全局显示已开启，调整时无需预览。' : '检测区域全局显示关闭，拖动滑块时显示蓝色预览。'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-4">
            <div className="py-3 border-b border-border/60">
              <div className="flex items-end justify-between mb-2"><div><Label className="text-sm">DeepSeek API Key</Label><p className="text-[11px] text-muted-foreground mt-0.5">用于 AI 解析和聊天功能</p></div><Button onClick={handleSaveApiKey} size="sm" className="h-8 text-xs">保存</Button></div>
              <div className="relative"><Input type={showKey ? 'text' : 'password'} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="sk-..." className="pr-8 h-8 text-xs" /><button onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>
            </div>
            <div className="py-3 border-b border-border/60"><div className="flex items-end justify-between"><div><Label className="text-sm">AI 模型</Label><p className="text-[11px] text-muted-foreground mt-0.5 mb-2">DeepSeek 模型名称</p></div>{modelDraft !== deepseekModel && (<Button onClick={saveModel} size="sm" className="h-8 text-xs">保存</Button>)}</div><Input value={modelDraft} onChange={(e) => setModelDraft(e.target.value)} placeholder="deepseek-v4-flash" className="max-w-[240px] h-8 text-xs" /></div>
            <div className="py-3 border-b border-border/60"><div className="flex items-end justify-between"><div><Label className="text-sm">后端 API 地址</Label><p className="text-[11px] text-muted-foreground mt-0.5 mb-2">体力数据后端服务</p></div>{backendDraft !== backendUrl && (<Button onClick={saveBackend} size="sm" className="h-8 text-xs">保存</Button>)}</div><Input value={backendDraft} onChange={(e) => setBackendDraft(e.target.value)} placeholder="http://100.70.198.102:8000" className="max-w-[240px] h-8 text-xs" /></div>
          </div>
        )}

        {activeTab === 'hotkey' && (
          <div className="space-y-4">
            {renderHotkeyRow(
              '体力捕获',
              '后台截图识别体力值',
              captureHotkeyEnabled,
              setCaptureHotkeyEnabled,
              captureHotkey,
              editingCapture,
              captureKeys,
              captureConflict,
              () => startEdit('capture'),
              () => cancelEdit('capture'),
              activeCaptureSlot,
              'capture'
            )}
            {renderHotkeyRow(
              'AI 聊天',
              '呼出或折叠 AI 聊天面板',
              chatHotkeyEnabled,
              setChatHotkeyEnabled,
              chatHotkey,
              editingChat,
              chatKeys,
              chatConflict,
              () => startEdit('chat'),
              () => cancelEdit('chat'),
              activeChatSlot,
              'chat'
            )}
            <p className="text-[10px] text-muted-foreground pt-1">点击「配置快捷键」进入编辑模式，点击「+」追加按键录入框，点击录入框后按下键盘按键进行录制，点击「保存」应用配置。</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPage
