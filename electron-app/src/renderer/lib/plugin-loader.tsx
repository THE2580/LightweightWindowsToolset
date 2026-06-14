import { Suspense } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { getPluginById } from '@/lib/plugin-registry'
import { usePluginStore } from '@/stores/pluginStore'

function PluginRoute(): React.JSX.Element {
  const { pluginId } = useParams<{ pluginId: string }>()
  const disabledTools = usePluginStore((s) => s.disabledTools)

  if (!pluginId) {
    return <Navigate to="/" replace />
  }

  // Check if tool is enabled
  if (disabledTools.has(pluginId)) {
    return <Navigate to="/" replace />
  }

  const plugin = getPluginById(pluginId)
  if (!plugin || !plugin.component) {
    return <Navigate to="/" replace />
  }

  const Component = plugin.component

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Loading...
        </div>
      }
    >
      <Component />
    </Suspense>
  )
}

export default PluginRoute
