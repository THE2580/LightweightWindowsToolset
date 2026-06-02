import { useCaptureStore, GameConfig, ResourceTypeConfig } from '@/stores/captureStore'
import { useShallow } from 'zustand/shallow'
import Dropdown from '@/components/shared/Dropdown'

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
        className="h-9 pl-3 pr-2 text-sm"
        menuClassName="text-sm"
      />
      <Dropdown
        ariaLabel="选择资源类型"
        options={resourceTypes.map((resourceType) => ({ id: resourceType.id, label: resourceType.label }))}
        value={selectedResourceType}
        onChange={setSelectedResourceType}
        className="h-9 pl-3 pr-2 text-xs"
        menuClassName="text-xs"
      />
    </div>
  )
}

export default GameSelector
