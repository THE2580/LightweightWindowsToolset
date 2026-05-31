import { useEffect, useState, useCallback } from 'react'
import { usePinnerStore } from '@/stores/pinnerStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useShallow } from 'zustand/shallow'
import AnimatedRoute from '@/components/shared/AnimatedRoute'
import { Pin, PinOff, X, RefreshCw } from 'lucide-react'
import { Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function PinnerPage(): React.JSX.Element {
  const navigate = useNavigate()
  const {
    pinnedWindows, maxPins,
    isPinmanRunning,
    selfHwnd,
    togglePin,
    unpin, unpinAll, setMaxPins,
    checkPinman,
  } = usePinnerStore(useShallow((s) => ({
    pinnedWindows: s.pinnedWindows,
    maxPins: s.maxPins,
    selfHwnd: s.selfHwnd,
    isPinmanRunning: s.isPinmanRunning,
    togglePin: s.togglePin,
    unpin: s.unpin,
    unpinAll: s.unpinAll,
    setMaxPins: s.setMaxPins,
    checkPinman: s.checkPinman,
  })))

  const {
    pinnerHotkey, pinnerAutoPinApp, setPinnerAutoPinApp,
    pinnerTopmostSelf, setPinnerTopmostSelf,
  } = useSettingsStore(
    useShallow((s) => ({
      pinnerHotkey: s.pinnerHotkey,
      pinnerAutoPinApp: s.pinnerAutoPinApp,
      setPinnerAutoPinApp: s.setPinnerAutoPinApp,
      pinnerTopmostSelf: s.pinnerTopmostSelf,
      setPinnerTopmostSelf: s.setPinnerTopmostSelf,
    }))
  )

  const [maxPinsInput, setMaxPinsInput] = useState(String(maxPins))
  useEffect(() => { setMaxPinsInput(String(maxPins)) }, [maxPins])

  const handleMaxPinsSave = useCallback(() => {
    const n = parseInt(maxPinsInput)
    if (n >= 1 && n <= 100) setMaxPins(n)
  }, [maxPinsInput, setMaxPins])

  const isSelfPinned = selfHwnd !== 0 && pinnedWindows.some(w => w.hwnd === selfHwnd)

  return (
    <AnimatedRoute>
      <div className="flex flex-col h-full p-4 gap-3">
        {/* Status bar */}
        <div className="shrink-0 flex items-center justify-between text-xs">
          <span className={isPinmanRunning ? 'text-green-600' : 'text-red-500'}>
            {isPinmanRunning ? 'PinMan 运行中' : 'PinMan 未运行'}
          </span>
          <button onClick={checkPinman} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="检查 pinman 状态">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pinned count + Toggle button */}
        <div className="shrink-0 flex items-center justify-between">
          <span className="text-sm font-medium">
            已置顶: {pinnedWindows.length} / {maxPins}
          </span>
          <div className="flex gap-2">
            {!isSelfPinned && (
              <button
                onClick={togglePin}
                disabled={!isPinmanRunning}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Pin className="w-4 h-4" />
                置顶本窗口
              </button>
            )}
            {pinnedWindows.length > 0 && (
              <button onClick={unpinAll} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">
                <PinOff className="w-4 h-4" />
                全部取消
              </button>
            )}
          </div>
        </div>

        {/* Hotkey display */}
        <div className="shrink-0 text-xs text-gray-500">
          <button
            onClick={() => navigate('/settings?tab=hotkey')}
            className="inline-flex items-center p-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 hover:text-blue-600 mr-1 align-text-bottom" title="设置快捷键"
          >
            <Settings size={12} />
          </button>
          当前快捷键:
          {pinnerHotkey ? (
            <span className="inline-flex items-center gap-1 flex-wrap ml-1">
              {(() => {
                try { const keys: string[] = JSON.parse(pinnerHotkey); return keys as string[] } catch { return [] }
              })().map((k: string, i: number) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground text-[11px]">+</span>}
                  <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 text-[11px] rounded border border-green-300 bg-white font-mono dark:bg-gray-800 dark:border-green-700">
                    {k}
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic ml-1">未配置</span>
          )}
        </div>

        {/* Pinned windows list — scrollable, fills remaining space */}
        {pinnedWindows.length > 0 ? (
          <div className="flex-1 min-h-0 border rounded-md flex flex-col overflow-hidden">
            <div className="shrink-0 text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-800 border-b">
              已置顶窗口
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {pinnedWindows.map((w) => (
                <div key={w.hwnd} className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900">
                  <span className="truncate" title={w.title || `hwnd:${w.hwnd}`}>{w.title || `hwnd:${w.hwnd}`}</span>

                  <button
                    onClick={() => unpin(w.hwnd)}
                    className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 shrink-0"
                    title="取消"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-muted-foreground">
            暂无置顶窗口。按快捷键或点击置顶按钮来置顶。
          </div>
        )}

        {/* Settings — fixed at bottom */}
        <div className="shrink-0 border-t pt-3 space-y-3">
          {/* Topmost self toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <span className="text-sm">置顶本应用时处于最顶部</span>
              <p className="text-[11px] text-muted-foreground">本应用被置顶时始终位于其他置顶窗口之上</p>
            </div>
            <button
              onClick={() => setPinnerTopmostSelf(!pinnerTopmostSelf)}
              className={`w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${pinnerTopmostSelf ? 'bg-primary' : 'bg-muted-foreground/25'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${pinnerTopmostSelf ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Auto-pin app */}
          <div className="flex items-center justify-between py-1">
            <div>
              <span className="text-sm">启动时自动置顶本应用</span>
              <p className="text-[11px] text-muted-foreground">打开工具时自动将自身窗口置顶</p>
            </div>
            <button
              onClick={() => setPinnerAutoPinApp(!pinnerAutoPinApp)}
              className={`w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${pinnerAutoPinApp ? 'bg-primary' : 'bg-muted-foreground/25'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${pinnerAutoPinApp ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Max pins */}
          <div className="flex items-center gap-2">
            <span className="text-sm">最大置顶数:</span>
            <input
              type="number" min={1} max={100}
              value={maxPinsInput}
              onChange={(e) => setMaxPinsInput(e.target.value)}
              onBlur={handleMaxPinsSave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleMaxPinsSave() }}
              className="w-16 px-2 py-1 text-sm border rounded bg-background"
            />
          </div>
        </div>
      </div>
    </AnimatedRoute>
  )
}

export default PinnerPage
