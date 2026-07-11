import type {
  EmptyTile,
  IngredientDefinition,
  IngredientId,
  IngredientTile,
  LevelDefinition,
  RockTile,
  Tile,
} from "./types";

/** Runtime tile values, kept alongside the authored content for UI consumers. */
export const TILE_KIND = Object.freeze({
  INGREDIENT: "ingredient",
  EMPTY: "empty",
  ROCK: "rock",
} as const);

export const INGREDIENTS: Readonly<Record<IngredientId, IngredientDefinition>> = Object.freeze({
  basil: Object.freeze({ label: "Basil", emoji: "🌿" }),
  carrot: Object.freeze({ label: "Carrot", emoji: "🥕" }),
  corn: Object.freeze({ label: "Corn", emoji: "🌽" }),
  garlic: Object.freeze({ label: "Garlic", emoji: "🧄" }),
  herb: Object.freeze({ label: "Garden herb", emoji: "🍃" }),
  mushroom: Object.freeze({ label: "Mushroom", emoji: "🍄" }),
  onion: Object.freeze({ label: "Onion", emoji: "🧅" }),
  pepper: Object.freeze({ label: "Pepper", emoji: "🫑" }),
  potato: Object.freeze({ label: "Potato", emoji: "🥔" }),
  spinach: Object.freeze({ label: "Spinach", emoji: "🥬" }),
  tomato: Object.freeze({ label: "Tomato", emoji: "🍅" }),
});

const ingredient = (item: IngredientId): IngredientTile => ({
  kind: TILE_KIND.INGREDIENT,
  item,
});

const empty = (): EmptyTile => ({ kind: TILE_KIND.EMPTY });
const rock = (): RockTile => ({ kind: TILE_KIND.ROCK });

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nestedValue of Object.values(value)) {
      deepFreeze(nestedValue);
    }
  }

  return value;
}

/**
 * Levels deliberately grow in both board area and number of required harvests.
 * `tiles[row][column]` is the authored tile pool before it is shuffled.
 */
const levelDefinitions: readonly LevelDefinition[] = [
  {
    id: "root-cellar",
    name: "Root Cellar Soup",
    board: { rows: 3, columns: 4 },
    digLimit: 6,
    recipe: {
      id: "root-soup",
      name: "Root Cellar Soup",
      ingredients: [
        { item: "carrot", amount: 1 },
        { item: "onion", amount: 1 },
      ],
    },
    tiles: [
      [ingredient("carrot"), empty(), rock(), empty()],
      [empty(), ingredient("onion"), empty(), rock()],
      [empty(), rock(), empty(), empty()],
    ],
  },
  {
    id: "garden-salsa",
    name: "Garden Salsa",
    board: { rows: 4, columns: 4 },
    digLimit: 9,
    recipe: {
      id: "garden-salsa",
      name: "Garden Salsa",
      ingredients: [
        { item: "tomato", amount: 1 },
        { item: "basil", amount: 1 },
        { item: "onion", amount: 1 },
      ],
    },
    tiles: [
      [rock(), ingredient("tomato"), empty(), rock()],
      [empty(), empty(), ingredient("basil"), empty()],
      [ingredient("onion"), rock(), empty(), rock()],
      [empty(), empty(), rock(), empty()],
    ],
  },
  {
    id: "forest-saute",
    name: "Forest Sauté",
    board: { rows: 4, columns: 5 },
    digLimit: 12,
    recipe: {
      id: "forest-saute",
      name: "Forest Sauté",
      ingredients: [
        { item: "mushroom", amount: 2 },
        { item: "garlic", amount: 1 },
        { item: "spinach", amount: 1 },
      ],
    },
    tiles: [
      [empty(), ingredient("mushroom"), rock(), empty(), ingredient("spinach")],
      [rock(), empty(), ingredient("garlic"), empty(), rock()],
      [ingredient("mushroom"), empty(), rock(), empty(), empty()],
      [empty(), rock(), empty(), rock(), empty()],
    ],
  },
  {
    id: "harvest-chowder",
    name: "Harvest Chowder",
    board: { rows: 5, columns: 6 },
    digLimit: 17,
    recipe: {
      id: "harvest-chowder",
      name: "Harvest Chowder",
      ingredients: [
        { item: "potato", amount: 2 },
        { item: "corn", amount: 1 },
        { item: "tomato", amount: 1 },
        { item: "pepper", amount: 1 },
        { item: "herb", amount: 1 },
      ],
    },
    tiles: [
      [rock(), ingredient("potato"), empty(), rock(), ingredient("corn"), empty()],
      [empty(), ingredient("tomato"), rock(), empty(), ingredient("herb"), rock()],
      [ingredient("potato"), empty(), rock(), ingredient("pepper"), empty(), rock()],
      [empty(), rock(), empty(), empty(), rock(), empty()],
      [rock(), empty(), rock(), empty(), empty(), rock()],
    ],
  },
];

export const LEVELS: readonly LevelDefinition[] = deepFreeze(levelDefinitions);

export type { Tile };
