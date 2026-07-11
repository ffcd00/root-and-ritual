import { INGREDIENTS, LEVELS, TILE_KIND } from "./levels";
import type {
  ActionType,
  DigRejectionReason,
  EmptyTile,
  GameAction,
  GameBoard,
  GameCell,
  GameState,
  GameStatus,
  IngredientId,
  IngredientTile,
  Inventory,
  LevelDefinition,
  LevelReference,
  LevelStartedAction,
  RandomSource,
  Recipe,
  RecipeProgress,
  RestartedAction,
  RockTile,
  Tile,
  TileKind,
} from "./types";

export const GAME_STATUS = Object.freeze({
  DIGGING: "digging",
  READY_TO_COOK: "ready-to-cook",
  OUT_OF_DIGS: "out-of-digs",
  COMPLETE: "complete",
} as const satisfies Record<string, GameStatus>);

export const ACTION_TYPE = Object.freeze({
  LEVEL_STARTED: "level-started",
  DUG_EMPTY: "dug-empty",
  DUG_ROCK: "dug-rock",
  DUG_INGREDIENT: "dug-ingredient",
  RECIPE_READY: "recipe-ready",
  OUT_OF_DIGS: "out-of-digs",
  DIG_REJECTED: "dig-rejected",
  COOK_BLOCKED: "cook-blocked",
  LEVEL_ADVANCED: "level-advanced",
  GAME_COMPLETE: "game-complete",
  RESTARTED: "restarted",
} as const satisfies Record<string, ActionType>);

const VALID_TILE_KINDS: ReadonlySet<TileKind> = new Set([
  TILE_KIND.INGREDIENT,
  TILE_KIND.EMPTY,
  TILE_KIND.ROCK,
]);

function cloneTile(tile: IngredientTile): IngredientTile;
function cloneTile(tile: EmptyTile): EmptyTile;
function cloneTile(tile: RockTile): RockTile;
function cloneTile(tile: Tile): Tile;
function cloneTile(tile: Tile): Tile {
  if (tile.kind === TILE_KIND.INGREDIENT) {
    return { kind: TILE_KIND.INGREDIENT, item: tile.item };
  }
  if (tile.kind === TILE_KIND.EMPTY) {
    return { kind: TILE_KIND.EMPTY };
  }
  return { kind: TILE_KIND.ROCK };
}

