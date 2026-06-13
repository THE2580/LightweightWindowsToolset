/// <reference types="vite/client" />

interface PinStatus {
  pinned: number
  maxPins: number
  hotkeyActive: boolean
  windows: { hwnd: number; title: string; color: string }[]
}

interface Window {
  api: {
    window: {
      minimize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      toggleMaximize: () => Promise<void>
      setTitle: (title: string) => Promise<void>
    }
    settings: {
      get: (key: string) => Promise<unknown>
      set: (key: string, value: unknown) => Promise<void>
      getAll: () => Promise<Record<string, unknown>>
      getStoragePath: () => Promise<string>
      setStoragePath: (newPath: string) => Promise<{ success: boolean; error?: string; newPath?: string }>
      selectFolder: () => Promise<string | null>
    }
    capture: {
      trigger: () => Promise<{
        ocrText: string
        imageBase64: string
        success: boolean
        errorCode?: string
        errorMessage?: string
      }>
      detectForeground: () => Promise<{ processName: string; resolvedGameId: string | null; isDesktop: boolean }>
      notify: (title: string, body: string, isSuccess?: boolean) => Promise<void>
    }
    overlay: {
      create: (a: string, b: string[], c?: boolean) => Promise<void>
      update: (a: { s: string; l: string }[], b: string) => Promise<void>
      result: (a: { s: string; l: string }[], b: string, c: string, d: boolean) => Promise<void>
      close: () => Promise<void>
    }
    queue: {
      add: (payload: unknown) => Promise<void>
      getCount: () => Promise<number>
      flush: () => Promise<{ flushed: number; remaining: number }>
    }
    backend: {
      postRecord: (payload: { game_name: string; resource_type: string; current_resource: number; max_resource: number; capture_time: string; platform: string }) => Promise<{ id: number; game_name: string; resource_type: string; current_resource: number; max_resource: number; capture_time: string; platform: string }>
      getLatest: () => Promise<{ id: number; game_name: string; resource_type: string; current_resource: number; max_resource: number; capture_time: string; platform: string }[]>
    }
    logs: {
      get: () => Promise<{ id: number; timestamp: string; level: 'log' | 'info' | 'warn' | 'error'; source: 'main' | 'renderer'; message: string }[]>
      clear: () => Promise<void>
      append: (level: 'log' | 'info' | 'warn' | 'error', args: unknown[]) => void
      onEntry: (callback: (entry: { id: number; timestamp: string; level: 'log' | 'info' | 'warn' | 'error'; source: 'main' | 'renderer'; message: string }) => void) => (() => void)
      onCleared: (callback: () => void) => (() => void)
    }
    keystats: {
      snapshot: () => Promise<{ today: string; days: Record<string, Record<string, number>> }>
      ping: () => Promise<string>
    }
    appstats: {
      snapshot: () => Promise<{ today: string; activeProcess: string | null; isAfk: boolean; afkThresholdSec: number; days: Record<string, Record<string, number>> }>
      ping: () => Promise<string>
      clear: () => Promise<string>
      configAfk: (thresholdSec: number) => Promise<string>
    }
    timer: {
      getSnapshot: () => Promise<TimerSnapshot>
      create: (input: CreateTimerInput) => Promise<TimerSnapshot>
      update: (id: string, patch: UpdateTimerInput) => Promise<TimerSnapshot>
      delete: (id: string) => Promise<TimerSnapshot>
      start: (id: string) => Promise<TimerSnapshot>
      pause: (id: string) => Promise<TimerSnapshot>
      reset: (id: string) => Promise<TimerSnapshot>
      resetPaused: () => Promise<TimerSnapshot>
      reorder: (ids: string[]) => Promise<TimerSnapshot>
      pauseAll: () => Promise<TimerSnapshot>
      openFloating: (id: string) => Promise<TimerSnapshot>
      closeFloating: (id: string) => Promise<TimerSnapshot>
      closeAllFloating: () => Promise<TimerSnapshot>
      openFree: (id: string) => Promise<TimerSnapshot>
      closeFree: (id: string) => Promise<TimerSnapshot>
      closeAllFree: () => Promise<TimerSnapshot>
      onSnapshot: (callback: (snapshot: TimerSnapshot) => void) => (() => void)
    }
    tray: {
      onTrayCapture: (callback: () => void) => (() => void)
      onNavigate: (callback: (path: string) => void) => (() => void)
      onToolToggle: (callback: (toolId: string) => void) => (() => void)
      notifyToolState: (toolId: string, enabled: boolean) => Promise<void>
    }
    tool: {
      setEnabled: (toolId: string, enabled: boolean) => Promise<void>
    }
    updater: {
      getState: () => Promise<UpdateState>
      check: () => Promise<UpdateState>
      download: () => Promise<UpdateState>
      apply: () => Promise<void>
      openRelease: () => Promise<void>
      onState: (callback: (state: UpdateState) => void) => (() => void)
    }
    pinner: {
      toggle: (borderColor: string) => Promise<{ success: boolean; action?: string; hwnd?: number; processName?: string; windowTitle?: string; reason?: string; message?: string }>
      unpin: () => Promise<{ success: boolean }>
      getState: () => Promise<{ hwnd: number; processName: string; windowTitle: string; pinnedAt: number } | null>
      setBorderColor: (color: string) => Promise<{ success: boolean }>
      onStateUpdate: (callback: (info: { hwnd: number; processName: string; windowTitle: string; pinnedAt: number } | null) => void) => (() => void)
    }
    pinman: {
      toggle: () => Promise<string>
      pinHwnd: (hwnd: number) => Promise<string>
      unpin: (hwnd: number) => Promise<string>
      unpinAll: () => Promise<string>
      status: () => Promise<PinStatus>
      config: (key: string, value: string) => Promise<string>
      ping: () => Promise<string>
      onEvent: (callback: (event: { type: string; hwnd: number; title?: string }) => void) => (() => void)
    }
    hotkey: {
      onHotkey: (callback: (action: string) => void) => (() => void)
      updateHotkey: (action: string, accelerator: string) => Promise<void>
      setHotkeyEnabled: (action: string, enabled: boolean) => Promise<void>
      disableAllHotkeys: () => Promise<void>
      enableAllHotkeys: () => Promise<void>
      checkConflict: (accelerator: string, excludeAction: string) => Promise<string | null>
      getAllAccelerators: () => Promise<Record<string, string>>
    }
  }
}

