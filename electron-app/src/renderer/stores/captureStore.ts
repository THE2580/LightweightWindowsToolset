import { create } from 'zustand'
import { parseResourcesViaAI, ParseResult } from '@/features/resource-capture/api/deepseek'
import { postResourceRecord, getAllLatestRecords } from '@/features/resource-capture/api/backend'

type CaptureState = 'idle' | 'capturing' | 'ocr' | 'parsing' | 'posting' | 'done' | 'error'

interface ResourceRecord {
  id: number
  game_name: string
  resource_type: string
  current_resource: number
  max_resource: number
  capture_time: string
  platform: string
}

export interface GameConfig {
  id: string
  name: string
  apiGameName: string
  processName: string
  color: string
  resourceTypes: ResourceTypeConfig[]
}

export interface ResourceTypeConfig {
  id: string
  label: string
  description: string
  cap: number
  isPrimary: boolean
  recoveryMinutes: number
}

const STEP_LABELS = ['正在截取游戏画面…', '正在识别画面文字…', '正在解析资源数据…']

const GAME_CONFIGS: GameConfig[] = [
  {
    id: 'genshin',
    name: '原神',
    apiGameName: 'GenshinImpact',
    processName: 'YuanShen.exe',
    color: '#2563EB',
    resourceTypes: [
      { id: 'GenshinImpact_ORIGINAL_RESIN', label: '原粹树脂', description: '体力', cap: 200, isPrimary: true, recoveryMinutes: 8 },
      { id: 'GenshinImpact_REALM_CURRENCY', label: '洞天宝钱', description: '子资源', cap: 2400, isPrimary: false, recoveryMinutes: 2 },
    ]
  },
  {
    id: 'zzz',
    name: '绝区零',
    apiGameName: 'ZenlessZoneZero',
    processName: 'ZenlessZoneZero.exe',
    color: '#D97706',
    resourceTypes: [
      { id: 'ZenlessZoneZero_BATTERY_CHARGE', label: '电量', description: '体力', cap: 240, isPrimary: true, recoveryMinutes: 6 },
    ]
  },
  {
    id: 'endfield',
    name: '终末地',
    apiGameName: 'Endfield',
    processName: '',
    color: '#059669',
    resourceTypes: [
      { id: 'Endfield_SANITY', label: '理智', description: '体力', cap: 360, isPrimary: true, recoveryMinutes: 7.2 },
    ]
  },
  {
    id: 'nte',
    name: '异环',
    apiGameName: 'NTE',
    processName: '',
    color: '#E11D48',
    resourceTypes: [
      { id: 'NTE_NATURE_PIXEL', label: '本性像素', description: '体力', cap: 240, isPrimary: true, recoveryMinutes: 6 },
    ]
  }
]

export interface CapturedResource {
  remaining: number
  max: number
  config: ResourceTypeConfig
  gameApiName: string
}

export interface ResourceSnapshot {
  remaining: number
  max: number
  recoveryMinutes: number
  lastCaptureTime: string
}

export interface CaptureHistoryEntry {
  id: string
  timestamp: string
  gameId: string
  gameName: string
  resourceName: string
  currentValue: number | null
  maxValue: number | null
  status: 'success' | 'fail'
  failureReason?: string
  ocrText?: string
  processName?: string
}

interface CaptureStore {
  selectedGame: string
  selectedResourceType: string
  resourceMap: Record<string, ResourceSnapshot | null>
  subResources: CapturedResource[]
  ocrText: string
  captureState: CaptureState
  latestRecords: ResourceRecord[]
  captureHistory: CaptureHistoryEntry[]
  captureHistoryLoaded: boolean
  gameConfigs: GameConfig[]
  backendOnline: boolean

