import { Sun, Moon, Monitor } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { applyTheme } from '@/lib/theme'

type ThemeMode = 'system' | 'light' | 'dark'

function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme } = useSettingsStore()

  const cycleTheme = (): void => {
    const modes: ThemeMode[] = ['system', 'light', 'dark']
    const idx = modes.indexOf(theme)
    const next = modes[(idx + 1) % modes.length]
    setTheme(next)
    applyTheme(next)
  }

  const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-md hover:bg-muted transition-colors"
      aria-label={`Theme: ${theme}`}
      title={`当前主题: ${theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'}`}
    >
      <Icon size={16} />
    </button>
  )
}

export default ThemeToggle
