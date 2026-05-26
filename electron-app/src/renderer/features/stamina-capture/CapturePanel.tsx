import { useCaptureStore } from '@/stores/captureStore'
import { Button } from '@/components/ui/button'
import { Camera, Loader2 } from 'lucide-react'
import { parseStaminaViaAI } from './api/deepseek'
import { postStaminaRecord, setBackendUrl } from './api/backend'

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
  const {
    captureState, setCaptureState, selectedGame,
    setStamina, setOcrText, setTodayRecords, getGameConfig
  } = useCaptureStore()
  const isLoading = captureState !== 'idle' && captureState !== 'done' && captureState !== 'error'

  const handleCapture = async (): Promise<void> => {
    if (isLoading) return

    const gameConfig = getGameConfig(selectedGame)
    if (!gameConfig) return

    try {
      setCaptureState('capturing')
      const result = await window.api.capture.trigger()

      if (!result.ocrText && !result.imageBase64) {
        throw new Error('Screenshot failed: empty result')
      }

      setOcrText(result.ocrText)

      setCaptureState('parsing')
      const aiResult = await parseStaminaViaAI(
        result.ocrText || 'no text recognized',
        gameConfig.name,
        gameConfig.staminaName || '体力'
      )

      if (aiResult.remaining_stamina !== null && aiResult.max_stamina !== null) {
        setStamina({
          remaining: aiResult.remaining_stamina,
          max: aiResult.max_stamina
        })
      }

      if (aiResult.remaining_stamina !== null && aiResult.max_stamina !== null) {
        setCaptureState('posting')

        const backendUrl = await window.api.settings.get('backendUrl')
        if (backendUrl && typeof backendUrl === 'string') {
          setBackendUrl(backendUrl)
        }

        try {
          const record = await postStaminaRecord({
            game_name: gameConfig.name,
            package_name: gameConfig.processName,
            remaining_stamina: aiResult.remaining_stamina,
            max_stamina: aiResult.max_stamina,
            capture_time: new Date().toISOString(),
            source: 'windows'
          })
          setTodayRecords([record])
        } catch (backendErr) {
          console.warn('[Capture] Backend post failed (non-blocking):', backendErr)
        }
      }

      setCaptureState('done')
      setTimeout(() => setCaptureState('idle'), 2000)
    } catch (err) {
      console.error('[Capture] Pipeline error:', err)
      setCaptureState('error')
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-5">
      <h3 className="text-sm font-semibold mb-3">捕获控制</h3>
      <p className="text-xs text-muted-foreground mb-4">
        按快捷键或点击按钮截图当前游戏窗口，自动识别体力值
      </p>
      <Button
        onClick={handleCapture}
        disabled={isLoading}
        size="sm"
        className="w-full"
        variant={captureState === 'error' ? 'destructive' : 'default'}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Camera size={16} />
        )}
        {STATE_LABELS[captureState]}
      </Button>
      {captureState === 'error' && (
        <p className="text-[11px] text-red-500 mt-2">捕获过程中出现错误，请检查游戏窗口是否打开</p>
      )}
    </div>
  )
}

export default CapturePanel
