/**
 * @file Firewall Defender rules: the network map, threats, towers, abilities, waves,
 * research tree, and threat intel cards.
 *
 * Pure data and functions only. No canvas, DOM, or React, so all of it is unit tested
 * and the balance can be tuned in one place.
 */

/* -------------------------------------------------------------------------- */
/*                                   Layout                                   */
/* -------------------------------------------------------------------------- */

export const W = 960;
export const H = 600;
/** Height of the play field. The HUD bar sits below it. */
export const PLAY_H = 530;
export const CX = W / 2;
export const CY = PLAY_H / 2;
export const CORE_R = 30;

/* -------------------------------------------------------------------------- */
/*                                Seeded random                               */
/* -------------------------------------------------------------------------- */

/** Small, fast seeded random number generator (mulberry32), so maps are reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/*                                 Network map                                */
/* -------------------------------------------------------------------------- */

export type NodeKind = "core" | "node" | "gate";

export interface GraphNode {
  id: number;
  x: number;
  y: number;
  kind: NodeKind;
  /** Ring index: 0 for the core, 1 to 3 for the rings, 4 for gates. */
  ring: number;
  /** Neighbor node ids. Links are undirected. */
  links: number[];
}

export interface Graph {
  nodes: GraphNode[];
  /** Shortest path distance from each node to the core, in pixels. */
  dist: Float64Array;
  /** Ids of the entry gates on the edge of the map. */
  gates: number[];
}

/** Rings of nodes around the core: vertical radius, and node count. Rings are ellipses. */
const RINGS = [
  { ry: 82, n: 6 },
  { ry: 150, n: 10 },
  { ry: 218, n: 14 },
] as const;
const RING_STRETCH = 1.55; // Horizontal stretch, so the map uses the wide canvas.
const GATE_COUNT = 8;

function link(nodes: GraphNode[], a: number, b: number) {
  if (a === b || nodes[a]!.links.includes(b)) return;
  nodes[a]!.links.push(b);
  nodes[b]!.links.push(a);
}

const distance = (a: GraphNode, b: GraphNode) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Builds a network map: the core, three rings of nodes, and entry gates on the map edge.
 * Rings are linked around (with a few gaps to create choke points) and inward to the
 * nearest inner node, so every node has a path to the core.
 *
 * O(n^2) for n nodes, which is about 40, and it runs once per game.
 */
export function buildGraph(seed: number): Graph {
  const rng = mulberry32(seed);
  const nodes: GraphNode[] = [{ id: 0, x: CX, y: CY, kind: "core", ring: 0, links: [] }];
  const ringIds: number[][] = [];

  RINGS.forEach(({ ry, n }, r) => {
    const ids: number[] = [];
    const offset = rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const angle = offset + (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.25;
      const radius = ry * (0.92 + rng() * 0.16);
      const id = nodes.length;
      nodes.push({ id, x: CX + Math.cos(angle) * radius * RING_STRETCH, y: CY + Math.sin(angle) * radius, kind: "node", ring: r + 1, links: [] });
      ids.push(id);
    }
    ringIds.push(ids);
  });

  // Core to every node in the first ring.
  for (const id of ringIds[0]!) link(nodes, 0, id);

  ringIds.forEach((ids, r) => {
    // Around the ring. The inner ring stays complete, outer rings get a few gaps.
    ids.forEach((id, i) => {
      if (r === 0 || rng() < 0.72) link(nodes, id, ids[(i + 1) % ids.length]!);
    });
    // Inward: every node links to its nearest inner neighbor, sometimes the second nearest too.
    if (r > 0) {
      for (const id of ids) {
        const inner = [...ringIds[r - 1]!].sort((a, b) => distance(nodes[id]!, nodes[a]!) - distance(nodes[id]!, nodes[b]!));
        link(nodes, id, inner[0]!);
        if (rng() < 0.35) link(nodes, id, inner[1]!);
      }
    }
  });

  // Gates on the edge of the map, each wired to the two nearest outer nodes.
  const gates: number[] = [];
  const outer = ringIds[ringIds.length - 1]!;
  for (let g = 0; g < GATE_COUNT; g++) {
    const angle = (g / GATE_COUNT) * Math.PI * 2 + Math.PI / GATE_COUNT;
    // Walk out along the ray until it leaves the inset play area.
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const tx = (dx > 0 ? W - 18 - CX : 18 - CX) / (dx || 1e-6);
    const ty = (dy > 0 ? PLAY_H - 18 - CY : 18 - CY) / (dy || 1e-6);
    const t = Math.min(Math.abs(tx), Math.abs(ty));
    const id = nodes.length;
    nodes.push({ id, x: CX + dx * t, y: CY + dy * t, kind: "gate", ring: 4, links: [] });
    gates.push(id);
    const nearest = [...outer].sort((a, b) => distance(nodes[id]!, nodes[a]!) - distance(nodes[id]!, nodes[b]!));
    link(nodes, id, nearest[0]!);
    link(nodes, id, nearest[1]!);
  }

  return { nodes, dist: shortestPaths(nodes), gates };
}

