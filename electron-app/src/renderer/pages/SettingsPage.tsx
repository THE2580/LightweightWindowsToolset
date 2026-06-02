import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSettingsStore } from '@/stores/settingsStore'
import { useDeepseekStore } from '@/stores/deepseekStore'
import { applyTheme } from '@/lib/theme'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Eye, EyeOff, Monitor, Sun, Moon, Wrench, Keyboard, RotateCcw,
  Plus, Minus, FolderOpen, Info, Terminal
} from 'lucide-react'
import ConsoleLogPanel from '@/features/settings/ConsoleLogPanel'
import Dropdown from '@/components/shared/Dropdown'

type TabId = 'general' | 'api' | 'hotkey' | 'logs' | 'about'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'general', label: '通用', icon: Monitor },
  { id: 'api', label: 'API 设置', icon: Wrench },
  { id: 'hotkey', label: '快捷键', icon: Keyboard },
  { id: 'about', label: '关于', icon: Info },
]

const DEFAULT_TITLE = '轻量化工具集'

type HotkeyAction = 'capture' | 'chat' | 'pinner'
type HotkeyIPC = 'resource-capture' | 'ai-chat' | 'window-pinner'

function actionToIPC(a: HotkeyAction): HotkeyIPC {
  if (a === 'capture') return 'resource-capture'
  if (a === 'chat') return 'ai-chat'
  return 'window-pinner'
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'CommandOrControl'])

