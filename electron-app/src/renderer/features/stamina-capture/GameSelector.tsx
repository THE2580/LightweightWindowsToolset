import { useCaptureStore, GameConfig, ResourceTypeConfig } from '@/stores/captureStore'
import { ChevronDown } from 'lucide-react'

function GameSelector(): React.JSX.Element {
  const { selectedGame, setSelectedGame, selectedResourceType, setSelectedResourceType, gameConfigs } = useCaptureStore()
  const currentGame: GameConfig | undefined = gameConfigs.find((g) => g.id === selectedGame)
  const resourceTypes: ResourceTypeConfig[] = currentGame?.resourceTypes || []

  return (
    <div className="flex items-center gap-2">
      {/* Game selector */}
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

      {/* Resource type selector */}
      {(
        <div className="relative">
          <select
            value={selectedResourceType}
            onChange={(e) => setSelectedResourceType(e.target.value)}
            className="appearance-none h-9 pl-3 pr-7 rounded-md border border-border bg-background text-xs
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {resourceTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
          />
        </div>
      )}
    </div>
  )
}

export default GameSelector
