import { INGREDIENTS, LEVELS, TILE_KIND } from "./data.js";

export const GAME_STATUS = Object.freeze({
  DIGGING: "digging",
  READY_TO_COOK: "ready-to-cook",
  OUT_OF_DIGS: "out-of-digs",
  COMPLETE: "complete",
});

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
});

const VALID_TILE_KINDS = new Set(Object.values(TILE_KIND));

function cloneTile(tile) {
  return tile.kind === TILE_KIND.INGREDIENT
    ? { kind: tile.kind, item: tile.item }
    : { kind: tile.kind };
}

function cloneRecipe(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    ingredients: recipe.ingredients.map(({ item, amount }) => ({ item, amount })),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new TypeError(`Invalid level definition: ${message}`);
  }
}

/**
 * Throws a TypeError when a level cannot be represented or completed.
 * Returning the input makes it convenient to use at configuration boundaries.
 */
export function validateLevelDefinition(level) {
  assert(level && typeof level === "object", "level must be an object");
  assert(typeof level.id === "string" && level.id.length > 0, "id is required");
  assert(typeof level.name === "string" && level.name.length > 0, "name is required");

  const { board, recipe, tiles, digLimit } = level;
  assert(board && Number.isInteger(board.rows) && board.rows > 0, "board.rows must be a positive integer");
  assert(
    board && Number.isInteger(board.columns) && board.columns > 0,
    "board.columns must be a positive integer",
  );
  assert(Number.isInteger(digLimit) && digLimit > 0, "digLimit must be a positive integer");
  assert(digLimit <= board.rows * board.columns, "digLimit cannot exceed board area");

  assert(recipe && typeof recipe.id === "string" && recipe.id.length > 0, "recipe.id is required");
  assert(recipe && typeof recipe.name === "string" && recipe.name.length > 0, "recipe.name is required");
  assert(Array.isArray(recipe?.ingredients) && recipe.ingredients.length > 0, "recipe.ingredients are required");
  assert(Array.isArray(tiles) && tiles.length === board.rows, "tiles must have one row per board row");

  const harvestableCounts = {};
  for (const [rowIndex, row] of tiles.entries()) {
    assert(Array.isArray(row) && row.length === board.columns, `tiles row ${rowIndex} has the wrong width`);
    for (const [columnIndex, tile] of row.entries()) {
      assert(tile && VALID_TILE_KINDS.has(tile.kind), `tile ${rowIndex},${columnIndex} has an unknown kind`);
      if (tile.kind === TILE_KIND.INGREDIENT) {
        assert(
          typeof tile.item === "string" && Object.hasOwn(INGREDIENTS, tile.item),
          `tile ${rowIndex},${columnIndex} has an unknown ingredient`,
        );
        harvestableCounts[tile.item] = (harvestableCounts[tile.item] ?? 0) + 1;
      }
    }
  }

  const requiredCounts = {};
  for (const ingredient of recipe.ingredients) {
    assert(
      ingredient && typeof ingredient.item === "string" && Object.hasOwn(INGREDIENTS, ingredient.item),
      "recipe has an unknown ingredient",
    );
    assert(Number.isInteger(ingredient.amount) && ingredient.amount > 0, "recipe ingredient amount must be positive");
    assert(requiredCounts[ingredient.item] === undefined, `recipe repeats ${ingredient.item}`);
    requiredCounts[ingredient.item] = (requiredCounts[ingredient.item] ?? 0) + ingredient.amount;
  }

  for (const [item, amount] of Object.entries(requiredCounts)) {
    assert(harvestableCounts[item] >= amount, `recipe requires more ${item} than the board contains`);
  }

  const totalRequired = Object.values(requiredCounts).reduce((total, amount) => total + amount, 0);
  assert(totalRequired <= digLimit, "recipe requires more digs than the level allows");

  return level;
}

function validateLevelCollection(levels) {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new TypeError("levels must be a non-empty array");
  }

  const ids = new Set();
  for (const level of levels) {
    validateLevelDefinition(level);
    if (ids.has(level.id)) {
      throw new TypeError(`Invalid level definition: duplicate level id '${level.id}'`);
    }
    ids.add(level.id);
  }
}

function findLevel(levelOrId, levels) {
  validateLevelCollection(levels);

  const index = typeof levelOrId === "number"
    ? levelOrId
    : typeof levelOrId === "string"
      ? levels.findIndex((level) => level.id === levelOrId)
      : levels.indexOf(levelOrId);

  if (!Number.isInteger(index) || index < 0 || index >= levels.length) {
    throw new RangeError("Unknown level");
  }

  return { level: levels[index], index };
}

function createBoard(level) {
  return {
    rows: level.board.rows,
    columns: level.board.columns,
    cells: level.tiles.flatMap((row, rowIndex) => row.map((tile, columnIndex) => ({
      id: `${rowIndex}:${columnIndex}`,
      row: rowIndex,
      column: columnIndex,
      isDug: false,
      tile: cloneTile(tile),
    }))),
  };
}

