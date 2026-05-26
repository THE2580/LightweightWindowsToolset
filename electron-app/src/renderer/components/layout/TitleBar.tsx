import { Minus, X } from 'lucide-react'

function TitleBar(): React.JSX.Element {
  const handleMinimize = (): void => {
    window.api.window.minimize()
  }

  const handleClose = (): void => {
    window.api.window.close()
  }

  return (
    <div className="titlebar-drag flex items-center justify-between h-8 bg-secondary border-b border-border select-none flex-shrink-0">
      <div className="flex items-center pl-3">
        <span className="text-xs font-medium text-muted-foreground">
          轻量化工具集
        </span>
      </div>
      <div className="titlebar-no-drag flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full w-10 flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleClose}
          className="h-full w-10 flex items-center justify-center hover:bg-red-600 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

export default TitleBar
