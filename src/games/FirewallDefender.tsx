/**
 * @file FIREWALL DEFENDER
 *
 * Packets stream toward your server core in waves. Click threats to neutralize them,
 * let legit traffic through, and pick an upgrade after every wave. Every fifth wave
 * brings a boss.
 *
 * Architecture
 * ------------
 * - Rules (balance, waves, upgrades) are pure functions in `firewallRules.ts`.
 * - The simulation lives in one mutable `World` object held in a ref and advanced by a
 *   requestAnimationFrame loop. React state only tracks the phase and the end of game
 *   summary, so the 60fps update never triggers a React re-render.
 *
 * Complexity per frame (n = packets on screen, usually under 40)
 * ---------------------------------------------------------------
 * - Movement and core collision: O(n), one pass.
 * - Removal: O(1) each, via swap-remove.
 * - Turret targeting: O(n) scan, but only when the turret fires (about once a second).
 * - Click hit test: O(n), only on pointer down.
 * - Wave clear check: O(1), because it only inspects counters.
 * - Background: one drawImage of a cached layer instead of redrawing the grid.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "../lib/sound";
import { useHighScore } from "../hooks/useHighScore";
import {
  ParticlePool, createLayer, drawGrid, drawPopups, pick, readPalette, swapRemove, toLocal,
  updatePopups, useGameCanvas, useGameLoop, usePauseOnHide, type Palette, type Popup,
} from "./engine";
import { GameOverlay, type Phase } from "./GameOverlay";
import {
  KINDS, UPGRADES, armorFactor, comboMultiplier, empGain, emptyLoadout, pickUpgrades, rollKind,
  tarpitFactor, turretInterval, waveBonus, waveConfig,
  type Kind, type Loadout, type UpgradeId, type WaveConfig,
} from "./firewallRules";

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const W = 800;
const H = 500;
const CX = W / 2;
const CY = H / 2;
const CORE_R = 34;
/** Radius of the firewall ring. The tarpit upgrade slows hostiles inside it. */
const PERIMETER = 125;
const TURRET_RANGE = 280;
/** Extra pixels around each packet that still count as a hit. Makes touch play fair. */
const HIT_PADDING = 8;
/** Trojans flash their true color for this many seconds out of every TROJAN_CYCLE. */
const TROJAN_TELL = 0.16;
const TROJAN_CYCLE = 1.5;

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface Packet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: Kind;
  label: string;
  hp: number;
  maxHp: number;
  /** Seconds alive. Drives the worm wiggle, the trojan flicker, and boss spawns. */
  age: number;
  halfW: number;
  halfH: number;
  /** Boss only: countdown until it spawns its next minion. */
  spawnIn: number;
}

/** Expanding EMP shockwave ring. */
interface Ring {
  r: number;
  life: number;
}

/** Turret laser, drawn from the core to a point for a few frames. */
interface Beam {
  x: number;
  y: number;
  life: number;
}

interface Stats {
  neutralized: number;
  served: number;
  breaches: number;
  bestCombo: number;
}

interface World {
  packets: Packet[];
  particles: ParticlePool;
  popups: Popup[];
  rings: Ring[];
  beams: Beam[];
  score: number;
  integrity: number;
  combo: number;
  /** EMP charge, 0 to 100. */
  emp: number;
  time: number;
  shake: number;
  cfg: WaveConfig;
  /** Edge spawns still owed this wave. */
  toSpawn: number;
  spawnTimer: number;
  /** Seconds the wave banner stays on screen. */
  banner: number;
  loadout: Loadout;
  turretTimer: number;
  over: boolean;
  stats: Stats;
}

interface Result {
  score: number;
  record: boolean;
  wave: number;
  stats: Stats;
}

/* -------------------------------------------------------------------------- */
/*                              World construction                            */
/* -------------------------------------------------------------------------- */

