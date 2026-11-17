# NextGenTechnologist Portfolio

A quiet interface over living art. This is the portfolio of Jesse, a security-minded software engineer, built from scratch with **React 19, TypeScript, Tailwind CSS v4, WebGL2, and native browser APIs**.

The page itself is almost empty: large type, hairlines, and space. All of the color and movement comes from a generative backdrop written in GLSL that reacts to your cursor. On top of it sit four working tools, three playable games, and a real terminal.

## What is on it

### The backdrop (WebGL2 + GLSL)

Four switchable scenes, each a fragment shader written from scratch. Each scene brings its own palette, which re-tints the whole site.

| Scene | What it is |
| --- | --- |
| **Breach** | A live attack map. Packets stream across a node graph, hostile traffic flares red, and your cursor is a sensor that locks onto threats in range. Click to fire a probe. |
| **Glyph** | A raymarched 3D sculpture rendered entirely in text characters, drawn from a 5×7 bitmap font packed into integers. The light follows your cursor. |
| **Drivetrain** | Meshing gears, a crankshaft, and a piston in blueprint linework. The gear ratios are exact, and sweeping your cursor across the screen turns the crank. |
| **Chrome** | A liquid metal sculpture, raymarched in real time and lit by a procedural studio. Your cursor orbits the camera. |

### Tools (all client side, nothing leaves your browser)

| Tool | What it does |
| --- | --- |
| **Password Lab** | Entropy and crack time analysis, plus a generator using `crypto.getRandomValues` with unbiased rejection sampling. |
| **Crypto Kit** | SHA-1 to SHA-512 hashing via `SubtleCrypto`, and UTF-8 safe Base64, hex, binary, URL, and ROT13 codecs. |
| **Subnet Calculator** | Network, broadcast, host ranges, and a live binary view for any IPv4 CIDR block. O(1) bitwise math. |
| **Mission Board** | A Kanban board with native HTML5 Drag and Drop, keyboard fallbacks, and localStorage persistence. |

### Games (HTML5 Canvas, no game libraries)

| Game | What it is |
| --- | --- |
| **Firewall Defender** | Defend your server core through waves of threats. Pick an upgrade after each wave, unmask trojans, and survive a boss every fifth wave. |
| **Byte Breaker** | A brick breaker with eight hand-built levels, explosive chain reactions, lasers, fireballs, and multi ball. |
| **Cipher Memory** | Match programming symbols across three tiers, with streaks, a limited peek power, and a mode where cards trade places. Fully keyboard accessible. |

### Interface details

- **One typeface family**: Geist and Geist Mono, set tight. Size does the shouting, not weight.
- **A clear zone**: the art steps back behind the hero copy, so the type stays crisp without an overlay.
- **Live telemetry**: the hero reads out pointer position and the real frame rate, written straight from the WebGL loop.

- **Liquid, magnetic buttons**: the hover color grows from the exact point your pointer enters, and the button leans toward the cursor.
- **Index rows** instead of cards: each project is one line that inverts on hover.
- **A cursor ring** that trails the mouse and grows over anything clickable.
- **A working terminal** with history, tab completion, and commands that drive the site (`help`, `play firewall`, `scene chrome`, `sudo hire-jesse`).
- **A command palette** (`Ctrl + K` / `Cmd + K`) with fuzzy search.
- **A live source section** showing this repo's language breakdown and latest commits from the GitHub REST API.
- **A Netlify Forms** contact form with validation and a spam honeypot.
- **An easter egg**: try the Konami code (up, up, down, down, left, right, left, right, B, A).

## Engineering highlights

These are the decisions I would want to talk about in an interview:

- **The art runs on the GPU.** Each scene is one fragment shader. Per frame, the CPU uploads eight uniforms and issues a single draw call, with zero allocations.
- **Adaptive resolution.** If frames run slow, the backdrop renders at a lower internal resolution to hold the frame rate. It stops entirely when the tab is hidden or a game window is open.
- **React renders state changes, not frames.** Game worlds, the cursor ring, button effects, and the scroll progress line all write straight to the DOM or to refs. A 60 fps simulation never triggers a re-render.
- **Big O awareness.** Byte Breaker's ball tests at most four grid cells instead of every brick. Entities are deleted with O(1) swap-remove. Lookups use Maps built once at load. See the full table in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **One source of truth for color.** Scene palettes are CSS variables. Components, Tailwind utilities, and the shaders all read the same values, so a scene change is one attribute write.
- **Code splitting.** Every game and tool is loaded with `React.lazy`, becoming its own small chunk that only downloads when opened (and preloads on hover).
- **No state library needed.** A 20 line observable store plus `useSyncExternalStore` powers the scene, the window launcher, and the mute toggle.
- **Pure, tested logic.** Game rules, the terminal interpreter, subnet math, password analysis, encoders, and the fuzzy matcher are pure functions covered by Vitest.
- **Security minded.** Netlify serves a strict Content Security Policy, HSTS, and anti-clickjacking headers (see `netlify.toml`). Every tool runs client side.
- **Accessible.** Semantic HTML, native `<dialog>` focus trapping, a skip link, keyboard paths for everything, and full `prefers-reduced-motion` support (the backdrop holds a single still frame).

## Tech stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · WebGL2 / GLSL · Vitest · GitHub Actions · Netlify

Browser APIs used: WebGL2, Canvas 2D, Typed Arrays, Web Audio, `<dialog>`, Drag and Drop, Web Crypto, IntersectionObserver, Clipboard, Fullscreen, Page Visibility, Pointer Events, localStorage, matchMedia.

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Other scripts:

| Command | Purpose |
| --- | --- |
| `npm run build` | Type check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the unit tests once |
| `npm run typecheck` | Run the TypeScript compiler |

## Deploying to Netlify

1. Push this repo to GitHub.
2. In Netlify, choose **Add new site → Import an existing project** and pick this repo.
3. Netlify reads `netlify.toml` automatically (build command `npm run build`, publish directory `dist`).
4. After the first deploy, open **Forms** in the Netlify dashboard. The `contact` form is detected automatically, and you can turn on email notifications there.

## Make it yours

All personal content lives in one place, so you never have to dig through components:

- `src/data/profile.ts`: name, headline, bio, off-the-clock notes, and links (**update LinkedIn and email before deploying**)
- `src/data/skills.ts`: skills and proficiency levels
- `src/data/timeline.ts`: the path shown in the About section
- `src/data/catalog.ts`: the tools and games listed in Work
- `src/index.css`: scene palettes (search for `data-scene`)
- `src/art/shaders.ts`: the scenes themselves

## Project structure

```
src/
├── art/           # Generative backdrop: GLSL shaders and the WebGL engine
├── apps/          # Tools (lazy loaded)
├── games/         # Canvas games: pure rules modules, components, shared engine
├── components/    # Navbar, launcher, palette, buttons, cursor ring
├── sections/      # Page sections (Hero, Work, About, ...)
├── terminal/      # Pure command interpreter and terminal UI
├── hooks/         # Custom React hooks
├── lib/           # Pure logic and small stores: subnet, password, encoding, sound, scene
└── data/          # Content you edit to personalize the site
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the code is organized, the state management approach, and a Big O cheat sheet for every hot path.
- Every source file starts with a `@file` header explaining its job, and exported functions carry JSDoc comments with complexity notes where it matters.