function cloneRecipe(recipe: Recipe): Recipe {
  return {
    id: recipe.id,
    name: recipe.name,
    ingredients: recipe.ingredients.map(({ item, amount }) => ({ item, amount })),
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new TypeError(`Invalid level definition: ${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isIngredientId(value: unknown): value is IngredientId {
  return typeof value === "string" && Object.hasOwn(INGREDIENTS, value);
}

function isTileKind(value: unknown): value is TileKind {
  return typeof value === "string" && VALID_TILE_KINDS.has(value as TileKind);
}

/**
 * Throws a TypeError when a level cannot be represented or completed.
 * Returning the input makes it convenient to use at configuration boundaries.
 */
export function validateLevelDefinition(level: unknown): LevelDefinition {
  assert(isRecord(level), "level must be an object");

  const id = level.id;
  const name = level.name;
  assert(typeof id === "string" && id.length > 0, "id is required");
  assert(typeof name === "string" && name.length > 0, "name is required");

  const { board, recipe, tiles, digLimit } = level;
  assert(isRecord(board), "board.rows must be a positive integer");
  const rows = board.rows;
  const columns = board.columns;
  assert(isPositiveInteger(rows), "board.rows must be a positive integer");
  assert(isPositiveInteger(columns), "board.columns must be a positive integer");
  assert(isPositiveInteger(digLimit), "digLimit must be a positive integer");
  assert(digLimit <= rows * columns, "digLimit cannot exceed board area");

  assert(isRecord(recipe), "recipe.id is required");
  const recipeId = recipe.id;
  const recipeName = recipe.name;
  const recipeIngredients = recipe.ingredients;
  assert(typeof recipeId === "string" && recipeId.length > 0, "recipe.id is required");
  assert(typeof recipeName === "string" && recipeName.length > 0, "recipe.name is required");
  assert(Array.isArray(recipeIngredients) && recipeIngredients.length > 0, "recipe.ingredients are required");
  assert(Array.isArray(tiles) && tiles.length === rows, "tiles must have one row per board row");

  const harvestableCounts: Inventory = {};
  const tileRows: readonly unknown[] = tiles;
  for (const [rowIndex, row] of tileRows.entries()) {
    assert(Array.isArray(row) && row.length === columns, `tiles row ${rowIndex} has the wrong width`);

    const tileCells: readonly unknown[] = row;
    for (const [columnIndex, tile] of tileCells.entries()) {
      assert(isRecord(tile) && isTileKind(tile.kind), `tile ${rowIndex},${columnIndex} has an unknown kind`);

      if (tile.kind === TILE_KIND.INGREDIENT) {
        const item = tile.item;
        assert(isIngredientId(item), `tile ${rowIndex},${columnIndex} has an unknown ingredient`);
        harvestableCounts[item] = (harvestableCounts[item] ?? 0) + 1;
      }
    }
  }

  const requiredCounts: Inventory = {};
  let totalRequired = 0;
  const recipeRows: readonly unknown[] = recipeIngredients;
  for (const recipeIngredient of recipeRows) {
    assert(isRecord(recipeIngredient), "recipe has an unknown ingredient");

    const item = recipeIngredient.item;
    const amount = recipeIngredient.amount;
    assert(isIngredientId(item), "recipe has an unknown ingredient");
    assert(isPositiveInteger(amount), "recipe ingredient amount must be positive");
    assert(requiredCounts[item] === undefined, `recipe repeats ${item}`);

    requiredCounts[item] = amount;
    totalRequired += amount;
  }

  for (const item of Object.keys(requiredCounts) as IngredientId[]) {
    const amount = requiredCounts[item];
    if (amount === undefined) {
      continue;
    }

    assert((harvestableCounts[item] ?? 0) >= amount, `recipe requires more ${item} than the board contains`);
  }

  assert(totalRequired <= digLimit, "recipe requires more digs than the level allows");

  return level as unknown as LevelDefinition;
}

function validateLevelCollection(levels: readonly LevelDefinition[]): void {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new TypeError("levels must be a non-empty array");
  }

  const ids = new Set<string>();
  for (const level of levels) {
    validateLevelDefinition(level);
    if (ids.has(level.id)) {
      throw new TypeError(`Invalid level definition: duplicate level id '${level.id}'`);
    }
    ids.add(level.id);
  }
}

function findLevel(
  levelOrId: LevelReference,
  levels: readonly LevelDefinition[],
): { readonly level: LevelDefinition; readonly index: number } {
  validateLevelCollection(levels);

  let index: number;
  if (typeof levelOrId === "number") {
    index = levelOrId;
  } else if (typeof levelOrId === "string") {
    index = levels.findIndex((level) => level.id === levelOrId);
  } else {
    index = levels.indexOf(levelOrId);
  }

  if (!Number.isInteger(index) || index < 0 || index >= levels.length) {
    throw new RangeError("Unknown level");
  }

  const level = levels[index];
  if (level === undefined) {
    throw new RangeError("Unknown level");
  }

  return { level, index };
}

function randomIndex(maxExclusive: number, random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Random source must return a number from 0 (inclusive) to 1 (exclusive)");
  }
  return Math.floor(value * maxExclusive);
}

/**
 * Shuffles ingredients and empty soil between the authored non-rock positions.
 * Rocks keep their placement, while every possible harvest location is fresh.
 */
function shuffleHarvestTiles(
  tiles: LevelDefinition["tiles"],
  random: RandomSource,
): Tile[] {
  const shuffled = tiles.flat().map((tile) => cloneTile(tile));
  const movableIndexes: number[] = [];
  const movableTiles: Tile[] = [];

  shuffled.forEach((tile, index) => {
    if (tile.kind !== TILE_KIND.ROCK) {
      movableIndexes.push(index);
      movableTiles.push(tile);
    }
  });

  for (let index = movableTiles.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1, random);
    const tile = movableTiles[index];
    const swapTile = movableTiles[swapIndex];

    if (tile === undefined || swapTile === undefined) {
      throw new Error("Unable to shuffle an incomplete tile collection");
    }

    movableTiles[index] = swapTile;
    movableTiles[swapIndex] = tile;
  }

  movableIndexes.forEach((boardIndex, index) => {
    const tile = movableTiles[index];
    if (tile === undefined) {
      throw new Error("Unable to restore an incomplete tile collection");
    }
    shuffled[boardIndex] = tile;
  });

  return shuffled;
}

function createBoard(level: LevelDefinition, random: RandomSource): GameBoard {
  const tiles = shuffleHarvestTiles(level.tiles, random);
  const cells: GameCell[] = tiles.map((tile, index) => {
    const row = Math.floor(index / level.board.columns);
    const column = index % level.board.columns;

    return {
      id: `${row}:${column}`,
      row,
      column,
      isDug: false,
      tile: cloneTile(tile),
    };
  });

  return {
    rows: level.board.rows,
    columns: level.board.columns,
    cells,
  };
}

function startAction(level: LevelDefinition): LevelStartedAction;
function startAction(level: LevelDefinition, type: typeof ACTION_TYPE.RESTARTED): RestartedAction;
function startAction(
  level: LevelDefinition,
  type: typeof ACTION_TYPE.LEVEL_STARTED | typeof ACTION_TYPE.RESTARTED = ACTION_TYPE.LEVEL_STARTED,
): LevelStartedAction | RestartedAction {
  return type === ACTION_TYPE.RESTARTED
    ? { type, levelId: level.id, sound: "restart" }
    : { type, levelId: level.id, sound: "level-start" };
}

/**
 * Builds a new shuffled level state. `levelOrId` accepts a numeric index, an
 * id, or the exact level object from `levels`. Pass a random function to make
 * a generated layout reproducible in a test or replay system.
 */
export function createLevelState(
  levelOrId: LevelReference = 0,
  levels: readonly LevelDefinition[] = LEVELS,
  random: RandomSource = Math.random,
): GameState {
  const { level, index } = findLevel(levelOrId, levels);

  return {
    levelId: level.id,
    levelIndex: index,
    levelName: level.name,
    board: createBoard(level, random),
    recipe: cloneRecipe(level.recipe),
    inventory: {},
    digLimit: level.digLimit,
    digsUsed: 0,
    status: GAME_STATUS.DIGGING,
    completedLevelIds: [],
    lastAction: startAction(level),
  };
}

/** Creates a fresh game at the first level in the supplied collection. */
export function createGameState(
  levels: readonly LevelDefinition[] = LEVELS,
  random: RandomSource = Math.random,
): GameState {
  return createLevelState(0, levels, random);
}

/**
 * Reports progress in recipe order. This is presentation-friendly but remains
 * pure: callers can safely derive UI from it without changing state.
 */
export function getRecipeProgress(state: GameState): readonly RecipeProgress[] {
  return state.recipe.ingredients.map(({ item, amount }) => {
    const collected = Math.min(state.inventory[item] ?? 0, amount);

    return {
      item,
      required: amount,
      collected,
      remaining: Math.max(amount - (state.inventory[item] ?? 0), 0),
    };
  });
}

/** Returns true when every recipe requirement is present in the inventory. */
export function isRecipeReady(recipe: Recipe, inventory: Inventory): boolean {
  return recipe.ingredients.every(({ item, amount }) => (inventory[item] ?? 0) >= amount);
}

function rejectDig(state: GameState, reason: DigRejectionReason): GameState {
  return {
    ...state,
    lastAction: {
      type: ACTION_TYPE.DIG_REJECTED,
      reason,
      sound: "error",
    },
  };
}

function getCellIndex(board: GameBoard, row: number, column: number): number {
  if (!Number.isInteger(row) || !Number.isInteger(column)) {
    return -1;
  }
  if (row < 0 || row >= board.rows || column < 0 || column >= board.columns) {
    return -1;
  }
  return row * board.columns + column;
}

/**
 * Digs one covered cell and returns a new state. Invalid, repeated, exhausted,
 * and terminal actions leave gameplay data intact and expose a rejection action
 * for UI feedback.
 */
export function digCell(state: GameState, row: number, column: number): GameState {
  if (state.status !== GAME_STATUS.DIGGING) {
    return rejectDig(state, "level-is-not-diggable");
  }
  if (state.digsUsed >= state.digLimit) {
    return rejectDig(state, "dig-limit-reached");
  }

  const index = getCellIndex(state.board, row, column);
  if (index === -1) {
    return rejectDig(state, "outside-board");
  }

  const currentCell = state.board.cells[index];
  if (currentCell === undefined) {
    return rejectDig(state, "outside-board");
  }
  if (currentCell.isDug) {
    return rejectDig(state, "cell-already-dug");
  }

  const cell: GameCell = { ...currentCell, isDug: true };
  const cells = state.board.cells.map((candidate, candidateIndex) => (
    candidateIndex === index ? cell : candidate
  ));
  const inventory: Inventory = { ...state.inventory };
  if (cell.tile.kind === TILE_KIND.INGREDIENT) {
    inventory[cell.tile.item] = (inventory[cell.tile.item] ?? 0) + 1;
  }

  const digsUsed = state.digsUsed + 1;
  const recipeReady = isRecipeReady(state.recipe, inventory);
  const outOfDigs = digsUsed >= state.digLimit;
  const status: GameStatus = recipeReady
    ? GAME_STATUS.READY_TO_COOK
    : outOfDigs
      ? GAME_STATUS.OUT_OF_DIGS
      : GAME_STATUS.DIGGING;

  let lastAction: GameAction;
  if (recipeReady) {
    lastAction = {
      type: ACTION_TYPE.RECIPE_READY,
      row,
      column,
      tile: cloneTile(cell.tile),
      sound: "recipe-ready",
    };
  } else if (outOfDigs) {
    lastAction = {
      type: ACTION_TYPE.OUT_OF_DIGS,
      row,
      column,
      tile: cloneTile(cell.tile),
      sound: "out-of-digs",
    };
  } else if (cell.tile.kind === TILE_KIND.ROCK) {
    lastAction = {
      type: ACTION_TYPE.DUG_ROCK,
      row,
      column,
      tile: cloneTile(cell.tile),
      sound: "rock",
    };
  } else if (cell.tile.kind === TILE_KIND.INGREDIENT) {
    lastAction = {
      type: ACTION_TYPE.DUG_INGREDIENT,
      row,
      column,
      tile: cloneTile(cell.tile),
      sound: "harvest",
    };
  } else {
    lastAction = {
      type: ACTION_TYPE.DUG_EMPTY,
      row,
      column,
      tile: cloneTile(cell.tile),
      sound: "dig",
    };
  }

  return {
    ...state,
    board: { ...state.board, cells },
    inventory,
    digsUsed,
    status,
    lastAction,
  };
}

/**
 * Cooks a ready recipe. It starts the next level when one exists, or marks the
 * game complete after the last level. If cooking is unavailable, it returns a
 * state with a `cook-blocked` action and otherwise unchanged game data.
 */
export function cookAndAdvance(
  state: GameState,
  levels: readonly LevelDefinition[] = LEVELS,
  random: RandomSource = Math.random,
): GameState {
  validateLevelCollection(levels);
  if (state.status !== GAME_STATUS.READY_TO_COOK) {
    return {
      ...state,
      lastAction: {
        type: ACTION_TYPE.COOK_BLOCKED,
        reason: "recipe-not-ready",
        sound: "error",
      },
    };
  }

  const currentIndex = levels.findIndex((level) => level.id === state.levelId);
  if (currentIndex === -1) {
    throw new RangeError(`Current level '${state.levelId}' is not in the supplied levels`);
  }

  const currentLevel = levels[currentIndex];
  if (currentLevel === undefined) {
    throw new RangeError(`Current level '${state.levelId}' is not in the supplied levels`);
  }

  const completedLevelIds = [...state.completedLevelIds, state.levelId];
  const nextLevel = levels[currentIndex + 1];

  if (nextLevel === undefined) {
    return {
      ...state,
      status: GAME_STATUS.COMPLETE,
      completedLevelIds,
      lastAction: {
        type: ACTION_TYPE.GAME_COMPLETE,
        completedLevelId: currentLevel.id,
        recipeId: state.recipe.id,
        sound: "game-complete",
      },
    };
  }

  const nextState = createLevelState(currentIndex + 1, levels, random);
  return {
    ...nextState,
    completedLevelIds,
    lastAction: {
      type: ACTION_TYPE.LEVEL_ADVANCED,
      completedLevelId: currentLevel.id,
      levelId: nextLevel.id,
      recipeId: state.recipe.id,
      sound: "cook",
    },
  };
}

/** Restores the current level with a newly shuffled layout and full dig budget. */
export function restartLevel(
  state: GameState,
  levels: readonly LevelDefinition[] = LEVELS,
  random: RandomSource = Math.random,
): GameState {
  const { level } = findLevel(state.levelId, levels);
  const restarted = createLevelState(state.levelId, levels, random);

  return {
    ...restarted,
    completedLevelIds: [...state.completedLevelIds],
    lastAction: startAction(level, ACTION_TYPE.RESTARTED),
  };
}

/** Returns the revealed tile for a cell, or null while it remains covered. */
export function getRevealedTile(cell: GameCell | null | undefined): Tile | null {
  return cell?.isDug ? cloneTile(cell.tile) : null;
}

/** A small utility for serializable UI snapshots and tests. */
export function getRemainingDigs(state: GameState): number {
  return Math.max(state.digLimit - state.digsUsed, 0);
}
