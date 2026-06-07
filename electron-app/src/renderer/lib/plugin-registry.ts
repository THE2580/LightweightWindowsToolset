// Built-in plugin component registry for renderer
// Maps plugin IDs to their page components.
// When adding a new tool, register its page component here.

import { lazy, ComponentType } from 'react'

const CapturePage = lazy(() => import('@/features/resource-capture/CapturePage'))
const PinnerPage = lazy(() => import('@/features/window-pinner/PinnerPage'))
const KeyCounterPage = lazy(() => import('@/features/key-counter/KeyCounterPage'))
const AppStatsPage = lazy(() => import('@/features/app-stats/AppStatsPage'))
const TimerPage = lazy(() => import('@/features/timer/TimerPage'))

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
    name: '按键统计',
    description: '统计每日键盘鼠标按键次数，隔天自动重置，支持历史记录与按键排行',
    icon: 'keyboard',
    status: 'stable',
    entry: './KeyCounterPage.tsx',
    component: KeyCounterPage
  },
  {
    id: 'app-stats',
    name: '软件使用统计',
    description: '按天统计前台软件使用时长，离开时自动暂停，仅在本地保存',
    icon: 'chart',
    status: 'stable',
    entry: './AppStatsPage.tsx',
    component: AppStatsPage
  },
  {
    id: 'timer',
    name: '计时器',
    description: '管理多个正计时和倒计时，可将任意计时器弹出为独立置顶悬浮窗',
    icon: 'clock',
    status: 'stable',
    entry: './TimerPage.tsx',
    component: TimerPage
  }
]

export function getPluginById(id: string): BuiltinPlugin | undefined {
  return BUILTIN_PLUGINS.find((p) => p.id === id)
}
