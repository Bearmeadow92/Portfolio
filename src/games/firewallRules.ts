/**
 * @file Firewall Defender game rules.
 *
 * Pure data and functions with no canvas, DOM, or React inside. Keeping the rules
 * separate from rendering makes the balance easy to tune and easy to unit test.
 */

/* -------------------------------------------------------------------------- */
/*                                 Packet kinds                               */
/* -------------------------------------------------------------------------- */

export type Kind = "legit" | "patch" | "threat" | "worm" | "trojan" | "botnet" | "bot" | "boss";

export interface KindStats {
  /** Hit points (clicks or turret shots needed). */
  hp: number;
  /** Points for neutralizing it (or for serving it, for legit traffic). */
  score: number;
  /** Integrity lost if it reaches the core. */
  damage: number;
  /** EMP charge gained on kill. */
  emp: number;
  /** True for anything that hurts the core. */
  hostile: boolean;
  /** Speed relative to the wave's base speed. */
  speed: number;
  /** Possible display labels. */
  labels: readonly string[];
}

const LEGIT_LABELS = ["HTTPS", "DNS", "SSH", "SMTP", "NTP", "TLS"] as const;

/** Balance table. One row per packet kind, looked up in O(1). */
export const KINDS: Record<Kind, KindStats> = {
  legit: { hp: 1, score: 10, damage: 0, emp: 0, hostile: false, speed: 1, labels: LEGIT_LABELS },
  patch: { hp: 1, score: 0, damage: 0, emp: 0, hostile: false, speed: 0.9, labels: ["PATCH"] },
  threat: { hp: 1, score: 25, damage: 14, emp: 9, hostile: true, speed: 1, labels: ["SQLi", "XSS", "DDoS", "RCE", "MITM", "CSRF", "0day"] },
  // Worms wiggle and take three hits.
  worm: { hp: 3, score: 60, damage: 22, emp: 16, hostile: true, speed: 0.75, labels: ["WORM"] },
  // Trojans are disguised as legit traffic and only flicker red briefly.
  trojan: { hp: 1, score: 45, damage: 18, emp: 12, hostile: true, speed: 0.95, labels: LEGIT_LABELS },
  // Botnets split into two fast bots when destroyed.
  botnet: { hp: 2, score: 40, damage: 20, emp: 10, hostile: true, speed: 0.8, labels: ["BOTNET"] },
  bot: { hp: 1, score: 15, damage: 8, emp: 4, hostile: true, speed: 1.4, labels: ["BOT"] },
  // The boss crawls in on every fifth wave and spawns threats as it goes.
  boss: { hp: 10, score: 500, damage: 45, emp: 100, hostile: true, speed: 0.3, labels: ["RANSOMWARE"] },
};

/* -------------------------------------------------------------------------- */
/*                                    Waves                                   */
/* -------------------------------------------------------------------------- */

export interface WaveConfig {
  wave: number;
  /** Packets spawned from the edges this wave (the boss and its minions are extra). */
  count: number;
  /** Seconds between spawns. */
  interval: number;
  /** Base packet speed in pixels per second. */
  speed: number;
  /** True on every fifth wave. */
  boss: boolean;
  /** Hit points for this wave's boss. */
  bossHp: number;
  /**
   * Cumulative spawn table: each entry is [kind, upper bound in 0..1].
   * A single random number picks a kind by walking this list.
   */
  table: readonly (readonly [Kind, number])[];
}

/**
 * Builds the difficulty settings for a wave. New enemy types unlock gradually so
 * players learn one mechanic at a time: worms (wave 2), trojans (3), botnets (4).
 */
