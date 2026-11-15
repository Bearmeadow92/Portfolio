/**
 * BYTE BREAKER
 * A brick breaker where every brick is a bug in production. Ship the fix, clear the board.
 *
 * Physics notes:
 *  - Movement is sub-stepped so a fast ball never travels more than its radius per step,
 *    which prevents "tunneling" through thin bricks.
 *  - Circle vs rectangle collision uses the closest point on the rectangle, and the
 *    bounce axis is chosen by the smaller penetration depth.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "../lib/sound";
import { useHighScore } from "../hooks/useHighScore";
import {
  burst, clamp, drawParticles, drawPopups, readPalette, setupCanvas, toLocal,
  updateParticles, updatePopups, useGameLoop, type Palette, type Particle, type Popup,
} from "./engine";
import { GameOverlay, type Phase } from "./GameOverlay";

const W = 800;
const H = 500;
const PADDLE_Y = H - 34;
const PADDLE_H = 12;
const BALL_R = 7;
const COLS = 10;
const GAP = 6;
const MARGIN = 30;
const BRICK_W = (W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
const BRICK_H = 22;
const TOP = 70;

type PowerKind = "wide" | "multi" | "slow" | "life";
const POWER_LABEL: Record<PowerKind, string> = { wide: "W", multi: "M", slow: "S", life: "+" };

interface Brick { x: number; y: number; hp: number; maxHp: number; row: number }
interface Ball { x: number; y: number; vx: number; vy: number; stuck: boolean }
interface Power { x: number; y: number; kind: PowerKind }

interface World {
  bricks: Brick[];
  balls: Ball[];
  powers: Power[];
  particles: Particle[];
  popups: Popup[];
  paddleX: number;
  targetX: number;
  paddleW: number;
  wideTimer: number;
  slowTimer: number;
  lives: number;
  level: number;
  score: number;
  over: boolean;
  banner: number;
}

/** Each level is a pattern function deciding whether a cell has a brick and its hit points. */
const LAYOUTS: ((r: number, c: number, level: number) => number)[] = [
  (r) => (r < 5 ? 1 : 0),
  (r, c) => (Math.abs(c - 4.5) < r + 1 ? (r < 2 ? 2 : 1) : 0),
  (r, c) => ((r + c) % 2 === 0 ? (r === 0 ? 2 : 1) : 0),
  (r, c) => (Math.abs(c - 4.5) + Math.abs(r - 2.5) < 5 ? (r === 2 || r === 3 ? 2 : 1) : 0),
  (r, c, level) => (c === 0 || c === COLS - 1 || r === 0 ? 2 + Math.floor(level / 5) : r < 6 ? 1 : 0),
];

function buildLevel(level: number): Brick[] {
  const layout = LAYOUTS[(level - 1) % LAYOUTS.length]!;
  const bonusHp = Math.floor((level - 1) / LAYOUTS.length); // Later cycles get tougher.
  const bricks: Brick[] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < COLS; c++) {
      const hp = layout(r, c, level);
      if (hp > 0) {
        const total = hp + bonusHp;
        bricks.push({ x: MARGIN + c * (BRICK_W + GAP), y: TOP + r * (BRICK_H + GAP), hp: total, maxHp: total, row: r });
      }
    }
  }
  return bricks;
}

const baseSpeed = (level: number) => Math.min(360 + level * 25, 560);

function newBall(w: World): Ball {
  return { x: w.paddleX, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, stuck: true };
}

function newWorld(): World {
  const w: World = {
    bricks: buildLevel(1), balls: [], powers: [], particles: [], popups: [],
    paddleX: W / 2, targetX: W / 2, paddleW: 110, wideTimer: 0, slowTimer: 0,
    lives: 3, level: 1, score: 0, over: false, banner: 2,
  };
  w.balls.push(newBall(w));
  return w;
}

