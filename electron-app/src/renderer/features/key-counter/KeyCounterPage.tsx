import { useEffect, useMemo, useState } from 'react'
import { Keyboard, MousePointer2, Activity } from 'lucide-react'
import AnimatedRoute from '@/components/shared/AnimatedRoute'
import { useKeyStatsStore } from '@/stores/keyStatsStore'
import { cn } from '@/lib/utils'

type ViewMode = 'day' | 'month' | 'year'
type Counts = Record<string, number>

interface Bucket {
  id: string
  label: string
  counts: Counts
}

const LINE_COLORS = ['#2563EB', '#D97706', '#059669', '#E11D48']
const MOUSE_KEYS = new Set(['鼠标左键', '鼠标右键', '鼠标中键'])
const HOVER_CARD = 'transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-blue-400/80 hover:shadow-md'
const KEYBOARD_ROWS = [
  ['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['CapsLock', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  ['Ctrl', 'Win', 'Alt', 'Space', 'Alt', 'Win', 'Ctrl', '←', '↑', '↓', '→'],
]
const WIDE_KEYS: Record<string, string> = {
  Backspace: 'flex-[1.7]',
  Tab: 'flex-[1.35]',
  CapsLock: 'flex-[1.65]',
  Enter: 'flex-[1.75]',
  Shift: 'flex-[2]',
  Space: 'flex-[5]',
  Ctrl: 'flex-[1.25]',
  Win: 'flex-[1.2]',
  Alt: 'flex-[1.2]',
}
const NUMPAD_KEYS = [
  { name: 'NumLock', label: 'Lock' }, { name: 'Num/', label: '/' }, { name: 'Num*', label: '*' }, { name: 'Num-', label: '-' },
  { name: 'Num7', label: '7' }, { name: 'Num8', label: '8' }, { name: 'Num9', label: '9' }, { name: 'Num+', label: '+', className: 'row-span-2' },
  { name: 'Num4', label: '4' }, { name: 'Num5', label: '5' }, { name: 'Num6', label: '6' },
  { name: 'Num1', label: '1' }, { name: 'Num2', label: '2' }, { name: 'Num3', label: '3' }, { name: 'NumEnter', label: '↵', className: 'row-span-2 text-[11px]' },
  { name: 'Num0', label: '0', className: 'col-span-2' }, { name: 'Num.', label: '.' },
]

function sumCounts(counts: Counts): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0)
}

function mergeCounts(target: Counts, source: Counts): void {
  for (const [key, value] of Object.entries(source)) target[key] = (target[key] || 0) + value
}

function localDay(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toLocaleDateString('en-CA')
}

function monthId(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function createBuckets(days: Record<string, Counts>, mode: ViewMode): Bucket[] {
  if (mode === 'day') {
    return Array.from({ length: 30 }, (_, index) => {
      const id = localDay(index - 29)
      return { id, label: id.slice(5), counts: days[id] || {} }
    })
  }
  if (mode === 'month') {
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date()
      date.setMonth(date.getMonth() + index - 11, 1)
      const id = monthId(date)
      const counts: Counts = {}
      for (const [day, values] of Object.entries(days)) if (day.startsWith(id)) mergeCounts(counts, values)
      return { id, label: id.slice(2), counts }
    })
  }
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, index) => {
    const id = String(currentYear + index - 4)
    const counts: Counts = {}
    for (const [day, values] of Object.entries(days)) if (day.startsWith(id)) mergeCounts(counts, values)
    return { id, label: id, counts }
  })
}

