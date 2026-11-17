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
4. **Use the platform.** WebGL, Canvas, `<dialog>`, Web Audio, Web Crypto, and Drag and
   Drop cover everything here. The only runtime dependencies are React and React DOM.
5. **A quiet interface.** The page is type, hairlines, and space. Color and motion come
   from the generative backdrop, so the two never compete.

## Layers

```
data/        Content (profile, skills, catalog). Edit these to personalize the site.
lib/         Pure logic and tiny stores. No JSX.
hooks/       Reusable React hooks.
art/         The generative backdrop: GLSL shaders and the WebGL engine.
components/  Shared UI (navbar, launcher, palette, buttons, cursor ring).
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
| App-wide state | A 20 line observable store + `useSyncExternalStore` | Scene, open window, mute |
| High frequency state | Mutable refs, typed arrays, and direct DOM writes | Game worlds, cursor ring, backdrop |

## The generative backdrop

`src/art` draws the animated background as a full-screen WebGL2 fragment shader.

- **Scenes** are fragment shaders in `shaders.ts`. They share a few helpers (hashing,
  rotation, segment distance, smooth minimum) and a fixed set of uniforms (time, pointer
  position, art intensity, a pulse, a clear zone, and three colors).
  - *Breach* intersects each pixel's ray with a floor plane and draws the network in
    floor coordinates, checking only the 3x3 nearby grid cells, so its cost is constant.
    fwidth() keeps lines one pixel wide at any distance, and a level-of-detail fade hides
    the network before distant lines can alias into grain. The firewall is an analytic
    ray-cylinder intersection, and the attack arc is a projected 3D curve. Incident
    targets are picked in screen space, then traced to the floor, so they always land
    in the open space beside the hero copy.
  - *Glyph* raymarches once per character cell and draws glyphs from a 5x7 bitmap font
    stored as integers (split in two, since 35 bits do not fit in a 32-bit int).
  - *Drivetrain* is pure 2D distance fields (a slider crank solved per cylinder), so it
    is cheap. Its crank angle is integrated on the CPU (see below).
  - *Chrome* is a raymarched signed distance field (chamfered hex prisms and a helical
    thread). Reflection lookups are offset by surface position to fake nearby studio
    lights, which gives flat faces the gradients of a real product shot.
- **The engine** (`Backdrop.tsx`) compiles a scene's program the first time it is shown and
  caches it. Each frame uploads eight uniforms and draws one triangle. Nothing is allocated.
- **Color** comes from CSS. Each scene's palette is a block of CSS variables in `index.css`.
  The engine reads `--bg`, `--text`, and `--accent` when the scene changes and eases the
  shader colors toward them, so a scene change crossfades. Components and Tailwind
  utilities read the same variables, so the interface re-tints with no React re-render.
- **Legibility**: a `u_dim` uniform tracks scroll position. The art is at full strength in
  the hero and recedes behind the content below it.
- **Engine RPM**: Drivetrain needs motion that builds up and dies down, which a shader
  cannot remember between frames. The CPU measures pointer and scroll speed, eases an
  angular velocity toward a target (fast to rev, slow to idle), integrates the crank
  angle, and uploads it as a uniform.
- **Color parsing**: palettes are read from CSS, and the production minifier shortens
  colors like `#ff4433` to `#f43`. `color.ts` handles every hex form, with tests, after
  a bug where the short form parsed as dark navy.
- **Staying fast**: the internal resolution steps down if frames run slow, the device pixel
  ratio is capped at 1.5, and the loop stops when the tab is hidden or a window is open.
- **Fallbacks**: without WebGL2 the canvas stays hidden and the flat page color shows.
  With `prefers-reduced-motion` the engine draws one still frame on demand.

## Game architecture

Each canvas game follows the same shape:

- A **rules module** (`firewall/rules.ts`, `byteBreakerLevels.ts`, `cipherMemoryRules.ts`)
  holds balance tables, level data, and algorithms as pure, unit tested functions.
- A **World object** in a ref holds all mutable simulation state.
- A **requestAnimationFrame loop** (`useGameLoop`) calls `update(dt)` and `draw()`.
- **React state** tracks only the phase (`menu`, `playing`, `paused`, `intermission`,
  `over`) and the end of game summary.

Firewall Defender is the largest game, so it splits one step further:

- `firewall/rules.ts` builds the network map from a seed (rings of nodes, gates on the
  edge), runs Dijkstra once from the core, and holds the wave, tower, ability, research,
  and threat intel tables. Threats pick their next hop from that distance field, so routing
  costs O(degree) per hop with no per-frame pathfinding.
- `firewall/sim.ts` owns the World and `step(dt)`: spawning, movement, towers, boss
  behaviors, abilities, and scoring. No React, no canvas.
- `firewall/draw.ts` is the renderer and HUD. The static network is painted once to an
  offscreen layer, and glow is a cached radial gradient sprite instead of `shadowBlur`.
- The Research Lab save lives in localStorage, which a visitor can edit, so it is
  sanitized on load: unknown ids are dropped and points are clamped.

## Complexity cheat sheet

| Operation | Naive approach | This codebase | How |
| --- | --- | --- | --- |
| Animate the backdrop | Canvas 2D on the CPU | One GPU draw call | Full-screen fragment shader, eight uniforms per frame |
| Switch scenes | Recompile each time | O(1) after first use | Shader programs cached in a Map |
| Re-tint the site per scene | Re-render components | No re-render | One attribute write, colors are CSS variables |
| Cursor ring and button effects | React state per mouse move | No re-render | Direct style writes, loop stops when idle |
| Remove a dead entity | O(n) `splice` | O(1) | Swap-remove |
| Spawn and expire particles | Allocate objects | Zero allocation | Struct of arrays in `Float32Array`s |
| Ball vs bricks | O(bricks) scan | O(1) | Uniform grid, test at most 4 cells |
| Laser bolt vs bricks | O(bricks) scan | O(1) | Direct grid index from coordinates |
| "Is the level clear?" | O(bricks) scan | O(1) | Counter of breakable bricks |
| Explosion chain reaction | Recursive, may revisit | O(k) for k bricks | Iterative flood fill, clear on visit |
| Draw the brick wall | Redraw every frame | One `drawImage` | Offscreen canvas, repainted only when dirty |
| Draw the game background | Redraw grid lines | One `drawImage` | Cached layer |
| Route a threat to the core | Pathfind per threat per frame | O(degree) per hop | Dijkstra once per map, then follow the distance field |
| Glow on every entity | `shadowBlur` (slow) | One `drawImage` | Radial gradient sprite cached per color and size |
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
- Idle work stops: the backdrop pauses when the tab is hidden or a window is open, and
  the cursor ring's loop ends as soon as it catches up with the mouse.
- No `backdrop-filter` blur anywhere. Blurring a full screen each frame cost more than the
  games running on top of it (21 fps without a GPU, 60 fps after removing it).
- The device pixel ratio is capped (1.5 for the backdrop, 2 for games), so 3x phones do
  not render 9x the pixels.

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
