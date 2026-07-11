import { describe, expect, it } from "vitest";

import { LEVELS, TILE_KIND } from "./levels";
import {
  ACTION_TYPE,
  GAME_STATUS,
  cookAndAdvance,
  createGameState,
  createLevelState,
  digCell,
  getRecipeProgress,
  getRemainingDigs,
  getRevealedTile,
  isRecipeReady,
  restartLevel,
  validateLevelDefinition,
} from "./engine";
import type { GameCell, GameState, IngredientId, LevelDefinition, TileKind } from "./types";

function harvestAllRequired(state: GameState): GameState {
  let next = state;
  for (const cell of state.board.cells) {
    if (cell.tile.kind === TILE_KIND.INGREDIENT) {
      next = digCell(next, cell.row, cell.column);
    }
  }
  return next;
}

const keepAuthoredOrder = (): number => 0.999999;
const reverseHarvestOrder = (): number => 0;

function findCell(
  state: GameState,
  predicate: (cell: GameCell) => boolean,
  description: string,
): GameCell {
  const cell = state.board.cells.find(predicate);
  if (cell === undefined) {
    throw new Error(`Expected to find ${description}`);
  }
  return cell;
}

function findIngredientCell(state: GameState, item: IngredientId): GameCell {
  return findCell(
    state,
    (cell) => cell.tile.kind === TILE_KIND.INGREDIENT && cell.tile.item === item,
    item,
  );
}

function findTileKindCell(state: GameState, kind: TileKind): GameCell {
  return findCell(state, (cell) => cell.tile.kind === kind, kind);
}

function boardLayout(state: GameState): string[] {
  return state.board.cells.map((cell) => (
    cell.tile.kind === TILE_KIND.INGREDIENT ? `${cell.tile.kind}:${cell.tile.item}` : cell.tile.kind
  ));
}

function sortedTilePool(state: GameState): string[] {
  return [...boardLayout(state)].sort();
}

function levelAt(index: number): LevelDefinition {
  const level = LEVELS[index];
  if (level === undefined) {
    throw new Error(`Expected level ${index} to exist`);
  }
  return level;
}

