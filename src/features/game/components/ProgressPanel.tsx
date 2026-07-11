import { LEVELS } from '../levels';
import type { GameState } from '../types';

interface ProgressPanelProps {
  readonly game: GameState;
}

export function ProgressPanel({ game }: ProgressPanelProps) {
  const completed = game.completedLevelIds.length;
  const remaining = LEVELS.length - completed;
  const icon = completed === 0 ? '☀️' : completed === LEVELS.length ? '🏆' : '🌼';

  return (
    <section className="progress-card card" aria-label="Kitchen progress">
      <span className="progress-orb" aria-hidden="true">{icon}</span>
      <div className="progress-copy">
        <strong>{completed === 0 ? 'First harvest' : `${completed} recipe${completed === 1 ? '' : 's'} cooked`}</strong>
        <span>{remaining === 0 ? 'The whole garden menu is yours.' : `${remaining} seasonal recipe${remaining === 1 ? '' : 's'} to discover`}</span>
      </div>
    </section>
  );
}
