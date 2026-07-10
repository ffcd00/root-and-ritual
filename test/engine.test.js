import assert from "node:assert/strict";
import test from "node:test";

import { LEVELS, TILE_KIND } from "../src/game/data.js";
import {
  ACTION_TYPE,
  GAME_STATUS,
  cookAndAdvance,
  createGameState,
  createLevelState,
  digCell,
  getRecipeProgress,
  getRevealedTile,
  getRemainingDigs,
  isRecipeReady,
  restartLevel,
  validateLevelDefinition,
} from "../src/game/engine.js";

function harvestAllRequired(state) {
  let next = state;
  for (const cell of state.board.cells) {
    if (cell.tile.kind === TILE_KIND.INGREDIENT) {
      next = digCell(next, cell.row, cell.column);
    }
  }
  return next;
}

const keepAuthoredOrder = () => 0.999999;
const reverseHarvestOrder = () => 0;

function findCell(state, predicate, description) {
  const cell = state.board.cells.find(predicate);
  assert.ok(cell, `Expected to find ${description}`);
  return cell;
}

function findIngredientCell(state, item) {
  return findCell(
    state,
    (cell) => cell.tile.kind === TILE_KIND.INGREDIENT && cell.tile.item === item,
    item,
  );
}

function findTileKindCell(state, kind) {
  return findCell(state, (cell) => cell.tile.kind === kind, kind);
}

function boardLayout(state) {
  return state.board.cells.map((cell) => (
    cell.tile.kind === TILE_KIND.INGREDIENT ? `${cell.tile.kind}:${cell.tile.item}` : cell.tile.kind
  ));
}

function sortedTilePool(state) {
  return [...boardLayout(state)].sort();
}

test("level templates are complete and become gradually more complex", () => {
  assert.equal(LEVELS.length, 4);

  let previousArea = 0;
  let previousHarvests = 0;
  for (const level of LEVELS) {
    assert.equal(validateLevelDefinition(level), level);
    assert.equal(level.tiles.length, level.board.rows);
    assert.equal(level.tiles.flat().length, level.board.rows * level.board.columns);

    const area = level.board.rows * level.board.columns;
    const harvests = level.recipe.ingredients.reduce((total, ingredient) => total + ingredient.amount, 0);
    assert.ok(area > previousArea);
    assert.ok(harvests > previousHarvests);
    assert.ok(level.tiles.flat().some((tile) => tile.kind === TILE_KIND.ROCK));
    assert.ok(level.tiles.flat().some((tile) => tile.kind === TILE_KIND.EMPTY));

    previousArea = area;
    previousHarvests = harvests;
  }
});

test("a generated board shuffles harvest locations while preserving its tile pool and rocks", () => {
  const authored = createLevelState("root-cellar", LEVELS, keepAuthoredOrder);
  const shuffled = createLevelState("root-cellar", LEVELS, reverseHarvestOrder);
  const repeated = createLevelState("root-cellar", LEVELS, reverseHarvestOrder);

  assert.deepEqual(sortedTilePool(shuffled), sortedTilePool(authored));
  assert.deepEqual(boardLayout(repeated), boardLayout(shuffled));
  assert.notDeepEqual(
    authored.board.cells.filter((cell) => cell.tile.kind === TILE_KIND.INGREDIENT).map((cell) => cell.id),
    shuffled.board.cells.filter((cell) => cell.tile.kind === TILE_KIND.INGREDIENT).map((cell) => cell.id),
  );
  assert.deepEqual(
    authored.board.cells.filter((cell) => cell.tile.kind === TILE_KIND.ROCK).map((cell) => cell.id),
    shuffled.board.cells.filter((cell) => cell.tile.kind === TILE_KIND.ROCK).map((cell) => cell.id),
  );
});

