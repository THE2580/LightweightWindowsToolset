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
import { usePinnerStore } from './stores/pinnerStore'
import { useSettingsStore } from './stores/settingsStore'

function AppListeners(): null {
  const navigate = useNavigate()
  const toggleToolEnabled = usePluginStore((s) => s.toggleToolEnabled)
  const toggleChat = usePluginStore((s) => s.toggleChat)
  const triggerBackgroundCapture = useCaptureStore((s) => s.triggerBackgroundCapture)
  const togglePin = usePinnerStore((s) => s.togglePin)
  const loadApiKey = useDeepseekStore((s) => s.loadApiKey)
  const loadSettings = useSettingsStore((s) => s.load)
  const loadPinnerSettings = usePinnerStore((s) => s.loadSettings)
  const refreshPinnerStatus = usePinnerStore((s) => s.refreshStatus)
  const listenPinnerEvents = usePinnerStore((s) => s.listenEvents)

  // Preload API key on app startup so chat works without visiting settings first
  useEffect(() => {
    loadApiKey()
  }, [loadApiKey])

  // Keep pinman state synchronized for the entire application lifetime.
  // Native hotkeys work outside the pinner page, so event listeners must too.
  useEffect(() => {
    loadSettings()
    loadPinnerSettings()
    refreshPinnerStatus()
    const unsubPinner = listenPinnerEvents()
    const interval = setInterval(refreshPinnerStatus, 1000)
    return () => {
      clearInterval(interval)
      unsubPinner()
    }
  }, [loadSettings, loadPinnerSettings, refreshPinnerStatus, listenPinnerEvents])

  // Load persisted disabled-tools state on startup
  const loadDisabledTools = usePluginStore((s) => s.loadDisabledTools)
  useEffect(() => {
    loadDisabledTools()
  }, [loadDisabledTools])


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
      } else if (action === 'window-pinner') {
        togglePin()
      }
    })
    return () => {
      unsubNav()
      unsubTool()
      unsubHotkey()
    }
  }, [navigate, toggleToolEnabled, toggleChat, triggerBackgroundCapture, togglePin])

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
