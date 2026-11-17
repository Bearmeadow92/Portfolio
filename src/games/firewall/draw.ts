/**
 * @file Firewall Defender renderer. Draws a World onto a 2D canvas.
 *
 * Visual language matches the Breach backdrop: a fine white network on near black,
 * red for threats, green for legit traffic, blue for your defenses, and gold for credits.
 *
 * Performance:
 * - The background (grid, links, nodes, gates) is painted once to an offscreen layer.
 * - Glow is a cached radial gradient sprite per color and size, blended additively.
 *   This looks like bloom but costs one drawImage, unlike shadowBlur, which is slow.
 * - Text is the most expensive thing canvas draws, so labels are short and sparse.
 */
import { createLayer, drawPopups, type Palette } from "../engine";
import type { Enemy, Tower, World } from "./sim";
import { abilityCooldown, towerCost, visible, buildableNodeAt } from "./sim";
import {
  ABILITIES, ABILITY_ORDER, CORE_R, CX, CY, H, HONEYPOT_CAPACITY, KINDS, PLAY_H, QUARANTINE_RADIUS, TOWERS, TOWER_ORDER, W,
  ZERODAY_EXPOSURE, comboMultiplier, mulberry32, polyVulnerable, type AbilityKind, type Graph, type TowerKind,
} from "./rules";

const MONO = "'Geist Mono', ui-monospace, monospace";
const font = (size: number, weight = 500) => `${weight} ${size}px ${MONO}`;

/* -------------------------------------------------------------------------- */
/*                                   Glow                                     */
/* -------------------------------------------------------------------------- */

const glowCache = new Map<string, HTMLCanvasElement>();

/** A soft radial glow sprite, created once per color and radius, then reused. */
function glowSprite(color: string, radius: number): HTMLCanvasElement {
  const key = `${color}|${radius}`;
  let sprite = glowCache.get(key);
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = sprite.height = radius * 2;
    const ctx = sprite.getContext("2d")!;
    const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, radius * 2, radius * 2);
    glowCache.set(key, sprite);
  }
  return sprite;
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, radius: number, alpha = 1) {
  const r = Math.max(4, Math.round(radius));
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color, r), x - r, y - r);
  ctx.globalAlpha = 1;
}

/* -------------------------------------------------------------------------- */
/*                                 Background                                 */
/* -------------------------------------------------------------------------- */

/** Paints the static network once: dot grid, links, nodes, gates, and ring guides. */
export function paintBackground(graph: Graph, p: Palette): HTMLCanvasElement {
  return createLayer(W, H, (ctx) => {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
    // Faint vignette toward the core.
    const v = ctx.createRadialGradient(CX, CY, 40, CX, CY, 560);
    v.addColorStop(0, "rgba(124,196,255,0.05)");
    v.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, PLAY_H);

    // Dot grid.
    ctx.fillStyle = p.text;
    ctx.globalAlpha = 0.07;
    for (let x = 12; x < W; x += 24) for (let y = 12; y < PLAY_H; y += 24) ctx.fillRect(x, y, 1, 1);
    ctx.globalAlpha = 1;

    // Links.
    ctx.strokeStyle = p.text;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const n of graph.nodes) {
      for (const m of n.links) {
        if (m < n.id) continue;
        const o = graph.nodes[m]!;
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(o.x, o.y);
      }
    }
    ctx.stroke();

    // Nodes and gates.
    ctx.globalAlpha = 1;
    for (const n of graph.nodes) {
      if (n.kind === "node") {
        ctx.fillStyle = p.bg;
        ctx.strokeStyle = p.text;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (n.kind === "gate") {
        // Gates: corner brackets, like a frame around the entry point.
        ctx.strokeStyle = p.bad;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        const s = 9;
        ctx.beginPath();
        for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
          ctx.moveTo(n.x + dx * s, n.y + dy * (s - 4));
          ctx.lineTo(n.x + dx * s, n.y + dy * s);
          ctx.lineTo(n.x + dx * (s - 4), n.y + dy * s);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }
    ctx.globalAlpha = 1;

    // HUD bar background.
    ctx.fillStyle = p.surface;
    ctx.fillRect(0, PLAY_H, W, H - PLAY_H);
    ctx.fillStyle = p.border;
    ctx.fillRect(0, PLAY_H, W, 1);
  });
}

