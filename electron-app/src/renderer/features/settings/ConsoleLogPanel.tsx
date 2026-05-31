import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LogEntry {
  id: number
  timestamp: string
  level: 'log' | 'info' | 'warn' | 'error'
  source: 'main' | 'renderer'
  message: string
}

const LEVEL_CLASS: Record<LogEntry['level'], string> = {
  log: 'text-foreground',
  info: 'text-blue-600 dark:text-blue-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
}

function ConsoleLogPanel(): React.JSX.Element {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.logs.get().then(setEntries).catch(() => {})
    const unsubEntry = window.api.logs.onEntry((entry) => {
      setEntries((current) => [...current, entry].slice(-500))
    })
    const unsubClear = window.api.logs.onCleared(() => setEntries([]))
    return () => {
      unsubEntry()
      unsubClear()
    }
  }, [])

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [entries])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">控制台日志</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">保留最近 500 条主进程与页面日志</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => window.api.logs.clear()}>
          <Trash2 size={12} className="mr-1" />清空
        </Button>
      </div>
      <div className="h-[285px] overflow-auto rounded-md border border-border bg-muted/35 p-2 font-mono text-[10px] leading-4">
        {entries.length === 0 ? (
          <p className="text-muted-foreground">暂无日志</p>
        ) : entries.map((entry) => (
          <div key={entry.id} className={cn('whitespace-pre-wrap break-all', LEVEL_CLASS[entry.level])}>
            <span className="text-muted-foreground">
              {new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour12: false })} [{entry.source}] [{entry.level}]
            </span>{' '}
            {entry.message}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}

export default ConsoleLogPanel
