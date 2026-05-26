import { useCaptureStore } from '@/stores/captureStore'

function CaptureHistory(): React.JSX.Element {
  const { todayRecords } = useCaptureStore()

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-8">
      <h3 className="text-sm font-semibold mb-5">今日记录</h3>
      {todayRecords.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">暂无记录</p>
      ) : (
        <div className="space-y-3">
          {todayRecords.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between py-3 px-4 rounded-md bg-muted/50"
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