/** Dijkstra from the core. O(n^2) with a plain array, ideal for a graph this small. */
export function shortestPaths(nodes: GraphNode[]): Float64Array {
  const dist = new Float64Array(nodes.length).fill(Infinity);
  const done = new Uint8Array(nodes.length);
  dist[0] = 0;
  for (let k = 0; k < nodes.length; k++) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && (u < 0 || dist[i]! < dist[u]!)) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done[u] = 1;
    for (const v of nodes[u]!.links) {
      const d = dist[u]! + distance(nodes[u]!, nodes[v]!);
      if (d < dist[v]!) dist[v] = d;
    }
  }
  return dist;
}

/**
 * Picks the next hop toward the core. Any neighbor that is strictly closer qualifies,
 * and among those within 30% of the best, one is chosen at random, so traffic spreads
 * across parallel routes instead of marching in a single file.
 */
export function nextHop(graph: Graph, from: number, rng: () => number = Math.random): number {
  const here = graph.dist[from]!;
  const options = graph.nodes[from]!.links.filter((n) => graph.dist[n]! < here);
  if (options.length === 0) return 0;
  const best = Math.min(...options.map((n) => graph.dist[n]!));
  const good = options.filter((n) => graph.dist[n]! <= best * 1.3 + 1);
  return good[Math.floor(rng() * good.length)]!;
}

/* -------------------------------------------------------------------------- */
/*                                   Threats                                  */
/* -------------------------------------------------------------------------- */

export type Kind = "legit" | "exploit" | "worm" | "trojan" | "ddos" | "poly" | "botnet" | "bot" | BossKind;
export type BossKind = "ransomware" | "rootkit" | "zeroday";

export interface KindStats {
  hp: number;
  /** Pixels per second before wave scaling. */
  speed: number;
  /** Credits for destroying it (or for serving it, for legit traffic). */
  reward: number;
  /** Core integrity lost if it gets through. */
  damage: number;
  radius: number;
  hostile: boolean;
  boss: boolean;
  /** Short labels drawn under the threat. */
  labels: readonly string[];
}

const EXPLOITS = ["SQLi", "XSS", "RCE", "CSRF", "SSRF", "LFI"] as const;

/** Balance table. One row per kind, looked up in O(1). */
export const KINDS: Record<Kind, KindStats> = {
  legit: { hp: 1, speed: 70, reward: 2, damage: 0, radius: 7, hostile: false, boss: false, labels: ["HTTPS", "DNS", "SSH", "NTP"] },
  exploit: { hp: 1, speed: 60, reward: 6, damage: 8, radius: 8, hostile: true, boss: false, labels: EXPLOITS },
  worm: { hp: 4, speed: 46, reward: 15, damage: 14, radius: 7, hostile: true, boss: false, labels: ["WORM"] },
  trojan: { hp: 2, speed: 58, reward: 12, damage: 12, radius: 7, hostile: true, boss: false, labels: ["HTTPS", "DNS"] },
  ddos: { hp: 1, speed: 105, reward: 2, damage: 3, radius: 4, hostile: true, boss: false, labels: [""] },
  poly: { hp: 3, speed: 54, reward: 14, damage: 12, radius: 9, hostile: true, boss: false, labels: ["POLY"] },
  botnet: { hp: 3, speed: 48, reward: 10, damage: 14, radius: 10, hostile: true, boss: false, labels: ["C2"] },
  bot: { hp: 1, speed: 90, reward: 3, damage: 5, radius: 5, hostile: true, boss: false, labels: [""] },
  ransomware: { hp: 34, speed: 22, reward: 120, damage: 40, radius: 22, hostile: true, boss: true, labels: ["RANSOMWARE"] },
  rootkit: { hp: 26, speed: 30, reward: 120, damage: 35, radius: 18, hostile: true, boss: true, labels: ["ROOTKIT"] },
  zeroday: { hp: 40, speed: 26, reward: 150, damage: 45, radius: 20, hostile: true, boss: true, labels: ["0-DAY"] },
};