type TimerType = 'stopwatch' | 'countdown'
type TimerStatus = 'idle' | 'running' | 'paused' | 'finished'

interface TimerItem {
  id: string
  name: string
  note: string
  type: TimerType
  status: TimerStatus
  createdAt: number
  order: number
  totalMs: number
  elapsedMs: number
  remainingMs: number
  lastStartedAt: number | null
  notifyOnFinish: boolean
  floatingBounds?: { x: number; y: number }
  freeWindowBounds?: { x: number; y: number; width: number; height: number }
}

interface TimerSnapshot {
  timers: TimerItem[]
  floatingIds: string[]
  freeIds: string[]
}

interface CreateTimerInput {
  name?: string
  note?: string
  type: TimerType
  totalMs?: number
  notifyOnFinish?: boolean
}

interface UpdateTimerInput {
  name?: string
  note?: string
  totalMs?: number
  notifyOnFinish?: boolean
}

interface UpdateState {
  phase: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error'
  currentVersion: string
  distribution: 'installer' | 'portable' | 'development'
  info: {
    currentVersion: string
    latestVersion: string
    releaseName: string
    releaseNotes: string
    releaseUrl: string
    distribution: 'installer' | 'portable' | 'development'
    assetName: string
    assetSize: number
  } | null
  downloadedBytes: number
  totalBytes: number
  percent: number
  downloadedPath: string | null
  message: string
  checksum: 'pending' | 'verified' | 'unavailable'
  checkSource: 'manual' | 'auto' | null
}