test("createGameState builds an untouched first level with a hidden board", () => {
  const state = createGameState();

  assert.equal(state.levelId, LEVELS[0].id);
  assert.equal(state.status, GAME_STATUS.DIGGING);
  assert.equal(state.digsUsed, 0);
  assert.equal(state.digLimit, LEVELS[0].digLimit);
  assert.deepEqual(state.inventory, {});
  assert.equal(state.board.cells.length, 12);
  assert.ok(state.board.cells.every((cell) => cell.isDug === false));
  assert.equal(getRevealedTile(state.board.cells[0]), null);
  assert.equal(state.lastAction.type, ACTION_TYPE.LEVEL_STARTED);
});

test("digging an ingredient is immutable, reveals it, and updates inventory", () => {
  const before = createLevelState("root-cellar");
  const carrotCell = findIngredientCell(before, "carrot");
  const after = digCell(before, carrotCell.row, carrotCell.column);
  const afterCarrot = after.board.cells.find((cell) => cell.id === carrotCell.id);

  assert.notEqual(after, before);
  assert.equal(before.digsUsed, 0);
  assert.equal(carrotCell.isDug, false);
  assert.equal(after.digsUsed, 1);
  assert.equal(afterCarrot.isDug, true);
  assert.deepEqual(after.inventory, { carrot: 1 });
  assert.deepEqual(getRevealedTile(afterCarrot), {
    kind: TILE_KIND.INGREDIENT,
    item: "carrot",
  });
  assert.equal(after.lastAction.type, ACTION_TYPE.DUG_INGREDIENT);
  assert.equal(after.lastAction.sound, "harvest");
});

test("empty tiles and rocks consume digs but do not add food", () => {
  const start = createLevelState(0);
  const emptyCell = findTileKindCell(start, TILE_KIND.EMPTY);
  const rockCell = findTileKindCell(start, TILE_KIND.ROCK);
  const afterEmpty = digCell(start, emptyCell.row, emptyCell.column);
  const afterRock = digCell(afterEmpty, rockCell.row, rockCell.column);

  assert.equal(afterEmpty.lastAction.type, ACTION_TYPE.DUG_EMPTY);
  assert.equal(afterRock.lastAction.type, ACTION_TYPE.DUG_ROCK);
  assert.equal(afterRock.digsUsed, 2);
  assert.equal(getRemainingDigs(afterRock), start.digLimit - 2);
  assert.deepEqual(afterRock.inventory, {});
});

test("invalid and repeated digs never consume the budget", () => {
  const start = createLevelState(0);
  const outside = digCell(start, -1, 0);
  const firstCell = outside.board.cells[0];
  const firstDig = digCell(outside, firstCell.row, firstCell.column);
  const repeated = digCell(firstDig, firstCell.row, firstCell.column);

  assert.equal(outside.digsUsed, 0);
  assert.equal(outside.lastAction.reason, "outside-board");
  assert.equal(firstDig.digsUsed, 1);
  assert.equal(repeated.digsUsed, 1);
  assert.equal(repeated.lastAction.type, ACTION_TYPE.DIG_REJECTED);
  assert.equal(repeated.lastAction.reason, "cell-already-dug");
});

test("the recipe becomes cookable only after every required ingredient is collected", () => {
  const start = createLevelState("root-cellar");
  const carrotCell = findIngredientCell(start, "carrot");
  const carrot = digCell(start, carrotCell.row, carrotCell.column);
  const onionCell = findIngredientCell(carrot, "onion");
  const ready = digCell(carrot, onionCell.row, onionCell.column);

  assert.equal(isRecipeReady(carrot.recipe, carrot.inventory), false);
  assert.equal(carrot.status, GAME_STATUS.DIGGING);
  assert.equal(isRecipeReady(ready.recipe, ready.inventory), true);
  assert.equal(ready.status, GAME_STATUS.READY_TO_COOK);
  assert.equal(ready.lastAction.type, ACTION_TYPE.RECIPE_READY);
  assert.deepEqual(getRecipeProgress(ready), [
    { item: "carrot", required: 1, collected: 1, remaining: 0 },
    { item: "onion", required: 1, collected: 1, remaining: 0 },
  ]);
});

