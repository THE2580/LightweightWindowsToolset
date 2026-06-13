import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { Pause, Play, RotateCcw } from 'lucide-react'
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

function TimerFloatingPage(): React.JSX.Element {
  const { timerId } = useParams()
  const timers = useTimerStore((s) => s.timers)
  const load = useTimerStore((s) => s.load)
  const listen = useTimerStore((s) => s.listen)
  const startTimer = useTimerStore((s) => s.startTimer)
  const pauseTimer = useTimerStore((s) => s.pauseTimer)
  const resetTimer = useTimerStore((s) => s.resetTimer)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    load()
    return listen()
  }, [load, listen])

  useEffect(() => {
    const root = document.getElementById('root')
    const targets = [document.documentElement, document.body, root].filter((item): item is HTMLElement => Boolean(item))
    const previous = targets.map((item) => ({
      backgroundColor: item.style.backgroundColor,
      overflow: item.style.overflow
    }))
    targets.forEach((item) => {
      item.style.backgroundColor = 'transparent'
      item.style.overflow = 'hidden'
    })
    return () => {
      targets.forEach((item, index) => {
        item.style.backgroundColor = previous[index]?.backgroundColor || ''
        item.style.overflow = previous[index]?.overflow || ''
      })
    }
  }, [])

  const timer = useMemo(() => timers.find((item) => item.id === timerId), [timerId, timers])
  const now = useNowTicker(timer?.status === 'running')

  if (!timer) {
    return (
      <div className="h-screen w-screen select-none bg-transparent" style={noDragStyle}>
        <div className="flex h-full w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-center text-xs font-semibold text-slate-800">
          计时器已删除
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-screen w-screen select-none bg-transparent text-slate-950"
      style={noDragStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-white" style={noDragStyle}>
        <div className="absolute left-0 right-0 top-0 z-10 flex h-2.5 cursor-grab items-center justify-center" style={dragStyle} title="拖动悬浮窗">
          <motion.div
            className="h-1 w-7 rounded-full bg-slate-300"
            animate={{ opacity: hovered ? 0.95 : 0.75 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
        </div>

        <motion.div
          className="absolute left-2 right-2 top-[17px] truncate text-center text-[11px] font-bold leading-none"
          animate={{ opacity: hovered ? 0 : 1, y: hovered ? -2 : 0 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
        >
          {timer.name}
        </motion.div>

        <motion.div
          className="absolute left-3 top-[16px] max-w-[94px] truncate text-[11px] font-bold leading-none"
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 2 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
        >
          {timer.name}
        </motion.div>

        <motion.div
          className={cn('absolute right-3 top-[16px] text-[10px] font-bold leading-none', timer.type === 'stopwatch' ? 'text-emerald-600' : 'text-amber-500')}
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 2 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
        >
          {timer.type === 'stopwatch' ? '正计时' : '倒计时'}
        </motion.div>

        <motion.div
          className="absolute left-0 right-0 text-center font-mono text-[20px] font-black leading-none tracking-tight tabular-nums"
          animate={{ top: hovered ? 32 : 34, scale: hovered ? 0.9 : 1.08 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {formatDuration(displayMs(timer, now), timer.type)}
        </motion.div>

        <motion.div
          className="absolute bottom-1 left-0 right-0 flex justify-center gap-2"
          style={{ ...noDragStyle, pointerEvents: hovered ? 'auto' : 'none' }}
          animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 5 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          {timer.status === 'running' ? (
            <button className={`rounded-full bg-blue-600 p-1 text-white hover:bg-blue-700 ${smoothButton}`} onClick={() => pauseTimer(timer.id)} title="暂停">
              <Pause size={11} />
            </button>
          ) : (
            <button className={`rounded-full bg-blue-600 p-1 text-white hover:bg-blue-700 ${smoothButton}`} onClick={() => startTimer(timer.id)} title="开始">
              <Play size={11} />
            </button>
          )}
          <button className={`rounded-full border border-slate-200 bg-white p-1 text-slate-700 hover:bg-slate-50 ${smoothButton}`} onClick={() => resetTimer(timer.id)} title="重置">
            <RotateCcw size={11} />
          </button>
        </motion.div>
      </div>
    </div>
  )
}

export default TimerFloatingPage
