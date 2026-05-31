import { useEffect, useRef, useState, useCallback } from 'react'
import AnimatedRoute from '@/components/shared/AnimatedRoute'
import GameSelector from './GameSelector'
import CapturePanel from './CapturePanel'
import ResourceDisplay from './ResourceDisplay'
import CaptureHistory from './CaptureHistory'
import { useCaptureStore } from '@/stores/captureStore'
import { useShallow } from 'zustand/shallow'
import { useSettingsStore } from '@/stores/settingsStore'
import { WifiOff, ArrowUp } from 'lucide-react'

function CapturePage(): React.JSX.Element {
  const { loadLatestFromBackend } = useCaptureStore(
    useShallow((s) => ({ loadLatestFromBackend: s.loadLatestFromBackend }))
  )
  const backendOnline = useCaptureStore((s) => s.backendOnline)
  const interval = useSettingsStore((s) => s.captureRefreshInterval)
  const setIntervalSetting = useSettingsStore((s) => s.setCaptureRefreshInterval)
  const [draft, setDraft] = useState(String(interval))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)
  const [showBackTop, setShowBackTop] = useState(false)

  const restartTimer = useCallback((ms: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (ms > 0) {
      timerRef.current = setInterval(() => { useCaptureStore.getState().refreshRecords() }, ms * 1000)
    }
  }, [])

  useEffect(() => { loadLatestFromBackend() }, [loadLatestFromBackend])

  useEffect(() => {
    restartTimer(interval)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [interval, restartTimer])

  useEffect(() => { setDraft(String(interval)) }, [interval])

  const handleSaveInterval = () => {
    const v = parseFloat(draft)
    if (isNaN(v) || v <= 0) { setDraft(String(interval)); return }
    setIntervalSetting(v)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSaveInterval()
    if (e.key === 'Escape') setDraft(String(interval))
  }

  const handleHistoryScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowBackTop(el.scrollTop > 60)
  }, [])

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <AnimatedRoute>
      <div
        ref={scrollRef}
        onScroll={handleHistoryScroll}
        className={historyExpanded
          ? 'h-full overflow-y-auto pr-1 pb-2 space-y-3'
          : 'flex flex-col h-full space-y-3 pr-1'
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-bold">游戏资源捕获</h1>
            {!backendOnline && (
              <div className="flex items-center gap-1 mt-0.5">
                <WifiOff size={11} className="text-amber-500" />
                <span className="text-[10px] text-amber-600">后端离线</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setDraft('2'); setIntervalSetting(2) }}
                className="text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                title="重置为默认 2s"
              >↻</button>
              <input
                type="number" min="0.5" step="0.5"
                value={draft} onChange={(e) => setDraft(e.target.value)}
                onBlur={handleSaveInterval} onKeyDown={handleKeyDown}
                className="w-10 h-6.5 text-center text-[11px] rounded border border-border bg-background px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-[10px] text-muted-foreground">s</span>
            </div>
            <GameSelector />
          </div>
        </div>

        {/* Upper row */}
        <div className="grid grid-cols-2 gap-3 flex-shrink-0">
          <ResourceDisplay />
          <CapturePanel />
        </div>

        {/* History — fills remaining space when collapsed */}
        <CaptureHistory onExpandedChange={setHistoryExpanded} />

        {/* Back-to-top button */}
        {showBackTop && historyExpanded && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-3 right-3 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-card border border-border shadow-md hover:shadow-lg hover:border-primary/40 transition-all duration-150"
          >
            <ArrowUp size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </AnimatedRoute>
  )
}

export default CapturePage
