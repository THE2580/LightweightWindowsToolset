// Built-in plugin component registry for renderer
// Maps plugin IDs to their page components.
// When adding a new tool, register its page component here.

import { lazy, ComponentType } from 'react'

const CapturePage = lazy(() => import('@/features/stamina-capture/CapturePage'))

export interface BuiltinPlugin {
  id: string
  name: string
  description: string
  icon: string
  status: 'stable' | 'upcoming'
  entry: string
  component?: ComponentType
}

export const BUILTIN_PLUGINS: BuiltinPlugin[] = [
  {
    id: 'stamina-capture',
    name: '游戏资源捕获',
    description: '截图识别游戏资源值，自动记录并同步',
    icon: 'zap',
    status: 'stable',
    entry: './CapturePage.tsx',
    component: CapturePage
  },
  {
    id: 'window-pinner',
    name: '置顶窗口',
    description: '将任意窗口固定在屏幕最上层',
    icon: 'pin',
    status: 'upcoming',
    entry: './WindowPinner.tsx'
  }
]

export function getPluginById(id: string): BuiltinPlugin | undefined {
  return BUILTIN_PLUGINS.find((p) => p.id === id)
}
