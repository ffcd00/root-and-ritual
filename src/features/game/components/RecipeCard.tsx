import { useMemo } from 'react';

import { DISH_DETAILS, FALLBACK_DISH } from '../content';
import { GAME_STATUS, getRecipeProgress } from '../engine';
import { INGREDIENTS } from '../levels';
import type { GameState, RecipeProgress } from '../types';

interface RecipeCardProps {
  readonly game: GameState;
  readonly onCook: () => void;
}

function IngredientRow({ item, required, collected }: RecipeProgress) {
  const ingredient = INGREDIENTS[item];
  const complete = collected >= required;

  return (
    <div className={`ingredient-row ${complete ? 'is-collected' : ''}`}>
      <span className="ingredient-name">
        <span className="food-icon" aria-hidden="true">{ingredient.emoji}</span>
        <span>{ingredient.label}</span>
      </span>
      <span className="ingredient-count" aria-label={`${collected} of ${required}`}>
        {collected}/{required}
      </span>
    </div>
  );
}

export function RecipeCard({ game, onCook }: RecipeCardProps) {
  const dish = DISH_DETAILS[game.recipe.id] ?? FALLBACK_DISH;
  const progress = useMemo(() => getRecipeProgress(game), [game]);
  const canCook = game.status === GAME_STATUS.READY_TO_COOK;
  const collectedTotal = progress.reduce((total, ingredient) => total + ingredient.collected, 0);
  const requiredTotal = progress.reduce((total, ingredient) => total + ingredient.required, 0);

  return (
    <section className="recipe-card card" aria-label={`Recipe: ${game.recipe.name}`}>
      <div className="recipe-compact-summary">
        <span className="recipe-compact-dish" aria-hidden="true">{dish.emoji}</span>
        <div className="recipe-compact-copy">
          <strong className="recipe-compact-title">{game.recipe.name}</strong>
          <span className="recipe-compact-items" aria-label={`${collectedTotal} of ${requiredTotal} ingredients collected`}>
            {progress.map((ingredientProgress) => {
              const ingredient = INGREDIENTS[ingredientProgress.item];
              return (
                <span
                  className="recipe-compact-item"
                  key={ingredientProgress.item}
                  role="img"
                  aria-label={`${ingredient.label}: ${ingredientProgress.collected} of ${ingredientProgress.required}`}
                >
                  <span aria-hidden="true">{ingredient.emoji}</span>
                  <span className="recipe-compact-count" aria-hidden="true">
                    {ingredientProgress.collected}/{ingredientProgress.required}
                  </span>
                </span>
              );
            })}
          </span>
        </div>
      </div>
      <p className="eyebrow">Today&apos;s recipe</p>
      <div className="recipe-head">
        <h1 id="recipe-title">{game.recipe.name}</h1>
        <span className="dish-illustration" aria-hidden="true">{dish.emoji}</span>
      </div>
      <p className="recipe-description">{dish.description}</p>
      <div className="ingredient-list" aria-label="Recipe ingredients">
        {progress.map((ingredient) => <IngredientRow key={ingredient.item} {...ingredient} />)}
      </div>
      <div className="recipe-action">
        <button
          className={`button button--wide ${canCook ? 'button--leaf' : ''}`}
          type="button"
          onClick={onCook}
          disabled={!canCook}
        >
          <span aria-hidden="true">{canCook ? '🍳' : '🫕'}</span>
          {canCook ? 'Cook this recipe' : 'Gather ingredients'}
        </button>
      </div>
    </section>
  );
}
