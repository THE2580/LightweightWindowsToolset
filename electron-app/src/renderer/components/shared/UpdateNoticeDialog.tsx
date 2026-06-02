import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleAlert, Download, ExternalLink, RefreshCw, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/stores/settingsStore'

function UpdateNoticeDialog(): React.JSX.Element {
  const showUpdateNotification = useSettingsStore((state) => state.showUpdateNotification)
  const navigate = useNavigate()
  const [notice, setNotice] = useState<UpdateState | null>(null)
  const lastNoticeKey = useRef('')

  useEffect(() => {
    return window.api.updater.onState((state) => {
      if (state.phase === 'checking') {
        lastNoticeKey.current = ''
        return
      }
      const isManualResult = state.checkSource === 'manual'
        && (state.phase === 'available' || state.phase === 'up-to-date' || state.phase === 'error')
      const isAutoUpdateAvailable = state.checkSource === 'auto'
        && state.phase === 'available'
        && showUpdateNotification
      if (!isManualResult && !isAutoUpdateAvailable) return

      const key = `${state.checkSource}:${state.phase}:${state.info?.latestVersion || ''}:${state.message}`
      if (lastNoticeKey.current === key) return
      lastNoticeKey.current = key
      setNotice(state)
    })
  }, [showUpdateNotification])

  const close = (): void => setNotice(null)
  const openRelease = (): void => {
    window.api.updater.openRelease()
    close()
  }
  const openUpdater = (): void => {
    navigate('/settings?tab=about')
    close()
  }

  const isAvailable = notice?.phase === 'available'
  const isLatest = notice?.phase === 'up-to-date'

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/25 px-5 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="软件更新提示"
            className="w-full max-w-[390px] overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-border/70 bg-muted/35 px-4 py-3.5">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
                {isAvailable ? <Sparkles size={17} /> : isLatest ? <CheckCircle2 size={17} /> : <CircleAlert size={17} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {isAvailable ? `发现新版本 v${notice.info?.latestVersion}` : isLatest ? '当前已经是最新版本' : '检查更新失败'}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {isAvailable ? `当前版本 v${notice.currentVersion}，建议更新以获得最新改进。` : notice.message}
                </p>
              </div>
              <button className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={close} aria-label="关闭">
                <X size={15} />
              </button>
            </div>

            {isAvailable && (
              <div className="px-4 py-3">
                <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">更新日志</p>
                <div className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-border/70 bg-muted/25 px-3 py-2 text-[11px] leading-5 text-foreground/85">
                  {notice.info?.releaseNotes.trim() || '本次 Release 暂未填写更新日志。'}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 px-4 pb-4 pt-3">
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={close}>
                {isAvailable ? '稍后处理' : '知道了'}
              </Button>
              {isAvailable && (
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={openRelease}>
                  <ExternalLink size={12} />查看 Release
                </Button>
              )}
              {isAvailable && (
                <Button size="sm" className="h-7 px-2.5 text-xs" onClick={openUpdater}>
                  <Download size={12} />前往更新
                </Button>
              )}
              {notice.phase === 'error' && (
                <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => { close(); window.api.updater.check() }}>
                  <RefreshCw size={12} />重新检查
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default UpdateNoticeDialog
