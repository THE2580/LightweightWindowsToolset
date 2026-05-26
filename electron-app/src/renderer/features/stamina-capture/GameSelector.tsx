import { useCaptureStore } from '@/stores/captureStore'
import { ChevronDown } from 'lucide-react'

function GameSelector(): React.JSX.Element {
  const { selectedGame, setSelectedGame, gameConfigs } = useCaptureStore()

  return (
    <div className="relative">
      <select
        value={selectedGame}
        onChange={(e) => setSelectedGame(e.target.value)}
        className="appearance-none h-9 pl-3 pr-8 rounded-md border border-border bg-background text-sm
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {gameConfigs.map((game) => (
          <option key={game.id} value={game.id}>
            {game.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
      />
    </div>
  )
}

export default GameSelector