/** Normalize a KeyboardEvent to a display key name */
function normalizeKey(e: React.KeyboardEvent): string {
  const key = e.key
  if (key.length === 1) return key.toUpperCase()
  if (key === ' ') return 'Space'
  if (key.startsWith('Arrow')) return key
  if (key.startsWith('F') && key.length <= 3) return key
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

/** Parse stored hotkey string. Supports JSON array (new) and +-separated (legacy). */
function parseAccelerator(acc: string): string[] {
  if (!acc) return []
  if (acc.startsWith('[')) {
    try { return JSON.parse(acc) } catch { return [] }
  }
  return acc.split('+')
}

/**
 * Validate a hotkey key combination for Electron globalShortcut.register.
 *
 * Electron's accelerator format: zero or more modifiers + exactly ONE key code,
 * joined by '+'.  Multiple non-modifier keys are NOT supported — the middle ones
 * are silently discarded (e.g. Control+B+C is registered as Control+C).
 *
 * Rules enforced here:
 * 1. At least 2 keys (>=1 modifier + exactly 1 non-modifier).
 * 2. All modifiers must come first, the single non-modifier key last.
 * 3. No interleaving.
 */
function validateHotkeyKeys(keys: string[]): string | null {
  const nonEmpty = keys.filter((k) => k)
  if (nonEmpty.length === 0) return null
  if (nonEmpty.length < 2) {
    return '快捷键至少需要两个按键（修饰键 + 普通键），如 Ctrl+C'
  }

  let seenNonModifier = false
  let nonModifierCount = 0
  for (let i = 0; i < nonEmpty.length; i++) {
    if (MODIFIER_KEYS.has(nonEmpty[i])) {
      if (seenNonModifier) {
        return '修饰键必须全部在普通键之前，不能交替排列'
      }
    } else {
      seenNonModifier = true
      nonModifierCount++
    }
  }

  if (!MODIFIER_KEYS.has(nonEmpty[0])) {
    return '首个按键必须是修饰键（Ctrl/Shift/Alt/Win）'
  }

  if (MODIFIER_KEYS.has(nonEmpty[nonEmpty.length - 1])) {
    return '末尾按键必须是普通键，不能以修饰键结尾'
  }

  // Electron globalShortcut.register only supports exactly one non-modifier key.
  // e.g. Control+B+C → Electron discards B, only registers Control+C.
  if (nonModifierCount > 1) {
    return '快捷键只能有一个普通键，不支持多字符组合（如 Ctrl+B+C 中间键会被 Electron 丢弃）'
  }

  return null
}

function SettingsPage(): React.JSX.Element {
  const {
    theme, autoStart, chatClickOutsideToClose, chatAutoExpand,
    chatExpandZoneVisible, chatExpandZoneWidth, chatExpandZoneHeight, chatAutoExpandDelay,
    backendUrl, deepseekModel, windowTitle, closeBehavior,
    captureHotkey, chatHotkey, captureHotkeyEnabled, chatHotkeyEnabled,
    pinnerHotkey, pinnerHotkeyEnabled,
    setTheme, setAutoStart, setChatClickOutsideToClose, setChatAutoExpand,
    setChatExpandZoneVisible, setChatExpandZoneWidth, setChatExpandZoneHeight, setChatAutoExpandDelay,
    setChatExpandZonePreview,
    setBackendUrl, setDeepseekModel, setWindowTitle, setCloseBehavior,
    setCaptureHotkey, setChatHotkey, setPinnerHotkey, setCaptureHotkeyEnabled, setChatHotkeyEnabled, setPinnerHotkeyEnabled,
    storagePath, loadStoragePath, setStoragePath,
    developerMode, setDeveloperMode,
    load
  } = useSettingsStore()

  const { apiKey, loadApiKey } = useDeepseekStore()
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tab = searchParams.get('tab')
    return (tab === 'general' || tab === 'api' || tab === 'hotkey' || tab === 'about') ? tab : 'general'
  })
  const [titleDraft, setTitleDraft] = useState(windowTitle)
  const [zoneWDraft, setZoneWDraft] = useState(chatExpandZoneWidth)
  const [zoneHDraft, setZoneHDraft] = useState(chatExpandZoneHeight)
  const [autoExpandDelayDraft, setAutoExpandDelayDraft] = useState(chatAutoExpandDelay)
  const [storagePathDraft, setStoragePathDraft] = useState('')
  const [storagePathEditing, setStoragePathEditing] = useState(false)
  const [storagePathError, setStoragePathError] = useState<string | null>(null)
  const [storagePathSuccess, setStoragePathSuccess] = useState(false)
  const [modelDraft, setModelDraft] = useState(deepseekModel)
  const [backendDraft, setBackendDraft] = useState(backendUrl)

  // Hotkey editing state
  const [editingCapture, setEditingCapture] = useState(false)
  const [editingChat, setEditingChat] = useState(false)
  const [editingPinner, setEditingPinner] = useState(false)
  const [captureKeys, setCaptureKeys] = useState<string[]>([])
  const [chatKeys, setChatKeys] = useState<string[]>([])
  const [pinnerKeys, setPinnerKeys] = useState<string[]>([])
  const [captureConflict, setCaptureConflict] = useState(false)
  const [chatConflict, setChatConflict] = useState(false)
  const [pinnerConflict, setPinnerConflict] = useState(false)
  const [captureValidationError, setCaptureValidationError] = useState<string | null>(null)
  const [chatValidationError, setChatValidationError] = useState<string | null>(null)
  const [pinnerValidationError, setPinnerValidationError] = useState<string | null>(null)
  const [activeCaptureSlot, setActiveCaptureSlot] = useState<number | null>(null)
  const [activeChatSlot, setActiveChatSlot] = useState<number | null>(null)
  const [activePinnerSlot, setActivePinnerSlot] = useState<number | null>(null)

  const captureKeysRef = useRef<string[]>([])
  const chatKeysRef = useRef<string[]>([])
  const pinnerKeysRef = useRef<string[]>([])
  const keyCaptureRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load(); loadApiKey(); loadStoragePath() }, [load, loadApiKey, loadStoragePath])
  useEffect(() => { applyTheme(theme) }, [theme])
  useEffect(() => { if (apiKey) setApiKeyInput(apiKey) }, [apiKey])
  useEffect(() => { setModelDraft(deepseekModel) }, [deepseekModel])
  useEffect(() => { setBackendDraft(backendUrl) }, [backendUrl])
  useEffect(() => { setTitleDraft(windowTitle) }, [windowTitle])
  useEffect(() => { setZoneWDraft(chatExpandZoneWidth); setZoneHDraft(chatExpandZoneHeight) }, [chatExpandZoneWidth, chatExpandZoneHeight])
  useEffect(() => { setAutoExpandDelayDraft(chatAutoExpandDelay) }, [chatAutoExpandDelay])
  useEffect(() => { if (!storagePathEditing) setStoragePathDraft(storagePath) }, [storagePath, storagePathEditing])
  useEffect(() => { if (!developerMode && activeTab === 'logs') setActiveTab('general') }, [developerMode, activeTab])

  useEffect(() => { if (!editingCapture) setCaptureKeys(parseAccelerator(captureHotkey)) }, [captureHotkey, editingCapture])
  useEffect(() => { if (!editingChat) setChatKeys(parseAccelerator(chatHotkey)) }, [chatHotkey, editingChat])
  useEffect(() => { if (!editingPinner) setPinnerKeys(parseAccelerator(pinnerHotkey)) }, [pinnerHotkey, editingPinner])

  useEffect(() => { captureKeysRef.current = captureKeys }, [captureKeys])
  useEffect(() => { chatKeysRef.current = chatKeys }, [chatKeys])
  useEffect(() => { pinnerKeysRef.current = pinnerKeys }, [pinnerKeys])

  // Clear save-time errors when keys change
  useEffect(() => { setCaptureValidationError(null); setCaptureConflict(false) }, [captureKeys])
  useEffect(() => { setChatValidationError(null); setChatConflict(false) }, [chatKeys])

  const handleSaveApiKey = async () => { useDeepseekStore.getState().setApiKey(apiKeyInput); await window.api.settings.set('deepseekApiKey', apiKeyInput) }
  const saveModel = async () => { await setDeepseekModel(modelDraft) }
  const saveBackend = async () => { await setBackendUrl(backendDraft) }
  const handleSaveTitle = async () => { const t = titleDraft.trim(); if (!t) { setTitleDraft(windowTitle); return }; await setWindowTitle(t) }
  const handleResetTitle = async () => { setTitleDraft(DEFAULT_TITLE); await setWindowTitle(DEFAULT_TITLE) }

  const handleZoneWChange = (w: number) => { setZoneWDraft(w); if (!chatExpandZoneVisible) setChatExpandZonePreview({ w, h: zoneHDraft }) }
  const handleZoneHChange = (h: number) => { setZoneHDraft(h); if (!chatExpandZoneVisible) setChatExpandZonePreview({ w: zoneWDraft, h }) }
  const handleZoneWCommit = async () => { await setChatExpandZoneWidth(zoneWDraft); setChatExpandZonePreview(null) }
  const handleZoneHCommit = async () => { await setChatExpandZoneHeight(zoneHDraft); setChatExpandZonePreview(null) }
  const handleAutoExpandDelayCommit = async () => { await setChatAutoExpandDelay(autoExpandDelayDraft) }

  // --- Hotkey helpers ---

  const startEdit = useCallback((which: HotkeyAction) => {
    try { window.api.hotkey.disableAllHotkeys() } catch { /* ok */ }
    const saved = which === 'capture' ? captureHotkey : which === 'pinner' ? pinnerHotkey : chatHotkey
    if (which === 'capture') {
      setEditingCapture(true)
      setEditingChat(false)
      setEditingPinner(false)
      setCaptureValidationError(null)
      setCaptureConflict(false)
      const parsed = parseAccelerator(saved)
      setCaptureKeys(parsed.length > 0 ? parsed : [''])
      setTimeout(() => { keyCaptureRef.current?.focus() }, 0)
    } else if (which === 'pinner') {
      setEditingPinner(true)
      setEditingCapture(false)
      setEditingChat(false)
      setPinnerValidationError(null)
      setPinnerConflict(false)
      const pp = parseAccelerator(saved)
      setPinnerKeys(pp.length > 0 ? pp : [''])
      setTimeout(() => { keyCaptureRef.current?.focus() }, 0)
    } else {
      setEditingChat(true)
      setEditingCapture(false)
      setEditingPinner(false)
      setChatValidationError(null)
      setChatConflict(false)
      const parsedChat = parseAccelerator(saved)
      setChatKeys(parsedChat.length > 0 ? parsedChat : [''])
    }
  }, [captureHotkey, chatHotkey, pinnerHotkey])

  const cancelEdit = useCallback((which: HotkeyAction) => {
    try { window.api.hotkey.enableAllHotkeys() } catch { /* ok */ }
    if (which === 'capture') {
      setEditingCapture(false)
      setCaptureKeys(parseAccelerator(captureHotkey))
      setCaptureConflict(false)
      setCaptureValidationError(null)
      setActiveCaptureSlot(null)
    } else if (which === 'pinner') {
      setEditingPinner(false)
      setPinnerKeys(parseAccelerator(pinnerHotkey))
      setPinnerConflict(false)
      setPinnerValidationError(null)
      setActivePinnerSlot(null)
    } else {
      setEditingChat(false)
      setChatKeys(parseAccelerator(chatHotkey))
      setChatConflict(false)
      setChatValidationError(null)
      setActiveChatSlot(null)
    }
  }, [captureHotkey, chatHotkey])

  const appendKey = useCallback((which: HotkeyAction) => {
    if (which === 'capture') {
      setCaptureKeys((prev) => {
        if (prev.length > 0 && !prev[prev.length - 1]) return prev
        return [...prev, '']
      })
    } else if (which === 'pinner') {
      setPinnerKeys((prev) => {
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
    } else if (which === 'pinner') {
      setPinnerKeys((prev) => prev.slice(0, -1))
      setActivePinnerSlot(null)
    } else {
      setChatKeys((prev) => prev.slice(0, -1))
      setActiveChatSlot(null)
    }
  }, [])

  const saveHotkey = useCallback(async (which: HotkeyAction) => {
    const keys = which === 'capture' ? captureKeysRef.current : which === 'pinner' ? pinnerKeysRef.current : chatKeysRef.current
    const nonEmpty = keys.filter((k) => k)
    const deduped = nonEmpty.filter((k, i) => nonEmpty.indexOf(k) === i)
    const acc = deduped.length > 0 ? keysToAccelerator(deduped) : ''

    // Step 1: validate combination structure
    if (deduped.length > 0) {
      const err = validateHotkeyKeys(deduped)
      if (err) {
        if (which === 'capture') { setCaptureValidationError(err); setCaptureConflict(false) }
        else if (which === 'pinner') { setPinnerValidationError(err); setPinnerConflict(false) }
        else { setChatValidationError(err); setChatConflict(false) }
        return
      }
    }

    // Step 2: check conflict against other registered shortcuts
    const exclude = actionToIPC(which)
    try {
      const conflictAction = await window.api.hotkey.checkConflict(acc, exclude)
      if (conflictAction) {
        if (which === 'capture') { setCaptureConflict(true); setCaptureValidationError(null) }
        else if (which === 'pinner') { setPinnerConflict(true); setPinnerValidationError(null) }
        else { setChatConflict(true); setChatValidationError(null) }
        return
      }
    } catch { /* ok */ }

    // All checks passed — save
    if (which === 'capture') {
      await setCaptureHotkey(deduped)
      setEditingCapture(false)
      setCaptureConflict(false)
      setCaptureValidationError(null)
    } else if (which === 'pinner') {
      await setPinnerHotkey(deduped)
      setEditingPinner(false)
      setPinnerConflict(false)
      setPinnerValidationError(null)
    } else {
      await setChatHotkey(deduped)
      setEditingChat(false)
      setChatConflict(false)
      setChatValidationError(null)
    }

    try { await window.api.hotkey.enableAllHotkeys() } catch { /* ok */ }
  }, [setCaptureHotkey, setChatHotkey])


  const handleSelectFolder = async () => {
    const folder = await window.api.settings.selectFolder()
    if (folder) {
      setStoragePathDraft(folder)
      setStoragePathEditing(true)
      setStoragePathError(null)
      setStoragePathSuccess(false)
    }
  }

  const handleSaveStoragePath = async () => {
    if (!storagePathDraft.trim()) return
    setStoragePathError(null)
    setStoragePathSuccess(false)
    const result = await setStoragePath(storagePathDraft.trim())
    if (result.success) {
      setStoragePathEditing(false)
      setStoragePathSuccess(true)
    } else {
      setStoragePathError(result.error || '')
    }
  }

  const handleCancelStoragePath = () => {
    setStoragePathDraft(storagePath)
    setStoragePathEditing(false)
    setStoragePathError(null)
    setStoragePathSuccess(false)
  }

  const handleKeyCapture = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const normalized = normalizeKey(e)
    if (!normalized) return

    if (editingCapture && activeCaptureSlot !== null) {
      const slot = activeCaptureSlot
      setCaptureKeys((prev) => { const n = [...prev]; n[slot] = normalized; return n })
      setActiveCaptureSlot(null)
    } else if (editingChat && activeChatSlot !== null) {
      const slot = activeChatSlot
      setChatKeys((prev) => { const n = [...prev]; n[slot] = normalized; return n })
      setActiveChatSlot(null)
    } else if (editingCapture) {
      setCaptureKeys((prev) => {
        const idx = prev.findIndex((k) => !k)
        if (idx < 0) return prev
        const n = [...prev]; n[idx] = normalized; return n
      })
    } else if (editingChat) {
      setChatKeys((prev) => {
        const idx = prev.findIndex((k) => !k)
        if (idx < 0) return prev
        const n = [...prev]; n[idx] = normalized; return n
      })
    } else if (editingPinner && activePinnerSlot !== null) {
      const slot = activePinnerSlot
      setPinnerKeys((prev) => { const n = [...prev]; n[slot] = normalized; return n })
      setActivePinnerSlot(null)
    } else if (editingPinner) {
      setPinnerKeys((prev) => {
        const idx = prev.findIndex((k) => !k)
        if (idx < 0) return prev
        const n = [...prev]; n[idx] = normalized; return n
      })
    }
  }, [editingCapture, editingChat, editingPinner, activeCaptureSlot, activeChatSlot, activePinnerSlot])

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
    validationError: string | null,
    startEditFn: () => void,
    cancelEditFn: () => void,
    activeSlot: number | null,
    which: HotkeyAction
  ) => (
    <div className="py-3 border-b border-border/60">
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
          <div className={cn(
            'flex items-center gap-1 flex-wrap p-1 rounded transition-colors',
            (conflict || validationError) && 'bg-red-500/10'
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
                          ? 'border-yellow-500 bg-background'
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
          {validationError && (
            <p className="text-[10px] text-red-500 mt-1">{validationError}</p>
          )}
        </div>
      ) : (
        saved ? (
          <span className="flex items-center gap-1 flex-wrap">
            {parseAccelerator(saved).map((k, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground text-[11px]">+</span>}
                <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-1 text-[11px] rounded border border-green-300 bg-background font-mono">
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
        {[...TABS.slice(0, 3), ...(developerMode ? [{ id: 'logs' as const, label: '控制台日志', icon: Terminal }] : []), ...TABS.slice(3)].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px', activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30')}>
            <tab.icon size={14} />{tab.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {activeTab === 'general' && (
          <motion.div key="general" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: 'easeOut' }} className="space-y-4">
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
              <Dropdown ariaLabel="关闭应用时" value={closeBehavior} onChange={(value) => setCloseBehavior(value as 'quit' | 'tray')} options={[{ id: 'quit', label: '直接退出' }, { id: 'tray', label: '缩小到托盘' }]} className="h-8 w-28 px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring" menuClassName="text-xs" />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border/60">
              <div><Label className="text-sm">开发者模式</Label><p className="text-[11px] text-muted-foreground mt-0.5">显示控制台日志标签页，便于排查运行状态</p></div>
              <button onClick={() => setDeveloperMode(!developerMode)} className={cn('w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', developerMode ? 'bg-primary' : 'bg-muted-foreground/25')}><div className={cn('w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200', developerMode ? 'translate-x-5.5' : 'translate-x-0.5')} /></button>
            </div>
            <div className="py-3 border-b border-border/60">
              <Label className="text-sm">存储路径</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">数据文件 config.json 存放目录，更改后自动迁移并重启生效</p>
              <div className="flex gap-2 items-center">
                <Input
                  value={storagePathEditing ? storagePathDraft : storagePath || ''}
                  onChange={(e) => { setStoragePathDraft(e.target.value); setStoragePathEditing(true); setStoragePathError(null); setStoragePathSuccess(false) }}
                  placeholder="默认路径"
                  readOnly={!storagePathEditing}
                  className={cn('flex-1 h-8 text-xs font-mono', !storagePathEditing && 'text-muted-foreground')}
                />
                {!storagePathEditing ? (
                  <Button size="sm" variant="outline" className="h-8 text-xs px-2 flex-shrink-0" onClick={handleSelectFolder}>
                    <FolderOpen size={12} className="mr-1" />更改
                  </Button>
                ) : (
                  <>
                    <Button size="sm" className="h-8 text-xs px-3 flex-shrink-0" onClick={handleSaveStoragePath}>保存</Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs px-2 flex-shrink-0" onClick={handleCancelStoragePath}>取消</Button>
                  </>
                )}
              </div>
              {storagePathSuccess && (
                <p className="text-[10px] text-green-600 mt-1">数据已迁移，重启应用后生效</p>
              )}
              {storagePathError && (
                <p className="text-[10px] text-red-500 mt-1">{storagePathError}</p>
              )}
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
                  <div>
                    <div className="flex items-center justify-between mb-1"><span className="text-[11px] text-muted-foreground">检测延迟</span><span className="text-[11px] font-mono text-muted-foreground">{autoExpandDelayDraft}ms</span></div>
                    <input type="range" min={0} max={1500} step={50} value={autoExpandDelayDraft} onChange={(e) => setAutoExpandDelayDraft(Number(e.target.value))} onMouseUp={handleAutoExpandDelayCommit} onTouchEnd={handleAutoExpandDelayCommit} className="w-full h-1.5 accent-primary" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{chatExpandZoneVisible ? '检测区域全局显示已开启，调整时无需预览。' : '检测区域全局显示关闭，拖动滑块时显示蓝色预览。'}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'api' && (
          <motion.div key="api" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: 'easeOut' }} className="space-y-4">
            <div className="py-3 border-b border-border/60">
              <div className="flex items-end justify-between mb-2"><div><Label className="text-sm">DeepSeek API Key</Label><p className="text-[11px] text-muted-foreground mt-0.5">用于 AI 解析和聊天功能</p></div><Button onClick={handleSaveApiKey} size="sm" className="h-8 text-xs">保存</Button></div>
              <div className="relative"><Input type={showKey ? 'text' : 'password'} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="sk-..." className="pr-8 h-8 text-xs" /><button onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>{showKey ? <EyeOff size={14} /> : <Eye size={14} />}</button></div>
            </div>
            <div className="py-3 border-b border-border/60"><div className="flex items-end justify-between"><div><Label className="text-sm">AI 模型</Label><p className="text-[11px] text-muted-foreground mt-0.5 mb-2">DeepSeek 模型名称</p></div>{modelDraft !== deepseekModel && (<Button onClick={saveModel} size="sm" className="h-8 text-xs">保存</Button>)}</div><Input value={modelDraft} onChange={(e) => setModelDraft(e.target.value)} placeholder="deepseek-v4-flash" className="max-w-[240px] h-8 text-xs" /></div>
            <div className="py-3 border-b border-border/60"><div className="flex items-end justify-between"><div><Label className="text-sm">后端 API 地址</Label><p className="text-[11px] text-muted-foreground mt-0.5 mb-2">游戏资源后端服务</p></div>{backendDraft !== backendUrl && (<Button onClick={saveBackend} size="sm" className="h-8 text-xs">保存</Button>)}</div><Input value={backendDraft} onChange={(e) => setBackendDraft(e.target.value)} placeholder="http://100.70.198.102:8000" className="max-w-[240px] h-8 text-xs" /></div>
          </motion.div>
        )}

        {activeTab === 'hotkey' && (
          <motion.div key="hotkey" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: 'easeOut' }} className="space-y-4">
            {renderHotkeyRow(
              '游戏资源捕获',
              '后台截图识别资源值',
              captureHotkeyEnabled,
              setCaptureHotkeyEnabled,
              captureHotkey,
              editingCapture,
              captureKeys,
              captureConflict,
              captureValidationError,
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
              chatValidationError,
              () => startEdit('chat'),
              () => cancelEdit('chat'),
              activeChatSlot,
              'chat'
            )}
            {renderHotkeyRow(
              '窗口置顶',
              '置顶当前焦点窗口，再次触发取消',
              pinnerHotkeyEnabled,
              setPinnerHotkeyEnabled,
              pinnerHotkey,
              editingPinner,
              pinnerKeys,
              pinnerConflict,
              pinnerValidationError,
              () => startEdit('pinner'),
              () => cancelEdit('pinner'),
              activePinnerSlot,
              'pinner'
            )}
            <p className="text-[10px] text-muted-foreground pt-1">快捷键格式：一个或多个修饰键（Ctrl/Shift/Alt/Win）在前，恰好一个普通键在后。不支持多字符组合（Ctrl+B+C 中间键会被 Electron 丢弃）。</p>
          </motion.div>
        )}
        {activeTab === 'logs' && developerMode && (
          <motion.div key="logs" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: 'easeOut' }}>
            <ConsoleLogPanel />
          </motion.div>
        )}
        {activeTab === 'about' && (
          <motion.div key="about" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: 'easeOut' }} className="space-y-4">
            <div className="py-3 border-b border-border/60">
              <Label className="text-sm">LightweightWindowsToolset</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">Windows 桌面工具集</p>
            </div>
            <div className="py-3 border-b border-border/60">
              <Label className="text-xs text-muted-foreground">作者</Label>
              <p className="text-sm mt-0.5">THE2580</p>
            </div>
            <div className="py-3 border-b border-border/60">
              <Label className="text-xs text-muted-foreground">GitHub</Label>
              <p className="text-sm mt-0.5">
                <a href="https://github.com/THE2580/LightweightWindowsToolset" target="_blank" rel="noreferrer" className="text-primary hover:underline">github.com/THE2580/LightweightWindowsToolset</a>
              </p>
            </div>
            <div className="py-3 border-b border-border/60">
              <Label className="text-xs text-muted-foreground">邮箱</Label>
              <p className="text-sm mt-0.5">2021289500@qq.com</p>
              <p className="text-sm">liangneng20060725@gmail.com</p>
            </div>
            <div className="py-3">
              <Label className="text-xs text-muted-foreground">版本</Label>
              <p className="text-sm mt-0.5 font-mono">1.0.0</p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

export default SettingsPage