describe("game engine", () => {
  it("level templates are complete and become gradually more complex", () => {
    expect(LEVELS).toHaveLength(4);

    let previousArea = 0;
    let previousHarvests = 0;
    for (const level of LEVELS) {
      expect(validateLevelDefinition(level)).toBe(level);
      expect(level.tiles).toHaveLength(level.board.rows);
      expect(level.tiles.flat()).toHaveLength(level.board.rows * level.board.columns);

      const area = level.board.rows * level.board.columns;
      const harvests = level.recipe.ingredients.reduce((total, ingredient) => total + ingredient.amount, 0);
      expect(area).toBeGreaterThan(previousArea);
      expect(harvests).toBeGreaterThan(previousHarvests);
      expect(level.tiles.flat().some((tile) => tile.kind === TILE_KIND.ROCK)).toBe(true);
      expect(level.tiles.flat().some((tile) => tile.kind === TILE_KIND.EMPTY)).toBe(true);

      previousArea = area;
      previousHarvests = harvests;
    }
  });

  it("a generated board shuffles harvest locations while preserving its tile pool and rocks", () => {
    const authored = createLevelState("root-cellar", LEVELS, keepAuthoredOrder);
    const shuffled = createLevelState("root-cellar", LEVELS, reverseHarvestOrder);
    const repeated = createLevelState("root-cellar", LEVELS, reverseHarvestOrder);

    expect(sortedTilePool(shuffled)).toEqual(sortedTilePool(authored));
    expect(boardLayout(repeated)).toEqual(boardLayout(shuffled));
    expect(
      authored.board.cells
        .filter((cell) => cell.tile.kind === TILE_KIND.INGREDIENT)
        .map((cell) => cell.id),
    ).not.toEqual(
      shuffled.board.cells
        .filter((cell) => cell.tile.kind === TILE_KIND.INGREDIENT)
        .map((cell) => cell.id),
    );
    expect(
      authored.board.cells
        .filter((cell) => cell.tile.kind === TILE_KIND.ROCK)
        .map((cell) => cell.id),
    ).toEqual(
      shuffled.board.cells
        .filter((cell) => cell.tile.kind === TILE_KIND.ROCK)
        .map((cell) => cell.id),
    );
  });

  it("createGameState builds an untouched first level with a hidden board", () => {
    const state = createGameState();
    const firstLevel = levelAt(0);

    expect(state.levelId).toBe(firstLevel.id);
    expect(state.status).toBe(GAME_STATUS.DIGGING);
    expect(state.digsUsed).toBe(0);
    expect(state.digLimit).toBe(firstLevel.digLimit);
    expect(state.inventory).toEqual({});
    expect(state.board.cells).toHaveLength(12);
    expect(state.board.cells.every((cell) => cell.isDug === false)).toBe(true);
    expect(getRevealedTile(state.board.cells[0])).toBeNull();
    expect(state.lastAction.type).toBe(ACTION_TYPE.LEVEL_STARTED);
  });

  it("digging an ingredient is immutable, reveals it, and updates inventory", () => {
    const before = createLevelState("root-cellar");
    const carrotCell = findIngredientCell(before, "carrot");
    const after = digCell(before, carrotCell.row, carrotCell.column);
    const afterCarrot = after.board.cells.find((cell) => cell.id === carrotCell.id);

    expect(after).not.toBe(before);
    expect(before.digsUsed).toBe(0);
    expect(carrotCell.isDug).toBe(false);
    expect(after.digsUsed).toBe(1);
    expect(afterCarrot?.isDug).toBe(true);
    expect(after.inventory).toEqual({ carrot: 1 });
    expect(getRevealedTile(afterCarrot)).toEqual({
      kind: TILE_KIND.INGREDIENT,
      item: "carrot",
    });
    expect(after.lastAction.type).toBe(ACTION_TYPE.DUG_INGREDIENT);
    expect(after.lastAction.sound).toBe("harvest");
  });

  it("empty tiles and rocks consume digs but do not add food", () => {
    const start = createLevelState(0);
    const emptyCell = findTileKindCell(start, TILE_KIND.EMPTY);
    const rockCell = findTileKindCell(start, TILE_KIND.ROCK);
    const afterEmpty = digCell(start, emptyCell.row, emptyCell.column);
    const afterRock = digCell(afterEmpty, rockCell.row, rockCell.column);

    expect(afterEmpty.lastAction.type).toBe(ACTION_TYPE.DUG_EMPTY);
    expect(afterRock.lastAction.type).toBe(ACTION_TYPE.DUG_ROCK);
    expect(afterRock.digsUsed).toBe(2);
    expect(getRemainingDigs(afterRock)).toBe(start.digLimit - 2);
    expect(afterRock.inventory).toEqual({});
  });

  it("invalid and repeated digs never consume the budget", () => {
    const start = createLevelState(0);
    const outside = digCell(start, -1, 0);
    const firstCell = findCell(outside, () => true, "the first board cell");
    const firstDig = digCell(outside, firstCell.row, firstCell.column);
    const repeated = digCell(firstDig, firstCell.row, firstCell.column);

    expect(outside.digsUsed).toBe(0);
    expect(outside.lastAction).toMatchObject({
      type: ACTION_TYPE.DIG_REJECTED,
      reason: "outside-board",
    });
    expect(firstDig.digsUsed).toBe(1);
    expect(repeated.digsUsed).toBe(1);
    expect(repeated.lastAction).toMatchObject({
      type: ACTION_TYPE.DIG_REJECTED,
      reason: "cell-already-dug",
    });
  });

  it("the recipe becomes cookable only after every required ingredient is collected", () => {
    const start = createLevelState("root-cellar");
    const carrotCell = findIngredientCell(start, "carrot");
    const carrot = digCell(start, carrotCell.row, carrotCell.column);
    const onionCell = findIngredientCell(carrot, "onion");
    const ready = digCell(carrot, onionCell.row, onionCell.column);

    expect(isRecipeReady(carrot.recipe, carrot.inventory)).toBe(false);
    expect(carrot.status).toBe(GAME_STATUS.DIGGING);
    expect(isRecipeReady(ready.recipe, ready.inventory)).toBe(true);
    expect(ready.status).toBe(GAME_STATUS.READY_TO_COOK);
    expect(ready.lastAction.type).toBe(ACTION_TYPE.RECIPE_READY);
    expect(getRecipeProgress(ready)).toEqual([
      { item: "carrot", required: 1, collected: 1, remaining: 0 },
      { item: "onion", required: 1, collected: 1, remaining: 0 },
    ]);
  });

  it("running out of digs fails the level unless the final dig completes its recipe", () => {
    let state = createLevelState("root-cellar");
    const nonIngredients = state.board.cells
      .filter((cell) => cell.tile.kind !== TILE_KIND.INGREDIENT)
      .slice(0, state.digLimit);
    for (const cell of nonIngredients) {
      state = digCell(state, cell.row, cell.column);
    }

    expect(state.digsUsed).toBe(state.digLimit);
    expect(state.status).toBe(GAME_STATUS.OUT_OF_DIGS);
    expect(state.lastAction.type).toBe(ACTION_TYPE.OUT_OF_DIGS);
    const onionCell = findIngredientCell(state, "onion");
    expect(digCell(state, onionCell.row, onionCell.column).digsUsed).toBe(state.digsUsed);
  });

  it("cooking advances a ready state and preserves completed-level history", () => {
    const ready = harvestAllRequired(createGameState());
    const advanced = cookAndAdvance(ready);
    const secondLevel = levelAt(1);
    const firstLevel = levelAt(0);

    expect(ready.status).toBe(GAME_STATUS.READY_TO_COOK);
    expect(advanced.levelId).toBe(secondLevel.id);
    expect(advanced.levelIndex).toBe(1);
    expect(advanced.status).toBe(GAME_STATUS.DIGGING);
    expect(advanced.digsUsed).toBe(0);
    expect(advanced.inventory).toEqual({});
    expect(advanced.completedLevelIds).toEqual([firstLevel.id]);
    expect(advanced.lastAction.type).toBe(ACTION_TYPE.LEVEL_ADVANCED);
    expect(advanced.lastAction.sound).toBe("cook");
  });

  it("cooking before a recipe is ready is rejected without changing the board", () => {
    const start = createGameState();
    const blocked = cookAndAdvance(start);

    expect(blocked.levelId).toBe(start.levelId);
    expect(blocked.digsUsed).toBe(start.digsUsed);
    expect(blocked.board).toBe(start.board);
    expect(blocked.lastAction.type).toBe(ACTION_TYPE.COOK_BLOCKED);
  });

  it("cooking the final recipe completes the game rather than creating a missing level", () => {
    const finalLevel = levelAt(LEVELS.length - 1);
    const finalState = harvestAllRequired(createLevelState(LEVELS.length - 1));
    const complete = cookAndAdvance(finalState);

    expect(finalState.status).toBe(GAME_STATUS.READY_TO_COOK);
    expect(complete.levelId).toBe(finalLevel.id);
    expect(complete.status).toBe(GAME_STATUS.COMPLETE);
    expect(complete.completedLevelIds).toEqual([finalLevel.id]);
    expect(complete.lastAction.type).toBe(ACTION_TYPE.GAME_COMPLETE);
  });

  it("restart restores a pristine reshuffled board while keeping prior history", () => {
    const started = createGameState(LEVELS, keepAuthoredOrder);
    const dug = digCell(started, 0, 0);
    const stateWithHistory: GameState = { ...dug, completedLevelIds: ["earlier-level"] };
    const restarted = restartLevel(stateWithHistory, LEVELS, reverseHarvestOrder);

    expect(restarted.levelId).toBe(started.levelId);
    expect(restarted.digsUsed).toBe(0);
    expect(restarted.status).toBe(GAME_STATUS.DIGGING);
    expect(restarted.inventory).toEqual({});
    expect(restarted.board.cells.every((cell) => !cell.isDug)).toBe(true);
    expect(restarted.completedLevelIds).toEqual(["earlier-level"]);
    expect(restarted.lastAction.type).toBe(ACTION_TYPE.RESTARTED);
    expect(boardLayout(restarted)).not.toEqual(boardLayout(started));
  });

  it("malformed level data is rejected before a game can start", () => {
    const invalidLevel = {
      id: "broken",
      name: "Broken board",
      board: { rows: 1, columns: 1 },
      digLimit: 1,
      recipe: {
        id: "impossible",
        name: "Impossible Soup",
        ingredients: [{ item: "carrot", amount: 2 }],
      },
      tiles: [[{ kind: TILE_KIND.INGREDIENT, item: "carrot" }]],
    };

    expect(() => validateLevelDefinition(invalidLevel)).toThrow(/requires more carrot/);
    expect(() => createLevelState("missing-level")).toThrow(/Unknown level/);
  });

  it("level validation rejects duplicate recipe rows and impossible dig budgets", () => {
    const duplicateIngredient = {
      id: "duplicate-recipe-item",
      name: "Duplicate recipe item",
      board: { rows: 1, columns: 2 },
      digLimit: 2,
      recipe: {
        id: "double-carrot",
        name: "Double Carrot",
        ingredients: [{ item: "carrot", amount: 1 }, { item: "carrot", amount: 1 }],
      },
      tiles: [[
        { kind: TILE_KIND.INGREDIENT, item: "carrot" },
        { kind: TILE_KIND.INGREDIENT, item: "carrot" },
      ]],
    };
    const impossibleBudget = {
      ...duplicateIngredient,
      id: "impossible-dig-budget",
      digLimit: 1,
      recipe: {
        id: "two-digs-needed",
        name: "Two Digs Needed",
        ingredients: [{ item: "carrot", amount: 2 }],
      },
    };

    expect(() => validateLevelDefinition(duplicateIngredient)).toThrow(/repeats carrot/);
    expect(() => validateLevelDefinition(impossibleBudget)).toThrow(/requires more digs/);
  });
});
