/**
 * @file Firewall Defender simulation: the game world and how it changes each frame.
 *
 * No drawing and no React here. The component owns a World object in a ref and calls
 * `step(world, dt)` from the animation loop, plus the action functions for input.
 * Visual effects (particles, popups, shockwaves) are recorded in the world for the
 * renderer to draw, and sounds are fired directly.
 *
 * Complexity per frame, for e enemies and k towers (typically e < 120, k < 20):
 *   - Enemy movement along network links: O(e).
 *   - Sandbox and honeypot checks: O(e * k).
 *   - Firewall targeting: O(e) per firewall shot, and shots are about once a second.
 *   - Removal is O(1) per entity via swap-remove.
 */
import { sfx } from "../../lib/sound";
import { ParticlePool, swapRemove, type Palette, type Popup } from "../engine";
import {
  ABILITIES, BOTNET_SPLIT, CORE_R, CX, CY, DDOS_SWARM, EMP_BOSS_DAMAGE, FIREWALL_INTERVAL, HONEYPOT_CAPACITY, INTEL, KINDS,
  MARK_MULTIPLIER, OVERCLOCK_TIME, PATCH_AMOUNT, QUARANTINE_RADIUS, QUARANTINE_TIME, SANDBOX_SLOW, SELL_REFUND, TOWERS,
  ZERODAY_EXPOSURE, buildGraph, comboMultiplier, nextHop, polyVulnerable, rollKind, waveBonus, waveConfig,
  type AbilityKind, type Graph, type Kind, type Modifiers, type TowerKind, type WaveConfig,
} from "./rules";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export interface Enemy {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  /** Network link being traveled: from node, to node, distance covered, link length. */
  from: number;
  to: number;
  t: number;
  len: number;
  hp: number;
  maxHp: number;
  speed: number;
  age: number;
  label: string;
  /** Trojans and zero-days stay disguised or immune until profiled by a Scanner. */
  revealed: boolean;
  /** Seconds left on a Scanner mark (marked threats take extra damage). */
  marked: number;
  /** Seconds left frozen by Quarantine. */
  frozen: number;
  /**
   * The honeypot luring it, or null. A direct reference, not an index: selling a tower
   * reorders the tower list, which would silently retarget an index.
   */
  lure: Tower | null;
  /** Recent positions, for the worm's trailing segments. Newest first. */
  trail: number[];
  /** Boss timer for its special move. */
  special: number;
  /** Seconds of a white hit flash. */
  hitFlash: number;
}

export interface Tower {
  kind: TowerKind;
  node: number;
  x: number;
  y: number;
  range: number;
  cost: number;
  cooldown: number;
  /** Seconds left locked by ransomware. */
  locked: number;
  /** Honeypot captures remaining. */
  capacity: number;
  /** Visual pulse when it acts. */
  flash: number;
}

export interface Beam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  color: "defense" | "threat";
}

export interface Ring {
  x: number;
  y: number;
  r: number;
  speed: number;
  life: number;
  color: "defense" | "threat" | "good";
}

export interface Toast {
  title: string;
  body: string;
  life: number;
}

export interface Stats {
  neutralized: number;
  served: number;
  breaches: number;
  bestCombo: number;
  bossesKilled: number;
  wavesCleared: number;
}

export type Targeting = { kind: "tower"; tower: TowerKind } | { kind: "quarantine" } | null;

export interface World {
  graph: Graph;
  mods: Modifiers;
  enemies: Enemy[];
  towers: Tower[];
  particles: ParticlePool;
  popups: Popup[];
  beams: Beam[];
  rings: Ring[];
  toasts: Toast[];
  credits: number;
  score: number;
  integrity: number;
  combo: number;
  wave: number;
  cfg: WaveConfig;
  /** "build" between waves (place defenses freely), "wave" while threats spawn. */
  stage: "build" | "wave";
  toSpawn: number;
  spawnTimer: number;
  cooldowns: Record<AbilityKind, number>;
  overclock: number;
  targeting: Targeting;
  mouse: { x: number; y: number; inside: boolean };
  shake: number;
  slowmo: number;
  /** Red flash on the core and screen edges after a breach. */
  breachFlash: number;
  seen: Set<Kind>;
  stats: Stats;
  over: boolean;
  time: number;
  nextId: number;
}

/* -------------------------------------------------------------------------- */
/*                                   Setup                                    */
/* -------------------------------------------------------------------------- */

