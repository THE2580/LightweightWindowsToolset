import { create } from 'zustand'
import { parseResourcesViaAI, ParseResult } from '@/features/resource-capture/api/deepseek'
import { postResourceRecord, getAllTodayRecords } from '@/features/resource-capture/api/backend'

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

const STEP_LABELS = ['正在截图...', 'OCR文本识别中...', 'AI文本解析中...']

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
  todayRecords: ResourceRecord[]
  captureHistory: CaptureHistoryEntry[]
  gameConfigs: GameConfig[]
  backendOnline: boolean

  setSelectedGame: (id: string) => void
  setSelectedResourceType: (rt: string) => void
  setResource: (s: ResourceSnapshot | null) => void
  setSubResources: (sr: CapturedResource[]) => void
  setOcrText: (text: string) => void
  setCaptureState: (state: CaptureState) => void
  setTodayRecords: (records: ResourceRecord[]) => void
  addCaptureHistory: (entry: CaptureHistoryEntry) => void
  clearCaptureHistory: () => void
  getGameConfig: (id: string) => GameConfig | undefined
  getCurrentResourceConfig: () => ResourceTypeConfig | undefined
  refreshRecords: () => Promise<void>
  loadTodayFromBackend: () => Promise<void>
  triggerBackgroundCapture: () => Promise<void>
}

