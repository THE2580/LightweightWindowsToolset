import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCaptureStore, GameConfig } from '@/stores/captureStore'
import { useShallow } from 'zustand/shallow'

function getGameColor(gameId: string, configs: GameConfig[]): string {
  if (gameId.startsWith('unknown-')) return '#6B7280'
  return configs.find((g) => g.id === gameId)?.color || '#6B7280'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

interface Props {
  onExpandedChange?: (expanded: boolean) => void
}

function CaptureHistory({ onExpandedChange }: Props): React.JSX.Element {
  const { captureHistory, gameConfigs } = useCaptureStore(
    useShallow((s) => ({ captureHistory: s.captureHistory, gameConfigs: s.gameConfigs }))
  )
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const prevExpanded = useRef<string | null>(null)

  useEffect(() => {
    if (expandedId !== prevExpanded.current) {
      prevExpanded.current = expandedId
      onExpandedChange?.(expandedId !== null)
    }
  }, [expandedId, onExpandedChange])

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id))

  const copyOcrText = async (text: string) => {
    try { await navigator.clipboard.writeText(text) } catch { /* ok */ }
  }

  const isAnyExpanded = expandedId !== null

  return (
    <div className={`rounded-lg border border-border bg-card shadow-sm p-4 hover:shadow-md hover:ring-1 hover:ring-blue-300/40 transition-shadow duration-150 ${isAnyExpanded ? '' : 'flex-1 min-h-0 flex flex-col'}`}>
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="text-[13px] font-semibold">捕获记录</h3>
        {captureHistory.length > 0 && (
          <span className="text-[10px] text-muted-foreground">{captureHistory.length} 条</span>
        )}
      </div>

      {captureHistory.length === 0 ? (
        <div className="flex items-center justify-center flex-1 min-h-[60px]">
          <p className="text-[11px] text-muted-foreground">暂无捕获记录</p>
        </div>
      ) : isAnyExpanded ? (
        <div className="flex flex-col gap-y-2">
          {renderEntries()}
        </div>
      ) : (
        <div className="flex flex-col gap-y-2 overflow-y-auto flex-1 min-h-0 pr-0.5">
          {renderEntries()}
        </div>
      )}
    </div>
  )

  function renderEntries() {
    return (
      <AnimatePresence initial={false}>
        {captureHistory.map((entry) => {
          const rawColor = getGameColor(entry.gameId, gameConfigs)
          const isExpanded = expandedId === entry.id
          const isSuccess = entry.status === 'success'
          const bgColor = isSuccess ? `${rawColor}10` : '#FEF2F2'
          const detailBg = isSuccess ? `${rawColor}08` : '#FEF2F2'
          const borderColor = isSuccess ? rawColor : '#EF4444'

          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <button
                type="button"
                className="w-full flex items-center justify-between py-1.5 px-2.5 rounded text-left hover:brightness-95 transition-[filter] duration-100"
                style={{ backgroundColor: bgColor }}
                onClick={() => toggleExpand(entry.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-1 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: borderColor }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-medium leading-tight">
                      {entry.gameName}
                      {entry.resourceName ? ` · ${entry.resourceName}` : ''}
                    </span>
                    {isSuccess ? (
                      <span className="font-mono text-[10px] tabular-nums" style={{ color: rawColor }}>
                        {entry.currentValue}/{entry.maxValue}
                      </span>
                    ) : (
                      <span className="text-[10px] text-red-500 truncate max-w-[160px]">
                        {entry.failureReason || '未知错误'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {formatTime(entry.timestamp)}
                  </span>
                  <svg
                    className={`w-3 h-3 text-muted-foreground/40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    viewBox="0 0 12 12" fill="none"
                  >
                    <path d="M4 5L6 7L8 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>

              <div
                className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out"
                style={{
                  maxHeight: isExpanded ? '260px' : '0px',
                  opacity: isExpanded ? 1 : 0
                }}
              >
                <div
                  className="mt-1 mx-0.5 px-2.5 py-2 rounded text-[10px] space-y-1"
                  style={{ backgroundColor: detailBg, borderLeft: `2px solid ${borderColor}` }}
                >
                  <div className="flex gap-2">
                    <span className="text-muted-foreground flex-shrink-0">时间</span>
                    <span className="font-mono">{entry.timestamp.slice(11, 19)}</span>
                  </div>
                  {entry.processName && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground flex-shrink-0">进程</span>
                      <span className="font-mono">{entry.processName}</span>
                    </div>
                  )}
                  {entry.status === 'fail' && entry.failureReason && (
                    <div className="flex gap-2">
                      <span className="text-muted-foreground flex-shrink-0">错误</span>
                      <span className="text-red-500 break-all">{entry.failureReason}</span>
                    </div>
                  )}
                  {entry.ocrText && (
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-muted-foreground">OCR</span>
                        <button
                          type="button"
                          className="text-[9px] px-1.5 py-0.5 rounded border border-border hover:bg-accent transition-colors"
                          onClick={(e) => { e.stopPropagation(); copyOcrText(entry.ocrText || '') }}
                        >
                          复制
                        </button>
                      </div>
                      <div className="font-mono bg-muted/50 rounded px-1.5 py-1 break-all max-h-14 overflow-y-auto">
                        {entry.ocrText}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-muted-foreground flex-shrink-0">游戏</span>
                    <span>{entry.gameName}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    )
  }
}

export default CaptureHistory
