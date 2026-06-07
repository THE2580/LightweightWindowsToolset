import { create } from 'zustand'

interface TimerState {
  timers: TimerItem[]
  floatingIds: Set<string>
  loaded: boolean
  load: () => Promise<void>
  listen: () => () => void
  createTimer: (input: CreateTimerInput) => Promise<void>
  updateTimer: (id: string, patch: UpdateTimerInput) => Promise<void>
  deleteTimer: (id: string) => Promise<void>
  startTimer: (id: string) => Promise<void>
  pauseTimer: (id: string) => Promise<void>
  resetTimer: (id: string) => Promise<void>
  resetPaused: () => Promise<void>
  reorderTimers: (ids: string[]) => Promise<void>
  pauseAll: () => Promise<void>
  openFloating: (id: string) => Promise<void>
  closeFloating: (id: string) => Promise<void>
  closeAllFloating: () => Promise<void>
}

function applySnapshot(snapshot: TimerSnapshot): Pick<TimerState, 'timers' | 'floatingIds' | 'loaded'> {
  return {
    timers: snapshot.timers,
    floatingIds: new Set(snapshot.floatingIds),
    loaded: true
  }
}

async function runAndApply(action: Promise<TimerSnapshot>, set: (state: Partial<TimerState>) => void): Promise<void> {
  const snapshot = await action
  set(applySnapshot(snapshot))
}

export const useTimerStore = create<TimerState>((set) => ({
  timers: [],
  floatingIds: new Set<string>(),
  loaded: false,

  load: async () => {
    const snapshot = await window.api.timer.getSnapshot()
    set(applySnapshot(snapshot))
  },

  listen: () => {
    return window.api.timer.onSnapshot((snapshot) => {
      set(applySnapshot(snapshot))
    })
  },

  createTimer: (input) => runAndApply(window.api.timer.create(input), set),
  updateTimer: (id, patch) => runAndApply(window.api.timer.update(id, patch), set),
  deleteTimer: (id) => runAndApply(window.api.timer.delete(id), set),
  startTimer: (id) => runAndApply(window.api.timer.start(id), set),
  pauseTimer: (id) => runAndApply(window.api.timer.pause(id), set),
  resetTimer: (id) => runAndApply(window.api.timer.reset(id), set),
  resetPaused: () => runAndApply(window.api.timer.resetPaused(), set),
  reorderTimers: (ids) => runAndApply(window.api.timer.reorder(ids), set),
  pauseAll: () => runAndApply(window.api.timer.pauseAll(), set),
  openFloating: (id) => runAndApply(window.api.timer.openFloating(id), set),
  closeFloating: (id) => runAndApply(window.api.timer.closeFloating(id), set),
  closeAllFloating: () => runAndApply(window.api.timer.closeAllFloating(), set)
}))