export function newWorld(mods: Modifiers, seed = Math.floor(Math.random() * 1e9)): World {
  return {
    graph: buildGraph(seed),
    mods,
    enemies: [],
    towers: [],
    particles: new ParticlePool(1200),
    popups: [],
    beams: [],
    rings: [],
    toasts: [],
    credits: mods.startCredits,
    score: 0,
    integrity: mods.maxIntegrity,
    combo: 0,
    wave: 0,
    cfg: waveConfig(1),
    stage: "build",
    toSpawn: 0,
    spawnTimer: 0,
    cooldowns: { emp: 0, quarantine: 0, patch: 0, overclock: 0 },
    overclock: 0,
    targeting: null,
    mouse: { x: CX, y: CY, inside: false },
    shake: 0,
    slowmo: 0,
    breachFlash: 0,
    seen: new Set(),
    stats: { neutralized: 0, served: 0, breaches: 0, bestCombo: 0, bossesKilled: 0, wavesCleared: 0 },
    over: false,
    time: 0,
    nextId: 1,
  };
}

const linkLength = (g: Graph, a: number, b: number) => Math.hypot(g.nodes[a]!.x - g.nodes[b]!.x, g.nodes[a]!.y - g.nodes[b]!.y);

/** Shows a threat intel card the first time a kind appears in this run. */
function teach(w: World, kind: Kind) {
  if (w.seen.has(kind)) return;
  w.seen.add(kind);
  const intel = INTEL[kind];
  if (intel) w.toasts.push({ ...intel, life: 6 });
}

/** Spawns one enemy at a node (a gate, or mid-network for boss minions and split bots). */
function spawn(w: World, kind: Kind, at: number, offset = 0) {
  const stats = KINDS[kind];
  const to = nextHop(w.graph, at);
  const hpMul = stats.boss ? w.cfg.bossHpMul : 1;
  const node = w.graph.nodes[at]!;
  w.enemies.push({
    id: w.nextId++,
    kind,
    x: node.x,
    y: node.y,
    from: at,
    to,
    t: offset,
    len: linkLength(w.graph, at, to),
    hp: stats.hp * hpMul,
    maxHp: stats.hp * hpMul,
    speed: stats.speed * w.cfg.speedMul * (0.9 + Math.random() * 0.2),
    age: 0,
    label: stats.labels[Math.floor(Math.random() * stats.labels.length)]!,
    revealed: kind !== "trojan" && kind !== "zeroday" && kind !== "rootkit",
    marked: 0,
    frozen: 0,
    lure: null,
    trail: [],
    special: 3,
    hitFlash: 0,
  });
  teach(w, kind);
}

