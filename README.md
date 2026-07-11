# 🌱 Root & Ritual

> A cozy, responsive digging-and-cooking game where every garden patch hides the ingredients for tonight’s recipe.

Root & Ritual turns a small garden into a playful kitchen ritual: uncover buried produce, avoid time-wasting rocks, complete a recipe, and cook before your digging budget runs out. Each retry reshuffles harvest locations, so every patch feels fresh.

## ✨ Highlights

|                                  |                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 🥕 **Four escalating recipes**   | Boards grow from a 3 × 4 starter patch to a 5 × 6 harvest, with more ingredients and decisions at every level. |
| 🎲 **Fresh garden layouts**      | Ingredients and empty soil reshuffle on every new attempt while the rock layout stays balanced.                |
| 📱 **Designed for every screen** | A portrait-first game board, touch-friendly tiles, and an adaptive desktop layout.                             |
| 🔊 **Asset-free sound effects**  | Gentle dig, harvest, cook, and celebration effects are synthesized with the Web Audio API.                     |
| ♿ **Accessible by default**     | Keyboard-operable tiles, meaningful live feedback, managed modal focus, and reduced-motion support.            |

## 🎮 How to play

1. **Dig** grass tiles to reveal soil, rocks, or ingredients.
2. **Collect** every item listed in the recipe card before the dig counter reaches zero.
3. **Cook** once the basket is complete, then take on the next recipe.

Rocks and empty soil still consume a dig, so choose each plot carefully. If you run out of digs, retry for a newly shuffled ingredient layout.

## 🗺️ Progression

| Level | Recipe           | Garden | Digs | Harvest target |
| ----: | ---------------- | -----: | ---: | -------------: |
|     1 | Root Cellar Soup |  3 × 4 |    6 |  2 ingredients |
|     2 | Garden Salsa     |  4 × 4 |    9 |  3 ingredients |
|     3 | Forest Sauté     |  4 × 5 |   12 |  4 ingredients |
|     4 | Harvest Chowder  |  5 × 6 |   17 |  6 ingredients |

## 🧱 Architecture

The app separates the deterministic game domain from React presentation and browser-only effects. That keeps the gameplay rules easy to test and leaves UI components focused on interaction and rendering.

```text
src/
├── app/                         # Application composition and focus management
├── features/game/
│   ├── components/               # Recipe, board, basket, modal, and feedback UI
│   ├── hooks/useGame.ts          # State transitions, toast timing, sound orchestration
│   ├── engine.ts                 # Pure immutable game rules
│   ├── levels.ts                 # Authored level and ingredient content
│   ├── types.ts                  # Domain unions and state contracts
│   └── engine.test.ts            # Fast unit coverage for game invariants
├── shared/audio/Soundscape.ts    # Web Audio sound service
├── styles/global.css             # Responsive visual system
└── main.tsx                      # React/Vite entry point
```

## 🛠️ Tech stack

- **React** for composable, state-driven UI
- **TypeScript** with strict compiler settings for domain safety
- **Vite** for fast development and optimized static builds
- **Vitest** for focused engine-level tests
- **Web Audio API** for lightweight synthesized feedback
- **GitHub Actions + GitHub Pages** for CI and deployment

## 🚀 Local development

### Prerequisites

- Node.js **22.12+**
- pnpm **6.11.0**

```bash
# Install dependencies from the committed lockfile
pnpm install

# Start the Vite development server
pnpm dev

# Run the game-rule test suite
pnpm test

# Run linting, TypeScript checks, and tests
pnpm check

# Run the complete local CI gate, including a production build
pnpm ci

# Preview the optimized production bundle
pnpm build
pnpm preview
```

## ✅ Quality gates

`pnpm check` is the fast validation command. `pnpm ci` adds the production build. Together they run:

1. ESLint across the codebase
2. Strict TypeScript project checks
3. Vitest engine tests
4. A production Vite build

The game engine is framework-independent and tests validation, randomized board generation, immutable digging, recipe readiness, out-of-digs behavior, advancement, completion, and retries.