function TrendChart({ buckets, keys }: { buckets: Bucket[]; keys: string[] }): React.JSX.Element {
  const width = 470
  const height = 142
  const pad = { left: 32, right: 8, top: 10, bottom: 23 }
  const max = Math.max(1, ...buckets.flatMap((bucket) => keys.map((key) => bucket.counts[key] || 0)))
  const x = (index: number): number => pad.left + index * ((width - pad.left - pad.right) / Math.max(1, buckets.length - 1))
  const y = (value: number): number => pad.top + (height - pad.top - pad.bottom) * (1 - value / max)
  const labelIndexes = new Set([0, Math.floor((buckets.length - 1) / 2), buckets.length - 1])

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[142px]" role="img" aria-label="按键趋势折线图">
      {[0, 0.5, 1].map((ratio) => (
        <g key={ratio}>
          <line x1={pad.left} x2={width - pad.right} y1={y(max * ratio)} y2={y(max * ratio)} stroke="currentColor" className="text-border" strokeWidth="1" />
          <text x={pad.left - 5} y={y(max * ratio) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{Math.round(max * ratio)}</text>
        </g>
      ))}
      {buckets.map((bucket, index) => labelIndexes.has(index) && (
        <text key={bucket.id} x={x(index)} y={height - 4} textAnchor={index === 0 ? 'start' : index === buckets.length - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[10px]">
          {bucket.label}
        </text>
      ))}
      {keys.map((key, keyIndex) => {
        const points = buckets.map((bucket, index) => `${x(index)},${y(bucket.counts[key] || 0)}`).join(' ')
        return <polyline key={key} points={points} fill="none" stroke={LINE_COLORS[keyIndex]} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      })}
    </svg>
  )
}

function VisualKey({ name, label = name, count, isTop, className }: { name: string; label?: string; count: number; isTop: boolean; className?: string }): React.JSX.Element {
  return (
    <span
      title={`${name}: ${count.toLocaleString()} 次`}
      className={cn(
        'flex min-w-0 flex-1 items-center justify-center rounded border px-0.5 py-1 text-[8px] font-mono',
        'transition-[border-color,box-shadow,color,background-color] duration-150 hover:shadow-sm',
        isTop
          ? 'border-blue-700 bg-blue-600 text-white shadow-sm hover:border-blue-800 hover:bg-blue-700 hover:text-white dark:border-blue-400 dark:bg-blue-600 dark:text-white'
          : count > 0
            ? 'border-blue-400 bg-blue-100 text-blue-800 hover:border-blue-500 hover:bg-blue-200 dark:border-blue-600 dark:bg-blue-900/65 dark:text-blue-100 dark:hover:bg-blue-900'
            : 'border-border bg-background text-muted-foreground hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40 dark:hover:text-blue-300',
        WIDE_KEYS[name],
        className
      )}
    >
      {label}
    </span>
  )
}

function InputHeatmap({ counts, topKeys }: { counts: Counts; topKeys: Set<string> }): React.JSX.Element {
  const mouseClass = (key: string): string => cn(
    'border transition-[border-color,box-shadow,background-color] duration-150 hover:shadow-sm',
    topKeys.has(key)
      ? 'border-blue-700 bg-blue-600 hover:border-blue-800 hover:bg-blue-700 dark:border-blue-400 dark:bg-blue-600'
      : (counts[key] || 0) > 0
        ? 'border-blue-400 bg-blue-100 hover:border-blue-500 hover:bg-blue-200 dark:border-blue-600 dark:bg-blue-900/65 dark:hover:bg-blue-900'
        : 'border-border bg-muted/60 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
  )

  return (
    <section className={cn('rounded-md border border-border bg-card px-2 py-2', HOVER_CARD)}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium">键鼠可视化</span>
        <span className="text-[9px] text-muted-foreground">悬浮按键查看次数</span>
      </div>
      <div className="space-y-2">
        <div className="min-w-0 space-y-1">
          {KEYBOARD_ROWS.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-1">
              {row.map((key, keyIndex) => <VisualKey key={`${key}-${keyIndex}`} name={key} count={counts[key] || 0} isTop={topKeys.has(key)} />)}
            </div>
          ))}
        </div>
        <div className="flex items-start justify-end gap-2 border-t border-border/60 pt-2">
          <span className="mr-auto text-[9px] text-muted-foreground">小键盘与鼠标</span>
          <div className="grid w-[150px] grid-cols-4 auto-rows-[21px] gap-1">
            {NUMPAD_KEYS.map(({ name, label, className }) => (
              <VisualKey key={name} name={name} label={label} count={counts[name] || 0} isTop={topKeys.has(name)} className={className} />
            ))}
          </div>
          <div className="w-[52px] shrink-0 rounded-[16px] border border-border bg-background p-1.5">
            <div className="grid h-[36px] grid-cols-2 gap-1">
              {['鼠标左键', '鼠标右键'].map((key) => (
                <div key={key} title={`${key}: ${(counts[key] || 0).toLocaleString()} 次`} className={cn('rounded-t-[10px]', mouseClass(key))} />
              ))}
            </div>
            <div className="flex justify-center">
              <div title={`鼠标中键: ${(counts['鼠标中键'] || 0).toLocaleString()} 次`} className={cn('mt-1 h-5 w-2 rounded-full', mouseClass('鼠标中键'))} />
            </div>
            <div className="mx-auto mt-1 h-5 w-8 rounded-b-[12px] border-x border-b border-border" />
          </div>
        </div>
      </div>
    </section>
  )
}

