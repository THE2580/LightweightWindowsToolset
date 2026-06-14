import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { usePluginStore } from '@/stores/pluginStore'
import { useSettingsStore } from '@/stores/settingsStore'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import ChatSidebar from '@/features/ai-chat/ChatSidebar'
import { ChevronRight } from 'lucide-react'

interface AppShellProps {
  children: ReactNode
}

const INTERACTIVE_SELECTOR = 'button, input, select, textarea, a, [role="button"], [contenteditable="true"]'
const AUTO_EXPAND_BLOCK_SELECTOR = '[data-chat-auto-expand-block="true"]'

function AppShell({ children }: AppShellProps): React.JSX.Element {
  const chatOpen = usePluginStore((s) => s.chatOpen)
  const setChatOpen = usePluginStore((s) => s.setChatOpen)
  const toggleChat = usePluginStore((s) => s.toggleChat)
  const chatClickOutsideToClose = useSettingsStore((s) => s.chatClickOutsideToClose)
  const chatAutoExpand = useSettingsStore((s) => s.chatAutoExpand)
  const chatExpandZoneVisible = useSettingsStore((s) => s.chatExpandZoneVisible)
  const zoneW = useSettingsStore((s) => s.chatExpandZoneWidth)
  const zoneH = useSettingsStore((s) => s.chatExpandZoneHeight)
  const chatAutoExpandDelay = useSettingsStore((s) => s.chatAutoExpandDelay)
  const zonePreview = useSettingsStore((s) => s.chatExpandZonePreview)
  const autoExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAutoExpandTimer = (): void => {
    if (!autoExpandTimerRef.current) return
    clearTimeout(autoExpandTimerRef.current)
    autoExpandTimerRef.current = null
  }

  useEffect(() => clearAutoExpandTimer, [])

  const handleBackdropClick = (): void => {
    if (chatClickOutsideToClose) setChatOpen(false)
  }

  const handleShellMouseMove = (event: MouseEvent<HTMLDivElement>): void => {
    if (!chatAutoExpand || chatOpen) {
      clearAutoExpandTimer()
      return
    }

    const target = event.target as HTMLElement
    const activeElement = document.activeElement
    if (target.closest(INTERACTIVE_SELECTOR)) {
      clearAutoExpandTimer()
      return
    }
    if (activeElement instanceof HTMLElement && activeElement.closest(AUTO_EXPAND_BLOCK_SELECTOR)) {
      clearAutoExpandTimer()
      return
    }

    const shell = event.currentTarget
    const bounds = shell.getBoundingClientRect()
    const zoneTop = bounds.top + bounds.height * (100 - previewH) / 200
    const zoneBottom = zoneTop + bounds.height * previewH / 100
    const inExpandZone = event.clientX >= bounds.right - previewW
      && event.clientY >= zoneTop
      && event.clientY <= zoneBottom

    if (!inExpandZone) {
      clearAutoExpandTimer()
      return
    }
    if (autoExpandTimerRef.current) return

    autoExpandTimerRef.current = setTimeout(() => {
      autoExpandTimerRef.current = null
      const focusedElement = document.activeElement
      if (focusedElement instanceof HTMLElement && focusedElement.closest(AUTO_EXPAND_BLOCK_SELECTOR)) return
      setChatOpen(true)
    }, chatAutoExpandDelay)
  }

  const zoneAlwaysShow = chatExpandZoneVisible && chatAutoExpand && !chatOpen
  const previewW = zonePreview?.w ?? zoneW
  const previewH = zonePreview?.h ?? zoneH
  const showPreview = zonePreview !== null && !chatExpandZoneVisible

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden relative" onMouseMove={handleShellMouseMove} onMouseLeave={clearAutoExpandTimer}>
        <Sidebar onToggleChat={toggleChat} />
        <main className="scrollbar-hidden flex-1 overflow-auto bg-background p-5">
          {children}
        </main>

        {zoneAlwaysShow && (
          <div className="absolute right-0 z-10 pointer-events-none"
            style={{ width: `${previewW}px`, height: `${previewH}%`, top: `${(100 - previewH) / 2}%`,
              backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px dashed rgba(59, 130, 246, 0.35)' }} />
        )}

        {chatAutoExpand && !chatOpen && !chatExpandZoneVisible && !showPreview && (
          <div className="absolute right-0 z-10 pointer-events-none"
            style={{ width: `${previewW}px`, height: `${previewH}%`, top: `${(100 - previewH) / 2}%` }} />
        )}

        {showPreview && (
          <div className="absolute right-0 z-30 pointer-events-none"
            style={{ width: `${previewW}px`, height: `${previewH}%`, top: `${(100 - previewH) / 2}%`,
              backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px dashed rgba(59, 130, 246, 0.5)' }} />
        )}

        {chatOpen && chatClickOutsideToClose && (
          <div className="absolute inset-0 z-10" onClick={handleBackdropClick} />
        )}

        <div className={`absolute top-0 h-full w-80 border-l border-border bg-background shadow-lg z-20 flex flex-col transition-[right] duration-200 ease-out ${chatOpen ? 'right-0' : '-right-80'}`}>
          <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0">
            <span className="text-sm font-semibold">AI 聊天</span>
            <button onClick={() => setChatOpen(false)} className="p-1 rounded hover:bg-muted transition-colors" aria-label="Close chat">
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatSidebar />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppShell
