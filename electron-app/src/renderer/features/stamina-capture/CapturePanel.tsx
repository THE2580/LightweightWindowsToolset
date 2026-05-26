import { useCaptureStore } from '@/stores/captureStore'
import { Button } from '@/components/ui/button'
import { Camera, Loader2 } from 'lucide-react'

const STATE_LABELS: Record<string, string> = {
  idle: '截图捕获体力',
  capturing: '正在截图...',
  ocr: 'OCR 识别中...',
  parsing: 'AI 解析中...',
  posting: '提交后端...',
  done: '捕获完成',
  error: '捕获失败，点击重试'
}

function CapturePanel(): React.JSX.Element {
  const { captureState, setCaptureState } = useCaptureStore()
  const isLoading = captureState !== 'idle' && captureState !== 'done' && captureState !== 'error'

  const handleCapture = async (): Promise<void> => {
    if (isLoading) return

    try {
      setCaptureState('capturing')
      await new Promise((r) => setTimeout(r, 400))
      setCaptureState('ocr')
      await new Promise((r) => setTimeout(r, 600))
      setCaptureState('parsing')
      await new Promise((r) => setTimeout(r, 500))
      setCaptureState('posting')
      await new Promise((r) => setTimeout(r, 300))
      setCaptureState('done')
      setTimeout(() => setCaptureState('idle'), 2000)
    } catch {
      setCaptureState('error')
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-8">
      <h3 className="text-sm font-semibold mb-5">捕获控制</h3>
      <p className="text-sm text-muted-foreground mb-6">
        按快捷键或点击按钮截图当前游戏窗口，自动识别体力值
      </p>
      <Button
        onClick={handleCapture}
        disabled={isLoading}
        size="lg"
        className="w-full"
        variant={captureState === 'error' ? 'destructive' : 'default'}
      >
        {isLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Camera size={18} />
        )}
        {STATE_LABELS[captureState]}
      </Button>
      {captureState === 'error' && (
        <p className="text-xs text-red-500 mt-3">捕获过程中出现错误，请检查游戏窗口是否打开</p>
      )}
    </div>
  )
}

export default CapturePanel
