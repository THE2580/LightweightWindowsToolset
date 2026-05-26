import { readdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  icon: string
  entry: string
  settings?: PluginSetting[]
  permissions?: string[]
  minWindow?: { width: number; height: number }
}

export interface PluginSetting {
  key: string
  label: string
  type: 'boolean' | 'string' | 'number' | 'hotkey' | 'select'
  default: unknown
  options?: { label: string; value: string }[]
}

export interface PluginRegistry {
  manifest: PluginManifest
  source: 'tools' | 'features'
  dirPath: string
}

function scanDirectory(baseDir: string, source: 'tools' | 'features'): PluginRegistry[] {
  if (!existsSync(baseDir)) return []

  const results: PluginRegistry[] = []
  const entries = readdirSync(baseDir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue

    const pluginJsonPath = join(baseDir, entry.name, 'plugin.json')
    if (!existsSync(pluginJsonPath)) continue

    try {
      const raw = readFileSync(pluginJsonPath, 'utf-8')
      const manifest: PluginManifest = JSON.parse(raw)
      results.push({
        manifest,
        source,
        dirPath: join(baseDir, entry.name)
      })
    } catch (e) {
      console.error(`Failed to parse plugin.json in ${entry.name}:`, e)
    }
  }

  return results
}

export function discoverPlugins(appRoot: string): PluginRegistry[] {
  const toolsDir = join(appRoot, '..', '..', 'tools')
  const featuresDir = join(appRoot, '..', 'renderer', 'features')

  return [
    ...scanDirectory(toolsDir, 'tools'),
    ...scanDirectory(featuresDir, 'features')
  ]
}
