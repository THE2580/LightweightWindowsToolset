import { type ReactNode } from 'react'
import { usePluginStore } from '@/stores/pluginStore'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import ChatSidebar from '@/features/ai-chat/ChatSidebar'
import { X } from 'lucide-react'

interface AppShellProps {
  children: ReactNode
}

function AppShell({ children }: AppShellProps): React.JSX.Element {
  const chatOpen = usePluginStore((s) => s.chatOpen)
  const setChatOpen = usePluginStore((s) => s.setChatOpen)
  const toggleChat = usePluginStore((s) => s.toggleChat)

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar onToggleChat={toggleChat} />
        <main className="flex-1 overflow-auto bg-background p-5">
          {children}
        </main>

        {chatOpen && (
          <div className="absolute top-0 right-0 h-full w-80 border-l border-border bg-background shadow-lg z-20 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
              <span className="text-xs font-semibold">AI 聊天</span>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 rounded hover:bg-muted transition-colors"
                aria-label="Close chat"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatSidebar />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AppShell
