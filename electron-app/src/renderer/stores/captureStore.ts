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

import { create } from 'zustand'

interface CaptureStore {
  selectedGame: string
  stamina: { remaining: number | null; max: number | null } | null
  ocrText: string
  captureState: CaptureState
  todayRecords: StaminaRecord[]

  setSelectedGame: (id: string) => void
  setStamina: (s: { remaining: number | null; max: number | null } | null) => void
  setOcrText: (text: string) => void
  setCaptureState: (state: CaptureState) => void
  setTodayRecords: (records: StaminaRecord[]) => void
  getGameConfig: (id: string) => GameConfig | undefined
  gameConfigs: GameConfig[]
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
  getGameConfig: (id) => GAME_CONFIGS.find((g) => g.id === id)
}))
