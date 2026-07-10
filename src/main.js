import { Soundscape } from './audio.js';
import { INGREDIENTS, TILE_KIND, LEVELS } from './game/data.js';
import {
  ACTION_TYPE,
  GAME_STATUS,
  cookAndAdvance,
  createGameState,
  digCell,
  getRecipeProgress,
  getRemainingDigs,
  restartLevel,
} from './game/engine.js';

const app = document.querySelector('#app');
const soundscape = new Soundscape();

const DISH_DETAILS = {
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

const ACTION_COPY = {
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

let game = createGameState();
let soundEnabled = readSoundPreference();
let toastTimer;
let activeTileId = null;
let queuedToast = null;

soundscape.setEnabled(soundEnabled);
render();

function readSoundPreference() {
  try {
    return window.localStorage.getItem('root-and-ritual:sound') !== 'off';
  } catch {
    return true;
  }
}

function saveSoundPreference() {
  try {
    window.localStorage.setItem('root-and-ritual:sound', soundEnabled ? 'on' : 'off');
  } catch {
    // Storage can be unavailable in private contexts; session audio still works.
  }
}

function render({ focusSelector = null } = {}) {
  const isFinished = game.status === GAME_STATUS.COMPLETE;
  const preferredFocus = isFinished ? '[data-play-again]' : focusSelector;

  app.innerHTML = `
    <div class="game-content" ${isFinished ? 'inert aria-hidden="true"' : ''}>
      <header class="topbar">
        <div class="brand" aria-label="Root and Ritual">
          <span class="brand-mark" aria-hidden="true">✦</span>
          <span>Root &amp; Ritual</span>
        </div>
        <div class="topbar-actions">
          <button
            class="icon-button"
            type="button"
            data-sound-toggle
            aria-label="${soundEnabled ? 'Mute sound effects' : 'Turn on sound effects'}"
            aria-pressed="${soundEnabled}"
            title="${soundEnabled ? 'Sound on' : 'Sound off'}"
          >${soundEnabled ? '🔊' : '🔇'}</button>
        </div>
      </header>
      <section class="game-layout" aria-label="Garden kitchen game">
        <aside class="side-rail">
          ${renderRecipeCard()}
          ${renderTipCard()}
          ${game.status === GAME_STATUS.OUT_OF_DIGS ? renderFailureCard() : ''}
        </aside>
        <section class="game-column">
          ${renderGarden()}
          ${renderInventory()}
          ${renderProgress()}
        </section>
      </section>
    </div>
    <div class="toast" role="status" aria-live="polite"></div>
    ${isFinished ? renderCompletionModal() : ''}
  `;

  attachListeners();

  if (queuedToast) {
    const message = queuedToast;
    queuedToast = null;
    showToast(message);
  }

  if (preferredFocus) {
    window.requestAnimationFrame(() => app.querySelector(preferredFocus)?.focus());
  }

  if (activeTileId) {
    const tileId = activeTileId;
    window.setTimeout(() => {
      document.querySelector(`[data-cell-id="${tileId}"]`)?.classList.remove('is-new');
      if (activeTileId === tileId) activeTileId = null;
    }, 480);
  }
}

function renderRecipeCard() {
  const dish = getDishDetails(game.recipe.id);
  const progress = getRecipeProgress(game);

  return `
    <section class="recipe-card card" aria-labelledby="recipe-title">
      <p class="eyebrow">Today's recipe</p>
      <div class="recipe-head">
        <h1 id="recipe-title">${escapeHtml(game.recipe.name)}</h1>
        <span class="dish-illustration" aria-hidden="true">${dish.emoji}</span>
      </div>
      <p class="recipe-description">${dish.description}</p>
      <div class="ingredient-list" aria-label="Recipe ingredients">
        ${progress.map(renderIngredientRow).join('')}
      </div>
      <div style="margin-top: 14px">
        <button
          class="button button--wide ${game.status === GAME_STATUS.READY_TO_COOK ? 'button--leaf' : ''}"
          type="button"
          data-cook
          ${game.status === GAME_STATUS.READY_TO_COOK ? '' : 'disabled'}
        >
          <span aria-hidden="true">${game.status === GAME_STATUS.READY_TO_COOK ? '🍳' : '🫕'}</span>
          ${game.status === GAME_STATUS.READY_TO_COOK ? 'Cook this recipe' : 'Gather ingredients'}
        </button>
      </div>
    </section>
  `;
}

function renderIngredientRow({ item, required, collected }) {
  const ingredient = INGREDIENTS[item];
  const complete = collected >= required;
  return `
    <div class="ingredient-row ${complete ? 'is-collected' : ''}">
      <span class="ingredient-name">
        <span class="food-icon" aria-hidden="true">${ingredient.emoji}</span>
        <span>${escapeHtml(ingredient.label)}</span>
      </span>
      <span class="ingredient-count" aria-label="${collected} of ${required}">${collected}/${required}</span>
    </div>
  `;
}

function renderTipCard() {
  const cells = game.board.rows * game.board.columns;
  const totalHarvests = game.recipe.ingredients.reduce((total, item) => total + item.amount, 0);
  return `
    <div class="tip-card" role="note">
      <span class="tip-symbol" aria-hidden="true">⛏</span>
      <p><strong>${cells} garden plots.</strong><br />Find ${totalHarvests} recipe ingredient${totalHarvests === 1 ? '' : 's'} before your digs run out.</p>
    </div>
  `;
}

function renderFailureCard() {
  return `
    <section class="failure-panel" aria-live="polite">
      <strong>Out of digs</strong>
      <span>The missing ingredients are still tucked away. Your recipe gets a fresh patch when you retry.</span>
      <button class="button button--ghost button--wide" type="button" data-restart>Try this patch again</button>
    </section>
  `;
}

function renderGarden() {
  const remainingDigs = getRemainingDigs(game);
  const requiredTotal = game.recipe.ingredients.reduce((sum, ingredient) => sum + ingredient.amount, 0);
  const collectedTotal = getRecipeProgress(game).reduce((sum, entry) => sum + entry.collected, 0);
  const statusMessage = getBoardMessage();
  const active = game.status === GAME_STATUS.DIGGING;

  return `
    <section class="garden-panel" aria-labelledby="garden-heading">
      <div class="garden-toolbar">
        <div class="level-badge"><span class="sprout" aria-hidden="true">🌱</span><span>Level ${game.levelIndex + 1} of ${LEVELS.length}</span></div>
        <div class="garden-toolbar-right">
          <div class="collection-counter" aria-label="Ingredients collected">${collectedTotal}/${requiredTotal} <span aria-hidden="true">🧺</span></div>
          <div class="dig-counter ${remainingDigs <= 3 ? 'is-low' : ''}" aria-label="${remainingDigs} digs remaining"><span class="tool" aria-hidden="true">🛠</span>${remainingDigs}</div>
        </div>
      </div>
      <h2 id="garden-heading" class="visually-hidden">${escapeHtml(game.levelName)} garden</h2>
      <div
        class="garden-grid"
        style="--columns: ${game.board.columns}"
        aria-label="${game.board.rows} by ${game.board.columns} dig garden"
      >
        ${game.board.cells.map((cell) => renderCell(cell, active)).join('')}
      </div>
      <div class="board-footer">
        <p class="board-message">${statusMessage}</p>
        ${game.status === GAME_STATUS.OUT_OF_DIGS ? '<button class="button button--ghost" type="button" data-restart>Retry</button>' : ''}
      </div>
    </section>
  `;
}

function renderCell(cell, active) {
  const tile = cell.isDug ? cell.tile : null;
  const classes = ['garden-tile'];
  if (cell.isDug) classes.push('is-dug');
  if (tile?.kind === TILE_KIND.INGREDIENT) classes.push('is-found');
  if (tile?.kind === TILE_KIND.ROCK) classes.push('is-rock');
  if (tile?.kind === TILE_KIND.EMPTY) classes.push('is-empty');
  if (activeTileId === cell.id) classes.push('is-new');

  const label = cell.isDug
    ? describeDugCell(tile)
    : `Dig plot ${cell.row + 1}, ${cell.column + 1}`;

  return `
    <button
      class="${classes.join(' ')}"
      type="button"
      data-dig="${cell.row}:${cell.column}"
      data-cell-id="${cell.id}"
      aria-label="${label}"
      ${active && !cell.isDug ? '' : 'disabled'}
    >
      ${renderCellArtwork(tile)}
    </button>
  `;
}

function renderCellArtwork(tile) {
  if (!tile) return '<span class="visually-hidden">Covered with grass</span>';
  if (tile.kind === TILE_KIND.INGREDIENT) {
    const ingredient = INGREDIENTS[tile.item];
    return `<span class="food-icon" aria-hidden="true">${ingredient.emoji}</span><span class="visually-hidden">${escapeHtml(ingredient.label)} found</span>`;
  }
  if (tile.kind === TILE_KIND.ROCK) {
    return '<span class="rock-art" aria-hidden="true"></span><span class="visually-hidden">Rock</span>';
  }
  return '<span class="visually-hidden">Empty soil</span>';
}

function describeDugCell(tile) {
  if (tile.kind === TILE_KIND.INGREDIENT) return `${INGREDIENTS[tile.item].label} found`;
  if (tile.kind === TILE_KIND.ROCK) return 'A rock was here';
  return 'Empty soil';
}

function renderInventory() {
  const inventoryEntries = Object.entries(game.inventory);
  const total = inventoryEntries.reduce((sum, [, quantity]) => sum + quantity, 0);

  return `
    <section class="inventory-card card" aria-labelledby="basket-heading">
      <div class="inventory-heading">
        <h2 id="basket-heading">Harvest basket</h2>
        <span class="inventory-total">${total} item${total === 1 ? '' : 's'}</span>
      </div>
      <div class="inventory-slots">
        ${inventoryEntries.length
          ? inventoryEntries.map(([item, quantity]) => renderInventoryItem(item, quantity)).join('')
          : '<div class="inventory-empty">Your fresh finds will gather here.</div>'}
      </div>
    </section>
  `;
}

function renderInventoryItem(item, quantity) {
  const ingredient = INGREDIENTS[item];
  return `
    <div class="inventory-chip" aria-label="${quantity} ${escapeHtml(ingredient.label)}">
      <span class="food-icon" aria-hidden="true">${ingredient.emoji}</span>
      <span class="inventory-chip-count" aria-hidden="true">${quantity}</span>
    </div>
  `;
}

function renderProgress() {
  const completed = game.completedLevelIds.length;
  const remaining = LEVELS.length - completed;
  return `
    <section class="progress-card card" aria-label="Kitchen progress">
      <span class="progress-orb" aria-hidden="true">${completed === 0 ? '☀️' : completed === LEVELS.length ? '🏆' : '🌼'}</span>
      <div class="progress-copy">
        <strong>${completed === 0 ? 'First harvest' : `${completed} recipe${completed === 1 ? '' : 's'} cooked`}</strong>
        <span>${remaining === 0 ? 'The whole garden menu is yours.' : `${remaining} seasonal recipe${remaining === 1 ? '' : 's'} to discover`}</span>
      </div>
    </section>
  `;
}

function renderCompletionModal() {
  const dish = getDishDetails(game.recipe.id);
  return `
    <section class="screen-overlay" role="dialog" aria-modal="true" aria-labelledby="completion-title">
      <div class="completion-modal">
        <div class="modal-garden" aria-hidden="true"><span class="modal-dish">${dish.emoji}</span></div>
        <div class="completion-content">
          <p class="eyebrow">Kitchen complete</p>
          <h2 id="completion-title">A garden feast!</h2>
          <p>You cooked all ${LEVELS.length} recipes and turned every harvest into something warm, bright, and delicious.</p>
          <div class="modal-actions">
            <button class="button button--leaf button--wide" type="button" data-play-again>Plant a new garden</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function attachListeners() {
  app.querySelector('[data-sound-toggle]')?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundscape.setEnabled(soundEnabled);
    if (soundEnabled) soundscape.play('tap');
    saveSoundPreference();
    render({ focusSelector: '[data-sound-toggle]' });
  });

  app.querySelectorAll('[data-dig]').forEach((button) => {
    button.addEventListener('click', () => {
      const [row, column] = button.dataset.dig.split(':').map(Number);
      const previousDigs = game.digsUsed;
      game = digCell(game, row, column);
      if (game.digsUsed > previousDigs) activeTileId = button.dataset.cellId;
      reactToAction();
      render({ focusSelector: getNextFocusTarget() });
    });
  });

  app.querySelector('[data-cook]')?.addEventListener('click', () => {
    game = cookAndAdvance(game);
    reactToAction();
    render({ focusSelector: getNextFocusTarget() });
  });

  app.querySelectorAll('[data-restart]').forEach((button) => {
    button.addEventListener('click', () => {
      game = restartLevel(game);
      activeTileId = null;
      reactToAction();
      render({ focusSelector: '[data-dig]:not([disabled])' });
    });
  });

  app.querySelector('[data-play-again]')?.addEventListener('click', () => {
    game = createGameState();
    activeTileId = null;
    soundscape.play('tap');
    queuedToast = 'A fresh season is ready to dig.';
    render({ focusSelector: '[data-dig]:not([disabled])' });
  });

  app.querySelector('.screen-overlay')?.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      app.querySelector('[data-play-again]')?.focus();
    }
  });
}

function reactToAction() {
  const action = game.lastAction;
  const soundByAction = {
    dig: 'dig',
    rock: 'rock',
    harvest: 'find',
    'recipe-ready': 'find',
    'out-of-digs': 'rock',
    error: 'rock',
    cook: 'cook',
    'game-complete': 'win',
    restart: 'tap',
    'level-start': 'tap',
  };
  soundscape.play(soundByAction[action.sound] ?? 'tap');
  queuedToast = ACTION_COPY[action.type] ?? 'The garden changed.';
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  const toast = app.querySelector('.toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function getBoardMessage() {
  if (game.status === GAME_STATUS.READY_TO_COOK) return 'Your basket has everything. Cook the recipe!';
  if (game.status === GAME_STATUS.OUT_OF_DIGS) return 'No digs left for this patch.';
  if (game.status === GAME_STATUS.COMPLETE) return 'Every seasonal recipe is complete.';
  return `${getRemainingDigs(game)} careful dig${getRemainingDigs(game) === 1 ? '' : 's'} left — rocks count, too.`;
}

function getNextFocusTarget() {
  if (game.status === GAME_STATUS.READY_TO_COOK) return '[data-cook]';
  if (game.status === GAME_STATUS.OUT_OF_DIGS) return '[data-restart]';
  if (game.status === GAME_STATUS.COMPLETE) return '[data-play-again]';
  return '[data-dig]:not([disabled])';
}

function getDishDetails(recipeId) {
  return DISH_DETAILS[recipeId] ?? { emoji: '🍲', description: 'A beautiful dish gathered one fresh ingredient at a time.' };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character]));
}
