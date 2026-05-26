import { useCaptureStore } from '@/stores/captureStore'
import { Card, CardContent } from '@/components/ui/card'

function StaminaDisplay(): React.JSX.Element {
  const { stamina } = useCaptureStore()

  if (!stamina || stamina.remaining === null || stamina.max === null) {
    return (
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold mb-3">体力状态</h3>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <span className="text-xs">暂无数据</span>
            <span className="text-[11px] mt-1">点击截图按钮开始捕获</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const pct = (stamina.remaining / stamina.max) * 100

  return (
    <Card>
      <CardContent>
        <h3 className="text-sm font-semibold mb-3">体力状态</h3>
        <div className="flex flex-col items-center">
          <div className="font-mono text-2xl font-bold tabular-nums">
            {stamina.remaining}
            <span className="text-base text-muted-foreground font-normal"> / {stamina.max}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {pct.toFixed(0)}%
          </div>

          <div className="w-full h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-[11px] text-muted-foreground mt-2">
            预计恢复时间: {(stamina.max - stamina.remaining) * 8} 分钟
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default StaminaDisplay
