import { useEffect } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import AppShell from './components/layout/AppShell'
import HomePage from './pages/HomePage'
import SettingsPage from './pages/SettingsPage'
import PluginRoute from './lib/plugin-loader.tsx'
import { usePluginStore } from './stores/pluginStore'
import { useCaptureStore } from './stores/captureStore'
import { useDeepseekStore } from './stores/deepseekStore'

function AppListeners(): null {
  const navigate = useNavigate()
  const toggleToolEnabled = usePluginStore((s) => s.toggleToolEnabled)
  const toggleChat = usePluginStore((s) => s.toggleChat)
  const triggerBackgroundCapture = useCaptureStore((s) => s.triggerBackgroundCapture)
  const loadApiKey = useDeepseekStore((s) => s.loadApiKey)

  // Preload API key on app startup so chat works without visiting settings first
  useEffect(() => {
    loadApiKey()
  }, [loadApiKey])


  useEffect(() => {
    const unsubNav = window.api.tray.onNavigate((path) => {
      navigate(path)
    })
    const unsubTool = window.api.tray.onToolToggle((toolId) => {
      toggleToolEnabled(toolId)
    })
    const unsubHotkey = window.api.hotkey.onHotkey((action) => {
      if (action === 'resource-capture') {
        triggerBackgroundCapture()
      } else if (action === 'ai-chat') {
        toggleChat()
      }
    })
    return () => {
      unsubNav()
      unsubTool()
      unsubHotkey()
    }
  }, [navigate, toggleToolEnabled, toggleChat, triggerBackgroundCapture])

  return null
}

function AppContent(): React.JSX.Element {
  const location = useLocation()
  return (
    <>
      <AppListeners />
      <AppShell>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/tool/:pluginId" element={<PluginRoute />} />
          </Routes>
        </AnimatePresence>
      </AppShell>
    </>
  )
}

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}

export default App
