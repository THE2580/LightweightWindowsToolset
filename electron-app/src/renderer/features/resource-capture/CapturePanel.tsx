import { useCaptureStore } from '@/stores/captureStore'
import { useShallow } from 'zustand/shallow'
import { useSettingsStore } from '@/stores/settingsStore'
import { Keyboard } from 'lucide-react'
import { Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function parseHotkeyKeys(jsonStr: string): string[] {
  if (!jsonStr) return []
  try { return JSON.parse(jsonStr) } catch { return jsonStr.split('+') }
}

function CapturePanel(): React.JSX.Element {
  const { selectedGame, getGameConfig } = useCaptureStore(
    useShallow((s) => ({ selectedGame: s.selectedGame, getGameConfig: s.getGameConfig }))
  )
  const captureHotkey = useSettingsStore((s) => s.captureHotkey)
  const navigate = useNavigate()
  const gameConfig = getGameConfig(selectedGame)
  const gameName = gameConfig?.name || '游戏'
  const keys = parseHotkeyKeys(captureHotkey)

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-4 hover:shadow-md hover:ring-1 hover:ring-blue-300/40 transition-shadow duration-150">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[13px] font-semibold">快捷键</h3>
        <button
          onClick={() => navigate('/settings?tab=hotkey')}
          className="p-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 hover:text-blue-600" title="设置快捷键"
        >
          <Settings size={12} />
        </button>
      </div>
      <div className="flex items-start gap-2.5">
        <Keyboard size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          全屏打开
          <span className="font-medium text-foreground"> {gameName} </span>
          后使用
          {keys.length > 0 ? (
            <span className="inline-flex items-center gap-0.5 align-middle mx-1">
              {keys.map((k, i) => (
                <span key={i} className="inline-flex items-center gap-0.5">
                  {i > 0 && <span className="text-[9px]">+</span>}
                  <kbd className="inline-flex items-center justify-center min-w-[24px] h-[18px] px-1 text-[10px] rounded border border-green-300 bg-card font-mono leading-none">
                    {k}
                  </kbd>
                </span>
              ))}
            </span>
          ) : (
            <span className="italic mx-0.5">未配置</span>
          )}
          <br />
          截图自动识别
        </div>
      </div>
      <p className="text-[9px] text-amber-500/80 mt-2 leading-relaxed">请确保游戏分辨率接近屏幕分辨率，否则识别正确率较低</p>
    </div>
  )
}

export default CapturePanel
