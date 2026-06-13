import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pause, Play, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimerStore } from '@/stores/timerStore'

type DragStyle = CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag'
}

const dragStyle: DragStyle = { WebkitAppRegion: 'drag' }
const noDragStyle: DragStyle = { WebkitAppRegion: 'no-drag' }
const smoothButton = 'transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/35'

function formatDuration(ms: number, type: TimerType): string {
  const totalSeconds = Math.max(0, type === 'countdown' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function useNowTicker(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!enabled) return
    const handle = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(handle)
  }, [enabled])

  return now
}

function displayMs(timer: TimerItem, now: number): number {
  if (timer.status !== 'running' || timer.lastStartedAt === null) {
    return timer.type === 'countdown' ? timer.remainingMs : timer.elapsedMs
  }
  const delta = Math.max(0, now - timer.lastStartedAt)
  return timer.type === 'countdown'
    ? Math.max(0, timer.remainingMs - delta)
    : timer.elapsedMs + delta
}

function statusLabel(status: TimerStatus): string {
  if (status === 'running') return '运行中'
  if (status === 'paused') return '暂停'
  if (status === 'finished') return '已结束'
  return '未开始'
}

function TimerFreePage(): React.JSX.Element {
  const { timerId } = useParams()
  const timers = useTimerStore((s) => s.timers)
  const load = useTimerStore((s) => s.load)
  const listen = useTimerStore((s) => s.listen)
  const startTimer = useTimerStore((s) => s.startTimer)
  const pauseTimer = useTimerStore((s) => s.pauseTimer)
  const resetTimer = useTimerStore((s) => s.resetTimer)
  const closeFree = useTimerStore((s) => s.closeFree)

  useEffect(() => {
    load()
    return listen()
  }, [load, listen])

  const timer = useMemo(() => timers.find((item) => item.id === timerId), [timerId, timers])
  const now = useNowTicker(timer?.status === 'running')

  if (!timer) {
    return (
      <div className="flex h-screen w-screen select-none items-center justify-center bg-white text-sm font-semibold text-slate-800">
        计时器已删除
      </div>
    )
  }

  const isRunning = timer.status === 'running'
  const showReset = timer.status === 'running' || timer.status === 'paused'

  return (
    <div
      className="flex h-screen w-screen select-none flex-col overflow-hidden bg-white text-slate-950"
      style={{
        ...noDragStyle,
        '--timer-free-control': 'clamp(2.5rem, min(6vw, 8vh), 5rem)',
        '--timer-free-icon': 'clamp(1.25rem, min(3vw, 4vh), 2.25rem)'
      } as CSSProperties}
    >
      <header className="flex h-[clamp(2.25rem,5vh,3.75rem)] shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-[clamp(0.75rem,2vw,1.5rem)]" style={dragStyle}>
        <div className="min-w-0 truncate text-[clamp(0.875rem,1.5vw,1.35rem)] font-semibold">{timer.name}</div>
        <div className="flex items-center gap-2" style={noDragStyle}>
          <span className={cn('rounded-full px-[clamp(0.5rem,1vw,0.8rem)] py-0.5 text-[clamp(0.7rem,1.1vw,1rem)] font-medium', timer.type === 'stopwatch' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
            {timer.type === 'stopwatch' ? '正计时' : '倒计时'}
          </span>
          <button className={cn('rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900', smoothButton)} onClick={() => closeFree(timer.id)} title="关闭自由窗口">
            <X className="size-[clamp(0.95rem,1.4vw,1.35rem)]" />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-[clamp(1rem,4vw,4rem)] py-[clamp(1rem,4vh,3rem)]">
        <div className="flex w-full max-w-[min(86vw,72rem)] flex-col items-center gap-[clamp(0.8rem,2.8vh,2rem)] text-center">
          <div className="text-[clamp(0.8rem,1.3vw,1.15rem)] text-slate-500">{statusLabel(timer.status)}</div>
          <div className="font-mono text-[min(10vw,30vh)] font-black leading-none tracking-tight tabular-nums">
            {formatDuration(displayMs(timer, now), timer.type)}
          </div>
          {timer.type === 'countdown' && (
            <div className="text-[clamp(0.75rem,1.1vw,1rem)] text-slate-500">原始 {formatDuration(timer.totalMs, timer.type)}</div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-[clamp(0.75rem,1.6vw,1.25rem)]">
            {isRunning ? (
              <button className={cn('flex h-[var(--timer-free-control)] min-w-[var(--timer-free-control)] items-center justify-center rounded-xl bg-blue-600 px-[clamp(1rem,2vw,2rem)] text-white shadow-sm hover:bg-blue-700', smoothButton)} onClick={() => pauseTimer(timer.id)} title="暂停">
                <Pause className="size-[var(--timer-free-icon)]" />
              </button>
            ) : (
              <button className={cn('flex h-[var(--timer-free-control)] min-w-[var(--timer-free-control)] items-center justify-center rounded-xl bg-blue-600 px-[clamp(1rem,2vw,2rem)] text-white shadow-sm hover:bg-blue-700', smoothButton)} onClick={() => startTimer(timer.id)} title="开始">
                <Play className="size-[var(--timer-free-icon)]" />
              </button>
            )}
            {showReset && (
              <button className={cn('flex h-[var(--timer-free-control)] min-w-[var(--timer-free-control)] items-center justify-center rounded-xl border border-slate-200 bg-white px-[clamp(1rem,2vw,2rem)] text-slate-700 hover:bg-slate-50', smoothButton)} onClick={() => resetTimer(timer.id)} title="重置">
                <RotateCcw className="size-[var(--timer-free-icon)]" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default TimerFreePage