  setSelectedGame: (id: string) => void
  setSelectedResourceType: (rt: string) => void
  setResource: (s: ResourceSnapshot | null) => void
  setSubResources: (sr: CapturedResource[]) => void
  setOcrText: (text: string) => void
  setCaptureState: (state: CaptureState) => void
  setLatestRecords: (records: ResourceRecord[]) => void
  addCaptureHistory: (entry: CaptureHistoryEntry) => void
  clearCaptureHistory: () => void
  loadCaptureHistory: () => Promise<void>
  getGameConfig: (id: string) => GameConfig | undefined
  getCurrentResourceConfig: () => ResourceTypeConfig | undefined
  refreshRecords: () => Promise<void>
  loadLatestFromBackend: () => Promise<void>
  triggerBackgroundCapture: () => Promise<void>
}

/** Resolve a foreground process name to a GameConfig by matching processName field */
function resolveGameByProcess(processName: string): GameConfig | null {
  const lower = processName.toLowerCase()
  return GAME_CONFIGS.find(g => {
    if (!g.processName) return false
    return g.processName.toLowerCase().replace('.exe', '') === lower
  }) ?? null
}

/** Extract resource-relevant lines from raw OCR text to reduce AI parsing noise */
function filterOcrText(rawText: string): string {
  if (!rawText) return ''
  const lines = rawText.split(/\r?\n/)
  // Keep lines that contain resource-like patterns: number/number, Chinese resource labels
  const resourcePattern = /\d+\s*\/\s*\d+/
  const labelHints = /树脂|体力|宝钱|电量|理智|像素|资源|体力值|剩余/
  const filtered = lines.filter(line => resourcePattern.test(line) || labelHints.test(line))
  if (filtered.length === 0) {
    // Fallback: return last 30 lines (game HUD is usually at top or has dense numeric data)
    console.log('[Capture] No resource lines found in OCR, using last 30 lines as fallback')
    return lines.slice(-30).join('\n')
  }
  const result = filtered.join('\n')
  console.log('[Capture] OCR filter: kept', filtered.length, '/', lines.length, 'lines, chars:', result.length)
  return result
}

/** Returns current UTC ISO string — all capture_time fields MUST use this */
function utcNow(): string {
  return new Date().toISOString()
}

/** Build step states array for overlay */
function buildSteps(screenshot: string, ocr: string, ai: string): { s: string; l: string }[] {
  return [
    { s: screenshot, l: STEP_LABELS[0] },
    { s: ocr,       l: STEP_LABELS[1] },
    { s: ai,        l: STEP_LABELS[2] },
  ]
}

/** Helper to add to captureHistory without duplicating timestamp generation */
function addHistory(entry: Omit<CaptureHistoryEntry, 'timestamp'>): void {
  useCaptureStore.getState().addCaptureHistory({
    ...entry,
    timestamp: utcNow()
  })
}

const CAPTURE_HISTORY_KEY = 'captureHistory'
const CAPTURE_HISTORY_LIMIT = 50

function isCaptureHistoryEntry(value: unknown): value is CaptureHistoryEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.id === 'string'
    && typeof entry.timestamp === 'string'
    && typeof entry.gameId === 'string'
    && typeof entry.gameName === 'string'
    && typeof entry.resourceName === 'string'
    && (entry.currentValue === null || typeof entry.currentValue === 'number')
    && (entry.maxValue === null || typeof entry.maxValue === 'number')
    && (entry.status === 'success' || entry.status === 'fail')
}

function persistCaptureHistory(entries: CaptureHistoryEntry[]): void {
  window.api.settings.set(CAPTURE_HISTORY_KEY, entries).catch((error) => {
    console.error('[Capture] Failed to persist history:', error)
  })
}

