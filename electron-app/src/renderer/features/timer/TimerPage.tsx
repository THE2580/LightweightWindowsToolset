import { type MouseEvent, type PointerEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion'
import {
  Bell,
  BellOff,
  Clock3,
  Maximize2,
  MonitorUp,
  Pause,
  Play,
  Plus,
  GripVertical,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react'
import AnimatedRoute from '@/components/shared/AnimatedRoute'
import { cn } from '@/lib/utils'
import { useTimerStore } from '@/stores/timerStore'

const SMOOTH_BUTTON = 'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/35'
const HOVER_CARD = 'transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-400/80 hover:shadow-md'
const ICON_BUTTON = cn('rounded-md border p-2', SMOOTH_BUTTON)
const LAYOUT_TRANSITION = { type: 'spring', stiffness: 520, damping: 44, mass: 0.8 } as const
const DRAG_TRANSITION = { type: 'spring', stiffness: 640, damping: 46, mass: 0.7 } as const
const MAX_TIMERS = 20
const MAX_NAME_LENGTH = 24
const MAX_COUNTDOWN_MS = 99 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000

type DialogMode = 'create' | 'edit'

interface TimerFormState {
  name: string
  note: string
  type: TimerType
  hours: string
  minutes: string
  seconds: string
  notifyOnFinish: boolean
}

function formatDuration(ms: number, type: TimerType = 'stopwatch'): string {
  const totalSeconds = Math.max(0, type === 'countdown' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function statusLabel(status: TimerStatus): string {
  if (status === 'running') return '运行中'
  if (status === 'paused') return '暂停'
  if (status === 'finished') return '已结束'
  return '未开始'
}

function typeLabel(type: TimerType): string {
  return type === 'stopwatch' ? '正计时' : '倒计时'
}

function durationFromForm(form: TimerFormState): number {
  const hours = Number.parseInt(form.hours || '0', 10)
  const minutes = Number.parseInt(form.minutes || '0', 10)
  const seconds = Number.parseInt(form.seconds || '0', 10)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0
  return (hours * 3600 + minutes * 60 + seconds) * 1000
}

function splitDuration(ms: number): Pick<TimerFormState, 'hours' | 'minutes' | 'seconds'> {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  return {
    hours: String(Math.floor(totalSeconds / 3600)),
    minutes: String(Math.floor((totalSeconds % 3600) / 60)),
    seconds: String(totalSeconds % 60)
  }
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

function useLocalClock(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const handle = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(handle)
  }, [])

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

function cardStateClass(status: TimerStatus): string {
  if (status === 'running') return 'border-blue-400/80 bg-blue-50/45 shadow-blue-100/70'
  if (status === 'paused') return 'border-amber-300/80 bg-amber-50/45 shadow-amber-100/60'
  return 'border-border bg-card'
}

function statusBadgeClass(status: TimerStatus): string {
  if (status === 'running') return 'bg-blue-100 text-blue-700'
  if (status === 'paused') return 'bg-amber-100 text-amber-700'
  if (status === 'finished') return 'bg-slate-200 text-slate-700'
  return 'bg-muted text-muted-foreground'
}

function sortTimers(timers: TimerItem[]): TimerItem[] {
  return [...timers].sort((a, b) => {
    if (a.status === 'running' && b.status !== 'running') return -1
    if (a.status !== 'running' && b.status === 'running') return 1
    return a.order - b.order || a.createdAt - b.createdAt
  })
}

const baseForm: TimerFormState = {
  name: '',
  note: '',
  type: 'stopwatch',
  hours: '0',
  minutes: '25',
  seconds: '0',
  notifyOnFinish: true
}

function TimerDialog({
  mode,
  timer,
  onClose
}: {
  mode: DialogMode
  timer: TimerItem | null
  onClose: () => void
}): React.JSX.Element {
  const createTimer = useTimerStore((s) => s.createTimer)
  const updateTimer = useTimerStore((s) => s.updateTimer)
  const [visible, setVisible] = useState(true)
  const [form, setForm] = useState<TimerFormState>(() => {
    if (!timer) return baseForm
    return {
      name: timer.name,
      note: timer.note,
      type: timer.type,
      ...splitDuration(timer.totalMs),
      notifyOnFinish: timer.notifyOnFinish
    }
  })
  const [error, setError] = useState('')

  const canEditDuration = mode === 'create' || (timer?.type === 'countdown' && timer.status !== 'running')

  const closeWithAnimation = (): void => {
    setVisible(false)
    window.setTimeout(onClose, 180)
  }

  const adjustDurationField = (key: 'hours' | 'minutes' | 'seconds', delta: number): void => {
    setForm((prev) => {
      const max = key === 'hours' ? 99 : 59
      const current = Number.parseInt(prev[key] || '0', 10)
      const next = Math.max(0, Math.min(max, (Number.isFinite(current) ? current : 0) + delta))
      return { ...prev, [key]: String(next) }
    })
  }

  const handleSubmit = async (): Promise<void> => {
    const name = form.name.trim()
    const totalMs = durationFromForm(form)
    if (!name) {
      setError('请输入计时器名称')
      return
    }
    if (name.length > MAX_NAME_LENGTH) {
      setError(`名称最多 ${MAX_NAME_LENGTH} 个字符`)
      return
    }
    if (form.type === 'countdown' && totalMs <= 0) {
      setError('倒计时需要大于 0 秒')
      return
    }
    if (totalMs > MAX_COUNTDOWN_MS) {
      setError('倒计时最长 99:59:59')
      return
    }

    try {
      if (mode === 'create') {
        await createTimer({
          name,
          note: form.note,
          type: form.type,
          totalMs: form.type === 'countdown' ? totalMs : 0,
          notifyOnFinish: form.type === 'countdown' ? form.notifyOnFinish : false
        })
      } else if (timer) {
        await updateTimer(timer.id, {
          name,
          note: form.note,
          totalMs: timer.type === 'countdown' && canEditDuration ? totalMs : undefined,
          notifyOnFinish: timer.type === 'countdown' ? form.notifyOnFinish : false
        })
      }
      closeWithAnimation()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  return createPortal(
    <AnimatePresence>
      {visible && (
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/25 px-5 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={closeWithAnimation}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={mode === 'create' ? '添加计时器' : '编辑计时器'}
          className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/70 bg-muted/35 px-4 py-3.5">
            <div>
              <h3 className="text-base font-semibold">{mode === 'create' ? '添加计时器' : '编辑计时器'}</h3>
              <p className="mt-1 text-xs text-muted-foreground">名称允许重复，软件内部会使用唯一 ID 管理。</p>
            </div>
            <button className={cn('rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground', SMOOTH_BUTTON)} onClick={closeWithAnimation}>
              <X size={16} />
            </button>
          </div>
          <div className="p-4">
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">名称</span>
            <input
              value={form.name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 outline-none transition-colors focus:border-blue-400"
              placeholder="例如 工作、煮面、休息"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">备注</span>
            <textarea
              value={form.note}
              maxLength={120}
              rows={2}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 outline-none transition-colors focus:border-blue-400"
              placeholder="可选，例如用途、提醒内容或上下文"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            {(['stopwatch', 'countdown'] as TimerType[]).map((type) => (
              <button
                key={type}
                type="button"
                disabled={mode === 'edit'}
                onClick={() => setForm((prev) => ({ ...prev, type }))}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60',
                  SMOOTH_BUTTON,
                  form.type === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border bg-background hover:border-blue-300'
                )}
              >
                {typeLabel(type)}
              </button>
            ))}
          </div>

          {form.type === 'countdown' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['hours', '小时'],
                  ['minutes', '分钟'],
                  ['seconds', '秒']
                ].map(([key, label]) => (
                  <label key={key} className="block text-sm">
                    <span className="mb-1 block text-muted-foreground">{label}</span>
                    <input
                      value={form[key as keyof TimerFormState] as string}
                      disabled={!canEditDuration}
                      inputMode="numeric"
                      onChange={(event) => {
                        const value = event.target.value.replace(/\D/g, '').slice(0, 2)
                        setForm((prev) => ({ ...prev, [key]: value }))
                      }}
                      onWheel={(event) => {
                        if (!canEditDuration) return
                        event.currentTarget.blur()
                        adjustDurationField(key as 'hours' | 'minutes' | 'seconds', event.deltaY < 0 ? 1 : -1)
                      }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 outline-none transition-colors focus:border-blue-400 disabled:opacity-60"
                    />
                  </label>
                ))}
              </div>
              <label className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm">
                <span>结束时发送系统通知</span>
                <input
                  type="checkbox"
                  checked={form.notifyOnFinish}
                  onChange={(event) => setForm((prev) => ({ ...prev, notifyOnFinish: event.target.checked }))}
                />
              </label>
            </>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button className={cn('rounded-md border border-border px-4 py-2 text-sm hover:bg-accent', SMOOTH_BUTTON)} onClick={closeWithAnimation}>
            取消
          </button>
          <button className={cn('rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700', SMOOTH_BUTTON)} onClick={handleSubmit}>
            保存
          </button>
        </div>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

function ConfirmDeleteDialog({
  onCancel,
  onConfirm
}: {
  onCancel: () => void
  onConfirm: () => void
}): React.JSX.Element {
  const [visible, setVisible] = useState(true)
  const closeWithAnimation = (): void => {
    setVisible(false)
    window.setTimeout(onCancel, 180)
  }

  return createPortal(
    <AnimatePresence>
      {visible && (
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/25 px-5 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={closeWithAnimation}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="删除计时器"
          className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-border/70 bg-muted/35 px-4 py-3.5">
            <h3 className="text-base font-semibold">删除计时器？</h3>
            <p className="mt-1 text-xs text-muted-foreground">这会同时关闭它的悬浮窗口。</p>
          </div>
          <div className="flex justify-end gap-2 px-4 py-4">
            <button className={cn('rounded-md border border-border px-4 py-2 text-sm hover:bg-accent', SMOOTH_BUTTON)} onClick={closeWithAnimation}>
              取消
            </button>
            <button className={cn('rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700', SMOOTH_BUTTON)} onClick={onConfirm}>
              删除
            </button>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

function TimerCard({
  timer,
  now,
  isDragging,
  dragConstraints,
  onDragStart,
  onDragEnd,
  shouldSuppressClick
}: {
  timer: TimerItem
  now: number
  isDragging: boolean
  dragConstraints: RefObject<HTMLElement | null>
  onDragStart: (id: string) => void
  onDragEnd: () => void
  shouldSuppressClick: () => boolean
}): React.JSX.Element {
  const startTimer = useTimerStore((s) => s.startTimer)
  const pauseTimer = useTimerStore((s) => s.pauseTimer)
  const resetTimer = useTimerStore((s) => s.resetTimer)
  const updateTimer = useTimerStore((s) => s.updateTimer)
  const openFloating = useTimerStore((s) => s.openFloating)
  const closeFloating = useTimerStore((s) => s.closeFloating)
  const openFree = useTimerStore((s) => s.openFree)
  const closeFree = useTimerStore((s) => s.closeFree)
  const floatingIds = useTimerStore((s) => s.floatingIds)
  const freeIds = useTimerStore((s) => s.freeIds)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteTimer = useTimerStore((s) => s.deleteTimer)
  const isFloating = floatingIds.has(timer.id)
  const isFree = freeIds.has(timer.id)
  const isRunning = timer.status === 'running'
  const showReset = timer.status === 'running' || timer.status === 'paused'
  const canEdit = !isRunning
  const dragControls = useDragControls()

  const handleCardClick = (): void => {
    if (shouldSuppressClick()) return
    if (editing || confirmDelete) return
    if (canEdit) setEditing(true)
  }

  const stopClick = (event: MouseEvent): void => {
    event.stopPropagation()
  }

  const startDrag = (event: PointerEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    dragControls.start(event)
  }

  return (
    <Reorder.Item
      value={timer.id}
      layout
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={dragConstraints}
      dragElastic={0.02}
      dragMomentum={false}
      transition={isDragging ? DRAG_TRANSITION : LAYOUT_TRANSITION}
      className={cn('relative list-none', isDragging ? 'z-20' : 'z-0')}
      onDragStart={() => onDragStart(timer.id)}
      onDragEnd={onDragEnd}
    >
      <div
        className={cn(
          'group relative rounded-xl border p-4 will-change-transform transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 ease-out hover:border-blue-400/80 hover:shadow-md',
          isDragging ? 'bg-background/65 shadow-2xl backdrop-blur-md' : cardStateClass(timer.status),
          canEdit ? 'cursor-pointer' : 'cursor-default'
        )}
        onClick={handleCardClick}
        title={timer.note || (canEdit ? '点击编辑计时器' : undefined)}
      >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            className="cursor-grab rounded-md p-1 text-muted-foreground"
            onPointerDown={startDrag}
            onClick={stopClick}
            title="拖拽排序"
          >
            <GripVertical size={17} />
          </button>
          <h3 className="truncate text-base font-semibold">{timer.name}</h3>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', timer.type === 'stopwatch' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
            {typeLabel(timer.type)}
          </span>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium', statusBadgeClass(timer.status))}>{statusLabel(timer.status)}</span>
        </div>
        {timer.type === 'countdown' && (
          <button
            className={cn(ICON_BUTTON, 'shrink-0 border-border text-muted-foreground hover:border-blue-300 hover:text-blue-600')}
            title={timer.notifyOnFinish ? '已开启结束通知' : '已关闭结束通知'}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              stopClick(event)
              updateTimer(timer.id, { notifyOnFinish: !timer.notifyOnFinish })
            }}
          >
            {timer.notifyOnFinish ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block w-[9.5ch] font-mono text-3xl font-semibold tracking-tight tabular-nums">{formatDuration(displayMs(timer, now), timer.type)}</span>
          {timer.type === 'countdown' && <span className="ml-2 align-middle text-xs text-muted-foreground">原始 {formatDuration(timer.totalMs, timer.type)}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-2" onPointerDown={(event) => event.stopPropagation()} onClick={stopClick}>
        {timer.status === 'running' ? (
          <button className={cn(ICON_BUTTON, 'border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700')} onClick={() => pauseTimer(timer.id)} title="暂停">
            <Pause size={18} />
          </button>
        ) : (
          <button className={cn(ICON_BUTTON, 'border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700')} onClick={() => startTimer(timer.id)} title="开始">
            <Play size={18} />
          </button>
        )}
        {showReset && (
          <button className={cn(ICON_BUTTON, 'border-border hover:bg-accent')} onClick={() => resetTimer(timer.id)} title="重置">
            <RotateCcw size={18} />
          </button>
        )}
        <button
          className={cn(ICON_BUTTON, isFloating ? 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100' : 'border-border hover:bg-accent')}
          onClick={() => (isFloating ? closeFloating(timer.id) : openFloating(timer.id))}
          title={isFloating ? '关闭悬浮' : '悬浮显示'}
        >
          <MonitorUp size={18} />
        </button>
        <button
          className={cn(ICON_BUTTON, isFree ? 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100' : 'border-border hover:bg-accent')}
          onClick={() => (isFree ? closeFree(timer.id) : openFree(timer.id))}
          title={isFree ? '关闭自由窗口' : '自由窗口'}
        >
          <Maximize2 size={18} />
        </button>
        {!isRunning && (
          <button className={cn(ICON_BUTTON, 'border-red-200 text-red-600 hover:bg-red-50')} onClick={() => setConfirmDelete(true)} title="删除">
            <Trash2 size={18} />
          </button>
        )}
        </div>
      </div>

      {editing && <TimerDialog mode="edit" timer={timer} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <ConfirmDeleteDialog
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            deleteTimer(timer.id)
            setConfirmDelete(false)
          }}
        />
      )}
      </div>
    </Reorder.Item>
  )
}

function TimerPage(): React.JSX.Element {
  const timers = useTimerStore((s) => s.timers)
  const loaded = useTimerStore((s) => s.loaded)
  const load = useTimerStore((s) => s.load)
  const listen = useTimerStore((s) => s.listen)
  const pauseAll = useTimerStore((s) => s.pauseAll)
  const closeAllFloating = useTimerStore((s) => s.closeAllFloating)
  const closeAllFree = useTimerStore((s) => s.closeAllFree)
  const toggleClock = useTimerStore((s) => s.toggleClock)
  const resetPaused = useTimerStore((s) => s.resetPaused)
  const reorderTimers = useTimerStore((s) => s.reorderTimers)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [statsVisible, setStatsVisible] = useState(true)
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const orderedIdsRef = useRef<string[]>([])
  const visibleIdsRef = useRef<string[]>([])
  const suppressClickRef = useRef(false)
  const listRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    load()
    return listen()
  }, [load, listen])

  const sortedTimers = useMemo(() => sortTimers(timers), [timers])
  const runningCount = timers.filter((timer) => timer.status === 'running').length
  const pausedCount = timers.filter((timer) => timer.status === 'paused').length
  const floatingCount = useTimerStore((s) => s.floatingIds.size)
  const freeCount = useTimerStore((s) => s.freeIds.size)
  const clockOpen = useTimerStore((s) => s.clockOpen)
  const windowCount = floatingCount + freeCount
  const timerById = useMemo(() => new Map(timers.map((timer) => [timer.id, timer])), [timers])
  const visibleIds = sortedTimers.map((timer) => timer.id)
  const now = useNowTicker(timers.some((timer) => timer.status === 'running'))
  const clockNow = useLocalClock()
  const localTime = clockNow.toLocaleTimeString('zh-CN', { hour12: false })
  const localDate = clockNow.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' })
  const orderedTimers = orderedIds
    .map((id) => timerById.get(id))
    .filter((timer): timer is TimerItem => Boolean(timer))

  useEffect(() => {
    visibleIdsRef.current = visibleIds
  }, [visibleIds.join('|')])

  useEffect(() => {
    if (dragging) return
    orderedIdsRef.current = visibleIds
    setOrderedIds(visibleIds)
  }, [dragging, visibleIds.join('|')])

  const handleReorder = (ids: string[]): void => {
    orderedIdsRef.current = ids
    setOrderedIds(ids)
  }

  const handleDragStart = (id: string): void => {
    suppressClickRef.current = true
    setDraggingId(id)
    setDragging(true)
  }

  const handleDragEnd = (): void => {
    const ids = orderedIdsRef.current
    orderedIdsRef.current = ids
    setOrderedIds(ids)
    setDragging(false)
    setDraggingId(null)
    window.requestAnimationFrame(() => {
      reorderTimers(ids)
    })
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 80)
  }

  useEffect(() => {
    if (!dragging) return

    const cancelDrag = (): void => {
      const ids = visibleIdsRef.current
      orderedIdsRef.current = ids
      setOrderedIds(ids)
      setDragging(false)
      setDraggingId(null)
      window.setTimeout(() => {
        suppressClickRef.current = false
      }, 80)
    }

    const handleVisibilityChange = (): void => {
      if (document.hidden) cancelDrag()
    }

    window.addEventListener('blur', cancelDrag)
    window.addEventListener('pagehide', cancelDrag)
    window.addEventListener('pointercancel', cancelDrag)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('blur', cancelDrag)
      window.removeEventListener('pagehide', cancelDrag)
      window.removeEventListener('pointercancel', cancelDrag)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [dragging])

  return (
    <AnimatedRoute>
      <div className="space-y-5 overflow-x-hidden pb-3">
        <header className="sticky top-0 z-30 -mx-5 -mt-5 flex items-center justify-between gap-4 border-b border-border/70 bg-background px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Clock3 className="text-blue-600" size={24} />
              计时器
            </h1>
            <button
              className={cn('whitespace-nowrap rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground', SMOOTH_BUTTON)}
              onClick={() => setStatsVisible((visible) => !visible)}
            >
              {statsVisible ? '隐藏统计卡片' : '显示统计卡片'}
            </button>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <AnimatePresence initial={false} mode="popLayout">
              {runningCount >= 1 && (
                <motion.button
                  key="pause-all"
                  layout
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={LAYOUT_TRANSITION}
                  className={cn('whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent', SMOOTH_BUTTON)}
                  onClick={pauseAll}
                >
                  暂停全部
                </motion.button>
              )}
              {pausedCount >= 1 && (
                <motion.button
                  key="reset-paused"
                  layout
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={LAYOUT_TRANSITION}
                  className={cn('whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent', SMOOTH_BUTTON)}
                  onClick={resetPaused}
                >
                  重置全部
                </motion.button>
              )}
              {windowCount >= 1 && (
                <motion.button
                  key="close-floating"
                  layout
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={LAYOUT_TRANSITION}
                  className={cn('whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent', SMOOTH_BUTTON)}
                  onClick={() => {
                    closeAllFloating()
                    closeAllFree()
                  }}
                >
                  关闭窗口
                </motion.button>
              )}
            </AnimatePresence>
            <button
              disabled={timers.length >= MAX_TIMERS}
              className={cn('whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60', SMOOTH_BUTTON)}
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="mr-1 inline" size={17} />
              添加
            </button>
          </div>
        </header>

        <motion.div layout className="min-w-0 space-y-5 overflow-x-hidden" transition={LAYOUT_TRANSITION}>
          <AnimatePresence initial={false}>
            {statsVisible && (
              <motion.section
                key="timer-stats"
                layout={!dragging}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={LAYOUT_TRANSITION}
                className={cn('overflow-hidden rounded-xl border border-border bg-card px-4 py-2.5', HOVER_CARD)}
              >
                <div className="grid min-h-[3.35rem] grid-cols-3 divide-x divide-border/70">
                  <div className="flex flex-col justify-center pr-4">
                    <p className="text-xs text-muted-foreground">计时器数量</p>
                    <p className="mt-1 text-xl font-semibold">{timers.length}/{MAX_TIMERS}</p>
                  </div>
                  <div className="flex flex-col justify-center px-4">
                    <p className="text-xs text-muted-foreground">运行中</p>
                    <p className="mt-1 text-xl font-semibold text-blue-600">{runningCount}</p>
                  </div>
                  <div className="flex flex-col justify-center pl-4">
                    <p className="text-xs text-muted-foreground">独立窗口</p>
                    <p className="mt-1 text-xl font-semibold">{windowCount}</p>
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <div className="flex justify-end">
            <motion.button
              type="button"
              layout={!dragging}
              transition={LAYOUT_TRANSITION}
              className={cn(
                'w-full max-w-[360px] rounded-xl border bg-card px-5 py-2.5 text-left',
                HOVER_CARD,
                SMOOTH_BUTTON,
                clockOpen ? 'border-blue-400/80 bg-blue-50/45 shadow-blue-100/70' : 'border-border'
              )}
              onClick={toggleClock}
              title={clockOpen ? '关闭本地时间窗口' : '打开本地时间窗口'}
            >
              <div className="flex h-full min-h-[3.35rem] items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">本地时间</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{localDate}</p>
                </div>
                <p className="shrink-0 font-mono text-[1.25rem] font-semibold leading-none tracking-tight tabular-nums text-slate-950">
                  {localTime}
                </p>
              </div>
            </motion.button>
          </div>

          {!loaded ? (
            <motion.section layout transition={LAYOUT_TRANSITION} className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              正在加载计时器...
            </motion.section>
          ) : orderedTimers.length === 0 ? (
            <motion.section layout transition={LAYOUT_TRANSITION} className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <Clock3 className="mx-auto text-muted-foreground" size={36} />
              <h2 className="mt-3 text-lg font-semibold">还没有计时器</h2>
              <p className="mt-1 text-sm text-muted-foreground">添加一个正计时或倒计时后，就能在这里统一管理。</p>
              <button className={cn('mt-4 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700', SMOOTH_BUTTON)} onClick={() => setDialogOpen(true)}>
                添加计时器
              </button>
            </motion.section>
          ) : (
            <Reorder.Group ref={listRef} layout axis="y" values={orderedIds} onReorder={handleReorder} className="flex flex-col gap-3 pb-3">
              {orderedTimers.map((timer) => (
                <TimerCard
                  key={timer.id}
                  timer={timer}
                  now={now}
                  isDragging={draggingId === timer.id}
                  dragConstraints={listRef}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  shouldSuppressClick={() => suppressClickRef.current}
                />
              ))}
            </Reorder.Group>
          )}
        </motion.div>
      </div>
      {dialogOpen && <TimerDialog mode="create" timer={null} onClose={() => setDialogOpen(false)} />}
    </AnimatedRoute>
  )
}

export default TimerPage
