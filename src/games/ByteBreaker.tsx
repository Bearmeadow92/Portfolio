/**
 * @file BYTE BREAKER
 *
 * A brick breaker where every brick is a bug in production. Clear eight hand-built
 * levels with explosive chain reactions, lasers, fireballs, and multi ball.
 *
 * Architecture
 * ------------
 * - Level data and the chain reaction algorithm are pure functions in `byteBreakerLevels.ts`.
 * - The simulation lives in a mutable `World` ref, advanced by requestAnimationFrame.
 *
 * Physics
 * -------
 * - Movement is sub-stepped so a ball never travels more than 80% of its radius per
 *   step, which prevents "tunneling" through thin bricks at high speed.
 * - Circle vs rectangle collision uses the closest point on the rectangle. The bounce
 *   axis is the one with the smaller penetration depth.
 *
 * Complexity
 * ----------
 * - Ball vs bricks: O(1) per step. Bricks sit in a uniform grid, so a ball only tests
 *   the (at most four) cells its bounding box overlaps, never the whole board.
 * - Laser vs bricks: O(1) per bolt, a direct grid lookup.
 * - Level clear check: O(1), a counter of breakable bricks.
 * - Explosions: O(k) for k bricks destroyed (see `detonate`).
 * - Brick rendering: the board is cached on an offscreen canvas and only repainted
 *   when a brick changes, so a typical frame draws it with one drawImage call.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "../lib/sound";
import { useHighScore } from "../hooks/useHighScore";
import {
  ParticlePool, clamp, drawPopups, pick, pixelRatio, readPalette, swapRemove, toLocal,
  updatePopups, useGameCanvas, useGameLoop, usePauseOnHide, type Palette, type Popup,
} from "./engine";
import { GameOverlay, type Phase } from "./GameOverlay";
import { COLS, ROWS, buildGrid, chainMultiplier, detonate, levelName, type Brick, type Grid } from "./byteBreakerLevels";

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

const W = 800;
const H = 500;
const PADDLE_Y = H - 34;
const PADDLE_H = 12;
const PADDLE_W = 110;
const BALL_R = 7;
const GAP = 5;
const MARGIN = 30;
const TOP = 56;
const BRICK_W = (W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
const BRICK_H = 20;
/** Distance between the left (or top) edges of neighboring bricks. */
const CELL_W = BRICK_W + GAP;
const CELL_H = BRICK_H + GAP;
const BOLT_SPEED = 720;

type PowerKind = "wide" | "multi" | "slow" | "life" | "laser" | "fire";

const POWERS: Record<PowerKind, { label: string; text: string }> = {
  wide: { label: "W", text: "WIDE PADDLE" },
  multi: { label: "M", text: "MULTI BALL" },
  slow: { label: "S", text: "SLOW MO" },
  life: { label: "♥", text: "+1 LIFE" },
  laser: { label: "L", text: "LASERS ONLINE" },
  fire: { label: "F", text: "FIREBALL" },
};
/** Drop table. Repeated entries are more common. */
const POWER_DROPS: readonly PowerKind[] = ["wide", "wide", "multi", "multi", "slow", "laser", "laser", "fire", "fire", "life"];

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** True while the ball rides the paddle waiting to be launched. */
  stuck: boolean;
}

interface Power {
  x: number;
  y: number;
  kind: PowerKind;
}

interface Bolt {
  x: number;
  y: number;
}

interface World {
  grid: Grid;
  /** Breakable bricks left. Reaching zero clears the level. */
  remaining: number;
  /** True when the cached brick layer must be repainted. */
  dirty: boolean;
  balls: Ball[];
  powers: Power[];
  bolts: Bolt[];
  particles: ParticlePool;
  popups: Popup[];
  paddleX: number;
  targetX: number;
  paddleW: number;
  /** Seconds remaining on timed power ups. */
  wideTimer: number;
  slowTimer: number;
  laserTimer: number;
  fireTimer: number;
  /** Countdown to the next laser shot. */
  boltCooldown: number;
  /** Bricks destroyed since the ball last touched the paddle. */
  chain: number;
  lives: number;
  level: number;
  score: number;
  shake: number;
  banner: number;
  over: boolean;
}

/* -------------------------------------------------------------------------- */
/*                              World construction                            */
/* -------------------------------------------------------------------------- */

