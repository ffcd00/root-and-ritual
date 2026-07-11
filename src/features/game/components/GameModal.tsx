import { useEffect, useRef, type KeyboardEvent } from 'react';

import { DISH_DETAILS, FALLBACK_DISH } from '../content';
import { LEVELS } from '../levels';
import type { GameState } from '../types';

interface GameModalProps {
  readonly variant: 'complete' | 'out-of-digs';
  readonly game: GameState;
  readonly onPrimaryAction: () => void;
}

export function GameModal({ variant, game, onPrimaryAction }: GameModalProps) {
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const complete = variant === 'complete';
  const dish = DISH_DETAILS[game.recipe.id] ?? FALLBACK_DISH;

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
      aria-labelledby={complete ? 'completion-title' : 'out-of-digs-title'}
      aria-describedby={complete ? undefined : 'out-of-digs-copy'}
      onKeyDown={trapFocus}
    >
      <div className={`completion-modal ${complete ? '' : 'failure-modal'}`}>
        <div className={`modal-garden ${complete ? '' : 'modal-garden--dusk'}`} aria-hidden="true">
          <span className="modal-dish">{complete ? dish.emoji : '🌙'}</span>
        </div>
        <div className="completion-content">
          <p className="eyebrow">{complete ? 'Kitchen complete' : 'Garden pause'}</p>
          <h2 id={complete ? 'completion-title' : 'out-of-digs-title'}>{complete ? 'A garden feast!' : 'Out of digs'}</h2>
          {complete ? (
            <p>You cooked all {LEVELS.length} recipes and turned every harvest into something warm, bright, and delicious.</p>
          ) : (
            <p id="out-of-digs-copy">The remaining ingredients are still underground. Try again for a freshly shuffled garden patch.</p>
          )}
          <div className="modal-actions">
            <button
              className="button button--leaf button--wide"
              type="button"
              ref={primaryActionRef}
              onClick={onPrimaryAction}
            >
              {complete ? 'Plant a new garden' : 'Reshuffle & try again'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
