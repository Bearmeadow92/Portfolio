/** Metadata for every playable game and usable app. Components are mapped in src/components/registry.ts. */
export type ItemKind = "game" | "app";

export interface CatalogItem {
  id: string;
  kind: ItemKind;
  title: string;
  icon: string;
  blurb: string;
  tech: string[];
  highlights: string[];
}

export const catalog: CatalogItem[] = [
  {
    id: "firewall",
    kind: "game",
    title: "Firewall Defender",
    icon: "🛡️",
    blurb: "Neutralize malicious packets before they breach your server core. Let legit traffic through.",
    tech: ["Canvas 2D", "rAF game loop", "Web Audio"],
    highlights: ["Simulation runs outside React renders", "Difficulty ramps over time", "Touch friendly hitboxes"],
  },
  {
    id: "bytebreaker",
    kind: "game",
    title: "Byte Breaker",
    icon: "🧱",
    blurb: "Squash bugs in production with a brick breaker built from scratch, complete with power ups.",
    tech: ["Canvas 2D", "Collision physics", "Sub-stepping"],
    highlights: ["Circle vs rectangle collision", "Anti-tunneling sub-steps", "Procedural level layouts"],
  },
  {
    id: "memory",
    kind: "game",
    title: "Cipher Memory",
    icon: "🧠",
    blurb: "Match pairs of programming symbols. Fewest moves wins. Fully keyboard accessible.",
    tech: ["React state", "CSS 3D transforms", "a11y"],
    highlights: ["Fisher-Yates shuffle", "Accessible button cards", "Per-difficulty high scores"],
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
    blurb: "A drag and drop Kanban board that saves to your browser. Plan the mission, ship the mission.",
    tech: ["HTML5 Drag & Drop", "localStorage", "Custom hooks"],
    highlights: ["Keyboard fallback controls", "Persists between visits", "Priority tags"],
  },
];

export const findItem = (id: string) => catalog.find((c) => c.id === id);
