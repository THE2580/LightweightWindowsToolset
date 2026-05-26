import { HashRouter, Routes, Route } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import HomePage from './pages/HomePage'
import SettingsPage from './pages/SettingsPage'
import PluginRoute from './lib/plugin-loader.tsx'

function App(): React.JSX.Element {
  return (
    <HashRouter>
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
