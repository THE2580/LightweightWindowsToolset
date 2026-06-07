import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimerStore } from '@/stores/timerStore'

type DragStyle = CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag'
}

const dragStyle: DragStyle = { WebkitAppRegion: 'drag' }
const noDragStyle: DragStyle = { WebkitAppRegion: 'no-drag' }
const smoothButton = 'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/35'

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function displayMs(timer: TimerItem): number {
  return timer.type === 'countdown' ? timer.remainingMs : timer.elapsedMs
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
  const [focused, setFocused] = useState(document.hasFocus())

  useEffect(() => {
    load()
    return listen()
  }, [load, listen])

  useEffect(() => {
    const handleFocus = (): void => setFocused(true)
    const handleBlur = (): void => setFocused(false)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  const timer = useMemo(() => timers.find((item) => item.id === timerId), [timerId, timers])
  const showControls = hovered || focused

  if (!timer) {
    return (
      <div className="flex h-screen select-none items-center justify-center rounded-2xl bg-white px-4 text-center text-sm font-semibold text-slate-800 shadow-lg" style={dragStyle}>
        计时器已删除
      </div>
    )
  }

  return (
    <div
      className="flex h-screen select-none flex-col justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-lg"
      style={dragStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={cn('flex items-center', showControls ? 'justify-between' : 'justify-center')}>
        <div className="max-w-[118px] truncate text-center text-sm font-bold">{timer.name}</div>
        {showControls && (
          <div className={cn('text-[11px] font-bold', timer.type === 'stopwatch' ? 'text-emerald-600' : 'text-amber-500')}>
            {timer.type === 'stopwatch' ? '正计时' : '倒计时'}
          </div>
        )}
      </div>

      <div className="mt-2 text-center font-mono text-3xl font-black tracking-tight">{formatDuration(displayMs(timer))}</div>

      <AnimatePresence initial={false}>
        {showControls && (
          <motion.div
            className="mt-2 flex justify-center gap-2"
            style={noDragStyle}
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {timer.status === 'running' ? (
              <button className={`rounded-full bg-blue-600 p-2 text-white shadow-sm hover:bg-blue-700 ${smoothButton}`} onClick={() => pauseTimer(timer.id)} title="暂停">
                <Pause size={15} />
              </button>
            ) : (
              <button className={`rounded-full bg-blue-600 p-2 text-white shadow-sm hover:bg-blue-700 ${smoothButton}`} onClick={() => startTimer(timer.id)} title="开始">
                <Play size={15} />
              </button>
            )}
            <button className={`rounded-full border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50 ${smoothButton}`} onClick={() => resetTimer(timer.id)} title="重置">
              <RotateCcw size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default TimerFloatingPage