/** DDoS arrives as a swarm, and a destroyed botnet scatters into bots. */
export const DDOS_SWARM = 7;
export const BOTNET_SPLIT = 3;

/** Polymorphic malware is only vulnerable during part of each cycle. */
export const POLY_CYCLE = 2.4;
export const polyVulnerable = (age: number) => age % POLY_CYCLE < POLY_CYCLE * 0.5;

/** A zero-day is immune until a Scanner profiles it, or until it has been out this long. */
export const ZERODAY_EXPOSURE = 10;

/* -------------------------------------------------------------------------- */
/*                                    Waves                                   */
/* -------------------------------------------------------------------------- */

export interface WaveConfig {
  wave: number;
  /** Spawns from the gates this wave (a DDoS spawn is one swarm). */
  count: number;
  interval: number;
  speedMul: number;
  boss: BossKind | null;
  bossHpMul: number;
  /** Cumulative table: [kind, upper bound in 0..1]. One random number picks a kind. */
  table: readonly (readonly [Kind, number])[];
}

const BOSS_ORDER: readonly BossKind[] = ["ransomware", "rootkit", "zeroday"];

/**
 * Difficulty for a wave. New threat types unlock one at a time so players learn each
 * mechanic: worms (wave 2), trojans (3), DDoS (4), polymorphic (6), botnets (7).
 * Every fifth wave adds a boss, cycling through the three, tougher each cycle.
 */
export function waveConfig(wave: number): WaveConfig {
  const weights: [Kind, number][] = [
    ["legit", Math.max(14, 30 - wave * 1.5)],
    ["exploit", 34],
    ["worm", wave >= 2 ? 10 : 0],
    ["trojan", wave >= 3 ? 10 : 0],
    ["ddos", wave >= 4 ? 7 : 0],
    ["poly", wave >= 6 ? 9 : 0],
    ["botnet", wave >= 7 ? 8 : 0],
  ];
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let running = 0;
  const table = weights
    .filter(([, w]) => w > 0)
    .map(([kind, w]) => {
      running += w / total;
      return [kind, running] as const;
    });
  const boss = wave % 5 === 0 ? BOSS_ORDER[(wave / 5 - 1) % BOSS_ORDER.length]! : null;
  return {
    wave,
    count: Math.min(10 + wave * 3, 60),
    interval: Math.max(0.28, 1.1 - wave * 0.05),
    speedMul: Math.min(1 + (wave - 1) * 0.035, 1.6),
    boss,
    bossHpMul: 1 + 0.5 * Math.floor((wave - 1) / 15),
    table,
  };
}

/** Picks a kind from a wave's table. `roll` is injectable for deterministic tests. */
export function rollKind(cfg: WaveConfig, roll = Math.random()): Kind {
  for (const [kind, bound] of cfg.table) if (roll < bound) return kind;
  return "exploit";
}

export const waveBonus = (wave: number) => 30 + wave * 5;

/** Score multiplier: +1 for every eight kills in a row, capped at x5. */
export const comboMultiplier = (combo: number) => Math.min(1 + Math.floor(combo / 8), 5);

/* -------------------------------------------------------------------------- */
/*                                   Towers                                   */
/* -------------------------------------------------------------------------- */

export type TowerKind = "firewall" | "scanner" | "sandbox" | "honeypot";

export interface TowerDef {
  kind: TowerKind;
  name: string;
  cost: number;
  range: number;
  hotkey: string;
  /** One line shown in the build bar tooltip. Doubles as a security lesson. */
  blurb: string;
}

