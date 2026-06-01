import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useCaptureStore, GameConfig, ResourceTypeConfig } from '@/stores/captureStore'
import { useShallow } from 'zustand/shallow'
import { ChevronDown } from 'lucide-react'

interface DropdownOption {
  id: string
  label: string
}

interface DropdownProps {
  ariaLabel: string
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  textSize: string
}

function Dropdown({ ariaLabel, options, value, onChange, textSize }: DropdownProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.id === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const selectOption = (id: string): void => {
    onChange(id)
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (options.length === 0) return
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const currentIndex = Math.max(0, options.findIndex((option) => option.id === value))
    const direction = event.key === 'ArrowDown' ? 1 : -1
    const nextIndex = (currentIndex + direction + options.length) % options.length
    selectOption(options[nextIndex].id)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-chat-auto-expand-block={open ? 'true' : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={`flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-background pl-3 pr-2 ${textSize}
                    focus-visible:outline-none focus-visible:border-primary`}
      >
        <span className="whitespace-nowrap">{selected?.label || ''}</span>
        <ChevronDown size={14} className="flex-shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={`${ariaLabel}选项`}
          className="absolute right-0 top-full z-40 mt-1 min-w-full overflow-hidden rounded-md border border-border bg-background py-1 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              data-chat-auto-expand-block="true"
              onClick={() => selectOption(option.id)}
              className={`block w-full whitespace-nowrap px-3 py-1.5 text-left ${textSize} hover:bg-muted
                          ${option.id === value ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GameSelector(): React.JSX.Element {
  const { selectedGame, setSelectedGame, selectedResourceType, setSelectedResourceType, gameConfigs } = useCaptureStore(
    useShallow((s) => ({
      selectedGame: s.selectedGame,
      setSelectedGame: s.setSelectedGame,
      selectedResourceType: s.selectedResourceType,
      setSelectedResourceType: s.setSelectedResourceType,
      gameConfigs: s.gameConfigs
    }))
  )
  const currentGame: GameConfig | undefined = gameConfigs.find((g) => g.id === selectedGame)
  const resourceTypes: ResourceTypeConfig[] = currentGame?.resourceTypes || []

  return (
    <div className="flex items-center gap-2">
      <Dropdown
        ariaLabel="选择游戏"
        options={gameConfigs.map((game) => ({ id: game.id, label: game.name }))}
        value={selectedGame}
        onChange={setSelectedGame}
        textSize="text-sm"
      />
      <Dropdown
        ariaLabel="选择资源类型"
        options={resourceTypes.map((resourceType) => ({ id: resourceType.id, label: resourceType.label }))}
        value={selectedResourceType}
        onChange={setSelectedResourceType}
        textSize="text-xs"
      />
    </div>
  )
}

export default GameSelector