function newWorld(): World {
  return {
    packets: [], particles: new ParticlePool(), popups: [], rings: [], beams: [],
    score: 0, integrity: 100, combo: 0, emp: 0, time: 0, shake: 0,
    cfg: waveConfig(1), toSpawn: 0, spawnTimer: 0, banner: 0,
    loadout: emptyLoadout(), turretTimer: 0, over: false,
    stats: { neutralized: 0, served: 0, breaches: 0, bestCombo: 0 },
  };
}

/**
 * Creates a packet at (x, y) heading straight for the core.
 * @param hp Overrides the default hit points (used for the boss, which scales by wave).
 */
function addPacket(w: World, kind: Kind, x: number, y: number, hp?: number) {
  const stats = KINDS[kind];
  const label = pick(stats.labels);
  const speed = w.cfg.speed * stats.speed * (0.88 + Math.random() * 0.24);
  const dist = Math.hypot(CX - x, CY - y) || 1;
  const boss = kind === "boss";
  w.packets.push({
    x, y, kind, label,
    vx: ((CX - x) / dist) * speed,
    vy: ((CY - y) / dist) * speed,
    hp: hp ?? stats.hp,
    maxHp: hp ?? stats.hp,
    age: Math.random() * TROJAN_CYCLE,
    halfW: boss ? 62 : kind === "bot" ? 20 : label.length * 4.2 + 10,
    halfH: boss ? 17 : kind === "bot" ? 9 : 11,
    spawnIn: 3,
  });
}

/** Spawns a packet just outside a random screen edge. */
function spawnFromEdge(w: World, kind: Kind, hp?: number) {
  const side = Math.floor(Math.random() * 4);
  const x = side === 0 ? -40 : side === 1 ? W + 40 : Math.random() * W;
  const y = side === 2 ? -24 : side === 3 ? H + 24 : Math.random() * H;
  addPacket(w, kind, x, y, hp);
}

function startWave(w: World, wave: number) {
  w.cfg = waveConfig(wave);
  w.toSpawn = w.cfg.count;
  w.spawnTimer = 1.4;
  w.banner = 2.4;
  if (w.cfg.boss) spawnFromEdge(w, "boss", w.cfg.bossHp);
}

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