function spawnFromGate(w: World, kind: Kind) {
  const gate = w.graph.gates[Math.floor(Math.random() * w.graph.gates.length)]!;
  if (kind === "ddos") {
    // A swarm: several bots staggered along the same first link.
    for (let i = 0; i < DDOS_SWARM; i++) spawn(w, "ddos", gate, -i * 9);
  } else {
    spawn(w, kind, gate);
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Actions                                  */
/* -------------------------------------------------------------------------- */

/** Starts the next wave (from the build stage). */
export function launchWave(w: World) {
  if (w.stage !== "build" || w.over) return;
  w.wave++;
  w.cfg = waveConfig(w.wave);
  w.stage = "wave";
  w.toSpawn = w.cfg.count;
  w.spawnTimer = 0.6;
  if (w.cfg.boss) spawnFromGate(w, w.cfg.boss);
  sfx.power();
}

/** Effective cost of a tower after research discounts. */
export const towerCost = (w: World, kind: TowerKind) => Math.round(TOWERS[kind].cost * w.mods.towerCostMul);

/** Nearest buildable node to a point, within a click radius, or -1. O(n). */
export function buildableNodeAt(w: World, x: number, y: number, radius = 24): number {
  let best = -1;
  let bestD = radius * radius;
  for (const node of w.graph.nodes) {
    if (node.kind !== "node") continue;
    const d = (node.x - x) ** 2 + (node.y - y) ** 2;
    if (d < bestD && !w.towers.some((t) => t.node === node.id)) {
      bestD = d;
      best = node.id;
    }
  }
  return best;
}

/** Places a tower if the node is free and affordable. Returns true on success. */
export function placeTower(w: World, kind: TowerKind, node: number): boolean {
  const cost = towerCost(w, kind);
  if (node < 0 || w.credits < cost) {
    sfx.bad();
    return false;
  }
  const n = w.graph.nodes[node]!;
  w.credits -= cost;
  w.towers.push({
    kind, node, x: n.x, y: n.y, range: TOWERS[kind].range * w.mods.towerRangeMul, cost,
    cooldown: 0, locked: 0, capacity: HONEYPOT_CAPACITY, flash: 1,
  });
  w.rings.push({ x: n.x, y: n.y, r: 6, speed: 220, life: 0.5, color: "defense" });
  sfx.power();
  return true;
}

/** Sells the tower nearest the point (within reach), refunding part of its cost. */
export function sellTowerAt(w: World, x: number, y: number, p: Palette): boolean {
  const i = w.towers.findIndex((t) => (t.x - x) ** 2 + (t.y - y) ** 2 < 22 * 22);
  if (i < 0) return false;
  const t = w.towers[i]!;
  const refund = Math.round(t.cost * SELL_REFUND);
  w.credits += refund;
  w.popups.push({ x: t.x, y: t.y - 18, text: `+₵${refund}`, life: 1, color: p.accent });
  swapRemove(w.towers, i);
  sfx.click();
  return true;
}

export const abilityCooldown = (w: World, kind: AbilityKind) =>
  ABILITIES[kind].cooldown * w.mods.cooldownMul * (kind === "patch" ? w.mods.patchCooldownMul : 1);

/** Triggers an ability. Quarantine needs a target, so it switches to targeting mode. */
export function fireAbility(w: World, kind: AbilityKind, p: Palette) {
  if (w.over || w.cooldowns[kind] > 0) {
    sfx.bad();
    return;
  }
  if (kind === "quarantine") {
    w.targeting = w.targeting?.kind === "quarantine" ? null : { kind: "quarantine" };
    sfx.click();
    return;
  }
  w.cooldowns[kind] = abilityCooldown(w, kind);
  if (kind === "emp") {
    w.rings.push({ x: CX, y: CY, r: CORE_R, speed: 1100, life: 1, color: "defense" });
    w.shake = 10;
    for (let i = w.enemies.length - 1; i >= 0; i--) {
      const e = w.enemies[i]!;
      if (!KINDS[e.kind].hostile) continue;
      if (KINDS[e.kind].boss) damage(w, i, EMP_BOSS_DAMAGE, p, true);
      else kill(w, i, p, false);
    }
    sfx.zap();
  } else if (kind === "patch") {
    const heal = PATCH_AMOUNT * w.mods.patchMul;
    w.integrity = Math.min(w.mods.maxIntegrity, w.integrity + heal);
    w.rings.push({ x: CX, y: CY, r: CORE_R, speed: 260, life: 0.8, color: "good" });
    w.popups.push({ x: CX, y: CY - 46, text: `+${heal} INTEGRITY`, life: 1.2, color: p.good });
    sfx.power();
  } else if (kind === "overclock") {
    w.overclock = OVERCLOCK_TIME;
    for (const t of w.towers) t.flash = 1;
    sfx.power();
  }
}

/** Fires Quarantine at a point. */
export function quarantineAt(w: World, x: number, y: number) {
  w.targeting = null;
  w.cooldowns.quarantine = abilityCooldown(w, "quarantine");
  for (const e of w.enemies) {
    if (KINDS[e.kind].hostile && (e.x - x) ** 2 + (e.y - y) ** 2 < QUARANTINE_RADIUS ** 2) e.frozen = QUARANTINE_TIME;
  }
  w.rings.push({ x, y, r: 8, speed: 420, life: 0.45, color: "defense" });
  sfx.zap();
}

/** A click on the play field: hits the best enemy under the pointer. */
export function clickAt(w: World, x: number, y: number, p: Palette) {
  let target = -1;
  let bestRank = Infinity;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i]!;
    const reach = KINDS[e.kind].radius + 10;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d > reach * reach || !visible(w, e)) continue;
    // Prefer hostile targets, so a threat overlapping legit traffic is never shielded by it.
    const rank = d - (KINDS[e.kind].hostile && !(e.kind === "trojan" && !e.revealed) ? 1e6 : 0);
    if (rank < bestRank) {
      bestRank = rank;
      target = i;
    }
  }
  if (target < 0) return;
  const e = w.enemies[target]!;
  if (e.kind === "legit") {
    w.integrity -= 4;
    w.combo = 0;
    w.popups.push({ x: e.x, y: e.y - 14, text: "BLOCKED A REAL USER", life: 1.1, color: p.warn });
    w.particles.burst(e.x, e.y, p.warn, 10);
    swapRemove(w.enemies, target);
    sfx.bad();
    return;
  }
  if (e.kind === "trojan" && !e.revealed) {
    e.revealed = true;
    w.popups.push({ x: e.x, y: e.y - 16, text: "TROJAN UNMASKED", life: 1, color: p.bad });
  }
  damage(w, target, w.mods.clickDamage, p, true);
}

