import { useCallback, useEffect, useRef, useState } from 'react';

import { ACTION_COPY, ACTION_SOUNDS } from '../content';
import {
  ACTION_TYPE,
  cookAndAdvance,
  createGameState,
  digCell,
  restartLevel,
} from '../engine';
import type { GameState } from '../types';
import { Soundscape } from '../../../shared/audio/Soundscape';

const SOUND_PREFERENCE_KEY = 'root-and-ritual:sound';

function readSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'off';
  } catch {
    return true;
  }
}

function persistSoundPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Storage may be disabled; sound still works for this session.
  }
}

export interface GameController {
  readonly game: GameState;
  readonly soundEnabled: boolean;
  readonly activeTileId: string | null;
  readonly toast: string | null;
  readonly dig: (row: number, column: number) => void;
  readonly cook: () => void;
  readonly restart: () => void;
  readonly playAgain: () => void;
  readonly toggleSound: () => void;
}

/** Owns UI-side effects around the framework-independent game engine. */
export function useGame(): GameController {
  const soundscapeRef = useRef(new Soundscape());
  const [game, setGame] = useState<GameState>(() => createGameState());
  const gameRef = useRef(game);
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference);
  const [activeTileId, setActiveTileId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | undefined>(undefined);

  const commit = useCallback((nextGame: GameState, activeCellId: string | null = null): void => {
    gameRef.current = nextGame;
    setGame(nextGame);
    setActiveTileId(activeCellId);

    soundscapeRef.current.play(ACTION_SOUNDS[nextGame.lastAction.sound]);
    if (nextGame.lastAction.type === ACTION_TYPE.OUT_OF_DIGS) {
      setToast(null);
      return;
    }

    setToast(ACTION_COPY[nextGame.lastAction.type]);
  }, []);

  useEffect(() => {
    soundscapeRef.current.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    if (activeTileId === null) return undefined;

    const timeout = window.setTimeout(() => setActiveTileId(null), 480);
    return () => window.clearTimeout(timeout);
  }, [activeTileId]);

  useEffect(() => {
    window.clearTimeout(toastTimeoutRef.current);
    if (toast === null) return undefined;

    toastTimeoutRef.current = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(toastTimeoutRef.current);
  }, [toast]);

  const dig = useCallback((row: number, column: number): void => {
    const previous = gameRef.current;
    const next = digCell(previous, row, column);
    const activeCellId = next.digsUsed > previous.digsUsed ? `${row}:${column}` : null;
    commit(next, activeCellId);
  }, [commit]);

  const cook = useCallback((): void => {
    commit(cookAndAdvance(gameRef.current));
  }, [commit]);

  const restart = useCallback((): void => {
    commit(restartLevel(gameRef.current));
  }, [commit]);

  const playAgain = useCallback((): void => {
    const next = createGameState();
    gameRef.current = next;
    setGame(next);
    setActiveTileId(null);
    soundscapeRef.current.play('tap');
    setToast('A fresh season is ready to dig.');
  }, []);

  const toggleSound = useCallback((): void => {
    setSoundEnabled((current) => {
      const next = !current;
      soundscapeRef.current.setEnabled(next);
      if (next) soundscapeRef.current.play('tap');
      persistSoundPreference(next);
      return next;
    });
  }, []);

  return {
    game,
    soundEnabled,
    activeTileId,
    toast,
    dig,
    cook,
    restart,
    playAgain,
    toggleSound,
  };
}
