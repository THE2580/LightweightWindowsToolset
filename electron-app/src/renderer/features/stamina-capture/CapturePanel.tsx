import { useCaptureStore } from '@/stores/captureStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { Keyboard } from 'lucide-react'

function parseHotkeyKeys(jsonStr: string): string[] {
  if (!jsonStr) return []
  try {
    return JSON.parse(jsonStr)
  } catch {
    return jsonStr.split('+')
  }
}

function CapturePanel(): React.JSX.Element {
  const { selectedGame, getGameConfig } = useCaptureStore()
  const captureHotkey = useSettingsStore((s) => s.captureHotkey)
  const gameConfig = getGameConfig(selectedGame)
  const gameName = gameConfig?.name || '游戏'
  const keys = parseHotkeyKeys(captureHotkey)

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-5">
      <h3 className="text-sm font-semibold mb-3">资源捕获</h3>
      <div className="flex items-start gap-3">
        <Keyboard size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          请全屏打开 <span className="font-medium text-primary">{gameName}</span> 后，使用快捷键{' '}
          {keys.length > 0 ? (
            <span className="inline-flex items-center gap-1 align-middle">
              {keys.map((k, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {i > 0 && <span className="text-[10px]">+</span>}
                  <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 text-[10px] rounded border border-green-300 bg-card font-mono leading-none">
                    {k}
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <span className="italic">未配置</span>
          )}
          {' '}进行资源自动识别
          <br />
          <span className="text-[10px]">快捷键请在「设置」页面中配置</span>
        </div>
      </div>
    </div>
  )
}

export default CapturePanel
