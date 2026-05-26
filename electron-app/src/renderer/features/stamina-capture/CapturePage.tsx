import AnimatedRoute from '@/components/shared/AnimatedRoute'
import GameSelector from './GameSelector'
import CapturePanel from './CapturePanel'
import StaminaDisplay from './StaminaDisplay'
import CaptureHistory from './CaptureHistory'

function CapturePage(): React.JSX.Element {
  return (
    <AnimatedRoute>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">体力捕获</h1>
            <p className="text-xs text-muted-foreground">截图识别游戏体力值</p>
          </div>
          <GameSelector />
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
