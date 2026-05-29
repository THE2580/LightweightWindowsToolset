import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCaptureStore, GameConfig } from '@/stores/captureStore'

function getGameColor(gameId: string, configs: GameConfig[]): string {
  if (gameId.startsWith('unknown-')) return '#6B7280'
  return configs.find((g) => g.id === gameId)?.color || '#6B7280'
}

function formatFullTimestamp(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function CaptureHistory(): React.JSX.Element {
  const { captureHistory, gameConfigs } = useCaptureStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const copyOcrText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard API may fail in some contexts
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">捕获记录</h3>
        {captureHistory.length > 0 && (
          <span className="text-[10px] text-muted-foreground">{captureHistory.length}条</span>
        )}
      </div>
      {captureHistory.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">暂无记录</p>
      ) : (
        <div className="flex flex-col gap-y-3 max-h-[154px] overflow-y-auto pr-0.5">
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
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between py-2 px-3 rounded-md text-left hover:brightness-95 transition-[filter,box-shadow] duration-100"
                    style={{ backgroundColor: bgColor }}
                    onClick={() => toggleExpand(entry.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-1 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: borderColor }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium">
                          {entry.gameName}
                          {entry.resourceName ? ` - ${entry.resourceName}` : ''}
                        </span>
                        {isSuccess ? (
                          <span className="font-mono text-[10px] tabular-nums" style={{ color: rawColor }}>
                            {entry.currentValue}/{entry.maxValue}
                          </span>
                        ) : (
                          <span className="text-[10px] text-red-500 truncate max-w-[200px]">
                            {entry.failureReason || '未知错误'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                      <svg
                        className={`w-3 h-3 text-muted-foreground/50 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path d="M4 5L6 7L8 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </button>

                  {/* Expand/collapse — pure CSS max-height transition */}
                  <div
                    className="overflow-hidden transition-all duration-200 ease-out"
                    style={{
                      maxHeight: isExpanded ? '300px' : '0px',
                      opacity: isExpanded ? 1 : 0
                    }}
                  >
                    <div
                      className="mt-1 mx-1 px-3 py-2 rounded-md text-[10px] space-y-1.5"
                      style={{
                        backgroundColor: detailBg,
                        borderLeft: `2px solid ${borderColor}`
                      }}
                    >
                      <div className="flex gap-2">
                        <span className="text-muted-foreground flex-shrink-0">时间:</span>
                        <span className="font-mono">{formatFullTimestamp(entry.timestamp)}</span>
                      </div>

                      {entry.processName && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground flex-shrink-0">进程:</span>
                          <span className="font-mono">{entry.processName}</span>
                        </div>
                      )}

                      {entry.status === 'fail' && entry.failureReason && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground flex-shrink-0">错误:</span>
                          <span className="text-red-500 break-all">{entry.failureReason}</span>
                        </div>
                      )}

                      {entry.ocrText && (
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-muted-foreground">OCR 文本:</span>
                            <button
                              type="button"
                              className="text-[9px] px-1.5 py-0.5 rounded border border-border hover:bg-accent transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyOcrText(entry.ocrText || '')
                              }}
                            >
                              复制
                            </button>
                          </div>
                          <div className="font-mono bg-muted/50 rounded px-1.5 py-1 break-all max-h-16 overflow-y-auto">
                            {entry.ocrText}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <span className="text-muted-foreground flex-shrink-0">游戏:</span>
                        <span>{entry.gameName}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export default CaptureHistory
