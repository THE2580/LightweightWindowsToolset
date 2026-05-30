// Built-in plugin component registry for renderer
// Maps plugin IDs to their page components.
// When adding a new tool, register its page component here.

import { lazy, ComponentType } from 'react'

const CapturePage = lazy(() => import('@/features/resource-capture/CapturePage'))
const PinnerPage = lazy(() => import('@/features/window-pinner/PinnerPage'))

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
    id: 'resource-capture',
    name: '游戏资源捕获',
    description: '截图识别游戏资源值，自动记录并同步',
    icon: 'zap',
    status: 'stable',
    entry: './CapturePage.tsx',
    component: CapturePage
  },
  {
    id: 'window-pinner',
    name: '窗口置顶',
    description: '将任意窗口固定在屏幕最上层，可设置边框颜色与同时置顶数量',
    icon: 'pin',
    status: 'stable',
    entry: './PinnerPage.tsx',
    component: PinnerPage
  },
  {
    id: 'key-counter',
    name: '今日按键统计',
    description: '统计每日键盘鼠标按键次数，隔天自动重置，支持历史记录与按键排行',
    icon: 'keyboard',
    status: 'upcoming',
    entry: './KeyCounter.tsx'
  }
]

export function getPluginById(id: string): BuiltinPlugin | undefined {
  return BUILTIN_PLUGINS.find((p) => p.id === id)
}
