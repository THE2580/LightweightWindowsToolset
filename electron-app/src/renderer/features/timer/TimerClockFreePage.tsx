import { type CSSProperties, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimerStore } from '@/stores/timerStore'

type DragStyle = CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag'
}

const dragStyle: DragStyle = { WebkitAppRegion: 'drag' }
const noDragStyle: DragStyle = { WebkitAppRegion: 'no-drag' }
const smoothButton = 'transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/35'

function useClockNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const handle = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(handle)
  }, [])

  return now
}

function TimerClockFreePage(): React.JSX.Element {
  const closeClock = useTimerStore((s) => s.closeClock)
  const now = useClockNow()
  const time = now.toLocaleTimeString('zh-CN', { hour12: false })
  const date = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  })

  return (
    <div
      className="flex h-screen w-screen select-none flex-col overflow-hidden bg-white text-slate-950"
      style={noDragStyle}
    >
      <header className="flex h-[clamp(2.25rem,5vh,3.75rem)] shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/80 px-[clamp(0.75rem,2vw,1.5rem)]" style={dragStyle}>
        <div className="min-w-0 truncate text-[clamp(0.875rem,1.5vw,1.35rem)] font-semibold">本地时间</div>
        <div className="flex items-center gap-2" style={noDragStyle}>
          <span className="rounded-full bg-sky-50 px-[clamp(0.5rem,1vw,0.8rem)] py-0.5 text-[clamp(0.7rem,1.1vw,1rem)] font-medium text-sky-700">
            时钟
          </span>
          <button className={cn('rounded-md p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900', smoothButton)} onClick={closeClock} title="关闭时钟窗口">
            <X className="size-[clamp(0.95rem,1.4vw,1.35rem)]" />
          </button>
        </div>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden px-[clamp(1rem,4vw,4rem)] py-[clamp(1rem,4vh,3rem)]">
        <div className="absolute left-1/2 top-1/2 w-full max-w-[min(86vw,72rem)] -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="absolute left-0 right-0 top-[calc(-1*clamp(2.4rem,8vh,5.5rem))] text-[clamp(0.85rem,1.4vw,1.2rem)] text-slate-500">
            {date}
          </div>
          <div className="font-mono text-[min(14vw,34vh)] font-black leading-none tracking-tight tabular-nums">
            {time}
          </div>
        </div>
      </main>
    </div>
  )
}

export default TimerClockFreePage
