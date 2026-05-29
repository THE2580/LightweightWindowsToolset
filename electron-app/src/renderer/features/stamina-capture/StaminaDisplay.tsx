import { useEffect, useState } from 'react'
import { useCaptureStore } from '@/stores/captureStore'
import { Card, CardContent } from '@/components/ui/card'

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '已恢复'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}分${s}秒` : `${s}秒`
}

function StaminaDisplay(): React.JSX.Element {
  const { staminaMap, subResources, getCurrentResourceConfig, selectedGame, selectedResourceType } = useCaptureStore()
  const snapshot = staminaMap[selectedResourceType] ?? null
  const resourceConfig = getCurrentResourceConfig()
  const [tick, setTick] = useState(Date.now())

  // Tick every second for countdown
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Calculate current value and time-to-next from snapshot
  let displayRemaining: number | null = null
  let displayMax: number | null = null
  let nextRecoverySec = 0

  if (snapshot && snapshot.recoveryMinutes > 0) {
    const elapsedMin = (tick - new Date(snapshot.lastCaptureTime).getTime()) / 60000
    const recovered = Math.floor(elapsedMin / snapshot.recoveryMinutes)
    displayRemaining = Math.min(snapshot.remaining + recovered, snapshot.max)
    displayMax = snapshot.max
    const fractionalMin = (elapsedMin % snapshot.recoveryMinutes)
    nextRecoverySec = Math.ceil((snapshot.recoveryMinutes - fractionalMin) * 60)
  } else if (snapshot) {
    displayRemaining = snapshot.remaining
    displayMax = snapshot.max
  }

  if (displayRemaining === null || displayMax === null) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">资源状态</h3>
            {resourceConfig && (
              <span className="text-[11px] text-muted-foreground">{resourceConfig.label}</span>
            )}
          </div>
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
            <span className="text-xs">暂无数据</span>
            <span className="text-[11px] mt-1">使用快捷键截图开始捕获</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const pct = (displayRemaining / displayMax) * 100

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">资源状态</h3>
          {resourceConfig && (
            <span className="text-[11px] text-muted-foreground">{resourceConfig.label}</span>
          )}
        </div>
        <div className="flex flex-col items-center">
          <div className="font-mono text-2xl font-bold tabular-nums">
            {displayRemaining}
            <span className="text-base text-muted-foreground font-normal"> / {displayMax}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {pct.toFixed(0)}%
          </div>

          <div className="w-full h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>

          {resourceConfig && resourceConfig.recoveryMinutes > 0 && (
            <>
              <p className="text-[11px] text-muted-foreground mt-2">
                {(() => {
                  const total = (displayMax - displayRemaining) * resourceConfig.recoveryMinutes
                  return total >= 60
                    ? `预计恢复: ${Math.floor(total / 60)} 小时 ${total % 60} 分钟`
                    : `预计恢复: ${total} 分钟`
                })()}
              </p>
              {displayRemaining < displayMax && (
                <p className="text-[11px] text-primary font-medium mt-0.5">
                  下一恢复点: {formatCountdown(nextRecoverySec)}
                </p>
              )}
            </>
          )}
        </div>

        {subResources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/60">
            <div className="space-y-2">
              {subResources.map((sr) => {
                const srPct = (sr.remaining / sr.max) * 100
                return (
                  <div key={sr.config.id} className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{sr.config.label}</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs tabular-nums">
                        {sr.remaining}/{sr.max}
                      </span>
                      <div className="w-16 h-1 bg-muted rounded-full overflow-hidden flex-shrink-0">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${Math.min(srPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default StaminaDisplay
