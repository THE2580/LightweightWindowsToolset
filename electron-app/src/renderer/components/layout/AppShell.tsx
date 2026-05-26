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

  const handleBackdropClick = (): void => {
    if (chatClickOutsideToClose) {
      setChatOpen(false)
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar onToggleChat={toggleChat} />
        <main className="flex-1 overflow-auto bg-background p-5">
          {children}
        </main>

        {/* Backdrop for click-outside-to-close */}
        {chatOpen && chatClickOutsideToClose && (
          <div
            className="absolute inset-0 z-10"
            onClick={handleBackdropClick}
          />
        )}

        {/* AI Chat sliding panel — slides from right */}
        <div
          className={`absolute top-0 h-full w-80 border-l border-border bg-background shadow-lg z-20 flex flex-col transition-all duration-200 ease-out ${
            chatOpen ? 'right-0' : '-right-80'
          }`}
        >
          <div className="flex items-center justify-end px-2 py-1.5 flex-shrink-0">
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 rounded hover:bg-muted transition-colors"
              aria-label="Close chat"
            >
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