const baseSpeed = (level: number) => Math.min(350 + level * 22, 540);

const stuckBall = (paddleX: number): Ball => ({ x: paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, stuck: true });

function loadLevel(w: World, level: number) {
  const { grid, breakable } = buildGrid(level);
  w.level = level;
  w.grid = grid;
  w.remaining = breakable;
  w.dirty = true;
  w.balls = [stuckBall(w.paddleX)];
  w.powers = [];
  w.bolts = [];
  w.chain = 0;
  w.banner = 2.2;
}

function newWorld(): World {
  const w: World = {
    grid: [], remaining: 0, dirty: true, balls: [], powers: [], bolts: [],
    particles: new ParticlePool(), popups: [],
    paddleX: W / 2, targetX: W / 2, paddleW: PADDLE_W,
    wideTimer: 0, slowTimer: 0, laserTimer: 0, fireTimer: 0, boltCooldown: 0,
    chain: 0, lives: 3, level: 1, score: 0, shake: 0, banner: 0, over: false,
  };
  loadLevel(w, 1);
  return w;
}

/** Center of the brick at a grid index, in canvas coordinates. O(1). */
const brickCenter = (index: number) => ({
  x: MARGIN + (index % COLS) * CELL_W + BRICK_W / 2,
  y: TOP + Math.floor(index / COLS) * CELL_H + BRICK_H / 2,
});

const rowColor = (p: Palette, row: number) => [p.bad, p.warn, p.accent2, p.accent, p.good, p.accent, p.accent2, p.warn][row % 8]!;

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