function startAction(level, type = ACTION_TYPE.LEVEL_STARTED, extra = {}) {
  return {
    type,
    levelId: level.id,
    sound: type === ACTION_TYPE.RESTARTED ? "restart" : "level-start",
    ...extra,
  };
}

/**
 * Builds a new level state. `levelOrId` accepts a numeric index, an id, or the
 * exact level object from `levels` (the default collection is LEVELS).
 */
export function createLevelState(levelOrId = 0, levels = LEVELS) {
  const { level, index } = findLevel(levelOrId, levels);
  return {
    levelId: level.id,
    levelIndex: index,
    levelName: level.name,
    board: createBoard(level),
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
export function createGameState(levels = LEVELS) {
  return createLevelState(0, levels);
}

/**
 * Reports progress in recipe order. This is presentation-friendly but remains
 * pure: callers can safely derive UI from it without changing state.
 */
export function getRecipeProgress(state) {
  return state.recipe.ingredients.map(({ item, amount }) => ({
    item,
    required: amount,
    collected: Math.min(state.inventory[item] ?? 0, amount),
    remaining: Math.max(amount - (state.inventory[item] ?? 0), 0),
  }));
}

/** Returns true when every recipe requirement is present in the inventory. */
export function isRecipeReady(recipe, inventory) {
  return recipe.ingredients.every(({ item, amount }) => (inventory[item] ?? 0) >= amount);
}

function rejectDig(state, reason) {
  return {
    ...state,
    lastAction: {
      type: ACTION_TYPE.DIG_REJECTED,
      reason,
      sound: "error",
    },
  };
}

function getCellIndex(board, row, column) {
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
export function digCell(state, row, column) {
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
  if (currentCell.isDug) {
    return rejectDig(state, "cell-already-dug");
  }

  const cell = { ...currentCell, isDug: true };
  const cells = state.board.cells.map((candidate, candidateIndex) => (
    candidateIndex === index ? cell : candidate
  ));
  const inventory = { ...state.inventory };
  if (cell.tile.kind === TILE_KIND.INGREDIENT) {
    inventory[cell.tile.item] = (inventory[cell.tile.item] ?? 0) + 1;
  }

  const digsUsed = state.digsUsed + 1;
  const recipeReady = isRecipeReady(state.recipe, inventory);
  const outOfDigs = digsUsed >= state.digLimit;
  const status = recipeReady
    ? GAME_STATUS.READY_TO_COOK
    : outOfDigs
      ? GAME_STATUS.OUT_OF_DIGS
      : GAME_STATUS.DIGGING;

  let type = ACTION_TYPE.DUG_EMPTY;
  let sound = "dig";
  if (cell.tile.kind === TILE_KIND.ROCK) {
    type = ACTION_TYPE.DUG_ROCK;
    sound = "rock";
  } else if (cell.tile.kind === TILE_KIND.INGREDIENT) {
    type = ACTION_TYPE.DUG_INGREDIENT;
    sound = "harvest";
  }
  if (recipeReady) {
    type = ACTION_TYPE.RECIPE_READY;
    sound = "recipe-ready";
  } else if (outOfDigs) {
    type = ACTION_TYPE.OUT_OF_DIGS;
    sound = "out-of-digs";
  }

  return {
    ...state,
    board: { ...state.board, cells },
    inventory,
    digsUsed,
    status,
    lastAction: {
      type,
      row,
      column,
      tile: cloneTile(cell.tile),
      sound,
    },
  };
}

/**
 * Cooks a ready recipe. It starts the next level when one exists, or marks the
 * game complete after the last level. If cooking is unavailable, it returns a
 * state with a `cook-blocked` action and otherwise unchanged game data.
 */
export function cookAndAdvance(state, levels = LEVELS) {
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

  const completedLevelIds = [...state.completedLevelIds, state.levelId];
  const currentLevel = levels[currentIndex];
  const nextLevel = levels[currentIndex + 1];

  if (!nextLevel) {
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

  const nextState = createLevelState(currentIndex + 1, levels);
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

/** Restores the current level's original deterministic layout and dig budget. */
export function restartLevel(state, levels = LEVELS) {
  const { level } = findLevel(state.levelId, levels);
  const restarted = createLevelState(state.levelId, levels);
  return {
    ...restarted,
    completedLevelIds: [...state.completedLevelIds],
    lastAction: startAction(level, ACTION_TYPE.RESTARTED),
  };
}

/** Returns the revealed tile for a cell, or null while it remains covered. */
export function getRevealedTile(cell) {
  return cell?.isDug ? cloneTile(cell.tile) : null;
}

/** A small utility for serializable UI snapshots and tests. */
export function getRemainingDigs(state) {
  return Math.max(state.digLimit - state.digsUsed, 0);
}
