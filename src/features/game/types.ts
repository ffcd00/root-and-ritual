/**
 * Shared, framework-agnostic types for Root & Ritual's game domain.
 *
 * The engine treats game state as immutable. These types deliberately model
 * the authored level data separately from a generated board so UI layers can
 * render state without needing to know how a level is constructed.
 */

export type IngredientId =
  | "basil"
  | "carrot"
  | "corn"
  | "garlic"
  | "herb"
  | "mushroom"
  | "onion"
  | "pepper"
  | "potato"
  | "spinach"
  | "tomato";

export type TileKind = "ingredient" | "empty" | "rock";

export interface IngredientDefinition {
  readonly label: string;
  readonly emoji: string;
}

export interface IngredientTile {
  readonly kind: "ingredient";
  readonly item: IngredientId;
}

export interface EmptyTile {
  readonly kind: "empty";
}

export interface RockTile {
  readonly kind: "rock";
}

export type Tile = IngredientTile | EmptyTile | RockTile;

export interface BoardDimensions {
  readonly rows: number;
  readonly columns: number;
}

export interface RecipeIngredient {
  readonly item: IngredientId;
  readonly amount: number;
}

export interface Recipe {
  readonly id: string;
  readonly name: string;
  readonly ingredients: readonly RecipeIngredient[];
}

/** A validated, authored level before its movable tiles have been shuffled. */
export interface LevelDefinition {
  readonly id: string;
  readonly name: string;
  readonly board: BoardDimensions;
  readonly digLimit: number;
  readonly recipe: Recipe;
  readonly tiles: readonly (readonly Tile[])[];
}

/** Inventory values are omitted until at least one of that ingredient is found. */
export type Inventory = Partial<Record<IngredientId, number>>;

export interface GameCell {
  readonly id: string;
  readonly row: number;
  readonly column: number;
  readonly isDug: boolean;
  readonly tile: Tile;
}

export interface GameBoard extends BoardDimensions {
  readonly cells: readonly GameCell[];
}

export type GameStatus = "digging" | "ready-to-cook" | "out-of-digs" | "complete";

export type ActionType =
  | "level-started"
  | "dug-empty"
  | "dug-rock"
  | "dug-ingredient"
  | "recipe-ready"
  | "out-of-digs"
  | "dig-rejected"
  | "cook-blocked"
  | "level-advanced"
  | "game-complete"
  | "restarted";

export type SoundEffect =
  | "level-start"
  | "restart"
  | "dig"
  | "rock"
  | "harvest"
  | "recipe-ready"
  | "out-of-digs"
  | "error"
  | "cook"
  | "game-complete";

export type DigRejectionReason =
  | "level-is-not-diggable"
  | "dig-limit-reached"
  | "outside-board"
  | "cell-already-dug";

export interface LevelStartedAction {
  readonly type: "level-started";
  readonly levelId: string;
  readonly sound: "level-start";
}

export interface DugEmptyAction {
  readonly type: "dug-empty";
  readonly row: number;
  readonly column: number;
  readonly tile: EmptyTile;
  readonly sound: "dig";
}

export interface DugRockAction {
  readonly type: "dug-rock";
  readonly row: number;
  readonly column: number;
  readonly tile: RockTile;
  readonly sound: "rock";
}

export interface DugIngredientAction {
  readonly type: "dug-ingredient";
  readonly row: number;
  readonly column: number;
  readonly tile: IngredientTile;
  readonly sound: "harvest";
}

export interface RecipeReadyAction {
  readonly type: "recipe-ready";
  readonly row: number;
  readonly column: number;
  readonly tile: Tile;
  readonly sound: "recipe-ready";
}

export interface OutOfDigsAction {
  readonly type: "out-of-digs";
  readonly row: number;
  readonly column: number;
  readonly tile: Tile;
  readonly sound: "out-of-digs";
}

export interface DigRejectedAction {
  readonly type: "dig-rejected";
  readonly reason: DigRejectionReason;
  readonly sound: "error";
}

export interface CookBlockedAction {
  readonly type: "cook-blocked";
  readonly reason: "recipe-not-ready";
  readonly sound: "error";
}

export interface LevelAdvancedAction {
  readonly type: "level-advanced";
  readonly completedLevelId: string;
  readonly levelId: string;
  readonly recipeId: string;
  readonly sound: "cook";
}

export interface GameCompleteAction {
  readonly type: "game-complete";
  readonly completedLevelId: string;
  readonly recipeId: string;
  readonly sound: "game-complete";
}

export interface RestartedAction {
  readonly type: "restarted";
  readonly levelId: string;
  readonly sound: "restart";
}

export type GameAction =
  | LevelStartedAction
  | DugEmptyAction
  | DugRockAction
  | DugIngredientAction
  | RecipeReadyAction
  | OutOfDigsAction
  | DigRejectedAction
  | CookBlockedAction
  | LevelAdvancedAction
  | GameCompleteAction
  | RestartedAction;

export interface GameState {
  readonly levelId: string;
  readonly levelIndex: number;
  readonly levelName: string;
  readonly board: GameBoard;
  readonly recipe: Recipe;
  readonly inventory: Inventory;
  readonly digLimit: number;
  readonly digsUsed: number;
  readonly status: GameStatus;
  readonly completedLevelIds: readonly string[];
  readonly lastAction: GameAction;
}

export interface RecipeProgress {
  readonly item: IngredientId;
  readonly required: number;
  readonly collected: number;
  readonly remaining: number;
}

/** Inject a deterministic source when testing or replaying a board layout. */
export type RandomSource = () => number;

export type LevelReference = number | string | LevelDefinition;
