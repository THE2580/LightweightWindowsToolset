import { useEffect, useState } from 'react'
import { usePinnerStore, PinnedWindowInfo } from '@/stores/pinnerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useShallow } from 'zustand/shallow'
import AnimatedRoute from '@/components/shared/AnimatedRoute'
import { Pin, PinOff, ChevronDown, Settings } from 'lucide-react'

const COLOR_PRESETS = [
  { label: '蓝', value: '#2563EB' },
  { label: '绿', value: '#10B981' },
  { label: '橙', value: '#F59E0B' },
  { label: '红', value: '#EF4444' },
  { label: '紫', value: '#8B5CF6' },
  { label: '粉', value: '#EC4899' },
  { label: '青', value: '#06B6D4' },
  { label: '黄', value: '#EAB308' },
]

function parseHotkeyKeys(jsonStr: string): string[] {
  if (!jsonStr) return []
  try { return JSON.parse(jsonStr) } catch { return jsonStr.split('+') }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function PinnerPage(): React.JSX.Element {
  const {
    pinnedWindow, setPinnedWindow,
    borderColor,
    isLoaded, loadSettings,
    togglePin, unpin, updateBorderColor
  } = usePinnerStore(useShallow((s) => ({
    pinnedWindow: s.pinnedWindow,
    setPinnedWindow: s.setPinnedWindow,
    borderColor: s.borderColor,
    isLoaded: s.isLoaded,
    loadSettings: s.loadSettings,
    togglePin: s.togglePin,
    unpin: s.unpin,
    updateBorderColor: s.updateBorderColor
  })))

  const [customColor, setCustomColor] = useState(borderColor)
  const pinnerHotkey = useSettingsStore((s) => s.pinnerHotkey)
  const hotkeyKeys = parseHotkeyKeys(pinnerHotkey)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => { loadSettings() }, [loadSettings])

  useEffect(() => {
    const cleanup = window.api.pinner.onStateUpdate((info: PinnedWindowInfo | null) => {
      setPinnedWindow(info)
    })
    return cleanup
  }, [setPinnedWindow])

  useEffect(() => { setCustomColor(borderColor) }, [borderColor])

  return (
    <AnimatedRoute>
      <div className="flex flex-col h-full space-y-3 pr-1">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <h1 className="text-lg font-bold">窗口置顶</h1>
          <div className="flex items-center gap-2">
            {pinnedWindow && (
              <button
                onClick={unpin}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                title="取消置顶"
              >
                <PinOff size={12} />
                取消置顶
              </button>
            )}
            <button
              onClick={togglePin}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
            >
              <Pin size={13} />
              {pinnedWindow ? '置顶新窗口' : '置顶当前窗口'}
            </button>
          </div>
        </div>

        {/* Pinned window state */}
        <div className="flex-1 min-h-0">
          {!pinnedWindow ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-1.5">
              <Pin size={28} className="opacity-30" />
              <p className="text-[12px]">暂无置顶窗口</p>
              <p className="text-[10px]">
                点击上方按钮或使用
                {hotkeyKeys.length > 0 ? (
                  <span className="inline-flex items-center gap-0.5 align-middle mx-0.5">
                    {hotkeyKeys.map((k, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5">
                        {i > 0 && <span className="text-[9px]">+</span>}
                        <kbd className="inline-flex items-center justify-center min-w-[20px] h-[16px] px-1 text-[10px] rounded border border-border bg-card font-mono leading-none">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="italic">(未设置)</span>
                )}
                置顶当前前台窗口
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="p-4 rounded-lg border-2 border-border bg-card"
                style={{ borderColor: borderColor }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">已置顶窗口</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{formatTime(pinnedWindow.pinnedAt)}</span>
                </div>
                <p className="text-[13px] font-medium truncate">{pinnedWindow.windowTitle || '(无标题)'}</p>
                <p className="text-[11px] text-muted-foreground mt-1">进程: {pinnedWindow.processName}</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom settings bar */}
        <div className="flex-shrink-0 border-t border-border pt-2.5">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <Settings size={12} />
            置顶设置
            <ChevronDown size={10} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
          </button>

          {showSettings && (
            <div className="space-y-3 pb-1">
              {/* Border color presets */}
              <div className="flex items-start gap-2">
                <span className="text-[11px] text-muted-foreground w-24 mt-1.5">边框颜色</span>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map((cp) => (
                      <button
                        key={cp.value}
                        onClick={() => updateBorderColor(cp.value)}
                        className={`w-6 h-6 rounded-full border-2 transition-all duration-150 ${
                          borderColor === cp.value
                            ? 'border-foreground scale-110 ring-2 ring-primary/30'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: cp.value }}
                        title={cp.label}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-muted-foreground">自定义</span>
                    <input
                      type="color"
                      value={customColor}
                      onChange={(e) => { setCustomColor(e.target.value); updateBorderColor(e.target.value) }}
                      className="w-6 h-5 rounded border border-border cursor-pointer bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none"
                    />
                    {customColor !== borderColor && (
                      <span className="text-[10px] text-muted-foreground font-mono">{borderColor}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AnimatedRoute>
  )
}

export default PinnerPage
