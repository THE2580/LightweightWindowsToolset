import { type ReactNode } from 'react'
import { usePluginStore } from '@/stores/pluginStore'
import { useSettingsStore } from '@/stores/settingsStore'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import ChatSidebar from '@/features/ai-chat/ChatSidebar'
import { ChevronRight } from 'lucide-react'

interface AppShellProps {
  children: ReactNode
}

function AppShell({ children }: AppShellProps): React.JSX.Element {
  const chatOpen = usePluginStore((s) => s.chatOpen)
  const setChatOpen = usePluginStore((s) => s.setChatOpen)
  const toggleChat = usePluginStore((s) => s.toggleChat)
  const chatClickOutsideToClose = useSettingsStore((s) => s.chatClickOutsideToClose)
  const chatAutoExpand = useSettingsStore((s) => s.chatAutoExpand)
  const chatExpandZoneVisible = useSettingsStore((s) => s.chatExpandZoneVisible)
  const zoneW = useSettingsStore((s) => s.chatExpandZoneWidth)
  const zoneH = useSettingsStore((s) => s.chatExpandZoneHeight)
  const zonePreview = useSettingsStore((s) => s.chatExpandZonePreview)

  const handleBackdropClick = (): void => {
    if (chatClickOutsideToClose) setChatOpen(false)
  }

  const handleZoneEnter = (): void => {
    if (chatAutoExpand && !chatOpen) setChatOpen(true)
  }

  const zoneAlwaysShow = chatExpandZoneVisible && chatAutoExpand && !chatOpen
  const previewW = zonePreview?.w ?? zoneW
  const previewH = zonePreview?.h ?? zoneH
  const showPreview = zonePreview !== null && !chatExpandZoneVisible

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar onToggleChat={toggleChat} />
        <main className="flex-1 overflow-auto bg-background p-5">
          {children}
        </main>

        {zoneAlwaysShow && (
          <div onMouseEnter={handleZoneEnter} className="absolute right-0 z-10 pointer-events-auto"
            style={{ width: `${previewW}px`, height: `${previewH}%`, top: `${(100 - previewH) / 2}%`,
              backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px dashed rgba(59, 130, 246, 0.35)' }} />
        )}

        {chatAutoExpand && !chatOpen && !chatExpandZoneVisible && !showPreview && (
          <div onMouseEnter={handleZoneEnter} className="absolute right-0 z-10"
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

        <div className={`absolute top-0 h-full w-80 border-l border-border bg-background shadow-lg z-20 flex flex-col transition-all duration-200 ease-out ${chatOpen ? 'right-0' : '-right-80'}`}>
          <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0">
            <span className="text-xs font-semibold">AI 聊天</span>
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