test("running out of digs fails the level unless the final dig completes its recipe", () => {
  let state = createLevelState("root-cellar");
  const nonIngredients = state.board.cells
    .filter((cell) => cell.tile.kind !== TILE_KIND.INGREDIENT)
    .slice(0, state.digLimit);
  for (const cell of nonIngredients) {
    state = digCell(state, cell.row, cell.column);
  }

  assert.equal(state.digsUsed, state.digLimit);
  assert.equal(state.status, GAME_STATUS.OUT_OF_DIGS);
  assert.equal(state.lastAction.type, ACTION_TYPE.OUT_OF_DIGS);
  const onionCell = findIngredientCell(state, "onion");
  assert.equal(digCell(state, onionCell.row, onionCell.column).digsUsed, state.digsUsed);
});

test("cooking advances a ready state and preserves completed-level history", () => {
  const ready = harvestAllRequired(createGameState());
  const advanced = cookAndAdvance(ready);

  assert.equal(ready.status, GAME_STATUS.READY_TO_COOK);
  assert.equal(advanced.levelId, LEVELS[1].id);
  assert.equal(advanced.levelIndex, 1);
  assert.equal(advanced.status, GAME_STATUS.DIGGING);
  assert.equal(advanced.digsUsed, 0);
  assert.deepEqual(advanced.inventory, {});
  assert.deepEqual(advanced.completedLevelIds, [LEVELS[0].id]);
  assert.equal(advanced.lastAction.type, ACTION_TYPE.LEVEL_ADVANCED);
  assert.equal(advanced.lastAction.sound, "cook");
});

test("cooking before a recipe is ready is rejected without changing the board", () => {
  const start = createGameState();
  const blocked = cookAndAdvance(start);

  assert.equal(blocked.levelId, start.levelId);
  assert.equal(blocked.digsUsed, start.digsUsed);
  assert.equal(blocked.board, start.board);
  assert.equal(blocked.lastAction.type, ACTION_TYPE.COOK_BLOCKED);
});

test("cooking the final recipe completes the game rather than creating a missing level", () => {
  const finalState = harvestAllRequired(createLevelState(LEVELS.length - 1));
  const complete = cookAndAdvance(finalState);

  assert.equal(finalState.status, GAME_STATUS.READY_TO_COOK);
  assert.equal(complete.levelId, LEVELS.at(-1).id);
  assert.equal(complete.status, GAME_STATUS.COMPLETE);
  assert.deepEqual(complete.completedLevelIds, [LEVELS.at(-1).id]);
  assert.equal(complete.lastAction.type, ACTION_TYPE.GAME_COMPLETE);
});

test("restart restores a pristine reshuffled board while keeping prior history", () => {
  const started = createGameState(LEVELS, keepAuthoredOrder);
  const dug = digCell(started, 0, 0);
  const stateWithHistory = { ...dug, completedLevelIds: ["earlier-level"] };
  const restarted = restartLevel(stateWithHistory, LEVELS, reverseHarvestOrder);

  assert.equal(restarted.levelId, started.levelId);
  assert.equal(restarted.digsUsed, 0);
  assert.equal(restarted.status, GAME_STATUS.DIGGING);
  assert.deepEqual(restarted.inventory, {});
  assert.ok(restarted.board.cells.every((cell) => !cell.isDug));
  assert.deepEqual(restarted.completedLevelIds, ["earlier-level"]);
  assert.equal(restarted.lastAction.type, ACTION_TYPE.RESTARTED);
  assert.notDeepEqual(boardLayout(restarted), boardLayout(started));
});

test("malformed level data is rejected before a game can start", () => {
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

  assert.throws(() => validateLevelDefinition(invalidLevel), /requires more carrot/);
  assert.throws(() => createLevelState("missing-level"), /Unknown level/);
});

test("level validation rejects duplicate recipe rows and impossible dig budgets", () => {
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
    tiles: [[{ kind: TILE_KIND.INGREDIENT, item: "carrot" }, { kind: TILE_KIND.INGREDIENT, item: "carrot" }]],
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

  assert.throws(() => validateLevelDefinition(duplicateIngredient), /repeats carrot/);
  assert.throws(() => validateLevelDefinition(impossibleBudget), /requires more digs/);
});
