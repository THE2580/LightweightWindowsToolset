import { ReactNode } from 'react'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'

interface AppShellProps {
  children: ReactNode
}

function AppShell({ children }: AppShellProps): React.JSX.Element {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-background p-10">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppShell
