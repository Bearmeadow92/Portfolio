# Architecture and Performance Notes

This document explains how the portfolio is put together and why. It is written for
anyone reading the code, including future me.

## Guiding principles

1. **Pure logic lives apart from UI.** Game rules, math, and parsers are plain functions
   with no React or DOM inside. That makes them easy to test and easy to reason about.
2. **React renders state changes, not frames.** Anything that updates 60 times a second
   lives in refs and typed arrays, outside React's render cycle.
3. **No allocations in hot loops.** Per-frame code reuses memory, so the garbage
   collector never causes a dropped frame.
4. **Use the platform.** Canvas, `<dialog>`, Web Audio, Web Crypto, and Drag and Drop
   cover everything here. The only runtime dependencies are React and React DOM.

## Layers

```
data/        Content (profile, skills, catalog). Edit these to personalize the site.
lib/         Pure logic and tiny stores. No JSX.
hooks/       Reusable React hooks.
components/  Shared UI (navbar, launcher, palette, particle field).
sections/    Page sections, composed in App.tsx.
games/       Canvas games. Each has a rules module (pure) and a component (rendering).
apps/        Toolkit mini apps. Thin UI over lib/ functions.
terminal/    Pure command interpreter plus its UI.
```

Dependencies only point downward: `sections` may import `components`, `hooks`, `lib`,
and `data`, but `lib` never imports a component.

## State management

There is no state library. Three patterns cover everything:

| Kind of state | Where it lives | Example |
| --- | --- | --- |
| Local UI state | `useState` | Form fields, the active skill filter |
| App-wide state | A 20 line observable store + `useSyncExternalStore` | Theme, open window, mute |
| High frequency state | Mutable refs and typed arrays | Game worlds, particles |

## Game architecture

Each canvas game follows the same shape:

- A **rules module** (`firewallRules.ts`, `byteBreakerLevels.ts`, `cipherMemoryRules.ts`)
  holds balance tables, level data, and algorithms as pure, unit tested functions.
- A **World object** in a ref holds all mutable simulation state.
- A **requestAnimationFrame loop** (`useGameLoop`) calls `update(dt)` and `draw()`.
- **React state** tracks only the phase (`menu`, `playing`, `paused`, `intermission`,
  `over`) and the end of game summary.

## Complexity cheat sheet

| Operation | Naive approach | This codebase | How |
| --- | --- | --- | --- |
| Link nearby hero particles | O(n²) all pairs | O(n) average | Spatial hash grid, cell size = link distance |
| Draw hero particle links | One draw call per line | About 6 draw calls | Lines batched into opacity buckets |
| Remove a dead entity | O(n) `splice` | O(1) | Swap-remove |
| Spawn and expire particles | Allocate objects | Zero allocation | Struct of arrays in `Float32Array`s |
| Ball vs bricks | O(bricks) scan | O(1) | Uniform grid, test at most 4 cells |
| Laser bolt vs bricks | O(bricks) scan | O(1) | Direct grid index from coordinates |
| "Is the level clear?" | O(bricks) scan | O(1) | Counter of breakable bricks |
| Explosion chain reaction | Recursive, may revisit | O(k) for k bricks | Iterative flood fill, clear on visit |
| Draw the brick wall | Redraw every frame | One `drawImage` | Offscreen canvas, repainted only when dirty |
| Draw the game background | Redraw grid lines | One `drawImage` | Cached layer |
| "Is the wave clear?" | O(packets) scan | O(1) | Counters |
| Filter skills by category | O(n) per click | O(1) | Map built once at module load |
| Find a game or app by id | O(n) `find` | O(1) | Map index |
| Group Kanban tasks | O(columns × n) | O(n) | Single pass, memoized |
| Scroll progress bar | React re-render per frame | No re-render | Direct transform write, rAF throttled |
| Scrollspy and reveals | Scroll listeners | No scroll listeners | IntersectionObserver |
| Terminal command dispatch | Chain of `if` checks | O(1) | Object lookup by name |
| Password character class | O(k) `includes` | O(1) | `Set` membership |
| Subnet math | String manipulation | O(1) | 32-bit bitwise operations |

## Loading performance

- **Code splitting:** every game and app is a `React.lazy` chunk (2 to 6 KB gzipped
  each), downloaded only when opened and preloaded on hover.
- **No audio files:** sound effects are synthesized with the Web Audio API.
- **No images:** icons are emoji and inline SVG. The favicon is a 500 byte SVG.
- **Long-lived caching:** hashed assets are served with `immutable` cache headers.

## Rendering performance

- Animations use `transform` and `opacity`, which run on the compositor without layout.
- Canvas state changes (`fillStyle`, `font`) are minimized and paths are batched.
- Offscreen work stops: the hero animation pauses when scrolled away or the tab is hidden.
- The device pixel ratio is capped at 2, so 3x phones do not render 9x the pixels.

## Security

- `netlify.toml` sets a strict Content Security Policy (no inline scripts), HSTS,
  `X-Frame-Options: DENY`, and a locked down Permissions Policy.
- Every tool runs client side. Passwords and text typed into the toolkit never leave
  the browser.
- All rendered text goes through React, which escapes it. There is no `innerHTML`.
- The contact form uses a honeypot field, and Netlify treats submissions as untrusted.

## Accessibility

- Semantic landmarks, a skip link, and labeled controls throughout.
- Native `<dialog>` provides focus trapping and Escape to close.
- Every interaction has a keyboard path, including the Kanban board and Cipher Memory.
- `prefers-reduced-motion` disables animations and the boot sequence.

## Testing

`npm test` runs Vitest over the pure modules: game rules, the engine's particle pool,
subnet math, password analysis, encoders, fuzzy search, and the terminal interpreter.
CI (GitHub Actions) runs the type check, the tests, and a production build on every
push and pull request.