function KeyCounterPage(): React.JSX.Element {
  const snapshot = useKeyStatsStore((state) => state.snapshot)
  const isRunning = useKeyStatsStore((state) => state.isRunning)
  const refresh = useKeyStatsStore((state) => state.refresh)
  const [mode, setMode] = useState<ViewMode>('day')

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 2000)
    return () => clearInterval(interval)
  }, [refresh])

  const todayCounts = snapshot.days[snapshot.today] || {}
  const todayTotal = sumCounts(todayCounts)
  const todayMouse = Object.entries(todayCounts).reduce((sum, [key, value]) => sum + (MOUSE_KEYS.has(key) ? value : 0), 0)
  const todayKeyboard = todayTotal - todayMouse

  const buckets = useMemo(() => createBuckets(snapshot.days, mode), [snapshot.days, mode])
  const rankings = useMemo(() => {
    const counts: Counts = {}
    for (const bucket of buckets) mergeCounts(counts, bucket.counts)
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [buckets])
  const chartKeys = rankings.slice(0, 4).map(([key]) => key)
  const topKeys = useMemo(() => new Set(rankings.map(([key]) => key)), [rankings])

  return (
    <AnimatedRoute>
      <div className="h-full overflow-y-auto pr-1 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">今日按键统计</h1>
            <p className={cn('text-[10px] mt-0.5', isRunning ? 'text-green-600' : 'text-red-500')}>
              {isRunning ? '正在后台统计键盘与鼠标按键' : '统计进程未运行'}
            </p>
          </div>
          <div className="flex rounded-md bg-muted p-0.5">
            {(['day', 'month', 'year'] as const).map((value) => (
              <button key={value} onClick={() => setMode(value)} className={cn('px-2.5 py-1 rounded text-[11px] transition-colors', mode === value ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {value === 'day' ? '日' : value === 'month' ? '月' : '年'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '今日总计', value: todayTotal, icon: Activity },
            { label: '键盘', value: todayKeyboard, icon: Keyboard },
            { label: '鼠标', value: todayMouse, icon: MousePointer2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className={cn('rounded-md border border-border bg-card px-3 py-2', HOVER_CARD)}>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon size={11} />{label}</div>
              <p className="mt-1 text-lg font-semibold font-mono">{value.toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_150px] gap-3">
          <section className={cn('rounded-md border border-border bg-card px-2 py-2', HOVER_CARD)}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">热门按键趋势</span>
              <div className="flex gap-2">
                {chartKeys.map((key, index) => (
                  <span key={key} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LINE_COLORS[index] }} />{key}
                  </span>
                ))}
              </div>
            </div>
            {chartKeys.length > 0 ? <TrendChart buckets={buckets} keys={chartKeys} /> : <div className="h-[142px] flex items-center justify-center text-xs text-muted-foreground">暂无统计数据</div>}
          </section>

          <section className={cn('rounded-md border border-border bg-card px-2 py-2 overflow-hidden', HOVER_CARD)}>
            <p className="text-xs font-medium mb-1.5">按键排行 TOP 20</p>
            <div className="space-y-1 overflow-y-auto max-h-[155px] pr-1">
              {rankings.length > 0 ? rankings.map(([key, value], index) => (
                <div key={key} className="flex items-center justify-between gap-1 text-[10px]">
                  <span className="truncate"><span className="text-muted-foreground mr-1">{index + 1}.</span>{key}</span>
                  <span className="font-mono text-muted-foreground">{value.toLocaleString()}</span>
                </div>
              )) : <p className="text-[10px] text-muted-foreground">暂无数据</p>}
            </div>
          </section>
        </div>

        <InputHeatmap counts={todayCounts} topKeys={topKeys} />
      </div>
    </AnimatedRoute>
  )
}

export default KeyCounterPage
