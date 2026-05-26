import { create } from 'zustand'
import { parseStaminaViaAI } from '@/features/stamina-capture/api/deepseek'
import { postStaminaRecord, setBackendUrl } from '@/features/stamina-capture/api/backend'

type CaptureState = 'idle' | 'capturing' | 'ocr' | 'parsing' | 'posting' | 'done' | 'error'

interface StaminaRecord {
  id: number
  game_name: string
  remaining_stamina: number
  max_stamina: number
  capture_time: string
}

interface GameConfig {
  id: string
  name: string
  staminaName: string
  processName: string
}

const GAME_CONFIGS: GameConfig[] = [
  { id: 'genshin', name: '原神', staminaName: '原粹树脂', processName: 'YuanShen.exe' },
  { id: 'zzz', name: '绝区零', staminaName: '电量', processName: 'ZenlessZoneZero.exe' },
  { id: 'endfield', name: '终末地', staminaName: '', processName: '' },
  { id: 'abnormal', name: '异环', staminaName: '', processName: '' }
]

interface CaptureStore {
  selectedGame: string
  stamina: { remaining: number | null; max: number | null } | null
  ocrText: string
  captureState: CaptureState
  todayRecords: StaminaRecord[]
  gameConfigs: GameConfig[]

  setSelectedGame: (id: string) => void
  setStamina: (s: { remaining: number | null; max: number | null } | null) => void
  setOcrText: (text: string) => void
  setCaptureState: (state: CaptureState) => void
  setTodayRecords: (records: StaminaRecord[]) => void
  getGameConfig: (id: string) => GameConfig | undefined
  triggerBackgroundCapture: () => Promise<void>
}

export const useCaptureStore = create<CaptureStore>((set, get) => ({
  selectedGame: 'genshin',
  stamina: null,
  ocrText: '',
  captureState: 'idle',
  todayRecords: [],
  gameConfigs: GAME_CONFIGS,

  setSelectedGame: (id) => set({ selectedGame: id }),
  setStamina: (s) => set({ stamina: s }),
  setOcrText: (text) => set({ ocrText: text }),
  setCaptureState: (state) => set({ captureState: state }),
  setTodayRecords: (records) => set({ todayRecords: records }),
  getGameConfig: (id) => GAME_CONFIGS.find((g) => g.id === id),

  // Background capture pipeline for hotkey — no UI interaction required
  triggerBackgroundCapture: async () => {
    const state = get()
    if (state.captureState !== 'idle' && state.captureState !== 'done' && state.captureState !== 'error') return

    const gameConfig = state.getGameConfig(state.selectedGame)
    if (!gameConfig) return

    try {
      set({ captureState: 'capturing' })
      const result = await window.api.capture.trigger()

      if (!result.ocrText && !result.imageBase64) {
        throw new Error('Screenshot failed')
      }

      set({ ocrText: result.ocrText, captureState: 'parsing' })

      const aiResult = await parseStaminaViaAI(
        result.ocrText || 'no text recognized',
        gameConfig.name,
        gameConfig.staminaName || '体力'
      )

      if (aiResult.remaining_stamina !== null && aiResult.max_stamina !== null) {
        set({
          stamina: { remaining: aiResult.remaining_stamina, max: aiResult.max_stamina },
          captureState: 'posting'
        })

        const backendUrlVal = await window.api.settings.get('backendUrl')
        if (backendUrlVal && typeof backendUrlVal === 'string') {
          setBackendUrl(backendUrlVal)
        }

        try {
          const record = await postStaminaRecord({
            game_name: gameConfig.name,
            package_name: gameConfig.processName,
            remaining_stamina: aiResult.remaining_stamina,
            max_stamina: aiResult.max_stamina,
            capture_time: new Date().toISOString(),
            source: 'windows'
          })
          set({ todayRecords: [record] })
        } catch (backendErr) {
          console.warn('[Capture] Backend post failed (non-blocking):', backendErr)
        }
      }

      set({ captureState: 'done' })
      setTimeout(() => set({ captureState: 'idle' }), 2000)
    } catch (err) {
      console.error('[Capture] Background pipeline error:', err)
      set({ captureState: 'error' })
      setTimeout(() => set({ captureState: 'idle' }), 3000)
    }
  }
}))
