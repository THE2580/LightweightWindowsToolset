import { useCaptureStore } from '@/stores/captureStore'

function CaptureHistory(): React.JSX.Element {
  const { todayRecords } = useCaptureStore()

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-sm font-semibold mb-4">今日记录</h3>
      {todayRecords.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">暂无记录</p>
      ) : (
        <div className="space-y-2">
          {todayRecords.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
            >
              <span className="text-sm font-medium">{record.game_name}</span>
              <span className="font-mono text-sm tabular-nums">
                {record.remaining_stamina}/{record.max_stamina}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CaptureHistory
