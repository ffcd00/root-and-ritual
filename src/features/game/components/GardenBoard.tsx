import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';

import { GAME_STATUS, getRecipeProgress, getRemainingDigs } from '../engine';
import { INGREDIENTS, LEVELS, TILE_KIND } from '../levels';
import type { GameCell, GameState, Tile } from '../types';
import { useContainedGridSize } from '../../../shared/hooks/useContainedGridSize';

interface GardenBoardProps {
  readonly game: GameState;
  readonly activeTileId: string | null;
  readonly onDig: (row: number, column: number) => void;
}

function describeDugTile(tile: Tile): string {
  if (tile.kind === TILE_KIND.INGREDIENT) return `${INGREDIENTS[tile.item].label} found`;
  if (tile.kind === TILE_KIND.ROCK) return 'A rock was here';
  return 'Empty soil';
}

function TileArtwork({ tile }: { readonly tile: Tile | null }) {
  if (tile === null) return <span className="visually-hidden">Covered with grass</span>;
  if (tile.kind === TILE_KIND.INGREDIENT) {
    const ingredient = INGREDIENTS[tile.item];
    return (
      <>
        <span className="food-icon" aria-hidden="true">{ingredient.emoji}</span>
        <span className="visually-hidden">{ingredient.label} found</span>
      </>
    );
  }
  if (tile.kind === TILE_KIND.ROCK) {
    return (
      <>
        <span className="rock-art" aria-hidden="true" />
        <span className="visually-hidden">Rock</span>
      </>
    );
  }
  return <span className="visually-hidden">Empty soil</span>;
}

function GardenTile({ cell, active, isNew, onDig }: {
  readonly cell: GameCell;
  readonly active: boolean;
  readonly isNew: boolean;
  readonly onDig: (row: number, column: number) => void;
}) {
  const tile = cell.isDug ? cell.tile : null;
  const classes = [
    'garden-tile',
    cell.isDug ? 'is-dug' : '',
    tile?.kind === TILE_KIND.INGREDIENT ? 'is-found' : '',
    tile?.kind === TILE_KIND.ROCK ? 'is-rock' : '',
    tile?.kind === TILE_KIND.EMPTY ? 'is-empty' : '',
    isNew ? 'is-new' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      type="button"
      data-dig={`${cell.row}:${cell.column}`}
      data-cell-id={cell.id}
      aria-label={cell.isDug ? describeDugTile(cell.tile) : `Dig plot ${cell.row + 1}, ${cell.column + 1}`}
      disabled={!active || cell.isDug}
      onClick={() => onDig(cell.row, cell.column)}
    >
      {isNew ? <span className="dig-shovel" aria-hidden="true" /> : null}
      <TileArtwork tile={tile} />
    </button>
  );
}

function boardMessage(game: GameState): string {
  if (game.status === GAME_STATUS.READY_TO_COOK) return 'Your basket has everything. Cook the recipe!';
  if (game.status === GAME_STATUS.OUT_OF_DIGS) return 'No digs left for this patch.';
  if (game.status === GAME_STATUS.COMPLETE) return 'Every seasonal recipe is complete.';
  const remaining = getRemainingDigs(game);
  return `${remaining} careful dig${remaining === 1 ? '' : 's'} left — rocks count, too.`;
}

