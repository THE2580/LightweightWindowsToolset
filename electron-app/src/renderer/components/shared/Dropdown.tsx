import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DropdownOption {
  id: string
  label: string
}

interface DropdownProps {
  ariaLabel: string
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  className?: string
  menuClassName?: string
}

function Dropdown({ ariaLabel, options, value, onChange, className, menuClassName }: DropdownProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.id === value) ?? options[0]

  const updateMenuPosition = (): void => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuStyle({ left: rect.left, minWidth: rect.width, top: rect.bottom + 4 })
  }

  useEffect(() => {
    if (!open) return
    updateMenuPosition()

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as Node
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const handleViewportChange = (): void => updateMenuPosition()

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
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
    if (options.length === 0 || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return
    event.preventDefault()
    const currentIndex = Math.max(0, options.findIndex((option) => option.id === value))
    const direction = event.key === 'ArrowDown' ? 1 : -1
    selectOption(options[(currentIndex + direction + options.length) % options.length].id)
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
        className={cn(
          'flex cursor-default select-none items-center justify-between gap-2 rounded-md border border-border bg-background focus-visible:border-primary focus-visible:outline-none',
          className
        )}
      >
        <span className="whitespace-nowrap">{selected?.label || ''}</span>
        <ChevronDown size={14} className="flex-shrink-0 text-muted-foreground" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={`${ariaLabel}选项`}
          data-dropdown-portal="true"
          style={menuStyle}
          className={cn('fixed z-50 overflow-hidden rounded-md border border-border bg-background py-1 shadow-lg', menuClassName)}
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              data-chat-auto-expand-block="true"
              onClick={() => selectOption(option.id)}
              className={cn(
                'block w-full cursor-default select-none whitespace-nowrap px-3 py-1.5 text-left hover:bg-muted',
                option.id === value && 'bg-primary text-primary-foreground hover:bg-primary'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export default Dropdown