export default function FirewallDefender() {
  const { canvasRef, ctxRef, paletteRef } = useGameCanvas(W, H);
  const world = useRef<World>(newWorld());
  const bgLayer = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [choices, setChoices] = useState<UpgradeId[]>([]);
  const [result, setResult] = useState<Result>({ score: 0, record: false, wave: 1, stats: world.current.stats });
  const { best, submit } = useHighScore("firewall");

  /* ------------------------------ Game actions ----------------------------- */

  const start = useCallback(() => {
    const p = readPalette();
    paletteRef.current = p;
    // Paint the static background once. Each frame then costs a single drawImage.
    bgLayer.current = createLayer(W, H, (ctx) => {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
      drawGrid(ctx, W, H, p.border);
    });
    world.current = newWorld();
    startWave(world.current, 1);
    setPhase("playing");
    sfx.power();
  }, [paletteRef]);

  /**
   * Removes the packet at index `i` as a kill and pays out its rewards.
   * @param split When true, a destroyed botnet splits into two bots.
   */
  const destroy = (w: World, i: number, p: Palette, split: boolean) => {
    const pk = w.packets[i]!;
    const stats = KINDS[pk.kind];
    w.combo++;
    w.stats.bestCombo = Math.max(w.stats.bestCombo, w.combo);
    w.stats.neutralized++;
    const gained = stats.score * comboMultiplier(w.combo);
    w.score += gained;
    w.emp = Math.min(100, w.emp + stats.emp * empGain(w.loadout.capacitor));
    w.popups.push({ x: pk.x, y: pk.y, text: `+${gained}`, life: 0.8, color: p.accent });
    w.particles.burst(pk.x, pk.y, p.bad, pk.kind === "boss" ? 70 : 16, pk.kind === "boss" ? 320 : 180);

    if (pk.kind === "boss") {
      w.shake = 12;
      w.popups.push({ x: pk.x, y: pk.y - 24, text: "RANSOMWARE PURGED", life: 1.6, color: p.good });
      sfx.win();
    } else {
      sfx.hit();
    }

    swapRemove(w.packets, i);
    if (split && pk.kind === "botnet") {
      // Offset the two bots sideways (perpendicular to the botnet's heading).
      const speed = Math.hypot(pk.vx, pk.vy) || 1;
      const px = (-pk.vy / speed) * 26;
      const py = (pk.vx / speed) * 26;
      addPacket(w, "bot", pk.x + px, pk.y + py);
      addPacket(w, "bot", pk.x - px, pk.y - py);
    }
  };

  /** Applies damage to a packet, destroying it when its hit points run out. */
  const hit = (w: World, i: number, dmg: number, p: Palette) => {
    const pk = w.packets[i]!;
    pk.hp -= dmg;
    if (pk.hp <= 0) destroy(w, i, p, true);
    else {
      w.particles.burst(pk.x, pk.y, p.bad, 5, 90);
      sfx.click();
    }
  };

  const fireEmp = useCallback(() => {
    const w = world.current;
    const p = paletteRef.current;
    if (!p || w.emp < 100 || w.over) return;
    w.emp = 0;
    w.rings.push({ r: CORE_R, life: 1 });
    w.popups.push({ x: CX, y: CY - 64, text: "EMP BLAST", life: 1.2, color: p.accent2 });
    sfx.zap();
    // Backward iteration is safe with swap-remove: the element swapped in was already visited.
    for (let i = w.packets.length - 1; i >= 0; i--) {
      const pk = w.packets[i]!;
      if (!KINDS[pk.kind].hostile) continue;
      if (pk.kind === "boss") {
        // The boss shrugs off most of the blast.
        pk.hp -= 4;
        w.particles.burst(pk.x, pk.y, p.accent2, 20);
        if (pk.hp <= 0) destroy(w, i, p, false);
      } else {
        w.score += 15;
        w.stats.neutralized++;
        w.particles.burst(pk.x, pk.y, p.accent2, 10);
        swapRemove(w.packets, i);
      }
    }
  }, [paletteRef]);

  const chooseUpgrade = useCallback((id: UpgradeId) => {
    const w = world.current;
    if (id === "repair") w.integrity = Math.min(100, w.integrity + 35);
    else w.loadout[id]++;
    startWave(w, w.cfg.wave + 1);
    setPhase("playing");
    sfx.power();
  }, []);

  /* --------------------------------- Input --------------------------------- */

  // Space fires the EMP, P toggles pause, and 1 to 3 pick an upgrade.
  // Escape is left alone because it closes the game window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === "playing" && e.code === "Space") {
        e.preventDefault();
        fireEmp();
      } else if (e.key.toLowerCase() === "p" && (phase === "playing" || phase === "paused")) {
        e.preventDefault();
        setPhase(phase === "playing" ? "paused" : "playing");
      } else if (phase === "intermission") {
        const choice = choices[Number(e.key) - 1];
        if (choice) chooseUpgrade(choice);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, choices, fireEmp, chooseUpgrade]);

  usePauseOnHide(() => setPhase((p) => (p === "playing" ? "paused" : p)));

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = paletteRef.current;
    if (phase !== "playing" || !p) return;
    const w = world.current;
    const { x, y } = toLocal(e.currentTarget, e, W, H);

    // EMP button (bottom center).
    if (Math.abs(x - CX) < 90 && y > H - 40) return fireEmp();

    // Find the best packet under the pointer in one O(n) pass. Hostiles win ties, so a
    // threat overlapping legit traffic is never blocked by it.
    let target = -1;
    let bestRank = Infinity;
    for (let i = 0; i < w.packets.length; i++) {
      const pk = w.packets[i]!;
      const dx = Math.abs(x - pk.x);
      const dy = Math.abs(y - pk.y);
      if (dx > pk.halfW + HIT_PADDING || dy > pk.halfH + HIT_PADDING) continue;
      const rank = dx * dx + dy * dy - (KINDS[pk.kind].hostile ? 1e6 : 0);
      if (rank < bestRank) {
        bestRank = rank;
        target = i;
      }
    }
    if (target < 0) return;

    const pk = w.packets[target]!;
    if (pk.kind === "legit") {
      w.score = Math.max(0, w.score - 15);
      w.combo = 0;
      w.integrity -= 4;
      w.popups.push({ x: pk.x, y: pk.y, text: "LEGIT TRAFFIC! -15", life: 1, color: p.warn });
      w.particles.burst(pk.x, pk.y, p.warn, 8);
      sfx.bad();
      swapRemove(w.packets, target);
    } else if (pk.kind === "patch") {
      w.integrity = Math.min(100, w.integrity + 20);
      w.popups.push({ x: pk.x, y: pk.y, text: "+20 INTEGRITY", life: 1, color: p.good });
      w.particles.burst(pk.x, pk.y, p.good, 16);
      sfx.power();
      swapRemove(w.packets, target);
    } else {
      if (pk.kind === "trojan") w.popups.push({ x: pk.x, y: pk.y - 18, text: "TROJAN UNMASKED", life: 0.9, color: p.warn });
      hit(w, target, 1, p);
    }
  };

  /* -------------------------------- Simulation ----------------------------- */

  const update = (dt: number) => {
    const w = world.current;
    const p = paletteRef.current!;
    w.time += dt;
    w.banner = Math.max(0, w.banner - dt);
    w.shake = Math.max(0, w.shake - dt * 20);

    // Edge spawns for the current wave.
    if (w.toSpawn > 0) {
      w.spawnTimer -= dt;
      if (w.spawnTimer <= 0) {
        spawnFromEdge(w, rollKind(w.cfg));
        w.toSpawn--;
        w.spawnTimer = w.cfg.interval;
      }
    }

    // Move packets and resolve arrivals at the core in a single backward pass.
    const slow = tarpitFactor(w.loadout.tarpit);
    for (let i = w.packets.length - 1; i >= 0; i--) {
      const pk = w.packets[i]!;
      const stats = KINDS[pk.kind];
      pk.age += dt;
      const dist = Math.hypot(pk.x - CX, pk.y - CY);
      const step = dt * (stats.hostile && dist < PERIMETER ? slow : 1);
      pk.x += pk.vx * step;
      pk.y += pk.vy * step;

      if (pk.kind === "worm") {
        // Worms wiggle perpendicular to their heading.
        const speed = Math.hypot(pk.vx, pk.vy) || 1;
        const wobble = Math.cos(pk.age * 5) * 90 * dt;
        pk.x += (-pk.vy / speed) * wobble;
        pk.y += (pk.vx / speed) * wobble;
      } else if (pk.kind === "boss" && dist > PERIMETER) {
        pk.spawnIn -= dt;
        if (pk.spawnIn <= 0) {
          pk.spawnIn = 2.6;
          addPacket(w, "threat", pk.x, pk.y);
        }
      }

      if (dist < CORE_R + pk.halfH) {
        if (pk.kind === "legit") {
          w.score += stats.score;
          w.stats.served++;
          w.particles.burst(pk.x, pk.y, p.good, 6, 60);
        } else if (stats.hostile) {
          const dmg = Math.round(stats.damage * armorFactor(w.loadout.armor));
          w.integrity -= dmg;
          w.combo = 0;
          w.shake = pk.kind === "boss" ? 16 : 8;
          w.stats.breaches++;
          w.popups.push({ x: CX, y: CY - 50, text: `BREACH -${dmg}%`, life: 1, color: p.bad });
          w.particles.burst(pk.x, pk.y, p.bad, 24, 260);
          sfx.bad();
        }
        swapRemove(w.packets, i);
      }
    }

    // Auto turret: zap the nearest valid hostile in range.
    const interval = turretInterval(w.loadout.turret);
    if (interval !== Infinity) {
      w.turretTimer -= dt;
      if (w.turretTimer <= 0) {
        let target = -1;
        let nearest = TURRET_RANGE * TURRET_RANGE;
        for (let i = 0; i < w.packets.length; i++) {
          const pk = w.packets[i]!;
          // Without Deep Packet Inspection the turret cannot tell trojans from legit traffic.
          if (!KINDS[pk.kind].hostile || (pk.kind === "trojan" && !w.loadout.dpi)) continue;
          const d = (pk.x - CX) ** 2 + (pk.y - CY) ** 2; // Squared distance avoids a sqrt.
          if (d < nearest) {
            nearest = d;
            target = i;
          }
        }
        if (target >= 0) {
          const pk = w.packets[target]!;
          w.beams.push({ x: pk.x, y: pk.y, life: 0.18 });
          w.turretTimer = interval;
          hit(w, target, 1, p);
        }
      }
    }

    for (let i = w.rings.length - 1; i >= 0; i--) {
      const ring = w.rings[i]!;
      ring.r += 900 * dt;
      ring.life -= dt * 1.4;
      if (ring.life <= 0) swapRemove(w.rings, i);
    }
    for (let i = w.beams.length - 1; i >= 0; i--) {
      w.beams[i]!.life -= dt;
      if (w.beams[i]!.life <= 0) swapRemove(w.beams, i);
    }
    w.particles.update(dt);
    updatePopups(w.popups, dt);

    if (w.integrity <= 0 && !w.over) {
      w.over = true;
      w.integrity = 0;
      sfx.lose();
      setResult({ score: w.score, record: submit(w.score), wave: w.cfg.wave, stats: { ...w.stats } });
      setPhase("over");
    } else if (!w.over && w.toSpawn === 0 && w.packets.length === 0) {
      // Wave cleared. Both conditions are counters, so this check is O(1).
      const bonus = waveBonus(w.cfg.wave);
      w.score += bonus;
      w.popups.push({ x: CX, y: CY - 70, text: `WAVE CLEAR +${bonus}`, life: 1.4, color: p.good });
      sfx.win();
      setChoices(pickUpgrades(w.loadout));
      setPhase("intermission");
    }
  };

  /* --------------------------------- Rendering ----------------------------- */

  const draw = (t: number) => {
    const ctx = ctxRef.current;
    const p = paletteRef.current;
    if (!ctx || !p) return;
    const w = world.current;
    const mono = (size: number, bold = true) => `${bold ? "bold " : ""}${size}px 'Geist Mono', monospace`;

    ctx.save();
    if (w.shake > 0) ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake);

    if (bgLayer.current) ctx.drawImage(bgLayer.current, 0, 0, W, H);
    else {
      ctx.fillStyle = p.bg;
      ctx.fillRect(0, 0, W, H);
    }

    // Firewall perimeter. It glows when the tarpit upgrade is active.
    if (w.loadout.tarpit > 0) {
      ctx.fillStyle = p.accent2;
      ctx.globalAlpha = 0.04 + w.loadout.tarpit * 0.025;
      ctx.beginPath();
      ctx.arc(CX, CY, PERIMETER, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(t * 0.4);
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([10, 14]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, PERIMETER, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    // Turret beams.
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3;
    for (const beam of w.beams) {
      ctx.globalAlpha = Math.min(beam.life * 6, 1);
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(beam.x, beam.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Pulsing core, colored by integrity.
    const health = w.integrity / 100;
    const coreColor = health > 0.5 ? p.accent : health > 0.25 ? p.warn : p.bad;
    ctx.shadowColor = coreColor;
    ctx.shadowBlur = 30;
    ctx.fillStyle = p.surface;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CX, CY, CORE_R * (1 + Math.sin(t * 3) * 0.06), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = coreColor;
    ctx.font = mono(12);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CORE", CX, CY);

    // EMP shockwaves.
    ctx.strokeStyle = p.accent2;
    ctx.lineWidth = 6;
    for (const ring of w.rings) {
      ctx.globalAlpha = Math.max(ring.life, 0);
      ctx.beginPath();
      ctx.arc(CX, CY, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Packets.
    const dpi = w.loadout.dpi > 0;
    for (const pk of w.packets) {
      let color = p.bad;
      if (pk.kind === "legit") color = p.good;
      else if (pk.kind === "patch") color = p.accent2;
      else if (pk.kind === "trojan") {
        // Disguised as legit, except for a brief red flicker (or always, once unmasked by DPI).
        color = dpi || pk.age % TROJAN_CYCLE < TROJAN_TELL ? p.bad : p.good;
      } else if (pk.kind === "boss") color = p.warn;

      // Motion trail.
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pk.x, pk.y);
      ctx.lineTo(pk.x - pk.vx * 0.25, pk.y - pk.vy * 0.25);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = p.surface;
      ctx.lineWidth = pk.kind === "boss" ? 3 : pk.maxHp > 1 ? 1 + pk.hp : 2;
      if (pk.kind === "trojan" && dpi) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.roundRect(pk.x - pk.halfW, pk.y - pk.halfH, pk.halfW * 2, pk.halfH * 2, pk.halfH);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = mono(pk.kind === "boss" ? 14 : pk.kind === "bot" ? 10 : 12);
      ctx.fillText(pk.label, pk.x, pk.y + 1);

      if (pk.kind === "boss") {
        // Boss health bar.
        ctx.fillStyle = p.border;
        ctx.fillRect(pk.x - 50, pk.y - 30, 100, 5);
        ctx.fillStyle = p.bad;
        ctx.fillRect(pk.x - 50, pk.y - 30, 100 * (pk.hp / pk.maxHp), 5);
      }
    }

    w.particles.draw(ctx);
    drawPopups(ctx, w.popups);
    ctx.restore();

    /* HUD, drawn without screen shake. */
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.font = mono(16);
    ctx.fillStyle = p.text;
    ctx.fillText(`SCORE ${w.score.toLocaleString()}`, 16, 28);
    ctx.font = mono(12, false);
    ctx.fillStyle = p.muted;
    ctx.fillText(`WAVE ${w.cfg.wave}  ·  COMBO x${comboMultiplier(w.combo)}`, 16, 46);

    // Owned upgrades, bottom left.
    let ux = 16;
    ctx.font = "15px sans-serif";
    ctx.fillStyle = p.text;
    for (const id of Object.keys(w.loadout) as UpgradeId[]) {
      const level = w.loadout[id];
      if (!level || id === "repair") continue;
      ctx.fillText(UPGRADES[id].icon, ux, H - 16);
      ctx.font = mono(10);
      ctx.fillStyle = p.muted;
      ctx.fillText(String(level), ux + 18, H - 14);
      ctx.font = "15px sans-serif";
      ctx.fillStyle = p.text;
      ux += 36;
    }

    // Integrity bar.
    ctx.font = mono(12, false);
    ctx.textAlign = "right";
    ctx.fillStyle = p.muted;
    ctx.fillText(`INTEGRITY ${Math.ceil(w.integrity)}%`, W - 16, 22);
    ctx.fillStyle = p.border;
    ctx.fillRect(W - 176, 30, 160, 8);
    ctx.fillStyle = coreColor;
    ctx.fillRect(W - 176, 30, 160 * health, 8);

    // EMP charge button.
    const ready = w.emp >= 100;
    ctx.fillStyle = p.surface;
    ctx.strokeStyle = ready ? p.accent2 : p.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(CX - 90, H - 36, 180, 24, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ready ? p.accent2 : p.border;
    ctx.globalAlpha = ready ? 0.35 + Math.sin(t * 8) * 0.15 : 0.6;
    ctx.beginPath();
    ctx.roundRect(CX - 88, H - 34, 176 * (w.emp / 100), 20, 10);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.fillStyle = ready ? p.text : p.muted;
    ctx.fillText(ready ? "EMP READY [SPACE]" : `EMP ${Math.floor(w.emp)}%`, CX, H - 20);

    // Wave banner.
    if (w.banner > 0) {
      ctx.globalAlpha = Math.min(w.banner, 1);
      ctx.font = mono(34);
      ctx.fillStyle = w.cfg.boss ? p.warn : p.accent;
      ctx.fillText(w.cfg.boss ? `BOSS WAVE ${w.cfg.wave}` : `WAVE ${w.cfg.wave}`, CX, 120);
      ctx.globalAlpha = 1;
    }
  };

  // The loop always runs so the menu has a living background, but the world only
  // advances while playing.
  useGameLoop((dt) => {
    if (phase === "playing") update(dt);
    draw(performance.now() / 1000);
  }, true);

  /* ---------------------------------- Markup -------------------------------- */

  const w = world.current;
  return (
    <div className="relative mx-auto w-full max-w-[800px] overflow-hidden border border-border">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        className="block aspect-[8/5] w-full touch-none cursor-crosshair"
        aria-label="Firewall Defender game canvas"
      />

      {phase === "intermission" && (
        <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-bg/90 p-3">
          <div className="w-full max-w-xl text-center">
            <h3 className="font-mono text-xl font-bold text-good sm:text-2xl">WAVE {w.cfg.wave} CLEARED</h3>
            <p className="mt-1 text-sm text-muted">Choose an upgrade (or press 1 to {choices.length})</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {choices.map((id, i) => {
                const def = UPGRADES[id];
                const next = w.loadout[id] + 1;
                return (
                  <button
                    key={id}
                    onClick={() => chooseUpgrade(id)}
                    autoFocus={i === 0}
                    className="panel panel-hover flex items-center gap-3 p-3 text-left sm:block sm:text-center"
                  >
                    <span className="text-2xl text-accent sm:text-3xl" aria-hidden>{def.icon}</span>
                    <span className="block">
                      <span className="block font-mono text-sm font-bold text-accent">{def.name}</span>
                      {def.max !== Infinity && <span className="block font-mono text-[11px] text-muted">Level {next} of {def.max}</span>}
                      <span className="mt-1 block text-xs text-text/80">{def.describe(next)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <GameOverlay
        phase={phase}
        title="Firewall Defender"
        tagline="Hostile packets are inbound. Protect the core."
        controls={[
          "Click or tap RED threats. Let GREEN traffic through",
          "Trojans look green but flicker red. Stay sharp",
          "Grab BLUE patches and pick an upgrade each wave",
          "SPACE fires the EMP. P pauses. ESC exits",
        ]}
        score={result.score}
        best={best}
        isRecord={result.record}
        onStart={start}
        onResume={() => setPhase("playing")}
      >
        <p className="mt-2 font-mono text-sm text-muted">Reached wave {result.wave}</p>
        <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-[11px]">
          <div className="panel p-2"><div className="text-lg text-bad">{result.stats.neutralized}</div>neutralized</div>
          <div className="panel p-2"><div className="text-lg text-good">{result.stats.served}</div>served</div>
          <div className="panel p-2"><div className="text-lg text-warn">{result.stats.breaches}</div>breaches</div>
          <div className="panel p-2"><div className="text-lg text-accent">{result.stats.bestCombo}</div>best combo</div>
        </div>
      </GameOverlay>
    </div>
  );
}