export const TOWERS: Record<TowerKind, TowerDef> = {
  firewall: { kind: "firewall", name: "Firewall", cost: 60, range: 110, hotkey: "1", blurb: "Filters hostile packets in range." },
  scanner: { kind: "scanner", name: "Scanner", cost: 45, range: 120, hotkey: "2", blurb: "Reveals hidden threats. Marked threats take +50% damage." },
  sandbox: { kind: "sandbox", name: "Sandbox", cost: 50, range: 95, hotkey: "3", blurb: "Isolates traffic in range, slowing threats 45%." },
  honeypot: { kind: "honeypot", name: "Honeypot", cost: 70, range: 130, hotkey: "4", blurb: "A decoy that lures threats in and traps them." },
};
export const TOWER_ORDER: readonly TowerKind[] = ["firewall", "scanner", "sandbox", "honeypot"];

export const FIREWALL_INTERVAL = 0.9;
export const SANDBOX_SLOW = 0.55; // Speed multiplier inside a sandbox.
export const MARK_MULTIPLIER = 1.5;
export const HONEYPOT_CAPACITY = 6;
/** Selling a tower refunds this share of its cost. */
export const SELL_REFUND = 0.6;

/* -------------------------------------------------------------------------- */
/*                                  Abilities                                 */
/* -------------------------------------------------------------------------- */

export type AbilityKind = "emp" | "quarantine" | "patch" | "overclock";

export interface AbilityDef {
  kind: AbilityKind;
  name: string;
  hotkey: string;
  cooldown: number;
  blurb: string;
}

export const ABILITIES: Record<AbilityKind, AbilityDef> = {
  emp: { kind: "emp", name: "EMP", hotkey: "Q", cooldown: 30, blurb: "Destroys every non-boss threat on the network." },
  quarantine: { kind: "quarantine", name: "Quarantine", hotkey: "W", cooldown: 18, blurb: "Click an area to freeze threats there for 4s." },
  patch: { kind: "patch", name: "Patch", hotkey: "E", cooldown: 40, blurb: "Restores 25 integrity to the core." },
  overclock: { kind: "overclock", name: "Overclock", hotkey: "R", cooldown: 35, blurb: "Towers fire twice as fast for 6s." },
};
export const ABILITY_ORDER: readonly AbilityKind[] = ["emp", "quarantine", "patch", "overclock"];

export const QUARANTINE_RADIUS = 110;
export const QUARANTINE_TIME = 4;
export const PATCH_AMOUNT = 25;
export const OVERCLOCK_TIME = 6;
export const EMP_BOSS_DAMAGE = 5;

/* -------------------------------------------------------------------------- */
/*                                  Research                                  */
/* -------------------------------------------------------------------------- */

export type ResearchId = "h1" | "h2" | "h3" | "t1" | "t2" | "t3" | "r1" | "r2" | "r3";

export interface ResearchDef {
  id: ResearchId;
  branch: "Hardening" | "Tooling" | "Response";
  name: string;
  cost: number;
  /** Must be owned first. Each branch is a straight line of three. */
  requires: ResearchId | null;
  blurb: string;
}

export const RESEARCH: readonly ResearchDef[] = [
  { id: "h1", branch: "Hardening", name: "Reinforced Core", cost: 2, requires: null, blurb: "+20 max integrity." },
  { id: "h2", branch: "Hardening", name: "Defense in Depth", cost: 3, requires: "h1", blurb: "Breaches deal 20% less damage." },
  { id: "h3", branch: "Hardening", name: "Incident Response", cost: 4, requires: "h2", blurb: "Patch heals double and recharges 20% faster." },
  { id: "t1", branch: "Tooling", name: "Security Budget", cost: 2, requires: null, blurb: "Start every run with +60 credits." },
  { id: "t2", branch: "Tooling", name: "Bulk Licensing", cost: 3, requires: "t1", blurb: "Towers cost 15% less." },
  { id: "t3", branch: "Tooling", name: "Signal Boost", cost: 4, requires: "t2", blurb: "Tower range +20%." },
  { id: "r1", branch: "Response", name: "Muscle Memory", cost: 2, requires: null, blurb: "Your clicks deal +1 damage." },
  { id: "r2", branch: "Response", name: "Automation", cost: 3, requires: "r1", blurb: "Ability cooldowns 20% shorter." },
  { id: "r3", branch: "Response", name: "Threat Intel", cost: 4, requires: "r2", blurb: "Trojans are always visible, and rootkits show faintly." },
];

