import { useEffect, useRef, type KeyboardEvent } from 'react';

import { DISH_DETAILS, FALLBACK_DISH } from '../content';
import { LEVELS } from '../levels';
import type { GameState } from '../types';

interface GameModalProps {
  readonly variant: 'complete' | 'out-of-digs' | 'ready-to-cook';
  readonly game: GameState;
  readonly onPrimaryAction: () => void;
}

export function GameModal({ variant, game, onPrimaryAction }: GameModalProps) {
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const complete = variant === 'complete';
  const readyToCook = variant === 'ready-to-cook';
  const outOfDigs = variant === 'out-of-digs';
  const dish = DISH_DETAILS[game.recipe.id] ?? FALLBACK_DISH;
  const titleId = `${variant}-title`;
  const copyId = `${variant}-copy`;

  useEffect(() => {
    primaryActionRef.current?.focus();
  }, []);

  const trapFocus = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    primaryActionRef.current?.focus();
  };

  return (
    <section
      className="screen-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={complete ? undefined : copyId}
      onKeyDown={trapFocus}
    >
      <div className={`completion-modal ${outOfDigs ? 'failure-modal' : ''}`}>
        <div className={`modal-garden ${outOfDigs ? 'modal-garden--dusk' : ''}`} aria-hidden="true">
          <span className="modal-dish">{outOfDigs ? '🌙' : dish.emoji}</span>
        </div>
        <div className="completion-content">
          <p className="eyebrow">{complete ? 'Kitchen complete' : readyToCook ? 'Harvest complete' : 'Garden pause'}</p>
          <h2 id={titleId}>{complete ? 'A garden feast!' : readyToCook ? 'Ready to cook!' : 'Out of digs'}</h2>
          {complete ? (
            <p>You cooked all {LEVELS.length} recipes and turned every harvest into something warm, bright, and delicious.</p>
          ) : readyToCook ? (
            <p id={copyId}>Every ingredient for {game.recipe.name} is in your basket. Bring it to the kitchen!</p>
          ) : (
            <p id={copyId}>The remaining ingredients are still underground. Try again for a freshly shuffled garden patch.</p>
          )}
          <div className="modal-actions">
            <button
              className="button button--leaf button--wide"
              type="button"
              ref={primaryActionRef}
              onClick={onPrimaryAction}
            >
              {complete ? 'Plant a new garden' : readyToCook ? 'Cook this recipe' : 'Reshuffle & try again'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
