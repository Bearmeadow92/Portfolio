# 🦅 NextGenTechnologist Portfolio

An interactive developer portfolio built from scratch with **React 19, TypeScript, Tailwind CSS v4, and native HTML5 APIs**. It is a resume you can actually play with: original canvas games, genuinely useful mini apps, a working terminal, and a live GitHub feed.

> Marine Corps veteran. B.S. in Cybersecurity (SNHU, 2026). Software engineer building secure, playful, and useful things.

## ✨ Features

### 🎮 The Arcade (HTML5 Canvas, zero game libraries)
| Game | What it shows off |
| --- | --- |
| **Firewall Defender** | Click malicious packets before they breach your server core. rAF game loop, particle effects, difficulty ramp, EMP mechanic. |
| **Byte Breaker** | A brick breaker where every brick is a bug. Circle vs rectangle collision, anti-tunneling sub-steps, power ups, procedural levels. |
| **Cipher Memory** | Match programming symbols. Pure React state with CSS 3D card flips, fully keyboard accessible. |

### 🧰 The Toolkit (useful mini apps, all client side)
| App | What it does |
| --- | --- |
| **Password Lab** | Entropy and crack time analysis, plus a generator using `crypto.getRandomValues` with unbiased rejection sampling. |
| **Crypto Kit** | SHA-1 to SHA-512 hashing via `SubtleCrypto`, and UTF-8 safe Base64, hex, binary, URL, and ROT13 codecs. |
| **Subnet Calculator** | Network, broadcast, host ranges, and a live binary view for any IPv4 CIDR block. O(1) bitwise math. |
| **Mission Board** | A Kanban board with native HTML5 Drag and Drop, keyboard fallbacks, and localStorage persistence. |

### 🖥️ The Experience
- **Boot sequence** intro (once per session, skippable, skipped for reduced motion users)
- **Interactive particle network** hero that reacts to your cursor. Click to send a shockwave.
- **Working terminal** with history, tab completion, and commands that drive the site (`help`, `play firewall`, `theme matrix`, `sudo hire-jesse`)
- **Command palette** (`Ctrl + K` / `⌘ + K`) with fuzzy search
- **Four themes** built on CSS variables: Cyber, Matrix, Synthwave, and Semper Fi 🇺🇸
- **Live GitHub feed** from the GitHub REST API with caching, loading, and error states
- **Netlify Forms** contact form with validation and a spam honeypot
- **Easter egg**: try the Konami code (↑ ↑ ↓ ↓ ← → ← → B A)

## 🏗️ Engineering Highlights

These are the decisions I would want to talk about in an interview:

- **Game state lives outside React.** Each game's world is a mutable `useRef` advanced by a `requestAnimationFrame` loop. React only tracks the phase (menu, playing, paused, over), so a 60fps simulation never triggers a re-render.
- **Big O awareness.** The hero's particle links use a spatial hash grid, turning an O(n²) all-pairs check into roughly O(n). Particle cleanup uses swap-remove for O(1) deletes.
- **Code splitting.** Every game and app is loaded with `React.lazy`, becoming its own small chunk that only downloads when opened (and preloads on hover).
- **No global state library needed.** A ~20 line observable store plus `useSyncExternalStore` powers the theme, the window launcher, and the mute toggle.
- **Pure, tested logic.** The terminal interpreter, subnet math, password analysis, encoders, and fuzzy matcher are pure functions covered by Vitest.
- **Security minded.** Netlify serves a strict Content Security Policy, HSTS, and anti-clickjacking headers (see `netlify.toml`). Every tool runs client side, so user data never leaves the browser.
- **Accessible.** Semantic HTML, native `<dialog>` focus trapping, skip link, ARIA labels, keyboard support everywhere, and full `prefers-reduced-motion` support.

## 🛠️ Tech Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · Vitest · GitHub Actions · Netlify

Browser APIs used: Canvas 2D, Web Audio, `<dialog>`, Drag and Drop, Web Crypto, IntersectionObserver, ResizeObserver, Clipboard, Fullscreen, Page Visibility, Pointer Events, localStorage, matchMedia.

## 🚀 Getting Started

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

## ☁️ Deploying to Netlify

1. Push this repo to GitHub.
2. In Netlify, choose **Add new site → Import an existing project** and pick this repo.
3. Netlify reads `netlify.toml` automatically (build command `npm run build`, publish directory `dist`).
4. After the first deploy, open **Forms** in the Netlify dashboard. The `contact` form is detected automatically, and you can turn on email notifications there.

## 🎨 Make It Yours

All personal info lives in one place, so you never have to dig through components:

- `src/data/profile.ts`: name, roles, bio, stats, and links (**update LinkedIn and email before deploying**)
- `src/data/skills.ts`: skills and proficiency levels
- `src/data/timeline.ts`: the About section timeline
- `src/data/catalog.ts`: game and app cards
- `src/index.css`: theme colors

## 📁 Project Structure

```
src/
├── apps/          # Toolkit mini apps (lazy loaded)
├── games/         # Canvas games, shared engine, and overlay
├── components/    # Navbar, launcher, palette, particle field, and more
├── sections/      # Page sections (Hero, About, Skills, ...)
├── terminal/      # Pure command interpreter and terminal UI
├── hooks/         # Custom React hooks
├── lib/           # Pure logic: subnet, password, encoding, sound, stores
└── data/          # Content you edit to personalize the site
```

---

Built with discipline, curiosity, and a lot of coffee. Semper Fi. 🦅
