import { useEffect } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import HomePage from './pages/HomePage'
import SettingsPage from './pages/SettingsPage'
import PluginRoute from './lib/plugin-loader.tsx'
import { usePluginStore } from './stores/pluginStore'

function AppListeners(): null {
  const navigate = useNavigate()
  const toggleToolEnabled = usePluginStore((s) => s.toggleToolEnabled)
  const toggleChat = usePluginStore((s) => s.toggleChat)

  useEffect(() => {
    const unsubNav = window.api.tray.onNavigate((path) => {
      navigate(path)
    })
    const unsubTool = window.api.tray.onToolToggle((toolId) => {
      toggleToolEnabled(toolId)
    })
    const unsubHotkey = window.api.hotkey.onHotkey((action) => {
      if (action === 'stamina-capture') {
        navigate('/tool/stamina-capture')
      } else if (action === 'ai-chat') {
        toggleChat()
      }
    })
    return () => {
      unsubNav()
      unsubTool()
      unsubHotkey()
    }
  }, [navigate, toggleToolEnabled, toggleChat])

  return null
}

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <AppListeners />
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/tool/:pluginId" element={<PluginRoute />} />
        </Routes>
      </AppShell>
    </HashRouter>
  )
}

export default App