export interface Modifiers {
  maxIntegrity: number;
  breachMul: number;
  patchMul: number;
  patchCooldownMul: number;
  startCredits: number;
  towerCostMul: number;
  towerRangeMul: number;
  clickDamage: number;
  cooldownMul: number;
  threatIntel: boolean;
}

export const STARTING_CREDITS = 120;

/** Turns owned research into the numbers the game actually uses. */
export function modifiers(owned: readonly ResearchId[]): Modifiers {
  const has = (id: ResearchId) => owned.includes(id);
  return {
    maxIntegrity: 100 + (has("h1") ? 20 : 0),
    breachMul: has("h2") ? 0.8 : 1,
    patchMul: has("h3") ? 2 : 1,
    patchCooldownMul: has("h3") ? 0.8 : 1,
    startCredits: STARTING_CREDITS + (has("t1") ? 60 : 0),
    towerCostMul: has("t2") ? 0.85 : 1,
    towerRangeMul: has("t3") ? 1.2 : 1,
    clickDamage: 1 + (has("r1") ? 1 : 0),
    cooldownMul: has("r2") ? 0.8 : 1,
    threatIntel: has("r3"),
  };
}

/** Whether a research node can be bought: not owned, prerequisite owned, and affordable. */
export function canResearch(id: ResearchId, owned: readonly ResearchId[], points: number): boolean {
  const def = RESEARCH.find((r) => r.id === id)!;
  return !owned.includes(id) && (def.requires === null || owned.includes(def.requires)) && points >= def.cost;
}

/** Research points earned by a run: one per wave cleared, three per boss destroyed. */
export const researchEarned = (wavesCleared: number, bossesKilled: number) => wavesCleared + bossesKilled * 3;

/** What the Research Lab saves between runs. */
export interface Lab {
  points: number;
  owned: ResearchId[];
}

const VALID_RESEARCH = new Set<string>(RESEARCH.map((r) => r.id));

/**
 * The saved lab comes from localStorage, which anyone can edit, so it is treated as
 * untrusted input: unknown or duplicate ids are dropped and points are clamped to 0..999.
 */
export function sanitizeLab(raw: unknown): Lab {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<Record<keyof Lab, unknown>>;
  const points = typeof obj.points === "number" && Number.isFinite(obj.points) ? Math.max(0, Math.min(999, Math.floor(obj.points))) : 0;
  const owned = Array.isArray(obj.owned)
    ? [...new Set(obj.owned.filter((id): id is ResearchId => typeof id === "string" && VALID_RESEARCH.has(id)))]
    : [];
  return { points, owned };
}

/* -------------------------------------------------------------------------- */
/*                                Threat intel                                */
/* -------------------------------------------------------------------------- */

/** A short, real-world explanation shown the first time each kind appears in a run. */
export const INTEL: Partial<Record<Kind, { title: string; body: string }>> = {
  legit: { title: "Legit traffic", body: "Green is real users. Let it through. Blocking customers is an outage too." },
  exploit: { title: "Exploits", body: "SQLi, XSS, RCE: attacks that abuse a flaw in code. Defense: validate input and patch fast." },
  worm: { title: "Worm", body: "Malware that copies itself across a network on its own. Defense: segment networks and patch services." },
  trojan: { title: "Trojan", body: "Malware disguised as legit traffic. Watch for the red flicker, or reveal it with a Scanner." },
  ddos: { title: "DDoS", body: "A flood of traffic from many machines, meant to overwhelm. Defense: rate limiting at the edge." },
  poly: { title: "Polymorphic malware", body: "It keeps changing its signature to dodge detection. Strike when it shows its true red form." },
  botnet: { title: "Botnet", body: "A network of hijacked machines run from one controller. Take it down and the bots scatter." },
  ransomware: { title: "Boss: Ransomware", body: "Encrypts systems and demands payment. It will lock your defenses. Contain it fast." },
  rootkit: { title: "Boss: Rootkit", body: "Hides deep in a system to stay invisible. Find it with Scanners, or sweep your cursor." },
  zeroday: { title: "Boss: Zero-day", body: "An exploit with no known signature. It is immune until a Scanner profiles it." },
};
