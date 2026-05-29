import { useEffect, useState } from 'react'
import { memo } from 'react'
import { useCaptureStore } from '@/stores/captureStore'
import { useShallow } from 'zustand/shallow'

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '已恢复'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}分${s}秒` : `${s}秒`
}

function ResourceDisplay(): React.JSX.Element {
  const { resourceMap, subResources, getCurrentResourceConfig } = useCaptureStore(
    useShallow((s) => ({
      resourceMap: s.resourceMap,
      subResources: s.subResources,
      getCurrentResourceConfig: s.getCurrentResourceConfig
    }))
  )
  const selectedResourceType = useCaptureStore((s) => s.selectedResourceType)
  const snapshot = resourceMap[selectedResourceType] ?? null
  const resourceConfig = getCurrentResourceConfig()
  const [tick, setTick] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

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
      <div className="rounded-lg border border-border bg-card shadow-sm p-4 hover:shadow-md hover:ring-1 hover:ring-blue-300/40 transition-shadow duration-150">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold">资源状态</h3>
          {resourceConfig && (
            <span className="text-[10px] text-muted-foreground">{resourceConfig.label}</span>
          )}
        </div>
        <div className="flex flex-col items-center justify-center py-3 text-muted-foreground">
          <span className="text-[11px]">暂无数据</span>
          <span className="text-[10px] mt-0.5">快捷键截图开始捕获</span>
        </div>
      </div>
    )
  }

  const pct = Math.min((displayRemaining / displayMax) * 100, 100)

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-4 hover:shadow-md hover:ring-1 hover:ring-blue-300/40 transition-shadow duration-150">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold">资源状态</h3>
        {resourceConfig && (
          <span className="text-[10px] text-muted-foreground">{resourceConfig.label}</span>
        )}
      </div>

      <div className="text-center">
        <span className="font-mono text-2xl font-bold tabular-nums">{displayRemaining}</span>
        <span className="font-mono text-sm text-muted-foreground font-normal tabular-nums">/{displayMax}</span>
      </div>

      <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {resourceConfig && resourceConfig.recoveryMinutes > 0 && (
        <div className="mt-2 text-center space-y-0.5">
          <p className="text-[10px] text-muted-foreground">
            {(() => {
              const total = (displayMax - displayRemaining) * resourceConfig.recoveryMinutes
              return total >= 60
                ? `恢复满需 ${Math.floor(total / 60)}h${total % 60}m`
                : `恢复满需 ${total}m`
            })()}
          </p>
          {displayRemaining < displayMax && (
            <p className="text-[10px] text-primary font-medium">
              +1 于 {formatCountdown(nextRecoverySec)}
            </p>
          )}
        </div>
      )}

      {subResources.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-border/60 space-y-1.5">
          {subResources.map((sr) => (
            <div key={sr.config.id} className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground truncate">{sr.config.label}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="font-mono text-[11px] tabular-nums">{sr.remaining}/{sr.max}</span>
                <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{ width: `${Math.min((sr.remaining / sr.max) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ResourceDisplayMemo = memo(ResourceDisplay)
export default ResourceDisplayMemo