export default function ByteBreaker() {
  const { canvasRef, ctxRef, paletteRef } = useGameCanvas(W, H);
  const world = useRef<World>(newWorld());
  const keys = useRef({ left: false, right: false });
  /** Offscreen canvas holding the pre-rendered bricks. */
  const brickLayer = useRef<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null>(null);
  const [phase, setPhase] = useState<Phase>("menu");
  const [result, setResult] = useState({ score: 0, record: false, level: 1 });
  const { best, submit } = useHighScore("bytebreaker");

  /* ------------------------------ Game actions ----------------------------- */

  const start = useCallback(() => {
    paletteRef.current = readPalette();
    world.current = newWorld();
    setPhase("playing");
    sfx.power();
  }, [paletteRef]);

  const launch = useCallback(() => {
    const w = world.current;
    const speed = baseSpeed(w.level);
    for (const b of w.balls) {
      if (!b.stuck) continue;
      b.stuck = false;
      // A slightly random angle makes every serve feel different.
      const angle = Math.random() * 0.6 - 0.3 - Math.PI / 2;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
    }
  }, []);

  /** Pays out score and effects for a destroyed brick. */
  const award = (w: World, index: number, brick: Brick, p: Palette, dropChance: number) => {
    const { x, y } = brickCenter(index);
    if (brick.type === "steel") {
      w.particles.burst(x, y, p.muted, 10);
      return;
    }
    w.remaining--;
    w.chain++;
    const gained = 10 * brick.maxHp * w.level * chainMultiplier(w.chain);
    w.score += gained;
    w.popups.push({ x, y, text: `+${gained}`, life: 0.7, color: p.accent });
    w.particles.burst(x, y, brick.type === "explosive" ? p.warn : rowColor(p, brick.row), 12);
    if (Math.random() < dropChance) w.powers.push({ x, y, kind: pick(POWER_DROPS) });
  };

  /**
   * Damages the brick at a grid index and handles destruction, including explosions.
   * @returns True if the brick should deflect whatever hit it.
   */
  const damageBrick = (w: World, index: number, dmg: number, p: Palette) => {
    const brick = w.grid[index];
    if (!brick) return false;
    const { x, y } = brickCenter(index);

    if (brick.type === "steel") {
      w.particles.burst(x, y, p.muted, 4, 70);
      sfx.bounce();
      return true;
    }

    brick.hp -= dmg;
    w.dirty = true;
    if (brick.hp > 0) {
      w.particles.burst(x, y, p.muted, 5, 80);
      sfx.click();
    } else if (brick.type === "explosive") {
      // Resolve the full chain reaction in one pass.
      const blast = detonate(w.grid, index);
      for (const hit of blast) award(w, hit.index, hit.brick, p, 0.05);
      w.shake = Math.min(6 + blast.length, 16);
      sfx.zap();
    } else {
      w.grid[index] = null;
      award(w, index, brick, p, 0.13);
      sfx.hit();
    }
    return true;
  };

  const applyPower = (w: World, kind: PowerKind, p: Palette) => {
    sfx.power();
    w.popups.push({ x: w.paddleX, y: PADDLE_Y - 20, text: POWERS[kind].text, life: 1.2, color: p.accent2 });
    switch (kind) {
      case "wide": w.wideTimer = 10; break;
      case "slow": w.slowTimer = 8; break;
      case "laser": w.laserTimer = 8; break;
      case "fire": w.fireTimer = 6; break;
      case "life": w.lives = Math.min(w.lives + 1, 5); break;
      case "multi": {
        // Clone each active ball into two more at spread angles (capped for sanity).
        const clones: Ball[] = [];
        for (const b of w.balls) {
          if (b.stuck) continue;
          const speed = Math.hypot(b.vx, b.vy);
          const angle = Math.atan2(b.vy, b.vx);
          for (const off of [-0.4, 0.4]) {
            clones.push({ x: b.x, y: b.y, vx: Math.cos(angle + off) * speed, vy: Math.sin(angle + off) * speed, stuck: false });
          }
        }
        w.balls.push(...clones.slice(0, Math.max(0, 12 - w.balls.length)));
      }
    }
  };

  /* --------------------------------- Input --------------------------------- */

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "p" && (phase === "playing" || phase === "paused")) {
        e.preventDefault();
        setPhase(phase === "playing" ? "paused" : "playing");
        return;
      }
      if (phase !== "playing") return;
      if (key === "arrowleft" || key === "a") keys.current.left = true;
      else if (key === "arrowright" || key === "d") keys.current.right = true;
      else if (e.code === "Space") {
        e.preventDefault();
        launch();
      }
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "arrowleft" || key === "a") keys.current.left = false;
      if (key === "arrowright" || key === "d") keys.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, launch]);

  usePauseOnHide(() => setPhase((p) => (p === "playing" ? "paused" : p)));

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    world.current.targetX = toLocal(e.currentTarget, e, W, H).x;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "playing") return;
    onPointerMove(e);
    launch();
  };

  /* -------------------------------- Simulation ----------------------------- */

  /**
   * Moves one ball a small step and resolves collisions.
   * @returns False if the ball fell off the bottom of the screen.
   */
  const stepBall = (w: World, b: Ball, dt: number, p: Palette): boolean => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Walls.
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); sfx.bounce(); }
    else if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); sfx.bounce(); }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); sfx.bounce(); }
    if (b.y > H + 20) return false;

    // Paddle. The bounce angle depends on where the ball lands, which gives the player aim control.
    const half = w.paddleW / 2;
    if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y - BALL_R <= PADDLE_Y + PADDLE_H && Math.abs(b.x - w.paddleX) <= half + BALL_R) {
      const offset = clamp((b.x - w.paddleX) / half, -1, 1);
      const angle = offset * (Math.PI / 3); // Up to 60 degrees from vertical.
      const speed = Math.hypot(b.vx, b.vy);
      b.vx = Math.sin(angle) * speed;
      b.vy = -Math.cos(angle) * speed;
      b.y = PADDLE_Y - BALL_R;
      w.chain = 0;
      sfx.bounce();
      return true;
    }

    // Bricks. Only the grid cells under the ball's bounding box are tested: O(1).
    const c0 = Math.max(0, Math.floor((b.x - BALL_R - MARGIN) / CELL_W));
    const c1 = Math.min(COLS - 1, Math.floor((b.x + BALL_R - MARGIN) / CELL_W));
    const r0 = Math.max(0, Math.floor((b.y - BALL_R - TOP) / CELL_H));
    const r1 = Math.min(ROWS - 1, Math.floor((b.y + BALL_R - TOP) / CELL_H));
    const fireball = w.fireTimer > 0;

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const index = r * COLS + c;
        const brick = w.grid[index];
        if (!brick) continue;
        const bx = MARGIN + c * CELL_W;
        const by = TOP + r * CELL_H;
        // Closest point on the brick to the ball center.
        const dx = b.x - clamp(b.x, bx, bx + BRICK_W);
        const dy = b.y - clamp(b.y, by, by + BRICK_H);
        if (dx * dx + dy * dy > BALL_R * BALL_R) continue;

        // A fireball burns straight through everything except tech debt.
        if (fireball && brick.type !== "steel") {
          damageBrick(w, index, Infinity, p);
          continue;
        }

        // Bounce on the axis with the smaller overlap.
        const overlapX = Math.min(b.x + BALL_R - bx, bx + BRICK_W - (b.x - BALL_R));
        const overlapY = Math.min(b.y + BALL_R - by, by + BRICK_H - (b.y - BALL_R));
        if (overlapX < overlapY) b.vx = b.x < bx + BRICK_W / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
        else b.vy = b.y < by + BRICK_H / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
        damageBrick(w, index, 1, p);
        return true; // One bounce per step keeps the physics stable.
      }
    }
    return true;
  };

  const update = (dt: number) => {
    const w = world.current;
    const p = paletteRef.current!;
    w.banner = Math.max(0, w.banner - dt);
    w.shake = Math.max(0, w.shake - dt * 24);
    w.wideTimer = Math.max(0, w.wideTimer - dt);
    w.slowTimer = Math.max(0, w.slowTimer - dt);
    w.laserTimer = Math.max(0, w.laserTimer - dt);
    w.fireTimer = Math.max(0, w.fireTimer - dt);

    // Paddle: the keyboard nudges the target, then the paddle eases toward it.
    if (keys.current.left) w.targetX -= 640 * dt;
    if (keys.current.right) w.targetX += 640 * dt;
    w.paddleW = w.wideTimer > 0 ? 170 : PADDLE_W;
    w.targetX = clamp(w.targetX, w.paddleW / 2, W - w.paddleW / 2);
    w.paddleX += (w.targetX - w.paddleX) * Math.min(1, dt * 18);

    // Balls, sub-stepped to prevent tunneling.
    const scaled = dt * (w.slowTimer > 0 ? 0.6 : 1);
    for (let i = w.balls.length - 1; i >= 0; i--) {
      const b = w.balls[i]!;
      if (b.stuck) {
        b.x = w.paddleX;
        b.y = PADDLE_Y - BALL_R - 1;
        continue;
      }
      const speed = Math.hypot(b.vx, b.vy);
      const steps = Math.max(1, Math.ceil((speed * scaled) / (BALL_R * 0.8)));
      let alive = true;
      for (let s = 0; s < steps && alive; s++) alive = stepBall(w, b, scaled / steps, p);
      if (!alive) {
        swapRemove(w.balls, i);
        continue;
      }
      // Anti-stall: never let a ball bounce almost horizontally forever.
      const minVy = speed * 0.2;
      if (Math.abs(b.vy) < minVy) {
        b.vy = b.vy < 0 ? -minVy : minVy;
        b.vx = Math.sign(b.vx || 1) * Math.sqrt(speed * speed - minVy * minVy);
      }
    }

    // Lasers: auto fire a pair of bolts from the paddle edges.
    if (w.laserTimer > 0) {
      w.boltCooldown -= dt;
      if (w.boltCooldown <= 0) {
        w.boltCooldown = 0.28;
        w.bolts.push({ x: w.paddleX - w.paddleW / 2 + 6, y: PADDLE_Y }, { x: w.paddleX + w.paddleW / 2 - 6, y: PADDLE_Y });
        sfx.click();
      }
    }
    // Bolts move in steps shorter than a brick, so they cannot skip a row.
    const boltSteps = Math.max(1, Math.ceil((BOLT_SPEED * dt) / 14));
    for (let i = w.bolts.length - 1; i >= 0; i--) {
      const bolt = w.bolts[i]!;
      let spent = false;
      for (let s = 0; s < boltSteps && !spent; s++) {
        bolt.y -= (BOLT_SPEED * dt) / boltSteps;
        const c = Math.floor((bolt.x - MARGIN) / CELL_W);
        const r = Math.floor((bolt.y - TOP) / CELL_H);
        const inBrick = c >= 0 && c < COLS && r >= 0 && r < ROWS && bolt.x - MARGIN - c * CELL_W <= BRICK_W && bolt.y - TOP - r * CELL_H <= BRICK_H;
        spent = bolt.y < 0 || (inBrick && damageBrick(w, r * COLS + c, 1, p));
      }
      if (spent) swapRemove(w.bolts, i);
    }

    // Falling power ups.
    for (let i = w.powers.length - 1; i >= 0; i--) {
      const pw = w.powers[i]!;
      pw.y += 150 * dt;
      if (pw.y > PADDLE_Y - 8 && pw.y < PADDLE_Y + PADDLE_H + 8 && Math.abs(pw.x - w.paddleX) < w.paddleW / 2 + 10) {
        applyPower(w, pw.kind, p);
        swapRemove(w.powers, i);
      } else if (pw.y > H + 20) swapRemove(w.powers, i);
    }

    w.particles.update(dt);
    updatePopups(w.popups, dt);

    if (w.remaining === 0) {
      // Board cleared: next level. O(1) check thanks to the counter.
      w.score += 250 * w.level;
      loadLevel(w, w.level + 1);
      sfx.win();
    } else if (w.balls.length === 0 && !w.over) {
      // Lost every ball: lose a life, or end the game.
      w.lives--;
      w.wideTimer = w.slowTimer = w.laserTimer = w.fireTimer = 0;
      sfx.bad();
      if (w.lives <= 0) {
        w.over = true;
        sfx.lose();
        setResult({ score: w.score, record: submit(w.score), level: w.level });
        setPhase("over");
        return;
      }
      w.balls.push(stuckBall(w.paddleX));
      w.powers = [];
      w.bolts = [];
    }
  };

  /* --------------------------------- Rendering ----------------------------- */

  /** Repaints the cached brick layer. Runs only when a brick changed, not every frame. */
  const paintBricks = (w: World, p: Palette) => {
    if (!brickLayer.current) {
      const canvas = document.createElement("canvas");
      const dpr = pixelRatio();
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      brickLayer.current = { canvas, ctx };
    }
    const ctx = brickLayer.current.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.font = "bold 10px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let index = 0; index < w.grid.length; index++) {
      const brick = w.grid[index];
      if (!brick) continue;
      const x = MARGIN + (index % COLS) * CELL_W;
      const y = TOP + Math.floor(index / COLS) * CELL_H;
      let label = "BUG";
      ctx.globalAlpha = 1;
      if (brick.type === "steel") {
        ctx.fillStyle = p.border;
        label = "DEBT";
      } else if (brick.type === "explosive") {
        ctx.fillStyle = p.warn;
        label = "NULL";
      } else {
        // Damaged bricks fade so their remaining hit points are readable at a glance.
        ctx.globalAlpha = 0.4 + 0.6 * (brick.hp / brick.maxHp);
        ctx.fillStyle = rowColor(p, brick.row);
        if (brick.maxHp > 1) label = `×${brick.hp}`;
      }
      ctx.beginPath();
      ctx.roundRect(x, y, BRICK_W, BRICK_H, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = brick.type === "steel" ? p.muted : p.bg;
      ctx.fillText(label, x + BRICK_W / 2, y + BRICK_H / 2 + 1);
    }
    w.dirty = false;
  };

  const draw = () => {
    const ctx = ctxRef.current;
    const p = paletteRef.current;
    if (!ctx || !p) return;
    const w = world.current;
    if (w.dirty || !brickLayer.current) paintBricks(w, p);

    ctx.save();
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
    if (w.shake > 0) ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake);
    ctx.drawImage(brickLayer.current!.canvas, 0, 0, W, H);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Power ups.
    ctx.font = "bold 12px 'Geist Mono', monospace";
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.accent2;
    for (const pw of w.powers) {
      ctx.fillStyle = p.surface;
      ctx.beginPath();
      ctx.arc(pw.x, pw.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = p.accent2;
      ctx.fillText(POWERS[pw.kind].label, pw.x, pw.y + 1);
    }

    // Laser bolts, batched into one path.
    if (w.bolts.length) {
      ctx.strokeStyle = p.bad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (const bolt of w.bolts) {
        ctx.moveTo(bolt.x, bolt.y);
        ctx.lineTo(bolt.x, bolt.y + 12);
      }
      ctx.stroke();
    }

    // Paddle with glow (red tips while lasers are active).
    ctx.shadowColor = p.accent;
    ctx.shadowBlur = 18;
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.roundRect(w.paddleX - w.paddleW / 2, PADDLE_Y, w.paddleW, PADDLE_H, 6);
    ctx.fill();
    if (w.laserTimer > 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = p.bad;
      ctx.fillRect(w.paddleX - w.paddleW / 2 + 3, PADDLE_Y - 4, 6, 6);
      ctx.fillRect(w.paddleX + w.paddleW / 2 - 9, PADDLE_Y - 4, 6, 6);
    }

    // Balls (orange and glowing while fireball is active).
    const ballColor = w.fireTimer > 0 ? p.warn : p.text;
    ctx.fillStyle = ballColor;
    ctx.shadowColor = ballColor;
    ctx.shadowBlur = w.fireTimer > 0 ? 24 : 12;
    ctx.beginPath();
    for (const b of w.balls) {
      ctx.moveTo(b.x + BALL_R, b.y);
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    w.particles.draw(ctx);
    drawPopups(ctx, w.popups);
    ctx.restore();

    /* HUD, drawn without screen shake. */
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 16px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = p.text;
    ctx.fillText(`SCORE ${w.score.toLocaleString()}`, 16, 30);
    ctx.textAlign = "right";
    ctx.fillStyle = p.bad;
    ctx.fillText("♥".repeat(w.lives), W - 16, 30);
    ctx.textAlign = "center";
    ctx.font = "12px 'Geist Mono', monospace";
    ctx.fillStyle = p.muted;
    const chain = chainMultiplier(w.chain);
    ctx.fillText(`SPRINT ${w.level} · ${levelName(w.level).toUpperCase()}${chain > 1 ? ` · CHAIN x${chain}` : ""}`, W / 2, 28);

    // Active power up timers, bottom left.
    const timers: string[] = [];
    if (w.laserTimer > 0) timers.push(`LASER ${Math.ceil(w.laserTimer)}s`);
    if (w.fireTimer > 0) timers.push(`FIRE ${Math.ceil(w.fireTimer)}s`);
    if (w.wideTimer > 0) timers.push(`WIDE ${Math.ceil(w.wideTimer)}s`);
    if (w.slowTimer > 0) timers.push(`SLOW ${Math.ceil(w.slowTimer)}s`);
    if (timers.length) {
      ctx.textAlign = "left";
      ctx.fillStyle = p.accent2;
      ctx.fillText(timers.join("  "), 16, H - 8);
    }

    if (w.balls.some((b) => b.stuck)) {
      ctx.textAlign = "center";
      ctx.fillStyle = p.muted;
      ctx.fillText("Click, tap, or press SPACE to launch", W / 2, PADDLE_Y - 40);
    }
    if (w.banner > 0) {
      ctx.globalAlpha = Math.min(w.banner, 1);
      ctx.textAlign = "center";
      ctx.font = "bold 30px 'Geist Mono', monospace";
      ctx.fillStyle = p.accent;
      ctx.fillText(`SPRINT ${w.level}: ${levelName(w.level).toUpperCase()}`, W / 2, H / 2 + 70);
      ctx.globalAlpha = 1;
    }
  };

  useGameLoop((dt) => {
    if (phase === "playing") update(dt);
    draw();
  }, true);

  /* ---------------------------------- Markup -------------------------------- */

  return (
    <div className="relative mx-auto w-full max-w-[800px] overflow-hidden border border-border">
      <canvas
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        className="block aspect-[8/5] w-full touch-none cursor-none"
        aria-label="Byte Breaker game canvas"
      />
      <GameOverlay
        phase={phase}
        title="Byte Breaker"
        tagline="Production is on fire. Squash every bug before the sprint ends."
        controls={[
          "Mouse, touch, or ← → / A D to move",
          "Click, tap, or SPACE to launch",
          "NULL bricks explode. DEBT bricks only break in a blast",
          "Power ups: W wide, M multi, S slow, L laser, F fireball, ♥ life",
          "P pauses. ESC exits",
        ]}
        score={result.score}
        best={best}
        isRecord={result.record}
        onStart={start}
        onResume={() => setPhase("playing")}
      >
        <p className="mt-3 font-mono text-sm text-muted">
          Reached sprint {result.level}: {levelName(result.level)}
        </p>
      </GameOverlay>
    </div>
  );
}