export const useCaptureStore = create<CaptureStore>((set, get) => ({
  selectedGame: 'genshin',
  selectedResourceType: 'GenshinImpact_ORIGINAL_RESIN',
  resourceMap: {},
  subResources: [],
  ocrText: '',
  captureState: 'idle',
  latestRecords: [],
  captureHistory: [],
  captureHistoryLoaded: false,
  gameConfigs: GAME_CONFIGS,
  backendOnline: true,

  setSelectedGame: (id) => {
    const config = GAME_CONFIGS.find((g) => g.id === id)
    const primary = config?.resourceTypes.find((rt) => rt.isPrimary)
    const defaultRT = primary?.id || config?.resourceTypes[0]?.id || ''
    set({ selectedGame: id, selectedResourceType: defaultRT, subResources: [], ocrText: '' })
  },
  setSelectedResourceType: (rt) => set({ selectedResourceType: rt }),
  setResource: (s) => {
    const rt = get().selectedResourceType
    if (s) {
      set((prev) => ({ resourceMap: { ...prev.resourceMap, [rt]: s } }))
    }
  },
  setSubResources: (sr) => set({ subResources: sr }),
  setOcrText: (text) => set({ ocrText: text }),
  setCaptureState: (state) => set({ captureState: state }),
  setLatestRecords: (records) => set({ latestRecords: records }),
  addCaptureHistory: (entry) => {
    set((s) => {
      const captureHistory = [entry, ...s.captureHistory.filter((item) => item.id !== entry.id)].slice(0, CAPTURE_HISTORY_LIMIT)
      persistCaptureHistory(captureHistory)
      return { captureHistory }
    })
  },
  clearCaptureHistory: () => {
    set({ captureHistory: [] })
    persistCaptureHistory([])
  },
  loadCaptureHistory: async () => {
    if (get().captureHistoryLoaded) return
    try {
      const stored = await window.api.settings.get(CAPTURE_HISTORY_KEY)
      const persisted = Array.isArray(stored)
        ? stored.filter(isCaptureHistoryEntry).slice(0, CAPTURE_HISTORY_LIMIT)
        : []
      const merged = [...get().captureHistory, ...persisted]
      const ids = new Set<string>()
      const captureHistory = merged.filter((entry) => {
        if (ids.has(entry.id)) return false
        ids.add(entry.id)
        return true
      }).slice(0, CAPTURE_HISTORY_LIMIT)
      set({ captureHistory, captureHistoryLoaded: true })
      persistCaptureHistory(captureHistory)
    } catch (error) {
      console.error('[Capture] Failed to load history:', error)
      set({ captureHistoryLoaded: true })
    }
  },
  getGameConfig: (id) => GAME_CONFIGS.find((g) => g.id === id),
  getCurrentResourceConfig: () => {
    const { selectedGame, selectedResourceType } = get()
    const config = GAME_CONFIGS.find((g) => g.id === selectedGame)
    return config?.resourceTypes.find((rt) => rt.id === selectedResourceType)
  },

  refreshRecords: async () => {
    try {
      const records = await getAllLatestRecords()
      if (records.length > 0) {
        set({ latestRecords: records })
        if (!get().backendOnline) set({ backendOnline: true })
        const now = Date.now()
        // Sort by capture_time ASC so the last record for each resource_type is the newest
        const sortedRecords = [...records].sort(
          (a, b) => new Date(a.capture_time).getTime() - new Date(b.capture_time).getTime()
        )
        const latest = new Map<string, ResourceSnapshot>()
        for (const r of sortedRecords) {
          const cfg = GAME_CONFIGS.find((g) => r.game_name.startsWith(g.name) || r.resource_type.startsWith(g.apiGameName + "_"))
          if (!cfg) continue
          const rt = cfg.resourceTypes.find((t) => t.id === r.resource_type)
          if (!rt) continue
          const elapsedMin = (now - new Date(r.capture_time).getTime()) / 60000
          const recovered = rt.recoveryMinutes > 0 ? Math.floor(elapsedMin / rt.recoveryMinutes) : 0
          const current = Math.min(r.current_resource + recovered, r.max_resource)
          latest.set(r.resource_type, {
            remaining: current,
            max: r.max_resource,
            recoveryMinutes: rt.recoveryMinutes,
            lastCaptureTime: r.capture_time
          })
        }
        if (latest.size > 0) {
          set((prev) => { const u = { ...prev.resourceMap }; for (const [k, v] of latest) u[k] = v; return { resourceMap: u } })
        }
      }
    } catch { set({ backendOnline: false }) }
  },

  loadLatestFromBackend: async () => {
    try {
      const records = await getAllLatestRecords()
      if (records.length > 0) {
        set({ latestRecords: records })
        if (!get().backendOnline) set({ backendOnline: true })
        const now = Date.now()
        const latest = new Map<string, ResourceSnapshot>()
        // Sort by capture_time ASC so the last record for each resource_type is the newest
        const sortedRecords = [...records].sort(
          (a, b) => new Date(a.capture_time).getTime() - new Date(b.capture_time).getTime()
        )
        for (const r of sortedRecords) {
          const cfg = GAME_CONFIGS.find((g) => r.game_name.startsWith(g.name) || r.resource_type.startsWith(g.apiGameName + "_"))
          if (!cfg) continue
          const rt = cfg.resourceTypes.find((t) => t.id === r.resource_type)
          if (!rt) continue
          const elapsedMin = (now - new Date(r.capture_time).getTime()) / 60000
          const recovered = rt.recoveryMinutes > 0 ? Math.floor(elapsedMin / rt.recoveryMinutes) : 0
          const current = Math.min(r.current_resource + recovered, r.max_resource)
          latest.set(r.resource_type, {
            remaining: current,
            max: r.max_resource,
            recoveryMinutes: rt.recoveryMinutes,
            lastCaptureTime: r.capture_time
          })
        }
        if (latest.size > 0) {
          const u: Record<string, ResourceSnapshot> = { ...get().resourceMap }
          for (const [k, v] of latest) u[k] = v
          set({ resourceMap: u })
        }
      } else if (!get().backendOnline) set({ backendOnline: true })
    } catch { set({ backendOnline: false }) }
  },

  // ── Core pipeline ──
  triggerBackgroundCapture: async () => {
    const state = get()
    if (state.captureState !== 'idle') {
      console.log('[Capture] Busy, state:', state.captureState)
      return
    }

    set({ captureState: 'capturing' })

    // ── Phase 1: Foreground detection ──
    let fg: { processName: string; resolvedGameId: string | null; isDesktop: boolean }
    try {
      fg = await window.api.capture.detectForeground()
      console.log('[Capture] Foreground:', fg.processName, 'desktop=', fg.isDesktop, 'resolved=', fg.resolvedGameId)
    } catch (err) {
      console.error('[Capture] Foreground detection failed:', err)
      set({ captureState: 'idle' })
      return
    }

    // ── Phase 2: Process validation ──
    // Resolve game config: prefer GAME_CONFIGS.processName match, fallback to main-process KNOWN_PROCESSES mapping
    let resolvedGameConfig: GameConfig | null = resolveGameByProcess(fg.processName)
    if (!resolvedGameConfig && fg.resolvedGameId) {
      resolvedGameConfig = GAME_CONFIGS.find(g => g.id === fg.resolvedGameId) ?? null
    }

    if (!resolvedGameConfig || fg.isDesktop) {
      // Invalid process — show overlay with error banner and abort
      const displayName = fg.processName || 'desktop'
      console.log('[Capture] Invalid process:', displayName)

      await window.api.overlay.create(displayName, [], true).catch(() => {})

      addHistory({
        id: `${Date.now()}-invalid`,
        gameId: `invalid-${displayName}`,
        gameName: displayName,
        resourceName: '',
        currentValue: null,
        maxValue: null,
        status: 'fail',
        failureReason: '当前为无效进程',
        processName: displayName
      })

      set({ captureState: 'idle' })
      return
    }

    // Update selectedGame if detected game differs from current selection
    // Sync both selectedGame and selectedResourceType to the captured game's primary resource
    const primaryRTForSync = resolvedGameConfig.resourceTypes.find(rt => rt.isPrimary)
    const targetRT = primaryRTForSync?.id || resolvedGameConfig.resourceTypes[0]?.id || resolvedGameConfig.id
    if (resolvedGameConfig.id !== state.selectedGame || targetRT !== state.selectedResourceType) {
      set({ selectedGame: resolvedGameConfig.id, selectedResourceType: targetRT })
    }

    const gameName = resolvedGameConfig.name
    const processName = fg.processName

    // ── Phase 3: Show overlay (valid game) ──
    await window.api.overlay.create(gameName, STEP_LABELS, false).catch(() => {})
    // Update step 0 to "running" immediately
    await window.api.overlay.update(
      buildSteps('running', 'pending', 'pending'),
      gameName
    ).catch(() => {})

    // ── Phase 4: Screenshot + OCR (with 20s overall timeout) ──
    let captureResult: {
      ocrText: string
      imageBase64: string
      success: boolean
      errorCode?: string
      errorMessage?: string
    }

    try {
      const capturePromise = window.api.capture.trigger()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('截图或OCR超时 (20s)')), 20000)
      )
      captureResult = await Promise.race([capturePromise, timeoutPromise])
    } catch (err) {
      console.error('[Capture] Screenshot/OCR failed:', err)
      const errMsg = err instanceof Error ? err.message : String(err)

      // Show error on overlay
      await window.api.overlay.update(
        buildSteps('error', 'pending', 'pending'),
        gameName
      ).catch(() => {})
      await window.api.overlay.result(
        buildSteps('error', 'pending', 'pending'),
        processName,
        `资源捕获失败: ${errMsg}`,
        false
      ).catch(() => {})

      addHistory({
        id: `${Date.now()}-capture-fail`,
        gameId: resolvedGameConfig.id,
        gameName,
        resourceName: '',
        currentValue: null,
        maxValue: null,
        status: 'fail',
        failureReason: errMsg,
        ocrText: '',
        processName
      })

      set({ captureState: 'idle' })
      return
    }

    if (!captureResult.success) {
      console.error('[Capture] capture:trigger returned failure:', captureResult.errorCode, captureResult.errorMessage)

      await window.api.overlay.update(
        buildSteps('error', 'pending', 'pending'),
        gameName
      ).catch(() => {})
      await window.api.overlay.result(
        buildSteps('error', 'pending', 'pending'),
        processName,
        `资源捕获失败: ${captureResult.errorMessage || '未知错误'}`,
        false
      ).catch(() => {})

      addHistory({
        id: `${Date.now()}-capture-fail`,
        gameId: resolvedGameConfig.id,
        gameName,
        resourceName: '',
        currentValue: null,
        maxValue: null,
        status: 'fail',
        failureReason: captureResult.errorMessage || '截图或OCR失败',
        ocrText: captureResult.ocrText || '',
        processName
      })

      set({ captureState: 'idle' })
      return
    }

    // ── Phase 5: Screenshot + OCR succeeded ──
    const ocrOk = !!captureResult.ocrText
    set({ ocrText: captureResult.ocrText })

    // Pre-filter OCR text: keep only lines with resource-like patterns to reduce AI noise
    const filteredOcrText = filterOcrText(captureResult.ocrText)

    // Update overlay: screenshot done, OCR done, AI running
    await window.api.overlay.update(
      buildSteps('done', ocrOk ? 'done' : 'error', 'running'),
      gameName
    ).catch(() => {})

    // ── Phase 6: AI parsing (30s timeout via AbortController in deepseek.ts) ──
    set({ captureState: 'parsing' })

    let aiResults: ParseResult[]
    try {
      aiResults = await parseResourcesViaAI(
        filteredOcrText || 'no text recognized',
        resolvedGameConfig
      )
      console.log('[Capture] AI parsed', aiResults.length, 'resources')
    } catch (aiErr) {
      console.error('[Capture] AI parsing failed:', aiErr)
      const aiMsg = aiErr instanceof Error ? aiErr.message : String(aiErr)

      await window.api.overlay.result(
        buildSteps('done', ocrOk ? 'done' : 'error', 'error'),
        processName,
        `AI 解析失败: ${aiMsg}`,
        false
      ).catch(() => {})

      addHistory({
        id: `${Date.now()}-ai-fail`,
        gameId: resolvedGameConfig.id,
        gameName,
        resourceName: '',
        currentValue: null,
        maxValue: null,
        status: 'fail',
        failureReason: `AI 解析失败: ${aiMsg}`,
        ocrText: captureResult.ocrText,
        processName
      })

      set({ captureState: 'idle' })
      return
    }

    if (aiResults.length === 0) {
      console.error('[Capture] AI returned no resources')

      await window.api.overlay.result(
        buildSteps('done', ocrOk ? 'done' : 'error', 'error'),
        processName,
        'AI 未识别到资源数据',
        false
      ).catch(() => {})

      addHistory({
        id: `${Date.now()}-ai-empty`,
        gameId: resolvedGameConfig.id,
        gameName,
        resourceName: '',
        currentValue: null,
        maxValue: null,
        status: 'fail',
        failureReason: 'AI 未识别到资源数据',
        ocrText: captureResult.ocrText,
        processName
      })

      set({ captureState: 'idle' })
      return
    }

    // ── Phase 7: Post to backend + update local stores ──
    set({ captureState: 'posting' })

    const primaryRT = resolvedGameConfig.resourceTypes.find(rt => rt.isPrimary)
    const records: ResourceRecord[] = []
    const now = utcNow()

    // Build local resource map updates
    const newResourceMap: Record<string, ResourceSnapshot> = {}
    const newSubResources: CapturedResource[] = []

    for (const r of aiResults) {
      const matched = resolvedGameConfig.resourceTypes.find(
        rt => r.max_resource === rt.cap
      )
      if (!matched || r.remaining_resource === null || r.max_resource === null) continue

      // Backend post
      try {
        const record = await postResourceRecord({
          game_name: resolvedGameConfig.name,
          resource_type: matched.id,
          current_resource: r.remaining_resource,
          max_resource: r.max_resource,
          capture_time: now,
          platform: 'desktop'
        })
        records.push(record)
        addHistory({
          id: `${Date.now()}-${matched.id}`,
          gameId: resolvedGameConfig.id,
          gameName: resolvedGameConfig.name,
          resourceName: matched.label,
          currentValue: r.remaining_resource,
          maxValue: r.max_resource,
          status: 'success',
          ocrText: captureResult.ocrText,
          processName
        })
      } catch (backendErr) {
        // Backend failed, still record locally
        addHistory({
          id: `${Date.now()}-${matched.id}`,
          gameId: resolvedGameConfig.id,
          gameName: resolvedGameConfig.name,
          resourceName: matched.label,
          currentValue: r.remaining_resource,
          maxValue: r.max_resource,
          status: 'fail',
          failureReason: `后端提交失败: ${backendErr instanceof Error ? backendErr.message : String(backendErr)}`,
          ocrText: captureResult.ocrText,
          processName
        })
      }

      // Always update local resource map
      const isPrimary = matched.isPrimary
      newResourceMap[matched.id] = {
        remaining: r.remaining_resource,
        max: r.max_resource,
        recoveryMinutes: matched.recoveryMinutes,
        lastCaptureTime: now
      }

      if (!isPrimary) {
        newSubResources.push({
          remaining: r.remaining_resource,
          max: r.max_resource,
          config: matched,
          gameApiName: resolvedGameConfig.apiGameName
        })
      }
    }

    // Apply local state updates
    set((prev) => ({
      resourceMap: { ...prev.resourceMap, ...newResourceMap },
      subResources: newSubResources,
    }))

    if (records.length > 0) {
      set({ latestRecords: records })
    }

    // ── Phase 8: Show success on overlay ──
    const primaryValue = primaryRT && newResourceMap[primaryRT.id]
      ? `${newResourceMap[primaryRT.id].remaining}/${newResourceMap[primaryRT.id].max}`
      : ''
    const subCount = newSubResources.length > 0 ? ` +${newSubResources.length}子资源` : ''

    await window.api.overlay.result(
      buildSteps('done', ocrOk ? 'done' : 'error', 'done'),
      processName,
      `识别成功 ${gameName} ${primaryRT?.label || '资源'} ${primaryValue}${subCount}`,
      true
    ).catch(() => {})

    // Flush retry queue
    window.api.queue.flush().catch(() => {})

    set({ captureState: 'done' })
    setTimeout(() => set({ captureState: 'idle' }), 2000)
  }
}))