/* -------------------------------------------------------------------------- */
/*                                    Core                                    */
/* -------------------------------------------------------------------------- */

/** Crack lines across the core, generated once. More appear as integrity drops. */
const CRACKS: number[][] = (() => {
  const rng = mulberry32(99);
  return Array.from({ length: 9 }, () => {
    const a = rng() * Math.PI * 2;
    const pts = [Math.cos(a) * 4, Math.sin(a) * 4];
    let x = pts[0]!;
    let y = pts[1]!;
    let dir = a;
    for (let i = 0; i < 4; i++) {
      dir += (rng() - 0.5) * 1.2;
      x += Math.cos(dir) * 7;
      y += Math.sin(dir) * 7;
      pts.push(x, y);
    }
    return pts;
  });
})();

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * Math.PI * 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function drawCore(ctx: CanvasRenderingContext2D, w: World, p: Palette, t: number) {
  const frac = w.integrity / w.mods.maxIntegrity;
  const color = frac > 0.5 ? p.accent2 : frac > 0.25 ? p.warn : p.bad;
  glow(ctx, CX, CY, color, 90, 0.5 + 0.2 * Math.sin(t * 2.5) + w.breachFlash * 0.6);

  // Rotating orbit rings.
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(t * (i ? -0.5 : 0.35));
    ctx.globalAlpha = 0.45;
    ctx.setLineDash(i ? [2, 6] : [12, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, CORE_R + 22 + i * 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Integrity ring: a track and a colored arc for what remains.
  ctx.lineWidth = 3;
  ctx.strokeStyle = p.border;
  ctx.beginPath();
  ctx.arc(CX, CY, CORE_R + 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(CX, CY, CORE_R + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
  ctx.stroke();

  // Core body: two nested hexagons.
  ctx.lineWidth = 2;
  ctx.fillStyle = p.surface;
  hexPath(ctx, CX, CY, CORE_R, t * 0.2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  hexPath(ctx, CX, CY, CORE_R * 0.55, -t * 0.4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Cracks spread as integrity falls.
  const cracks = Math.floor((1 - frac) * CRACKS.length * 1.15);
  ctx.strokeStyle = p.bad;
  ctx.lineWidth = 1.2;
  for (let c = 0; c < Math.min(cracks, CRACKS.length); c++) {
    const pts = CRACKS[c]!;
    ctx.beginPath();
    ctx.moveTo(CX + pts[0]!, CY + pts[1]!);
    for (let k = 2; k < pts.length; k += 2) ctx.lineTo(CX + pts[k]!, CY + pts[k + 1]!);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.font = font(9, 600);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.ceil(w.integrity)}`, CX, CY + 1);
}

/* -------------------------------------------------------------------------- */
/*                                   Towers                                   */
/* -------------------------------------------------------------------------- */

/** The icon for a tower kind, centered at (x, y). Shared by the map and the build bar. */
export function towerIcon(ctx: CanvasRenderingContext2D, kind: TowerKind, x: number, y: number, s: number, color: string, t = 0) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (kind === "firewall") {
    // Shield.
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.85, y - s * 0.6);
    ctx.lineTo(x + s * 0.7, y + s * 0.4);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s * 0.7, y + s * 0.4);
    ctx.lineTo(x - s * 0.85, y - s * 0.6);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y);
    ctx.lineTo(x + s * 0.4, y);
    ctx.stroke();
  } else if (kind === "scanner") {
    // Eye with a sweeping pupil.
    ctx.ellipse(x, y, s, s * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + Math.sin(t * 2) * s * 0.3, y, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "sandbox") {
    // Dashed box with a dot held inside.
    ctx.setLineDash([3, 2]);
    ctx.rect(x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Honeycomb cell.
    hexPath(ctx, x, y, s * 0.9, Math.PI / 6);
    ctx.stroke();
    hexPath(ctx, x, y, s * 0.42, Math.PI / 6);
    ctx.fill();
  }
}

function drawTower(ctx: CanvasRenderingContext2D, tw: Tower, w: World, p: Palette, t: number) {
  const locked = tw.locked > 0;
  const color = locked ? p.bad : w.overclock > 0 ? p.accent : p.accent2;

  // Area effects drawn under the tower.
  if (!locked && tw.kind === "sandbox") {
    ctx.fillStyle = p.accent2;
    ctx.globalAlpha = 0.05;
    ctx.beginPath();
    ctx.arc(tw.x, tw.y, tw.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = p.accent2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  } else if (!locked && tw.kind === "scanner") {
    // A radar sweep: a fading wedge rotating around the tower.
    const a = t * 2.2;
    const g = ctx.createConicGradient ? ctx.createConicGradient(a - 0.9, tw.x, tw.y) : null;
    if (g) {
      g.addColorStop(0, "rgba(124,196,255,0)");
      g.addColorStop(0.14, "rgba(124,196,255,0.16)");
      g.addColorStop(0.15, "rgba(124,196,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tw.x, tw.y, tw.range, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = p.accent2;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(tw.x, tw.y, tw.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (!locked && tw.kind === "honeypot" && tw.capacity > 0) {
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.14;
    ctx.setLineDash([2, 8]);
    ctx.beginPath();
    ctx.arc(tw.x, tw.y, tw.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  glow(ctx, tw.x, tw.y, color, 34, 0.35 + tw.flash * 0.6);
  ctx.fillStyle = p.surface;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(tw.x, tw.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  towerIcon(ctx, tw.kind, tw.x, tw.y, 7, color, t);

  if (tw.kind === "honeypot") {
    // Capacity pips around the rim.
    for (let i = 0; i < HONEYPOT_CAPACITY; i++) {
      const a = -Math.PI / 2 + (i / HONEYPOT_CAPACITY) * Math.PI * 2;
      ctx.fillStyle = i < tw.capacity ? p.accent : p.border;
      ctx.beginPath();
      ctx.arc(tw.x + Math.cos(a) * 19, tw.y + Math.sin(a) * 19, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (locked) {
    // Padlock badge: ransomware encrypted this tower.
    ctx.fillStyle = p.bad;
    ctx.fillRect(tw.x + 6, tw.y - 18, 9, 7);
    ctx.strokeStyle = p.bad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(tw.x + 10.5, tw.y - 18, 3, Math.PI, 0);
    ctx.stroke();
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Enemies                                  */
/* -------------------------------------------------------------------------- */

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, alpha = 0.85) {
  if (!text) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = font(8, 500);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

function polygon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sides: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function bossBar(ctx: CanvasRenderingContext2D, e: Enemy, p: Palette, y: number) {
  ctx.fillStyle = p.border;
  ctx.fillRect(e.x - 30, y, 60, 4);
  ctx.fillStyle = p.bad;
  ctx.fillRect(e.x - 30, y, 60 * Math.max(0, e.hp / e.maxHp), 4);
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, w: World, p: Palette, t: number) {
  const stats = KINDS[e.kind];
  const r = stats.radius;
  const red = p.bad;
  ctx.lineWidth = 1.5;

  switch (e.kind) {
    case "legit":
    case "trojan": {
      const disguised = e.kind === "trojan" && !e.revealed;
      const tell = disguised && (e.age % 1.6) < 0.14; // The red flicker that gives a trojan away.
      const color = e.kind === "legit" || (disguised && !tell) ? p.good : red;
      glow(ctx, e.x, e.y, color, 22, 0.5);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      if (e.kind === "trojan" && e.revealed) ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, e.kind === "trojan" && e.revealed ? "TROJAN" : e.label, e.x, e.y + r + 3, color, 0.7);
      break;
    }
    case "exploit": {
      glow(ctx, e.x, e.y, red, 26, 0.6);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.PI / 4 + Math.sin(e.age * 3) * 0.15);
      ctx.fillStyle = red;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = red;
      ctx.strokeRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
      ctx.restore();
      label(ctx, e.label, e.x, e.y + r + 3, red);
      break;
    }
    case "worm": {
      // Head plus one trailing segment per remaining hit point.
      const segs = Math.ceil(e.hp);
      for (let k = segs - 1; k >= 1; k--) {
        const tx = e.trail[k * 2];
        const ty = e.trail[k * 2 + 1];
        if (tx === undefined || ty === undefined) continue;
        ctx.strokeStyle = red;
        ctx.fillStyle = p.bg;
        ctx.beginPath();
        ctx.arc(tx, ty, r * (1 - k * 0.12), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      glow(ctx, e.x, e.y, red, 24, 0.6);
      ctx.fillStyle = red;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, "WORM", e.x, e.y + r + 3, red);
      break;
    }
    case "ddos":
    case "bot": {
      const a = w.graph.nodes[e.from]!;
      const b = w.graph.nodes[e.to]!;
      const dir = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.fillStyle = red;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(dir);
      ctx.beginPath();
      ctx.moveTo(r + 2, 0);
      ctx.lineTo(-r, -r * 0.8);
      ctx.lineTo(-r, r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case "poly": {
      const vuln = polyVulnerable(e.age);
      const color = vuln ? red : p.muted;
      const sides = 3 + (Math.floor(e.age * 2.5) % 4); // It keeps changing shape.
      if (vuln) glow(ctx, e.x, e.y, red, 28, 0.6);
      polygon(ctx, e.x, e.y, r, sides, e.age * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.stroke();
      if (!vuln) {
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      label(ctx, "POLY", e.x, e.y + r + 4, color);
      break;
    }
    case "botnet": {
      glow(ctx, e.x, e.y, red, 30, 0.6);
      polygon(ctx, e.x, e.y, r, 6, 0);
      ctx.fillStyle = p.bg;
      ctx.fill();
      ctx.strokeStyle = red;
      ctx.stroke();
      ctx.fillStyle = red;
      for (let k = 0; k < 3; k++) {
        const a = e.age * 3 + (k / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(a) * (r + 6), e.y + Math.sin(a) * (r + 6), 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      label(ctx, "C2", e.x, e.y - 4, red, 1);
      break;
    }
    case "ransomware": {
      glow(ctx, e.x, e.y, red, 70, 0.8);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.age * 0.6);
      ctx.strokeStyle = red;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, r + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);
      // Padlock body and shackle.
      ctx.fillStyle = p.bg;
      ctx.strokeStyle = red;
      ctx.lineWidth = 2;
      ctx.fillRect(e.x - 14, e.y - 6, 28, 22);
      ctx.strokeRect(e.x - 14, e.y - 6, 28, 22);
      ctx.beginPath();
      ctx.arc(e.x, e.y - 6, 9, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = red;
      ctx.fillRect(e.x - 2, e.y + 2, 4, 7);
      label(ctx, "RANSOMWARE", e.x, e.y + r + 10, red, 1);
      bossBar(ctx, e, p, e.y - r - 18);
      break;
    }
    case "rootkit": {
      const seen = visible(w, e);
      const alpha = seen ? 1 : w.mods.threatIntel ? 0.22 : 0.07;
      ctx.globalAlpha = alpha;
      if (seen) glow(ctx, e.x, e.y, red, 60, 0.7);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = e.age * 0.8 + (k / 16) * Math.PI * 2;
        const rr = k % 2 ? r * 0.55 : r;
        if (k === 0) ctx.moveTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
        else ctx.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = p.bg;
      ctx.fill();
      ctx.strokeStyle = red;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (seen) {
        label(ctx, "ROOTKIT", e.x, e.y + r + 6, red, 1);
        bossBar(ctx, e, p, e.y - r - 14);
      }
      break;
    }
    case "zeroday": {
      const immune = !e.revealed && e.age <= ZERODAY_EXPOSURE;
      glow(ctx, e.x, e.y, red, 64, 0.75);
      // Glitch: offset color copies jitter around the shape.
      const jitter = Math.sin(t * 40 + e.id) > 0.6 ? 3 : 0;
      for (const [dx, color] of [[-jitter, p.accent2], [jitter, red]] as const) {
        polygon(ctx, e.x + dx, e.y, r, 8, Math.PI / 8);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      polygon(ctx, e.x, e.y, r * 0.6, 8, Math.PI / 8 + e.age);
      ctx.fillStyle = red;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (immune) {
        ctx.strokeStyle = p.text;
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 6);
        ctx.beginPath();
        ctx.arc(e.x, e.y, r + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      label(ctx, immune ? "0-DAY · IMMUNE" : "0-DAY", e.x, e.y + r + 12, red, 1);
      bossBar(ctx, e, p, e.y - r - 18);
      break;
    }
  }

  // Status overlays.
  if (e.marked > 0 && KINDS[e.kind].hostile) {
    const s = r + 6;
    ctx.strokeStyle = p.accent2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      ctx.moveTo(e.x + dx * s, e.y + dy * (s - 4));
      ctx.lineTo(e.x + dx * s, e.y + dy * s);
      ctx.lineTo(e.x + dx * (s - 4), e.y + dy * s);
    }
    ctx.stroke();
  }
  if (e.frozen > 0) {
    ctx.strokeStyle = p.accent2;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (e.hitFlash > 0) {
    ctx.fillStyle = p.text;
    ctx.globalAlpha = e.hitFlash * 5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* -------------------------------------------------------------------------- */
/*                                     HUD                                    */
/* -------------------------------------------------------------------------- */

const BAR_Y = PLAY_H + 8;
const BAR_H = H - PLAY_H - 16;
const TOWER_W = 124;
const GAP = 6;
const ABILITY_W = 96;

/** Hit test for the HUD bar. Shared with the input handler so layout lives in one place. */
export function barHit(x: number, y: number): { type: "tower"; kind: TowerKind } | { type: "ability"; kind: AbilityKind } | null {
  if (y < BAR_Y || y > BAR_Y + BAR_H) return null;
  for (let i = 0; i < TOWER_ORDER.length; i++) {
    const bx = 12 + i * (TOWER_W + GAP);
    if (x >= bx && x <= bx + TOWER_W) return { type: "tower", kind: TOWER_ORDER[i]! };
  }
  for (let i = 0; i < ABILITY_ORDER.length; i++) {
    const bx = W - 12 - (ABILITY_ORDER.length - i) * (ABILITY_W + GAP) + GAP;
    if (x >= bx && x <= bx + ABILITY_W) return { type: "ability", kind: ABILITY_ORDER[i]! };
  }
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawHud(ctx: CanvasRenderingContext2D, w: World, p: Palette, t: number) {
  ctx.textBaseline = "alphabetic";

  // Top left: wave and progress.
  ctx.textAlign = "left";
  ctx.fillStyle = p.text;
  ctx.font = font(15, 600);
  ctx.fillText(w.wave === 0 ? "STANDBY" : `WAVE ${w.wave}${w.cfg.boss && w.stage === "wave" ? " · BOSS" : ""}`, 16, 26);
  ctx.font = font(11);
  ctx.fillStyle = p.muted;
  ctx.fillText(`SCORE ${w.score.toLocaleString()}`, 16, 44);
  if (w.stage === "wave") {
    const remaining = w.toSpawn + w.enemies.filter((e) => KINDS[e.kind].hostile).length;
    const total = w.cfg.count + (w.cfg.boss ? 1 : 0);
    ctx.fillStyle = p.border;
    ctx.fillRect(16, 52, 180, 3);
    ctx.fillStyle = w.cfg.boss ? p.bad : p.accent2;
    ctx.fillRect(16, 52, 180 * Math.min(1, 1 - remaining / Math.max(total, 1)), 3);
  }

  // Top right: credits and combo.
  ctx.textAlign = "right";
  ctx.fillStyle = p.accent;
  ctx.font = font(18, 600);
  ctx.fillText(`₵ ${w.credits}`, W - 16, 28);
  const mult = comboMultiplier(w.combo);
  ctx.font = font(11);
  ctx.fillStyle = mult > 1 ? p.text : p.muted;
  ctx.fillText(`COMBO x${mult}`, W - 16, 46);
  ctx.fillStyle = p.border;
  ctx.fillRect(W - 96, 52, 80, 3);
  ctx.fillStyle = p.accent;
  ctx.fillRect(W - 96, 52, 80 * ((w.combo % 8) / 8) * (mult < 5 ? 1 : 0) + (mult >= 5 ? 80 : 0), 3);

  // Threat radar.
  const rx = W - 58;
  const ry = 112;
  const rr = 40;
  ctx.fillStyle = p.surface;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(rx, ry, rr, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = p.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(rx, ry, rr * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = p.accent2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(rx, ry);
  ctx.lineTo(rx + Math.cos(t * 2) * rr, ry + Math.sin(t * 2) * rr);
  ctx.stroke();
  ctx.globalAlpha = 1;
  for (const e of w.enemies) {
    if (!KINDS[e.kind].hostile || (e.kind === "rootkit" && !visible(w, e))) continue;
    const dx = (e.x - CX) / (W / 2);
    const dy = (e.y - CY) / (PLAY_H / 2);
    const d = Math.min(1, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    ctx.fillStyle = p.bad;
    const s = KINDS[e.kind].boss ? 4 : 2;
    ctx.fillRect(rx + Math.cos(a) * d * rr - s / 2, ry + Math.sin(a) * d * rr - s / 2, s, s);
  }
  ctx.font = font(8);
  ctx.textAlign = "center";
  ctx.fillStyle = p.muted;
  ctx.fillText("RADAR", rx, ry + rr + 12);

  // Threat intel toast.
  const toast = w.toasts[0];
  if (toast) {
    const fade = Math.min(1, toast.life * 2, (6 - toast.life) * 4);
    ctx.globalAlpha = fade;
    ctx.font = font(11);
    const lines = wrap(ctx, toast.body, 400);
    const boxH = 34 + lines.length * 15;
    const bx = CX - 220;
    ctx.fillStyle = p.surface;
    ctx.fillRect(bx, 16, 440, boxH);
    const tone = toast.title === "Legit traffic" ? p.good : p.bad;
    ctx.fillStyle = tone;
    ctx.fillRect(bx, 16, 3, boxH);
    ctx.textAlign = "left";
    ctx.font = font(9, 600);
    ctx.fillStyle = tone;
    ctx.fillText(tone === p.good ? "FIELD NOTE" : "THREAT INTEL", bx + 16, 32);
    ctx.font = font(13, 600);
    ctx.fillStyle = p.text;
    ctx.fillText(toast.title, bx + 110, 32);
    ctx.font = font(11);
    ctx.fillStyle = p.muted;
    lines.forEach((ln, i) => ctx.fillText(ln, bx + 16, 52 + i * 15));
    ctx.globalAlpha = 1;
  }

  // Build stage call to action.
  if (w.stage === "build" && !w.over) {
    ctx.textAlign = "center";
    ctx.font = font(11, 600);
    ctx.fillStyle = p.text;
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3);
    ctx.fillText(`BUILD PHASE · PLACE DEFENSES ON NODES · SPACE TO LAUNCH WAVE ${w.wave + 1}`, CX, PLAY_H - 18);
    ctx.globalAlpha = 1;
  }

  // Bottom bar: towers.
  TOWER_ORDER.forEach((kind, i) => {
    const bx = 12 + i * (TOWER_W + GAP);
    const cost = towerCost(w, kind);
    const affordable = w.credits >= cost;
    const selected = w.targeting?.kind === "tower" && w.targeting.tower === kind;
    ctx.fillStyle = selected ? p.surface2 : p.bg;
    roundRect(ctx, bx, BAR_Y, TOWER_W, BAR_H);
    ctx.fill();
    ctx.strokeStyle = selected ? p.accent2 : p.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = affordable ? 1 : 0.4;
    towerIcon(ctx, kind, bx + 22, BAR_Y + BAR_H / 2, 8, p.accent2, t);
    ctx.textAlign = "left";
    ctx.font = font(11, 600);
    ctx.fillStyle = p.text;
    ctx.fillText(TOWERS[kind].name, bx + 42, BAR_Y + 21);
    ctx.font = font(10);
    ctx.fillStyle = p.accent;
    ctx.fillText(`₵${cost}`, bx + 42, BAR_Y + 37);
    ctx.fillStyle = p.muted;
    ctx.textAlign = "right";
    ctx.fillText(TOWERS[kind].hotkey, bx + TOWER_W - 8, BAR_Y + 16);
    ctx.globalAlpha = 1;
  });

  // Bottom bar: abilities, with a cooldown sweep.
  ABILITY_ORDER.forEach((kind, i) => {
    const bx = W - 12 - (ABILITY_ORDER.length - i) * (ABILITY_W + GAP) + GAP;
    const left = w.cooldowns[kind];
    const ready = left <= 0;
    const armed = kind === "quarantine" && w.targeting?.kind === "quarantine";
    ctx.fillStyle = p.bg;
    roundRect(ctx, bx, BAR_Y, ABILITY_W, BAR_H);
    ctx.fill();
    if (!ready) {
      const frac = left / abilityCooldown(w, kind);
      ctx.fillStyle = p.surface2;
      ctx.fillRect(bx, BAR_Y + BAR_H * (1 - frac), ABILITY_W, BAR_H * frac);
    } else {
      glow(ctx, bx + ABILITY_W / 2, BAR_Y + BAR_H / 2, p.accent2, 40, 0.25 + 0.15 * Math.sin(t * 4 + i));
    }
    ctx.strokeStyle = armed ? p.accent : ready ? p.accent2 : p.border;
    ctx.lineWidth = armed ? 2 : 1;
    roundRect(ctx, bx, BAR_Y, ABILITY_W, BAR_H);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = font(11, 600);
    ctx.fillStyle = ready ? p.text : p.muted;
    ctx.fillText(ABILITIES[kind].name, bx + ABILITY_W / 2, BAR_Y + 23);
    ctx.font = font(10);
    ctx.fillStyle = ready ? p.accent2 : p.muted;
    ctx.fillText(ready ? `[${ABILITIES[kind].hotkey}]` : `${Math.ceil(left)}s`, bx + ABILITY_W / 2, BAR_Y + 39);
  });

  // Tooltip for whatever bar button is hovered.
  const hover = w.mouse.inside ? barHit(w.mouse.x, w.mouse.y) : null;
  if (hover) {
    const text = hover.type === "tower" ? `${TOWERS[hover.kind].name}: ${TOWERS[hover.kind].blurb}` : `${ABILITIES[hover.kind].name}: ${ABILITIES[hover.kind].blurb}`;
    ctx.font = font(11);
    const width = ctx.measureText(text).width + 20;
    const x = Math.min(Math.max(w.mouse.x - width / 2, 8), W - width - 8);
    ctx.fillStyle = p.surface;
    ctx.fillRect(x, PLAY_H - 34, width, 24);
    ctx.strokeStyle = p.border;
    ctx.strokeRect(x, PLAY_H - 34, width, 24);
    ctx.fillStyle = p.text;
    ctx.textAlign = "left";
    ctx.fillText(text, x + 10, PLAY_H - 18);
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Full frame                                 */
/* -------------------------------------------------------------------------- */

/** Draws one complete frame of the game. */
export function drawFrame(ctx: CanvasRenderingContext2D, w: World, p: Palette, background: HTMLCanvasElement, t: number) {
  ctx.save();
  if (w.shake > 0) ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake);
  ctx.drawImage(background, 0, 0, W, H);

  // Placement preview: highlight buildable nodes, and show range at the hovered one.
  if (w.targeting?.kind === "tower") {
    const kind = w.targeting.tower;
    const range = TOWERS[kind].range * w.mods.towerRangeMul;
    for (const n of w.graph.nodes) {
      if (n.kind !== "node" || w.towers.some((tw) => tw.node === n.id)) continue;
      ctx.strokeStyle = p.accent2;
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 4 + n.id);
      ctx.beginPath();
      ctx.arc(n.x, n.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const node = w.mouse.inside ? buildableNodeAt(w, w.mouse.x, w.mouse.y) : -1;
    if (node >= 0) {
      const n = w.graph.nodes[node]!;
      const ok = w.credits >= towerCost(w, kind);
      const color = ok ? p.accent2 : p.bad;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.07;
      ctx.beginPath();
      ctx.arc(n.x, n.y, range, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.8;
      towerIcon(ctx, kind, n.x, n.y, 7, color, t);
      ctx.globalAlpha = 1;
    }
  }

  for (const tw of w.towers) drawTower(ctx, tw, w, p, t);
  drawCore(ctx, w, p, t);
  for (const e of w.enemies) drawEnemy(ctx, e, w, p, t);

  // Beams (tower shots and ransomware encryption).
  for (const b of w.beams) {
    const color = b.color === "defense" ? (w.overclock > 0 ? p.accent : p.accent2) : p.bad;
    ctx.strokeStyle = color;
    ctx.globalAlpha = Math.min(1, b.life * 6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.stroke();
    glow(ctx, b.x2, b.y2, color, 18, Math.min(1, b.life * 6));
  }
  ctx.globalAlpha = 1;

  for (const r of w.rings) {
    ctx.strokeStyle = r.color === "defense" ? p.accent2 : r.color === "good" ? p.good : p.bad;
    ctx.globalAlpha = Math.max(0, r.life);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;

  w.particles.draw(ctx);
  drawPopups(ctx, w.popups);

  // Cursor aids: Quarantine target, and a flashlight while a rootkit is hiding.
  if (w.mouse.inside && w.mouse.y < PLAY_H) {
    if (w.targeting?.kind === "quarantine") {
      ctx.strokeStyle = p.accent2;
      ctx.fillStyle = p.accent2;
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.arc(w.mouse.x, w.mouse.y, QUARANTINE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    } else if (w.enemies.some((e) => e.kind === "rootkit" && !e.revealed)) {
      ctx.strokeStyle = p.text;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(w.mouse.x, w.mouse.y, 75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  // Red pulse at the edges of the play field after a breach.
  if (w.breachFlash > 0) {
    const g = ctx.createRadialGradient(CX, CY, PLAY_H * 0.35, CX, CY, W * 0.62);
    g.addColorStop(0, "rgba(255,92,77,0)");
    g.addColorStop(1, `rgba(255,92,77,${0.35 * w.breachFlash})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, PLAY_H);
  }
  // Overclock tint.
  if (w.overclock > 0) {
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, PLAY_H - 2);
    ctx.globalAlpha = 1;
  }

  drawHud(ctx, w, p, t);
}
