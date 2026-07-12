import { useEffect, useRef } from 'react';

import { GardenBoard } from '../features/game/components/GardenBoard';
import { GameHeader } from '../features/game/components/GameHeader';
import { GameModal } from '../features/game/components/GameModal';
import { HarvestBasket } from '../features/game/components/HarvestBasket';
import { ProgressPanel } from '../features/game/components/ProgressPanel';
import { RecipeCard } from '../features/game/components/RecipeCard';
import { TipCard } from '../features/game/components/TipCard';
import { Toast } from '../features/game/components/Toast';
import { GAME_STATUS } from '../features/game/engine';
import { useGame } from '../features/game/hooks/useGame';

export function App() {
  const gameController = useGame();
  const gameContentRef = useRef<HTMLDivElement>(null);
  const { game } = gameController;
  const isComplete = game.status === GAME_STATUS.COMPLETE;
  const isOutOfDigs = game.status === GAME_STATUS.OUT_OF_DIGS;
  const isReadyToCook = game.status === GAME_STATUS.READY_TO_COOK;
  const hasModal = isComplete || isOutOfDigs || isReadyToCook;

  useEffect(() => {
    if (hasModal || gameController.focusTarget === null) return;

    const gameContent = gameContentRef.current;
    if (!gameContent) return;

    if (gameController.focusTarget === 'cook') {
      gameContent.querySelector<HTMLButtonElement>('[data-cook]')?.focus();
      return;
    }

    gameContent.querySelector<HTMLButtonElement>('[data-dig]:not(:disabled)')?.focus();
  }, [game.digsUsed, game.lastAction.type, hasModal, gameController.focusTarget]);

  return (
    <main className="app-shell">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />
      <div className="game-content" ref={gameContentRef} inert={hasModal} aria-hidden={hasModal}>
        <GameHeader
          soundEnabled={gameController.soundEnabled}
          onToggleSound={gameController.toggleSound}
        />
        <section className="game-layout" aria-label="Garden kitchen game">
          <aside className="side-rail">
            <RecipeCard game={game} onCook={gameController.cook} />
            <TipCard game={game} />
          </aside>
          <section className="game-column">
            <GardenBoard
              game={game}
              activeTileId={gameController.activeTileId}
              onDig={gameController.dig}
            />
            <HarvestBasket game={game} />
            <ProgressPanel game={game} />
          </section>
        </section>
      </div>
      <Toast message={gameController.toast} />
      {isComplete ? (
        <GameModal variant="complete" game={game} onPrimaryAction={gameController.playAgain} />
      ) : null}
      {isOutOfDigs ? (
        <GameModal variant="out-of-digs" game={game} onPrimaryAction={gameController.restart} />
      ) : null}
      {isReadyToCook ? (
        <GameModal variant="ready-to-cook" game={game} onPrimaryAction={gameController.cook} />
      ) : null}
    </main>
  );
}