export function GardenBoard({ game, activeTileId, onDig }: GardenBoardProps) {
  const remainingDigs = getRemainingDigs(game);
  const progress = getRecipeProgress(game);
  const requiredTotal = game.recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.amount, 0);
  const collectedTotal = progress.reduce((sum, ingredient) => sum + ingredient.collected, 0);
  const active = game.status === GAME_STATUS.DIGGING;
  const { dimensions, regionRef } = useContainedGridSize(game.board.rows, game.board.columns);
  const boardCursorRef = useRef<HTMLSpanElement>(null);
  const cursorFrameRef = useRef<number | null>(null);
  const cursorPositionRef = useRef<{ x: number; y: number } | null>(null);
  const cursorVisibleRef = useRef(false);
  const gridStyle: CSSProperties & Record<'--columns' | '--rows', number> & Partial<Record<'--grid-width' | '--grid-height', string>> = {
    '--columns': game.board.columns,
    '--rows': game.board.rows,
    ...(dimensions === null ? {} : {
      '--grid-width': `${dimensions.width}px`,
      '--grid-height': `${dimensions.height}px`,
    }),
  };

  const hideBoardCursor = useCallback((): void => {
    if (cursorFrameRef.current !== null) {
      window.cancelAnimationFrame(cursorFrameRef.current);
      cursorFrameRef.current = null;
    }
    cursorPositionRef.current = null;
    if (!cursorVisibleRef.current) return;

    boardCursorRef.current?.removeAttribute('data-visible');
    cursorVisibleRef.current = false;
  }, []);

  useEffect(() => () => hideBoardCursor(), [hideBoardCursor]);

  useEffect(() => {
    if (!active) {
      hideBoardCursor();
    }
  }, [active, hideBoardCursor]);

  const moveBoardCursor = (event: PointerEvent<HTMLDivElement>): void => {
    const overDisabledTile = event.target instanceof Element
      && event.target.closest('.garden-tile:disabled') !== null;
    if (!active || overDisabledTile || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')) {
      hideBoardCursor();
      return;
    }

    const cursor = boardCursorRef.current;
    if (cursor === null) return;

    cursorPositionRef.current = {
      x: event.clientX - 24,
      y: event.clientY - 45,
    };
    if (!cursorVisibleRef.current) {
      cursor.setAttribute('data-visible', 'true');
      cursorVisibleRef.current = true;
    }
    if (cursorFrameRef.current !== null) return;

    cursorFrameRef.current = window.requestAnimationFrame(() => {
      const position = cursorPositionRef.current;
      if (cursor !== null && position !== null && cursorVisibleRef.current) {
        const { x, y } = position;
        cursor.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(var(--shovel-strike-angle))`;
      }
      cursorFrameRef.current = null;
    });
  };

  return (
    <section className="garden-panel" aria-labelledby="garden-heading">
      <div className="garden-toolbar">
        <div className="level-badge">
          <span className="sprout" aria-hidden="true">🌱</span>
          <span>Level {game.levelIndex + 1} of {LEVELS.length}</span>
        </div>
        <div className="garden-toolbar-right">
          <div className="collection-counter" aria-label="Ingredients collected">
            {collectedTotal}/{requiredTotal} <span aria-hidden="true">🧺</span>
          </div>
          <div className={`dig-counter ${remainingDigs <= 3 ? 'is-low' : ''}`} aria-label={`${remainingDigs} digs remaining`}>
            <span className="tool" aria-hidden="true">🛠</span>{remainingDigs}
          </div>
        </div>
      </div>
      <h2 id="garden-heading" className="visually-hidden">{game.levelName} garden</h2>
      <div
        className="garden-grid-region"
        ref={regionRef}
        data-diggable={active ? 'true' : undefined}
        onPointerEnter={moveBoardCursor}
        onPointerMove={moveBoardCursor}
        onPointerDown={hideBoardCursor}
        onPointerLeave={hideBoardCursor}
      >
        <div
          className="garden-grid"
          style={gridStyle}
          aria-label={`${game.board.rows} by ${game.board.columns} dig garden`}
        >
          {game.board.cells.map((cell) => (
            <GardenTile
              key={cell.id}
              cell={cell}
              active={active}
              isNew={activeTileId === cell.id}
              onDig={onDig}
            />
          ))}
        </div>
      </div>
      <span className="garden-pointer" ref={boardCursorRef} aria-hidden="true" />
      <div className="board-footer"><p className="board-message">{boardMessage(game)}</p></div>
    </section>
  );
}