export const useCaptureStore = create<CaptureStore>((set, get) => ({
  selectedGame: 'genshin',
  selectedResourceType: 'GenshinImpact_ORIGINAL_RESIN',
  resourceMap: {},
  subResources: [],
  ocrText: '',
  captureState: 'idle',
  todayRecords: [],
  captureHistory: [],
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
    const { selectedGame } = get()
    if (s) {
      const rt = get().selectedResourceType
      set((prev) => ({ resourceMap: { ...prev.resourceMap, [rt]: s } }))
    }
  },
  setSubResources: (sr) => set({ subResources: sr }),
  setOcrText: (text) => set({ ocrText: text }),
  setCaptureState: (state) => set({ captureState: state }),
  setTodayRecords: (records) => set({ todayRecords: records }),
  addCaptureHistory: (entry) =>
    set((s) => ({ captureHistory: [entry, ...s.captureHistory].slice(0, 50) })),
  clearCaptureHistory: () => set({ captureHistory: [] }),
  getGameConfig: (id) => GAME_CONFIGS.find((g) => g.id === id),
  getCurrentResourceConfig: () => {
    const { selectedGame, selectedResourceType } = get()
    const config = GAME_CONFIGS.find((g) => g.id === selectedGame)
    return config?.resourceTypes.find((rt) => rt.id === selectedResourceType)
  },


  refreshRecords: async () => {
    try {
      const records = await getAllTodayRecords()
      if (records.length > 0) {
        set({ todayRecords: records })
        if (!get().backendOnline) set({ backendOnline: true })
        const now = Date.now()
        const latest = new Map<string, ResourceSnapshot>()
        for (const r of records) {
          if (latest.has(r.resource_type)) continue
          const cfg = GAME_CONFIGS.find((g) => g.name === r.game_name)
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

  loadTodayFromBackend: async () => {
    try {
      const records = await getAllTodayRecords()
      if (records.length > 0) {
        set({ todayRecords: records })
        if (!get().backendOnline) set({ backendOnline: true })
        const now = Date.now()
        const latest = new Map<string, ResourceSnapshot>()
        let lastGameId: string | null = null
        for (const r of records) {
          const cfg = GAME_CONFIGS.find((g) => g.name === r.game_name)
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
          if (rt.isPrimary) lastGameId = cfg.id
        }
        if (latest.size > 0) {
          const u: Record<string, ResourceSnapshot> = { ...get().resourceMap }
          for (const [k, v] of latest) u[k] = v
          set((prev) => ({
            resourceMap: u,
            selectedGame: lastGameId || prev.selectedGame
          }))
        }
      } else if (!get().backendOnline) set({ backendOnline: true })
    } catch { set({ backendOnline: false }) }
  },

  triggerBackgroundCapture: async () => {
    const state = get()
    if (state.captureState !== 'idle') return
    const gameConfig = state.getGameConfig(state.selectedGame)
    if (!gameConfig) return

    try {
      set({ captureState: 'capturing' })

      // Pre-detect foreground window to show correct game name in overlay
      const fg = await window.api.capture.detectForeground()
      let overlayName = fg.processName
      if (fg.resolvedGameId) {
        const cfg = GAME_CONFIGS.find((g) => g.id === fg.resolvedGameId)
        if (cfg) overlayName = cfg.name
      }
      await window.api.overlay.create(overlayName, STEP_LABELS)

      const result = await window.api.capture.trigger()

      const processName = result.windowInfo?.processName || fg.processName

      // Always resolve game from actual detection, never from dropdown
      const detectedGameId = result.resolvedGameId || fg.resolvedGameId
      let resolvedGameConfig: GameConfig = gameConfig
      if (detectedGameId) {
        const cfg = GAME_CONFIGS.find((g) => g.id === detectedGameId)
        if (cfg) {
          resolvedGameConfig = cfg
          if (detectedGameId !== state.selectedGame) {
            set({ selectedGame: detectedGameId })
          }
        }
      }

      if (!result.success) {
        // Error at capture/OCR phase — overlay already updated by main process
        // Show result on overlay
        const errorSteps = [
          { s: 'error', l: STEP_LABELS[0] },
          { s: 'pending', l: STEP_LABELS[1] },
          { s: 'pending', l: STEP_LABELS[2] },
        ]
        await window.api.overlay.result(
          errorSteps, processName,
          `资源捕获失败: ${result.errorMessage || '捕获失败'}`,
          false
        )
        const historyEntry: CaptureHistoryEntry = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          gameId: `unknown-${result.windowInfo?.processName || 'desktop'}`,
          gameName: result.windowInfo?.processName || '未知进程',
          resourceName: '',
          currentValue: null,
          maxValue: null,
          status: 'fail',
          failureReason: result.errorMessage || '捕获失败',
          ocrText: result.ocrText || '',
          processName: result.windowInfo?.processName
        }
        set({ captureHistory: [historyEntry, ...state.captureHistory].slice(0, 50), captureState: 'error' })
        setTimeout(() => set({ captureState: 'idle' }), 3000)
        return
      }

      if (!result.ocrText && !result.imageBase64) {
        throw new Error('Screenshot failed')
      }

      set({ ocrText: result.ocrText })

      // Steps screenshot and OCR were already updated by main process.
      // Now start AI parsing.
      const ocrOk = !!result.ocrText

      // Update overlay: AI parsing running
      const aiRunningSteps = [
        { s: 'done', l: STEP_LABELS[0] },
        { s: ocrOk ? 'done' : 'error', l: STEP_LABELS[1] },
        { s: 'running', l: STEP_LABELS[2] },
      ]
      await window.api.overlay.update(aiRunningSteps, processName)

      // --- AI parsing ---
      set({ captureState: 'parsing' })

      const aiResults: ParseResult[] = await parseResourcesViaAI(
        result.ocrText || 'no text recognized',
        resolvedGameConfig
      )

      const primaryResult = aiResults.find((r) =>
        resolvedGameConfig.resourceTypes.some((rt) => rt.isPrimary && r.max_resource === rt.cap)
      )

      const subResults: CapturedResource[] = []
      for (const r of aiResults) {
        const matched = resolvedGameConfig.resourceTypes.find(
          (rt) => !rt.isPrimary && r.max_resource === rt.cap
        )
        if (matched) {
          subResults.push({
            remaining: r.remaining_resource,
            max: r.max_resource,
            config: matched,
            gameApiName: resolvedGameConfig.apiGameName
          })
        }
      }

      if (primaryResult) {
        set((prev) => ({
          resourceMap: {
            ...prev.resourceMap,
            [primaryRT?.id || resolvedGameConfig.id]: { remaining: primaryResult.remaining_resource, max: primaryResult.max_resource, recoveryMinutes: primaryRT?.recoveryMinutes || 0, lastCaptureTime: new Date().toISOString() },
            ...Object.fromEntries(subResults.map((sr) => [sr.config.id, { remaining: sr.remaining, max: sr.max, recoveryMinutes: sr.config.recoveryMinutes, lastCaptureTime: new Date().toISOString() }])),
          },
          subResources: subResults,
          captureState: 'posting'
        }))
      } else if (subResults.length > 0) {
        const first = subResults[0]
        set((prev) => ({
          resourceMap: {
            ...prev.resourceMap,
            [first.config.id]: { remaining: first.remaining, max: first.max, recoveryMinutes: first.config.recoveryMinutes, lastCaptureTime: new Date().toISOString() },
            ...Object.fromEntries(subResults.slice(1).map((sr) => [sr.config.id, { remaining: sr.remaining, max: sr.max, recoveryMinutes: sr.config.recoveryMinutes, lastCaptureTime: new Date().toISOString() }])),
          },
          subResources: subResults.slice(1),
          captureState: 'posting'
        }))
      } else {
        // AI failed to parse any resources
        const aiFailSteps = [
          { s: 'done', l: STEP_LABELS[0] },
          { s: ocrOk ? 'done' : 'error', l: STEP_LABELS[1] },
          { s: 'error', l: STEP_LABELS[2] },
        ]
        await window.api.overlay.result(aiFailSteps, processName, 'AI 未识别到资源数据', false)
        const historyEntry: CaptureHistoryEntry = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          gameId: resolvedGameConfig.id,
          gameName: resolvedGameConfig.name,
          resourceName: '',
          currentValue: null,
          maxValue: null,
          status: 'fail',
          failureReason: 'AI 未识别到资源数据',
          ocrText: result.ocrText,
          processName: result.windowInfo?.processName
        }
        set({
          captureHistory: [historyEntry, ...state.captureHistory].slice(0, 50),
          captureState: 'done'
        })
        setTimeout(() => set({ captureState: 'idle' }), 2000)
        return
      }

      if (aiResults.length > 0) {
        set({ captureState: 'posting' })

        const records: ResourceRecord[] = []
        const primaryRT = resolvedGameConfig.resourceTypes.find((rt) => rt.isPrimary)
        for (const r of aiResults) {
          const matchedConfig = resolvedGameConfig.resourceTypes.find(
            (rt) => r.max_resource === rt.cap || (rt.isPrimary && r.max_resource !== 0)
          )
          if (matchedConfig && r.remaining_resource !== null && r.max_resource !== null) {
            try {
              const record = await postResourceRecord({
                game_name: resolvedGameConfig.name,
                resource_type: matchedConfig.id,
                current_resource: r.remaining_resource,
                max_resource: r.max_resource,
                capture_time: new Date().toISOString(),
                platform: 'desktop'
              })
              records.push(record)
              addHistory({
                id: `${Date.now()}-${matchedConfig.id}`,
                gameId: resolvedGameConfig.id,
                gameName: resolvedGameConfig.name,
                resourceName: matchedConfig.label,
                currentValue: r.remaining_resource,
                maxValue: r.max_resource,
                status: 'success',
                processName: result.windowInfo?.processName,
                ocrText: get().ocrText
              })
            } catch (backendErr) {
              set({ ocrText: result.ocrText })
              addHistory({
                id: `${Date.now()}-${matchedConfig.id}`,
                gameId: resolvedGameConfig.id,
                gameName: resolvedGameConfig.name,
                resourceName: matchedConfig.label,
                currentValue: r.remaining_resource,
                maxValue: r.max_resource,
                status: 'fail',
                failureReason: `后端提交失败: ${backendErr instanceof Error ? backendErr.message : String(backendErr)}`,
                processName: result.windowInfo?.processName,
                ocrText: get().ocrText
              })
            }
          }
        }
        if (records.length > 0) {
          set({ todayRecords: records })
        }

        const primaryLabel = primaryRT?.label || '资源'
        const primaryValue = primaryResult
          ? `${primaryResult.remaining_resource}/${primaryResult.max_resource}`
          : ''
        const subCount = subResults.length > 0 ? ` +${subResults.length}子资源` : ''

        const successSteps = [
          { s: 'done', l: STEP_LABELS[0] },
          { s: 'done', l: STEP_LABELS[1] },
          { s: 'done', l: STEP_LABELS[2] },
        ]
        await window.api.overlay.result(
          successSteps, processName,
          `识别成功 ${resolvedGameConfig.name} ${primaryLabel} ${primaryValue}${subCount}`,
          true
        )

        window.api.queue.flush().catch(() => {})
      }

      set({ captureState: 'done' })
      setTimeout(() => set({ captureState: 'idle' }), 2000)
    } catch (err) {
      console.error('[Capture] Background pipeline error:', err)

      const historyEntry: CaptureHistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        gameId: fg.resolvedGameId || `unknown-${fg.processName}`,
        gameName: fg.resolvedGameId ? GAME_CONFIGS.find((g) => g.id === fg.resolvedGameId)?.name || fg.processName : fg.processName,
        resourceName: '',
        currentValue: null,
        maxValue: null,
        status: 'fail',
        failureReason: err instanceof Error ? err.message : String(err),
        ocrText: get().ocrText,
        processName: fg.processName
      }
      set((s) => ({ captureHistory: [historyEntry, ...s.captureHistory].slice(0, 50), captureState: 'error' }))

      await window.api.overlay.close()
      setTimeout(() => set({ captureState: 'idle' }), 3000)
    }
  }
}))

/** Helper to add to captureHistory without duplicating timestamp generation */
function addHistory(entry: Omit<CaptureHistoryEntry, 'timestamp'>): void {
  useCaptureStore.getState().addCaptureHistory({
    ...entry,
    timestamp: new Date().toISOString()
  })
}
