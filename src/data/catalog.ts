/**
 * @file Metadata for every playable game and usable app.
 *
 * This file is data only. The React components are mapped to these ids in
 * `src/components/registry.ts`, which keeps the catalog importable from pure logic
 * (like the terminal interpreter) without pulling in any UI code.
 */
export type ItemKind = "game" | "app";

export interface CatalogItem {
  /** Stable id used by the launcher, the terminal `play` command, and high score keys. */
  id: string;
  kind: ItemKind;
  title: string;
  icon: string;
  blurb: string;
  tech: string[];
  highlights: string[];
}

export const catalog: readonly CatalogItem[] = [
  {
    id: "firewall",
    kind: "game",
    title: "Firewall Defender",
    icon: "🛡️",
    blurb: "Defend your server core through waves of threats. Earn upgrades, unmask trojans, and survive the boss.",
    tech: ["Canvas 2D", "Wave system", "Upgrades"],
    highlights: ["Simulation runs outside React renders", "O(1) entity removal", "Pooled particles, zero GC"],
  },
  {
    id: "bytebreaker",
    kind: "game",
    title: "Byte Breaker",
    icon: "🧱",
    blurb: "Squash bugs across eight levels with lasers, fireballs, and explosive chain reactions.",
    tech: ["Canvas 2D", "Grid collision", "Physics"],
    highlights: ["O(1) grid collision lookup", "Anti-tunneling sub-steps", "Cached offscreen brick layer"],
  },
  {
    id: "memory",
    kind: "game",
    title: "Cipher Memory",
    icon: "🧠",
    blurb: "Match programming symbols across three tiers. In Staff mode, the cards scramble on you.",
    tech: ["React state", "CSS 3D transforms", "a11y"],
    highlights: ["Fisher-Yates shuffle", "Fully keyboard accessible", "Pure, unit tested rules"],
  },
  {
    id: "password",
    kind: "app",
    title: "Password Lab",
    icon: "🔐",
    blurb: "Analyze password entropy and estimated crack time, then generate a truly random one.",
    tech: ["Web Crypto", "Entropy math", "useMemo"],
    highlights: ["Unbiased rejection sampling", "Detects common patterns", "Nothing leaves your browser"],
  },
  {
    id: "crypto",
    kind: "app",
    title: "Crypto Kit",
    icon: "🧪",
    blurb: "Hash text with SHA-1 through SHA-512 and encode or decode Base64, hex, binary, URL, and ROT13.",
    tech: ["SubtleCrypto", "TextEncoder", "Async effects"],
    highlights: ["UTF-8 safe encoding", "Stale async results ignored", "Clipboard API"],
  },
  {
    id: "subnet",
    kind: "app",
    title: "Subnet Calculator",
    icon: "🌐",
    blurb: "Network, broadcast, host range, and a live binary view for any IPv4 CIDR block.",
    tech: ["Bitwise ops", "Unit tested", "Network+"],
    highlights: ["O(1) 32-bit math", "RFC 1918 and RFC 3021 aware", "Binary visualizer"],
  },
  {
    id: "kanban",
    kind: "app",
    title: "Mission Board",
    icon: "📋",
    blurb: "A drag and drop Kanban board that saves to your browser. Plan the work, ship the work.",
    tech: ["HTML5 Drag & Drop", "localStorage", "Custom hooks"],
    highlights: ["Keyboard fallback controls", "Persists between visits", "Priority tags"],
  },
];

/** Id to item index, built once so lookups are O(1) instead of an O(n) scan. */
const catalogIndex: ReadonlyMap<string, CatalogItem> = new Map(catalog.map((item) => [item.id, item]));

/** Looks up a game or app by id. O(1). */
export const findItem = (id: string) => catalogIndex.get(id);

/** Items of one kind, precomputed so section renders do no filtering. */
export const itemsByKind: Record<ItemKind, readonly CatalogItem[]> = {
  game: catalog.filter((c) => c.kind === "game"),
  app: catalog.filter((c) => c.kind === "app"),
};