export function waveConfig(wave: number): WaveConfig {
  const weights: [Kind, number][] = [
    ["patch", 6],
    ["legit", Math.max(24, 40 - wave * 2)],
    ["threat", 34],
    ["worm", wave >= 2 ? 6 + Math.min(wave, 8) : 0],
    ["trojan", wave >= 3 ? 10 : 0],
    ["botnet", wave >= 4 ? 8 : 0],
  ];
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let running = 0;
  const table = weights
    .filter(([, w]) => w > 0)
    .map(([kind, w]) => {
      running += w / total;
      return [kind, running] as const;
    });

  return {
    wave,
    count: Math.min(8 + wave * 3, 44),
    interval: Math.max(0.34, 1.15 - wave * 0.07),
    speed: Math.min(58 + wave * 8, 150),
    boss: wave % 5 === 0,
    bossHp: 8 + wave * 2,
    table,
  };
}

/**
 * Picks a packet kind from a wave's cumulative table.
 * @param roll A number in [0, 1). Injectable so tests are deterministic.
 */
export function rollKind(cfg: WaveConfig, roll = Math.random()): Kind {
  for (const [kind, bound] of cfg.table) if (roll < bound) return kind;
  return "threat";
}

/* -------------------------------------------------------------------------- */
/*                                   Upgrades                                 */
/* -------------------------------------------------------------------------- */

export type UpgradeId = "turret" | "capacitor" | "armor" | "tarpit" | "dpi" | "repair";

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** A single text glyph (not an emoji), so it renders the same on canvas and in the DOM. */
  icon: string;
  /** Maximum level. Repair is a consumable, so it has no cap. */
  max: number;
  /** Describes what buying the given level (1-based) will do. */
  describe: (level: number) => string;
}

/** Seconds between auto turret shots, indexed by level (level 0 means no turret). */
const TURRET_INTERVALS = [Infinity, 2.2, 1.5, 1.0] as const;

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  turret: { id: "turret", name: "Auto Turret", icon: "◎", max: 3, describe: (l) => `The core zaps the nearest threat every ${TURRET_INTERVALS[l]}s.` },
  capacitor: { id: "capacitor", name: "EMP Capacitor", icon: "↯", max: 3, describe: (l) => `EMP charges ${l * 40}% faster.` },
  armor: { id: "armor", name: "Hardened Core", icon: "▣", max: 3, describe: (l) => `Breaches deal ${l * 20}% less damage.` },
  tarpit: { id: "tarpit", name: "Tarpit", icon: "≋", max: 3, describe: (l) => `Threats inside the perimeter move ${l * 18}% slower.` },
  dpi: { id: "dpi", name: "Deep Packet Inspection", icon: "⊙", max: 1, describe: () => "Unmasks trojans, and lets the turret target them." },
  repair: { id: "repair", name: "Hot Patch", icon: "✚", max: Infinity, describe: () => "Restore 35% integrity right now." },
};

const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

/** How many levels of each upgrade the player owns. */
export type Loadout = Record<UpgradeId, number>;

export const emptyLoadout = (): Loadout => ({ turret: 0, capacitor: 0, armor: 0, tarpit: 0, dpi: 0, repair: 0 });

/**
 * Offers up to `count` distinct upgrades the player can still buy.
 * Uses a partial Fisher-Yates shuffle, which is O(count) swaps after the O(n) filter
 * and gives every combination an equal chance.
 */
export function pickUpgrades(loadout: Loadout, count = 3, rng: () => number = Math.random): UpgradeId[] {
  const pool = UPGRADE_IDS.filter((id) => loadout[id] < UPGRADES[id].max);
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}

/* -------------------------------------------------------------------------- */
/*                             Derived stat helpers                           */
/* -------------------------------------------------------------------------- */

export const turretInterval = (level: number) => TURRET_INTERVALS[Math.min(level, 3)]!;
/** Multiplier applied to breach damage. */
export const armorFactor = (level: number) => 1 - 0.2 * level;
/** Multiplier applied to hostile speed inside the perimeter. */
export const tarpitFactor = (level: number) => 1 - 0.18 * level;
/** Multiplier applied to EMP charge gains. */
export const empGain = (level: number) => 1 + 0.4 * level;
/** Score multiplier: +1 for every five kills in a row, capped at x5. */
export const comboMultiplier = (combo: number) => Math.min(1 + Math.floor(combo / 5), 5);
/** Bonus points for clearing a wave. */
export const waveBonus = (wave: number) => 100 * wave;
