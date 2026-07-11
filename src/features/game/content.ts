import { ACTION_TYPE } from './engine';
import type { ActionType, SoundEffect } from './types';

export interface DishDetail {
  readonly emoji: string;
  readonly description: string;
}

export const DISH_DETAILS: Readonly<Record<string, DishDetail>> = {
  'root-soup': {
    emoji: '🥣',
    description: 'A mellow, garden-warm bowl for your first kitchen ritual.',
  },
  'garden-salsa': {
    emoji: '🥗',
    description: 'A bright little mix of sun-ripe vegetables and fragrant basil.',
  },
  'forest-saute': {
    emoji: '🍳',
    description: 'Earthy mushrooms meet garlic and a handful of tender greens.',
  },
  'harvest-chowder': {
    emoji: '🍲',
    description: 'A generous final pot built from the whole garden’s bounty.',
  },
};

export const FALLBACK_DISH: DishDetail = {
  emoji: '🍲',
  description: 'A beautiful dish gathered one fresh ingredient at a time.',
};

export const ACTION_COPY: Readonly<Record<ActionType, string>> = {
  [ACTION_TYPE.LEVEL_STARTED]: 'Tap a lush tile to start your harvest.',
  [ACTION_TYPE.DUG_EMPTY]: 'Only soft soil here. Keep looking!',
  [ACTION_TYPE.DUG_ROCK]: 'Clink! A stone used one of your digs.',
  [ACTION_TYPE.DUG_INGREDIENT]: 'Fresh from the ground — it went into your basket.',
  [ACTION_TYPE.RECIPE_READY]: 'Every ingredient is in the basket. Time to cook!',
  [ACTION_TYPE.OUT_OF_DIGS]: 'The garden is resting. Try this patch again.',
  [ACTION_TYPE.DIG_REJECTED]: 'That spot has already been checked.',
  [ACTION_TYPE.COOK_BLOCKED]: 'The recipe needs a few more ingredients.',
  [ACTION_TYPE.LEVEL_ADVANCED]: 'Delicious. A new garden patch is ready.',
  [ACTION_TYPE.GAME_COMPLETE]: 'The full seasonal menu is complete!',
  [ACTION_TYPE.RESTARTED]: 'Fresh patch, fresh chances. Start digging!',
};

export const ACTION_SOUNDS: Readonly<Record<SoundEffect, 'tap' | 'dig' | 'find' | 'rock' | 'cook' | 'win'>> = {
  'level-start': 'tap',
  restart: 'tap',
  dig: 'dig',
  rock: 'rock',
  harvest: 'find',
  'recipe-ready': 'find',
  'out-of-digs': 'rock',
  error: 'rock',
  cook: 'cook',
  'game-complete': 'win',
};
