import { INGREDIENTS } from '../levels';
import type { GameState, IngredientId } from '../types';

interface HarvestBasketProps {
  readonly game: GameState;
}

export function HarvestBasket({ game }: HarvestBasketProps) {
  const entries = Object.entries(game.inventory) as [IngredientId, number][];
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

  return (
    <section className="inventory-card card" aria-labelledby="basket-heading">
      <div className="inventory-heading">
        <h2 id="basket-heading">Harvest basket</h2>
        <span className="inventory-total">{total} item{total === 1 ? '' : 's'}</span>
      </div>
      <div className="inventory-slots">
        {entries.length === 0 ? (
          <div className="inventory-empty">Your fresh finds will gather here.</div>
        ) : entries.map(([item, quantity]) => {
          const ingredient = INGREDIENTS[item];
          return (
            <div className="inventory-chip" key={item} aria-label={`${quantity} ${ingredient.label}`}>
              <span className="food-icon" aria-hidden="true">{ingredient.emoji}</span>
              <span className="inventory-chip-count" aria-hidden="true">{quantity}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
