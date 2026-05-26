import { useEffect, useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { usePluginStore } from '@/stores/pluginStore'

// Placeholder for dynamic component loading
function PluginRoute(): React.JSX.Element {
  const { pluginId } = useParams<{ pluginId: string }>()
  const plugins = usePluginStore((s) => s.plugins)
  const [Component, setComponent] = useState<React.ComponentType | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const plugin = plugins.find((p) => p.id === pluginId)
    if (!plugin) {
      setError(true)
      return
    }
    // Dynamic import will be wired after plugin system is fully implemented
    // For now, route to known plugin pages
    setError(true) // placeholder - will be replaced with dynamic import
  }, [pluginId, plugins])

  if (error || !pluginId) {
    return <Navigate to="/" replace />
  }

  if (!Component) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading...
      </div>
    )
  }

  return <Component />
}

export default PluginRoute