/* -------------------------------------------------------------------------- */
/*                                   Combat                                   */
/* -------------------------------------------------------------------------- */

/** Whether the player can currently see (and so click) an enemy. */
export function visible(w: World, e: Enemy): boolean {
  if (e.kind !== "rootkit") return true;
  return e.revealed || (w.mouse.inside && (e.x - w.mouse.x) ** 2 + (e.y - w.mouse.y) ** 2 < 75 * 75);
}

/** Whether damage can land right now. */
function vulnerable(e: Enemy): boolean {
  if (e.kind === "poly") return polyVulnerable(e.age);
  if (e.kind === "zeroday") return e.revealed || e.age > ZERODAY_EXPOSURE;
  return true;
}

/** Applies damage to the enemy at index `i`, destroying it when its hit points run out. */
function damage(w: World, i: number, amount: number, p: Palette, byPlayer: boolean) {
  const e = w.enemies[i]!;
  if (!vulnerable(e)) {
    w.popups.push({ x: e.x, y: e.y - 16, text: e.kind === "zeroday" ? "UNKNOWN SIGNATURE" : "SHIELDED", life: 0.7, color: p.muted });
    w.particles.burst(e.x, e.y, p.muted, 4, 80);
    sfx.click();
    return;
  }
  const dealt = amount * (e.marked > 0 ? MARK_MULTIPLIER : 1);
  e.hp -= dealt;
  e.hitFlash = 0.12;
  if (e.hp <= 0.001) kill(w, i, p, byPlayer);
  else {
    w.particles.burst(e.x, e.y, p.bad, 5, 90);
    if (KINDS[e.kind].boss) w.popups.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - 26, text: `-${dealt.toFixed(dealt % 1 ? 1 : 0)}`, life: 0.6, color: p.text });
    if (byPlayer) sfx.click();
  }
}

/** Destroys the enemy at index `i` and pays out its reward. */
function kill(w: World, i: number, p: Palette, byPlayer: boolean) {
  const e = w.enemies[i]!;
  const stats = KINDS[e.kind];
  w.combo++;
  w.stats.bestCombo = Math.max(w.stats.bestCombo, w.combo);
  w.stats.neutralized++;
  w.credits += stats.reward;
  const points = stats.reward * 5 * comboMultiplier(w.combo);
  w.score += points;
  if (stats.boss) {
    w.stats.bossesKilled++;
    w.slowmo = 0.9;
    w.shake = 16;
    w.particles.burst(e.x, e.y, p.bad, 90, 340);
    w.particles.burst(e.x, e.y, p.text, 40, 220);
    w.rings.push({ x: e.x, y: e.y, r: 10, speed: 520, life: 1, color: "threat" });
    w.popups.push({ x: e.x, y: e.y - 30, text: `${stats.labels[0]} PURGED  +₵${stats.reward}`, life: 2, color: p.good });
    for (const t of w.towers) t.locked = 0; // Killing ransomware decrypts every tower.
    sfx.win();
  } else {
    w.particles.burst(e.x, e.y, p.bad, e.kind === "ddos" || e.kind === "bot" ? 6 : 16);
    w.popups.push({ x: e.x, y: e.y - 12, text: `+${points}`, life: 0.7, color: p.accent });
    if (byPlayer || Math.random() < 0.3) sfx.hit();
  }
  swapRemove(w.enemies, i);
  if (e.kind === "botnet") {
    // The botnet's controller is down: its bots scatter onward from here.
    for (let k = 0; k < BOTNET_SPLIT; k++) spawn(w, "bot", e.from, e.t - k * 8);
  }
}

/** A threat (or legit packet) reaches the core. */
function arrive(w: World, i: number, p: Palette) {
  const e = w.enemies[i]!;
  const stats = KINDS[e.kind];
  if (!stats.hostile) {
    w.credits += stats.reward;
    w.score += 10;
    w.stats.served++;
    w.particles.burst(e.x, e.y, p.good, 6, 60);
  } else {
    const dmg = Math.round(stats.damage * w.mods.breachMul);
    w.integrity -= dmg;
    w.combo = 0;
    w.shake = stats.boss ? 18 : 8;
    w.breachFlash = 1;
    w.stats.breaches++;
    w.popups.push({ x: CX, y: CY - 52, text: `BREACH -${dmg}`, life: 1.1, color: p.bad });
    w.particles.burst(e.x, e.y, p.bad, 26, 260);
    w.rings.push({ x: CX, y: CY, r: CORE_R, speed: 300, life: 0.6, color: "threat" });
    sfx.bad();
  }
  swapRemove(w.enemies, i);
}