export default function ByteBreaker() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const palette = useRef<Palette | null>(null);
  const world = useRef<World>(newWorld());
  const keys = useRef({ left: false, right: false });
  const [phase, setPhase] = useState<Phase>("menu");
  const [result, setResult] = useState({ score: 0, record: false, level: 1 });
  const { best, submit } = useHighScore("bytebreaker");

  useEffect(() => {
    if (!canvasRef.current) return;
    ctxRef.current = setupCanvas(canvasRef.current, W, H);
    palette.current = readPalette();
  }, []);

  const start = useCallback(() => {
    world.current = newWorld();
    palette.current = readPalette();
    setPhase("playing");
    sfx.power();
  }, []);

  const launch = useCallback(() => {
    const w = world.current;
    const speed = baseSpeed(w.level);
    for (const b of w.balls) {
      if (!b.stuck) continue;
      b.stuck = false;
      // Launch at a slight random angle so every serve feels different.
      const angle = (Math.random() * 0.6 - 0.3) - Math.PI / 2;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
    }
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (phase !== "playing") return;
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = true;
      else if (e.key === "ArrowRight" || e.key === "d") keys.current.right = true;
      else if (e.code === "Space") {
        e.preventDefault();
        launch();
      } else if (e.key === "p") {
        e.preventDefault();
        setPhase("paused");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") keys.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keys.current.right = false;
    };
    const onVis = () => document.hidden && setPhase((p) => (p === "playing" ? "paused" : p));
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [phase, launch]);

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    world.current.targetX = toLocal(e.currentTarget, e, W, H).x;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "playing") return;
    onPointerMove(e);
    launch();
  };

  const applyPower = (w: World, kind: PowerKind, p: Palette) => {
    sfx.power();
    const text = { wide: "WIDE PADDLE", multi: "MULTI BALL", slow: "SLOW MO", life: "+1 LIFE" }[kind];
    w.popups.push({ x: w.paddleX, y: PADDLE_Y - 20, text, life: 1.2, color: p.accent2 });
    if (kind === "wide") w.wideTimer = 10;
    else if (kind === "slow") w.slowTimer = 8;
    else if (kind === "life") w.lives = Math.min(w.lives + 1, 5);
    else {
      // Clone each active ball into two more at spread angles.
      const clones: Ball[] = [];
      for (const b of w.balls) {
        if (b.stuck) continue;
        const sp = Math.hypot(b.vx, b.vy);
        const a = Math.atan2(b.vy, b.vx);
        for (const off of [-0.4, 0.4]) clones.push({ x: b.x, y: b.y, vx: Math.cos(a + off) * sp, vy: Math.sin(a + off) * sp, stuck: false });
      }
      w.balls.push(...clones.slice(0, 8));
    }
  };

  /** Moves one ball a small step and resolves collisions. Returns false if the ball is lost. */
  const stepBall = (w: World, b: Ball, dt: number, p: Palette): boolean => {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Walls.
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); sfx.bounce(); }
    if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); sfx.bounce(); }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); sfx.bounce(); }
    if (b.y > H + 20) return false;

    // Paddle: the bounce angle depends on where the ball hits, giving the player aim control.
    const half = w.paddleW / 2;
    if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y - BALL_R <= PADDLE_Y + PADDLE_H && Math.abs(b.x - w.paddleX) <= half + BALL_R) {
      const offset = clamp((b.x - w.paddleX) / half, -1, 1);
      const angle = offset * (Math.PI / 3); // Up to 60 degrees from vertical.
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.sin(angle) * sp;
      b.vy = -Math.cos(angle) * sp;
      b.y = PADDLE_Y - BALL_R;
      sfx.bounce();
    }

    // Bricks. Only the first hit per step is resolved, which keeps bounces stable.
    for (let i = 0; i < w.bricks.length; i++) {
      const br = w.bricks[i]!;
      const nx = clamp(b.x, br.x, br.x + BRICK_W);
      const ny = clamp(b.y, br.y, br.y + BRICK_H);
      const dx = b.x - nx;
      const dy = b.y - ny;
      if (dx * dx + dy * dy > BALL_R * BALL_R) continue;

      const overlapX = Math.min(b.x + BALL_R - br.x, br.x + BRICK_W - (b.x - BALL_R));
      const overlapY = Math.min(b.y + BALL_R - br.y, br.y + BRICK_H - (b.y - BALL_R));
      if (overlapX < overlapY) b.vx = b.x < br.x + BRICK_W / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
      else b.vy = b.y < br.y + BRICK_H / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);

      br.hp--;
      const cx = br.x + BRICK_W / 2;
      const cy = br.y + BRICK_H / 2;
      if (br.hp <= 0) {
        const gained = 10 * br.maxHp * w.level;
        w.score += gained;
        w.popups.push({ x: cx, y: cy, text: `+${gained}`, life: 0.7, color: p.accent });
        burst(w.particles, cx, cy, rowColor(p, br.row), 12);
        w.bricks.splice(i, 1);
        sfx.hit();
        if (Math.random() < 0.13) {
          const kinds: PowerKind[] = ["wide", "multi", "slow", "wide", "multi", "life"];
          w.powers.push({ x: cx, y: cy, kind: kinds[Math.floor(Math.random() * kinds.length)]! });
        }
      } else {
        burst(w.particles, cx, cy, p.muted, 5, 80);
        sfx.click();
      }
      break;
    }
    return true;
  };

  const update = (dt: number) => {
    const w = world.current;
    const p = palette.current!;
    w.banner = Math.max(0, w.banner - dt);

    // Paddle: keyboard nudges the target, then the paddle eases toward it.
    if (keys.current.left) w.targetX -= 620 * dt;
    if (keys.current.right) w.targetX += 620 * dt;
    w.wideTimer = Math.max(0, w.wideTimer - dt);
    w.slowTimer = Math.max(0, w.slowTimer - dt);
    w.paddleW = w.wideTimer > 0 ? 170 : 110;
    w.targetX = clamp(w.targetX, w.paddleW / 2, W - w.paddleW / 2);
    w.paddleX += (w.targetX - w.paddleX) * Math.min(1, dt * 18);

    const timeScale = w.slowTimer > 0 ? 0.6 : 1;
    for (let i = w.balls.length - 1; i >= 0; i--) {
      const b = w.balls[i]!;
      if (b.stuck) {
        b.x = w.paddleX;
        b.y = PADDLE_Y - BALL_R - 1;
        continue;
      }
      const dist = Math.hypot(b.vx, b.vy) * dt * timeScale;
      const steps = Math.max(1, Math.ceil(dist / (BALL_R * 0.8)));
      let alive = true;
      for (let s = 0; s < steps && alive; s++) alive = stepBall(w, b, (dt * timeScale) / steps, p);
      if (!alive) w.balls.splice(i, 1);
    }

    // Falling power ups.
    for (let i = w.powers.length - 1; i >= 0; i--) {
      const pw = w.powers[i]!;
      pw.y += 150 * dt;
      if (pw.y > PADDLE_Y - 8 && pw.y < PADDLE_Y + PADDLE_H + 8 && Math.abs(pw.x - w.paddleX) < w.paddleW / 2 + 10) {
        applyPower(w, pw.kind, p);
        w.powers.splice(i, 1);
      } else if (pw.y > H + 20) w.powers.splice(i, 1);
    }

    // Lost every ball: lose a life or end the game.
    if (w.balls.length === 0 && !w.over) {
      w.lives--;
      sfx.bad();
      if (w.lives <= 0) {
        w.over = true;
        sfx.lose();
        setResult({ score: w.score, record: submit(w.score), level: w.level });
        setPhase("over");
        return;
      }
      w.balls.push(newBall(w));
      w.powers = [];
    }

    // Board cleared: next level.
    if (w.bricks.length === 0) {
      w.level++;
      w.score += 250 * w.level;
      w.bricks = buildLevel(w.level);
      w.balls = [newBall(w)];
      w.powers = [];
      w.banner = 2;
      sfx.win();
    }

    updateParticles(w.particles, dt);
    updatePopups(w.popups, dt);
  };

  const draw = () => {
    const ctx = ctxRef.current;
    const p = palette.current;
    if (!ctx || !p) return;
    const w = world.current;

    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);

    // Bricks, dimmer when damaged.
    ctx.font = "bold 10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const br of w.bricks) {
      const color = rowColor(p, br.row);
      ctx.globalAlpha = 0.35 + 0.65 * (br.hp / br.maxHp);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(br.x, br.y, BRICK_W, BRICK_H, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.bg;
      ctx.fillText(br.maxHp > 1 ? `BUG×${br.hp}` : "BUG", br.x + BRICK_W / 2, br.y + BRICK_H / 2 + 1);
    }

    // Power ups.
    for (const pw of w.powers) {
      ctx.fillStyle = p.surface;
      ctx.strokeStyle = p.accent2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pw.x, pw.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = p.accent2;
      ctx.font = "bold 12px 'JetBrains Mono', monospace";
      ctx.fillText(POWER_LABEL[pw.kind], pw.x, pw.y + 1);
    }

    // Paddle with glow.
    ctx.shadowColor = p.accent;
    ctx.shadowBlur = 18;
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.roundRect(w.paddleX - w.paddleW / 2, PADDLE_Y, w.paddleW, PADDLE_H, 6);
    ctx.fill();

    // Balls.
    ctx.fillStyle = p.text;
    ctx.shadowColor = p.text;
    for (const b of w.balls) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    drawParticles(ctx, w.particles);
    drawPopups(ctx, w.popups);

    // HUD.
    ctx.textBaseline = "alphabetic";
    ctx.font = "bold 16px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = p.text;
    ctx.fillText(`SCORE ${w.score.toLocaleString()}`, 16, 30);
    ctx.textAlign = "center";
    ctx.fillStyle = p.muted;
    ctx.fillText(`SPRINT ${w.level}`, W / 2, 30);
    ctx.textAlign = "right";
    ctx.fillStyle = p.bad;
    ctx.fillText("♥".repeat(w.lives), W - 16, 30);

    if (w.balls.some((b) => b.stuck)) {
      ctx.textAlign = "center";
      ctx.font = "13px 'JetBrains Mono', monospace";
      ctx.fillStyle = p.muted;
      ctx.fillText("Click, tap, or press SPACE to launch", W / 2, PADDLE_Y - 40);
    }
    if (w.banner > 0) {
      ctx.globalAlpha = Math.min(w.banner, 1);
      ctx.textAlign = "center";
      ctx.font = "bold 34px 'JetBrains Mono', monospace";
      ctx.fillStyle = p.accent;
      ctx.fillText(`SPRINT ${w.level}`, W / 2, H / 2 + 40);
      ctx.globalAlpha = 1;
    }
  };

  useGameLoop((dt) => {
    if (phase === "playing") update(dt);
    draw();
  }, true);

  return (
    <div className="relative mx-auto w-full max-w-[800px] overflow-hidden rounded-xl border border-border">
      <canvas
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        className="block aspect-[8/5] w-full touch-none cursor-none"
        aria-label="Byte Breaker game canvas"
      />
      <GameOverlay
        phase={phase}
        title="BYTE BREAKER"
        tagline="Production is on fire. Squash every bug before the sprint ends."
        controls={[
          "Mouse, touch, or ← → / A D to move",
          "Click, tap, or SPACE to launch",
          "Catch power ups: W wide, M multi ball, S slow, + life",
          "P to pause, ESC to exit",
        ]}
        score={result.score}
        best={best}
        isRecord={result.record}
        onStart={start}
        onResume={() => setPhase("playing")}
      >
        <p className="mt-3 font-mono text-sm text-muted">Reached sprint {result.level}</p>
      </GameOverlay>
    </div>
  );
}

function rowColor(p: Palette, row: number) {
  return [p.bad, p.warn, p.accent2, p.accent, p.good, p.accent][row % 6]!;
}
