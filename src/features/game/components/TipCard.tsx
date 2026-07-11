import type { GameState } from '../types';

interface TipCardProps {
  readonly game: GameState;
}

export function TipCard({ game }: TipCardProps) {
  const plotCount = game.board.rows * game.board.columns;
  const totalHarvests = game.recipe.ingredients.reduce((total, ingredient) => total + ingredient.amount, 0);

  return (
    <div className="tip-card" role="note">
      <span className="tip-symbol" aria-hidden="true">⛏</span>
      <p>
        <strong>{plotCount} garden plots.</strong><br />
        Find {totalHarvests} recipe ingredient{totalHarvests === 1 ? '' : 's'} before your digs run out.
      </p>
    </div>
  );
}
