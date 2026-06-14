import { useEffect, useMemo, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, Clock3, Monitor, PauseCircle, Save, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import AnimatedRoute from '@/components/shared/AnimatedRoute'
import Dropdown from '@/components/shared/Dropdown'
import { useAppStatsStore } from '@/stores/appStatsStore'
import { cn } from '@/lib/utils'

type ViewMode = 'day' | 'month' | 'year'
type MappingSort = 'name' | 'duration' | 'unrenamed' | 'renamed'
type AppSeconds = Record<string, number>

interface Bucket {
  id: string
  label: string
  seconds: number
  apps: AppSeconds
}

const AFK_OPTIONS = [60, 180, 300, 600, 900, 1800]
const HOVER_CARD = 'transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-blue-400/80 hover:shadow-md'

function sumApps(apps: AppSeconds): number {
  return Object.values(apps).reduce((sum, value) => sum + value, 0)
}

function mergeApps(target: AppSeconds, source: AppSeconds): void {
  for (const [app, seconds] of Object.entries(source)) target[app] = (target[app] || 0) + seconds
}

function localDay(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toLocaleDateString('en-CA')
}

function monthId(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}小时${minutes > 0 ? `${minutes}分` : ''}`
  if (totalMinutes > 0) return `${totalMinutes}分钟`
  return `${Math.floor(seconds)}秒`
}

function createBuckets(days: Record<string, AppSeconds>, mode: ViewMode): Bucket[] {
  if (mode === 'day') {
    return Array.from({ length: 30 }, (_, index) => {
      const id = localDay(index - 29)
      const apps = days[id] || {}
      return { id, label: id.slice(5), seconds: sumApps(apps), apps }
    })
  }
  if (mode === 'month') {
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date()
      date.setMonth(date.getMonth() + index - 11, 1)
      const id = monthId(date)
      const apps: AppSeconds = {}
      for (const [day, values] of Object.entries(days)) if (day.startsWith(id)) mergeApps(apps, values)
      return { id, label: id.slice(2), seconds: sumApps(apps), apps }
    })
  }
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, index) => {
    const id = String(currentYear + index - 4)
    const apps: AppSeconds = {}
    for (const [day, values] of Object.entries(days)) if (day.startsWith(id)) mergeApps(apps, values)
    return { id, label: id, seconds: sumApps(apps), apps }
  })
}

function appsForCurrentRange(days: Record<string, AppSeconds>, today: string, mode: ViewMode): AppSeconds {
  if (!today) return {}
  if (mode === 'day') return days[today] || {}
  const prefix = mode === 'month' ? today.slice(0, 7) : today.slice(0, 4)
  const apps: AppSeconds = {}
  for (const [day, values] of Object.entries(days)) if (day.startsWith(prefix)) mergeApps(apps, values)
  return apps
}

function TrendChart({ buckets }: { buckets: Bucket[] }): React.JSX.Element {
  const width = 470
  const height = 132
  const pad = { left: 70, right: 8, top: 10, bottom: 23 }
  const max = Math.max(1, ...buckets.map((bucket) => bucket.seconds))
  const x = (index: number): number => pad.left + index * ((width - pad.left - pad.right) / Math.max(1, buckets.length - 1))
  const y = (value: number): number => pad.top + (height - pad.top - pad.bottom) * (1 - value / max)
  const points = buckets.map((bucket, index) => `${x(index)},${y(bucket.seconds)}`).join(' ')
  const labelIndexes = new Set([0, Math.floor((buckets.length - 1) / 2), buckets.length - 1])

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[132px] w-full overflow-visible" role="img" aria-label="软件总使用时长趋势图">
      {[0, 0.5, 1].map((ratio) => (
        <g key={ratio}>
          <line x1={pad.left} x2={width - pad.right} y1={y(max * ratio)} y2={y(max * ratio)} stroke="currentColor" className="text-border" strokeWidth="1" />
          <text x={pad.left - 5} y={y(max * ratio) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{formatDuration(max * ratio)}</text>
        </g>
      ))}
      {buckets.map((bucket, index) => labelIndexes.has(index) && (
        <text key={bucket.id} x={x(index)} y={height - 4} textAnchor={index === 0 ? 'start' : index === buckets.length - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[10px]">
          {bucket.label}
        </text>
      ))}
      <polyline points={points} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function HistorySoftwareMappings({ apps, aliases, onSave }: { apps: [string, number][]; aliases: Record<string, string>; onSave: (processName: string, alias: string) => Promise<void> }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<MappingSort>('duration')

  const draftFor = (processName: string): string => drafts[processName] ?? aliases[processName] ?? ''
  const isSaved = (processName: string): boolean => draftFor(processName).trim() === (aliases[processName] ?? '')
  const sortedApps = useMemo(() => [...apps].sort((a, b) => {
    const [aName, aSeconds] = a
    const [bName, bSeconds] = b
    const aRenamed = Boolean(aliases[aName])
    const bRenamed = Boolean(aliases[bName])
    if (sort === 'name') return (aliases[aName] || aName).localeCompare(aliases[bName] || bName, 'zh-CN')
    if (sort === 'unrenamed' && aRenamed !== bRenamed) return aRenamed ? 1 : -1
    if (sort === 'renamed' && aRenamed !== bRenamed) return aRenamed ? -1 : 1
    return bSeconds - aSeconds || aName.localeCompare(bName, 'zh-CN')
  }), [aliases, apps, sort])

  return (
    <section
      className={cn('rounded-md border border-border bg-card', HOVER_CARD)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget
        if (nextTarget instanceof Element && nextTarget.closest('[data-dropdown-portal="true"]')) return
        if (!event.currentTarget.contains(nextTarget as Node | null)) setExpanded(false)
      }}
    >
      <button onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between px-3 py-2 text-left">
        <div>
          <p className="text-xs font-medium">历史软件名称映射</p>
          <p className="text-[10px] text-muted-foreground">将已记录的进程名映射为实际软件名称，共 {apps.length} 项</p>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden border-t border-border"
          >
          <div className="flex items-center justify-between gap-2 px-3 pt-2">
            <span className="text-[10px] text-muted-foreground">排序规则</span>
            <Dropdown
              ariaLabel="历史软件名称映射排序规则"
              value={sort}
              onChange={(value) => setSort(value as MappingSort)}
              options={[
                { id: 'name', label: '名称' },
                { id: 'duration', label: '总使用时长' },
                { id: 'unrenamed', label: '未重命名优先' },
                { id: 'renamed', label: '已重命名优先' },
              ]}
              className="h-6 px-1.5 text-[10px]"
              menuClassName="text-[10px]"
            />
          </div>
          <div className="max-h-[230px] space-y-1.5 overflow-y-auto px-3 py-2">
          {sortedApps.length > 0 ? sortedApps.map(([processName, seconds]) => (
            <div key={processName} className="grid grid-cols-[145px_1fr_auto] items-center gap-2">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-medium" title={processName}>{processName}</p>
                <p className="text-[9px] text-muted-foreground">{formatDuration(seconds)}</p>
              </div>
              <input
                value={draftFor(processName)}
                onChange={(event) => setDrafts((current) => ({ ...current, [processName]: event.target.value.slice(0, 60) }))}
                placeholder="实际软件名称"
                className="h-7 min-w-0 rounded border border-border bg-background px-2 text-[10px] outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
                aria-label={`${processName} 实际软件名称`}
              />
              <button
                onClick={async () => {
                  await onSave(processName, draftFor(processName))
                  setDrafts((current) => {
                    const next = { ...current }
                    delete next[processName]
                    return next
                  })
                }}
                disabled={isSaved(processName)}
                className={cn(
                  'flex h-7 items-center gap-1 rounded border px-2 text-[10px] transition-colors',
                  isSaved(processName)
                    ? 'cursor-default border-border bg-muted/50 text-muted-foreground'
                    : 'border-blue-400 text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                )}
                aria-label={`保存 ${processName} 软件名称`}
              >
                <Save size={11} />{isSaved(processName) ? '已保存' : '未保存'}
              </button>
            </div>
          )) : <p className="text-[10px] text-muted-foreground">暂无历史软件记录</p>}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function AppStatsPage(): React.JSX.Element {
  const snapshot = useAppStatsStore((state) => state.snapshot)
  const isRunning = useAppStatsStore((state) => state.isRunning)
  const refresh = useAppStatsStore((state) => state.refresh)
  const clear = useAppStatsStore((state) => state.clear)
  const setAfkThreshold = useAppStatsStore((state) => state.setAfkThreshold)
  const aliases = useAppStatsStore((state) => state.aliases)
  const loadAliases = useAppStatsStore((state) => state.loadAliases)
  const setAlias = useAppStatsStore((state) => state.setAlias)
  const [mode, setMode] = useState<ViewMode>('day')
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    refresh()
    loadAliases()
    const interval = setInterval(refresh, 2000)
    return () => clearInterval(interval)
  }, [loadAliases, refresh])

  const buckets = useMemo(() => createBuckets(snapshot.days, mode), [snapshot.days, mode])
  const rangeApps = useMemo(() => appsForCurrentRange(snapshot.days, snapshot.today, mode), [mode, snapshot.days, snapshot.today])
  const rangeTotal = sumApps(rangeApps)
  const rankings = useMemo(() => {
    return Object.entries(rangeApps).sort((a, b) => b[1] - a[1]).slice(0, 20)
  }, [rangeApps])
  const maxRankSeconds = Math.max(1, ...rankings.map(([, seconds]) => seconds))
  const historyApps = useMemo(() => {
    const apps: AppSeconds = {}
    for (const values of Object.values(snapshot.days)) mergeApps(apps, values)
    return Object.entries(apps).sort((a, b) => b[1] - a[1])
  }, [snapshot.days])
  const displayName = (processName: string): string => aliases[processName] || processName
  const rangeLabel = mode === 'day' ? '今日' : mode === 'month' ? '本月' : '今年'

  return (
    <AnimatedRoute>
      <div className="scrollbar-hidden h-full space-y-3 overflow-y-auto pr-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">软件使用统计</h1>
            <p className={cn('mt-0.5 text-[10px]', isRunning ? 'text-green-600' : 'text-red-500')}>
              {!isRunning ? '统计进程未运行' : snapshot.isAfk ? '当前处于离开状态，已暂停累计' : `正在统计：${snapshot.activeProcess ? displayName(snapshot.activeProcess) : '等待前台软件'}`
              }
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-md bg-muted p-0.5">
              {(['day', 'month', 'year'] as const).map((value) => (
                <button key={value} onClick={() => setMode(value)} className={cn('rounded px-2 py-1 text-[11px] transition-colors', mode === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {value === 'day' ? '日' : value === 'month' ? '月' : '年'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: `${rangeLabel}总时长`, value: formatDuration(rangeTotal), icon: Clock3 },
            { label: `${rangeLabel}软件数`, value: `${Object.keys(rangeApps).length}`, icon: Monitor },
            { label: '统计状态', value: snapshot.isAfk ? '已暂停' : isRunning ? '进行中' : '未运行', icon: snapshot.isAfk ? PauseCircle : Activity },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className={cn('rounded-md border border-border bg-card px-3 py-2', HOVER_CARD)}>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Icon size={11} />{label}</div>
              <p className="mt-1 truncate text-base font-semibold">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_190px] gap-3">
          <section className={cn('rounded-md border border-border bg-card px-2 py-2', HOVER_CARD)}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium">总使用时长趋势</span>
              <span className="text-[9px] text-muted-foreground">仅本地统计</span>
            </div>
            <TrendChart buckets={buckets} />
          </section>

          <section className={cn('overflow-hidden rounded-md border border-border bg-card px-2 py-2', HOVER_CARD)}>
            <p className="mb-1.5 text-xs font-medium">{rangeLabel}软件排行 TOP 20</p>
            <div className="max-h-[145px] space-y-1.5 overflow-y-auto pr-1">
              {rankings.length > 0 ? rankings.map(([app, seconds], index) => (
                <div key={app} className="text-[10px]">
                  <div className="mb-0.5 flex items-center justify-between gap-1">
                    <span className="truncate" title={aliases[app] ? `${aliases[app]} (${app})` : app}><span className="mr-1 text-muted-foreground">{index + 1}.</span>{displayName(app)}</span>
                    <span className="shrink-0 font-mono text-muted-foreground">{formatDuration(seconds)}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(2, seconds / maxRankSeconds * 100)}%` }} />
                  </div>
                </div>
              )) : <p className="text-[10px] text-muted-foreground">暂无统计数据</p>}
            </div>
          </section>
        </div>

        <section className={cn('flex items-center justify-between rounded-md border border-border bg-card px-3 py-2', HOVER_CARD)}>
          <div>
            <p className="text-xs font-medium">离开状态判定</p>
            <p className="text-[10px] text-muted-foreground">连续无输入达到阈值后暂停累计</p>
          </div>
          <div className="flex rounded-md bg-muted p-0.5">
            {AFK_OPTIONS.map((seconds) => (
              <button
                key={seconds}
                onClick={() => setAfkThreshold(seconds)}
                className={cn(
                  'rounded px-1.5 py-1 text-[10px] transition-colors',
                  snapshot.afkThresholdSec === seconds ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {seconds / 60}分
              </button>
            ))}
          </div>
        </section>

        <section className={cn('flex items-center justify-between rounded-md border border-border bg-card px-3 py-2', HOVER_CARD)}>
          <div>
            <p className="text-xs font-medium">本地数据管理</p>
            <p className="text-[10px] text-muted-foreground">仅记录进程名和累计时长，不记录窗口标题或文件路径</p>
          </div>
          {confirmClear ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setConfirmClear(false)} className="rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted">取消</button>
              <button onClick={() => { clear(); setConfirmClear(false) }} className="rounded bg-red-600 px-2 py-1 text-[10px] text-white hover:bg-red-700">确认清除</button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-[10px] text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">
              <Trash2 size={11} />清除统计
            </button>
          )}
        </section>

        <HistorySoftwareMappings apps={historyApps} aliases={aliases} onSave={setAlias} />
      </div>
    </AnimatedRoute>
  )
}

export default AppStatsPage
