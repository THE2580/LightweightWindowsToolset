import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { initPluginStore } from './stores/pluginStore'
import { installRendererLogger } from './lib/console-logger'

// Initialize built-in plugin registry
installRendererLogger()
initPluginStore()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