/* -------------------------------------------------------------------------- */
/*                                 Simulation                                 */
/* -------------------------------------------------------------------------- */

export interface StepResult {
  waveCleared: boolean;
  gameOver: boolean;
}

/** Advances the world by `realDt` seconds. */
export function step(w: World, realDt: number, p: Palette): StepResult {
  const result: StepResult = { waveCleared: false, gameOver: false };
  if (w.over) return result;

  // Slow motion after a boss kill. Timers below use the scaled time.
  w.slowmo = Math.max(0, w.slowmo - realDt);
  const dt = realDt * (w.slowmo > 0 ? 0.3 : 1);
  w.time += dt;
  w.shake = Math.max(0, w.shake - realDt * 24);
  w.breachFlash = Math.max(0, w.breachFlash - realDt * 2);
  w.overclock = Math.max(0, w.overclock - dt);
  for (const k of Object.keys(w.cooldowns) as AbilityKind[]) w.cooldowns[k] = Math.max(0, w.cooldowns[k] - dt);
  for (let i = w.toasts.length - 1; i >= 0; i--) {
    w.toasts[i]!.life -= realDt;
    if (w.toasts[i]!.life <= 0) w.toasts.splice(i, 1); // Keeps order: toasts are a short queue.
  }

  // Spawning.
  if (w.stage === "wave" && w.toSpawn > 0) {
    w.spawnTimer -= dt;
    if (w.spawnTimer <= 0) {
      spawnFromGate(w, rollKind(w.cfg));
      w.toSpawn--;
      w.spawnTimer = w.cfg.interval;
    }
  }

  // Scanners: profile and mark everything in range.
  const scanners = w.towers.filter((t) => t.kind === "scanner" && t.locked <= 0);
  const sandboxes = w.towers.filter((t) => t.kind === "sandbox" && t.locked <= 0);
  for (const e of w.enemies) {
    e.marked = Math.max(0, e.marked - dt);
    if (w.mods.threatIntel && e.kind === "trojan") e.revealed = true;
    for (const s of scanners) {
      if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < s.range * s.range && KINDS[e.kind].hostile) {
        e.revealed = true;
        e.marked = 0.4;
      }
    }
  }

  // Move enemies.
  for (let i = w.enemies.length - 1; i >= 0; i--) {
    const e = w.enemies[i]!;
    const stats = KINDS[e.kind];
    e.age += dt;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.frozen > 0) {
      e.frozen -= dt;
      continue;
    }
    let speed = e.speed;
    if (stats.hostile) {
      for (const s of sandboxes) if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < s.range * s.range) speed *= SANDBOX_SLOW;
    }

    // Honeypots lure ordinary threats in range (bosses are too smart for that).
    if (e.lure && (e.lure.capacity <= 0 || !w.towers.includes(e.lure))) e.lure = null;
    if (!e.lure && stats.hostile && !stats.boss) {
      for (const t of w.towers) {
        if (t.kind === "honeypot" && t.locked <= 0 && t.capacity > 0 && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 < t.range * t.range) {
          e.lure = t;
          break;
        }
      }
    }
    const lure = e.lure;

    if (lure) {
      const dx = lure.x - e.x;
      const dy = lure.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) {
        // Trapped: the honeypot captures it.
        lure.capacity--;
        lure.flash = 1;
        w.popups.push({ x: lure.x, y: lure.y - 20, text: "TRAPPED", life: 0.8, color: p.accent });
        kill(w, i, p, false);
        continue;
      }
      e.x += (dx / d) * speed * dt;
      e.y += (dy / d) * speed * dt;
    } else {
      e.t += speed * dt;
      while (e.t >= e.len) {
        e.t -= e.len;
        if (e.to === 0) break;
        e.from = e.to;
        e.to = nextHop(w.graph, e.from);
        e.len = linkLength(w.graph, e.from, e.to);
      }
      const a = w.graph.nodes[e.from]!;
      const b = w.graph.nodes[e.to]!;
      const f = e.len > 0 ? Math.min(1, Math.max(0, e.t) / e.len) : 1;
      e.x = a.x + (b.x - a.x) * f;
      e.y = a.y + (b.y - a.y) * f;
      if ((e.x - CX) ** 2 + (e.y - CY) ** 2 < (CORE_R + stats.radius * 0.5) ** 2) {
        arrive(w, i, p);
        continue;
      }
    }

    // Worm body: remember positions so segments can trail behind the head.
    if (e.kind === "worm") {
      const last = e.trail;
      if (last.length < 2 || (last[0]! - e.x) ** 2 + (last[1]! - e.y) ** 2 > 36) {
        last.unshift(e.x, e.y);
        if (last.length > 16) last.length = 16;
      }
    }

    // Boss specials.
    if (stats.boss) {
      e.special -= dt;
      if (e.special <= 0) {
        if (e.kind === "ransomware") {
          // Encrypt the nearest working tower.
          let nearest: Tower | undefined;
          let best = 300 * 300;
          for (const t of w.towers) {
            const d = (t.x - e.x) ** 2 + (t.y - e.y) ** 2;
            if (t.locked <= 0 && d < best) {
              best = d;
              nearest = t;
            }
          }
          if (nearest) {
            nearest.locked = 6;
            w.beams.push({ x1: e.x, y1: e.y, x2: nearest.x, y2: nearest.y, life: 0.5, color: "threat" });
            w.popups.push({ x: nearest.x, y: nearest.y - 20, text: "ENCRYPTED", life: 1, color: p.bad });
          }
          spawn(w, "exploit", e.from, e.t);
          e.special = 4.5;
        } else if (e.kind === "rootkit") {
          spawn(w, "trojan", e.from, e.t);
          e.special = 3.5;
        } else {
          e.special = 99;
        }
      }
    }
  }

  // Towers.
  const rate = w.overclock > 0 ? 2 : 1;
  for (const t of w.towers) {
    t.flash = Math.max(0, t.flash - dt * 2);
    if (t.locked > 0) {
      t.locked -= dt;
      continue;
    }
    if (t.kind !== "firewall") continue;
    t.cooldown -= dt * rate;
    if (t.cooldown > 0) continue;
    // Target the hostile in range that is closest to the core (the most urgent one).
    let target = -1;
    let urgency = Infinity;
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i]!;
      if (!KINDS[e.kind].hostile || (e.kind === "trojan" && !e.revealed) || !visible(w, e)) continue;
      if ((e.x - t.x) ** 2 + (e.y - t.y) ** 2 > t.range * t.range) continue;
      const u = w.graph.dist[e.to]! + (e.len - e.t);
      if (u < urgency) {
        urgency = u;
        target = i;
      }
    }
    if (target >= 0) {
      const e = w.enemies[target]!;
      w.beams.push({ x1: t.x, y1: t.y, x2: e.x, y2: e.y, life: 0.16, color: "defense" });
      t.flash = 1;
      t.cooldown = FIREWALL_INTERVAL;
      damage(w, target, 1, p, false);
    }
  }

  // Effects.
  for (let i = w.beams.length - 1; i >= 0; i--) {
    w.beams[i]!.life -= dt;
    if (w.beams[i]!.life <= 0) swapRemove(w.beams, i);
  }
  for (let i = w.rings.length - 1; i >= 0; i--) {
    const r = w.rings[i]!;
    r.r += r.speed * dt;
    r.life -= dt * 1.4;
    if (r.life <= 0) swapRemove(w.rings, i);
  }
  w.particles.update(dt);
  for (let i = w.popups.length - 1; i >= 0; i--) {
    const pop = w.popups[i]!;
    pop.life -= dt;
    pop.y -= 34 * dt;
    if (pop.life <= 0) swapRemove(w.popups, i);
  }

  // End of wave, or end of game.
  if (w.integrity <= 0) {
    w.integrity = 0;
    w.over = true;
    result.gameOver = true;
    sfx.lose();
  } else if (w.stage === "wave" && w.toSpawn === 0 && !w.enemies.some((e) => KINDS[e.kind].hostile)) {
    const bonus = waveBonus(w.wave);
    w.credits += bonus;
    w.score += bonus * 2;
    w.stats.wavesCleared++;
    w.stage = "build";
    w.popups.push({ x: CX, y: CY - 70, text: `WAVE ${w.wave} CLEAR  +₵${bonus}`, life: 1.8, color: p.good });
    result.waveCleared = true;
    sfx.win();
  }
  return result;
}
