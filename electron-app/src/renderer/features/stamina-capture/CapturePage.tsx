import { useEffect, useRef, useState, useCallback } from 'react'
import AnimatedRoute from '@/components/shared/AnimatedRoute'
import GameSelector from './GameSelector'
import CapturePanel from './CapturePanel'
import StaminaDisplay from './StaminaDisplay'
import CaptureHistory from './CaptureHistory'
import { useCaptureStore } from '@/stores/captureStore'
import { useShallow } from 'zustand/shallow'
import { useSettingsStore } from '@/stores/settingsStore'
import { RefreshCw } from 'lucide-react'
import { WifiOff } from 'lucide-react'

function CapturePage(): React.JSX.Element {
  const { loadTodayFromBackend } = useCaptureStore(
    useShallow((s) => ({ loadTodayFromBackend: s.loadTodayFromBackend }))
  )
  const backendOnline = useCaptureStore((s) => s.backendOnline)
  const interval = useSettingsStore((s) => s.captureRefreshInterval)
  const setIntervalSetting = useSettingsStore((s) => s.setCaptureRefreshInterval)
  const [draft, setDraft] = useState(String(interval))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const restartTimer = useCallback((ms: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (ms > 0) {
      timerRef.current = setInterval(() => { useCaptureStore.getState().refreshRecords() }, ms * 1000)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadTodayFromBackend()
  }, [loadTodayFromBackend])

  // Polling with configurable interval
  useEffect(() => {
    restartTimer(interval)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [interval, restartTimer])

  // Sync draft when interval changes externally
  useEffect(() => { setDraft(String(interval)) }, [interval])

  const handleSaveInterval = () => {
    const v = parseFloat(draft)
    if (isNaN(v) || v <= 0) {
      setDraft(String(interval))
      return
    }
    setIntervalSetting(v)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveInterval()
    if (e.key === 'Escape') setDraft(String(interval))
  }

  return (
    <AnimatedRoute>
      <div className="space-y-4 h-full overflow-y-auto pr-1 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">游戏资源捕获</h1>
            <p className="text-xs text-muted-foreground">截图识别游戏资源值</p>
            {!backendOnline && (
              <div className="flex items-center gap-1 mt-1">
                <WifiOff size={11} className="text-amber-500" />
                <span className="text-[10px] text-amber-600">后端离线</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Auto-refresh interval */}
            <div className="flex items-center gap-1.5">
              <RefreshCw size={12} className="text-muted-foreground" />
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={handleSaveInterval}
                onKeyDown={handleKeyDown}
                className="w-12 h-7 text-center text-[11px] rounded border border-border bg-background px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-muted-foreground">秒</span>
            </div>
            <GameSelector />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <StaminaDisplay />
          <CapturePanel />
        </div>

        <CaptureHistory />
      </div>
    </AnimatedRoute>
  )
}

export default CapturePage
