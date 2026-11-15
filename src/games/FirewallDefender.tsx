/**
 * FIREWALL DEFENDER
 * Packets stream toward your server core. Click threats to neutralize them, let legit
 * traffic through, grab patches to repair, and fire an EMP when your charge is full.
 *
 * Architecture: the simulation lives in a mutable ref (`world`) and is advanced by a
 * requestAnimationFrame loop. React state only tracks the game phase, so the 60fps
 * update never triggers a React re-render.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "../lib/sound";
import { useHighScore } from "../hooks/useHighScore";
import {
  burst, drawGrid, drawParticles, drawPopups, readPalette, setupCanvas, toLocal,
  updateParticles, updatePopups, useGameLoop, type Palette, type Particle, type Popup,
} from "./engine";
import { GameOverlay, type Phase } from "./GameOverlay";

const W = 800;
const H = 500;
const CX = W / 2;
const CY = H / 2;
const CORE_R = 34;
const HIT_PADDING = 8; // Generous hitboxes make touch play fair.

type Kind = "legit" | "threat" | "worm" | "patch";

interface Packet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: Kind;
  label: string;
  hp: number;
  age: number;
  w: number;
}

interface Ring {
  r: number;
  life: number;
}

interface World {
  packets: Packet[];
  particles: Particle[];
  popups: Popup[];
  rings: Ring[];
  score: number;
  integrity: number;
  combo: number;
  emp: number;
  time: number;
  spawnTimer: number;
  shake: number;
  over: boolean;
  stats: { neutralized: number; served: number; breaches: number };
}

const LABELS: Record<Kind, string[]> = {
  legit: ["HTTPS", "DNS", "SSH", "SMTP", "NTP", "TLS"],
  threat: ["SQLi", "XSS", "DDoS", "RCE", "MITM", "CSRF", "0day"],
  worm: ["WORM"],
  patch: ["PATCH"],
};

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]!;

function newWorld(): World {
  return {
    packets: [], particles: [], popups: [], rings: [],
    score: 0, integrity: 100, combo: 0, emp: 0, time: 0, spawnTimer: 0.6, shake: 0, over: false,
    stats: { neutralized: 0, served: 0, breaches: 0 },
  };
}

function spawnPacket(w: World) {
  // Pick a random point just outside one of the four edges.
  const side = Math.floor(Math.random() * 4);
  const x = side === 0 ? -30 : side === 1 ? W + 30 : Math.random() * W;
  const y = side === 2 ? -20 : side === 3 ? H + 20 : Math.random() * H;

  const roll = Math.random();
  const kind: Kind = roll < 0.06 ? "patch" : roll < 0.48 ? "legit" : w.time > 25 && roll > 0.86 ? "worm" : "threat";
  const speed = Math.min(55 + w.time * 1.5, 180) * (0.85 + Math.random() * 0.3) * (kind === "worm" ? 0.75 : 1);
  const d = Math.hypot(CX - x, CY - y);
  const label = pick(LABELS[kind]);

  w.packets.push({
    x, y, kind, label,
    vx: ((CX - x) / d) * speed,
    vy: ((CY - y) / d) * speed,
    hp: kind === "worm" ? 3 : 1,
    age: 0,
    w: label.length * 8.4 + 20,
  });
}

const multiplier = (combo: number) => Math.min(1 + Math.floor(combo / 5), 5);

export default function FirewallDefender() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const palette = useRef<Palette | null>(null);
  const world = useRef<World>(newWorld());
  const [phase, setPhase] = useState<Phase>("menu");
  const [result, setResult] = useState({ score: 0, record: false, stats: world.current.stats });
  const { best, submit } = useHighScore("firewall");

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

  const fireEmp = useCallback(() => {
    const w = world.current;
    if (w.emp < 100 || w.over) return;
    w.emp = 0;
    w.rings.push({ r: CORE_R, life: 1 });
    sfx.zap();
    const p = palette.current!;
    // Filter in place: keep everything that is not hostile.
    w.packets = w.packets.filter((pk) => {
      if (pk.kind === "threat" || pk.kind === "worm") {
        w.score += 15;
        w.stats.neutralized++;
        burst(w.particles, pk.x, pk.y, p.accent2, 10);
        return false;
      }
      return true;
    });
    w.popups.push({ x: CX, y: CY - 60, text: "EMP BLAST", life: 1.2, color: p.accent2 });
  }, []);

  // Keyboard: Space fires the EMP, P pauses. Escape is reserved for closing the window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && phase === "playing") {
        e.preventDefault();
        fireEmp();
      } else if (e.key === "p" && phase === "playing") {
        e.preventDefault();
        setPhase("paused");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, fireEmp]);

  // Auto pause when the tab is hidden, so nobody loses a run to a notification.
  useEffect(() => {
    const onVis = () => document.hidden && setPhase((p) => (p === "playing" ? "paused" : p));
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "playing") return;
    const w = world.current;
    const p = palette.current!;
    const { x, y } = toLocal(e.currentTarget, e, W, H);

    // EMP button hit test (bottom center).
    if (Math.abs(x - CX) < 90 && y > H - 40) return fireEmp();

    // Topmost packet under the pointer wins, so iterate from the end. O(n).
    for (let i = w.packets.length - 1; i >= 0; i--) {
      const pk = w.packets[i]!;
      if (Math.abs(x - pk.x) > pk.w / 2 + HIT_PADDING || Math.abs(y - pk.y) > 11 + HIT_PADDING) continue;

      if (pk.kind === "legit") {
        w.score = Math.max(0, w.score - 15);
        w.combo = 0;
        w.integrity -= 4;
        w.popups.push({ x: pk.x, y: pk.y, text: "LEGIT TRAFFIC! -15", life: 1, color: p.warn });
        burst(w.particles, pk.x, pk.y, p.warn, 8);
        sfx.bad();
        w.packets.splice(i, 1);
      } else if (pk.kind === "patch") {
        w.integrity = Math.min(100, w.integrity + 20);
        w.popups.push({ x: pk.x, y: pk.y, text: "+20 INTEGRITY", life: 1, color: p.good });
        burst(w.particles, pk.x, pk.y, p.good, 16);
        sfx.power();
        w.packets.splice(i, 1);
      } else {
        pk.hp--;
        if (pk.hp > 0) {
          burst(w.particles, pk.x, pk.y, p.bad, 5, 90);
          sfx.click();
        } else {
          w.combo++;
          const gained = (pk.kind === "worm" ? 60 : 25) * multiplier(w.combo);
          w.score += gained;
          w.emp = Math.min(100, w.emp + (pk.kind === "worm" ? 20 : 9));
          w.stats.neutralized++;
          w.popups.push({ x: pk.x, y: pk.y, text: `+${gained}`, life: 0.8, color: p.accent });
          burst(w.particles, pk.x, pk.y, p.bad, 16);
          sfx.hit();
          w.packets.splice(i, 1);
        }
      }
      return;
    }
  };

  const update = (dt: number) => {
    const w = world.current;
    const p = palette.current!;
    w.time += dt;
    w.shake = Math.max(0, w.shake - dt * 20);

    // Spawn rate ramps up over time with a floor so it stays humanly possible.
    w.spawnTimer -= dt;
    if (w.spawnTimer <= 0) {
      spawnPacket(w);
      if (w.time > 45 && Math.random() < 0.3) spawnPacket(w);
      w.spawnTimer = Math.max(0.32, 1.25 - w.time * 0.012);
    }

    for (let i = w.packets.length - 1; i >= 0; i--) {
      const pk = w.packets[i]!;
      pk.age += dt;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      if (pk.kind === "worm") {
        // Worms wiggle perpendicular to their heading.
        const sp = Math.hypot(pk.vx, pk.vy);
        const wob = Math.cos(pk.age * 5) * 90 * dt;
        pk.x += (-pk.vy / sp) * wob;
        pk.y += (pk.vx / sp) * wob;
      }

      if (Math.hypot(pk.x - CX, pk.y - CY) < CORE_R + 10) {
        if (pk.kind === "legit") {
          w.score += 10;
          w.stats.served++;
          burst(w.particles, pk.x, pk.y, p.good, 6, 60);
        } else if (pk.kind === "threat" || pk.kind === "worm") {
          const dmg = pk.kind === "worm" ? 25 : 14;
          w.integrity -= dmg;
          w.combo = 0;
          w.shake = 8;
          w.stats.breaches++;
          w.popups.push({ x: CX, y: CY - 50, text: `BREACH -${dmg}%`, life: 1, color: p.bad });
          burst(w.particles, pk.x, pk.y, p.bad, 24, 260);
          sfx.bad();
        }
        w.packets.splice(i, 1);
      }
    }

    for (let i = w.rings.length - 1; i >= 0; i--) {
      const ring = w.rings[i]!;
      ring.r += 900 * dt;
      ring.life -= dt * 1.4;
      if (ring.life <= 0) w.rings.splice(i, 1);
    }
    updateParticles(w.particles, dt);
    updatePopups(w.popups, dt);

    if (w.integrity <= 0 && !w.over) {
      w.over = true;
      w.integrity = 0;
      sfx.lose();
      setResult({ score: w.score, record: submit(w.score), stats: { ...w.stats } });
      setPhase("over");
    }
  };

  const draw = (t: number) => {
    const ctx = ctxRef.current;
    const p = palette.current;
    if (!ctx || !p) return;
    const w = world.current;

    ctx.save();
    if (w.shake > 0) ctx.translate((Math.random() - 0.5) * w.shake, (Math.random() - 0.5) * w.shake);
    ctx.fillStyle = p.bg;
    ctx.fillRect(-10, -10, W + 20, H + 20);
    drawGrid(ctx, W, H, p.border);

    // Rotating firewall perimeter.
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(t * 0.4);
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([10, 14]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Pulsing core, colored by integrity.
    const health = w.integrity / 100;
    const coreColor = health > 0.5 ? p.accent : health > 0.25 ? p.warn : p.bad;
    const pulse = 1 + Math.sin(t * 3) * 0.06;
    ctx.shadowColor = coreColor;
    ctx.shadowBlur = 30;
    ctx.fillStyle = p.surface;
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(CX, CY, CORE_R * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = coreColor;
    ctx.font = "bold 12px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CORE", CX, CY);

    // EMP shockwaves.
    for (const ring of w.rings) {
      ctx.strokeStyle = p.accent2;
      ctx.globalAlpha = Math.max(ring.life, 0);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(CX, CY, ring.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Packets.
    ctx.font = "bold 12px 'JetBrains Mono', monospace";
    for (const pk of w.packets) {
      const color = pk.kind === "legit" ? p.good : pk.kind === "patch" ? p.accent2 : p.bad;
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
      ctx.strokeStyle = color;
      ctx.lineWidth = pk.kind === "worm" ? 1 + pk.hp : 2;
      ctx.beginPath();
      ctx.roundRect(pk.x - pk.w / 2, pk.y - 11, pk.w, 22, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillText(pk.label, pk.x, pk.y + 1);
    }

    drawParticles(ctx, w.particles);
    drawPopups(ctx, w.popups);
    ctx.restore();

    // HUD, drawn without shake.
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.font = "bold 16px 'JetBrains Mono', monospace";
    ctx.fillStyle = p.text;
    ctx.fillText(`SCORE ${w.score.toLocaleString()}`, 16, 28);
    ctx.font = "12px 'JetBrains Mono', monospace";
    ctx.fillStyle = p.muted;
    ctx.fillText(`COMBO x${multiplier(w.combo)}  ·  ${Math.floor(w.time)}s`, 16, 46);

    // Integrity bar.
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
    ctx.fillText(ready ? "⚡ EMP READY [SPACE]" : `EMP ${Math.floor(w.emp)}%`, CX, H - 20);
  };

  // The loop always runs so the menu has a living background, but the world only advances while playing.
  useGameLoop((dt) => {
    if (phase === "playing") update(dt);
    draw(performance.now() / 1000);
  }, true);

  return (
    <div className="relative mx-auto w-full max-w-[800px] overflow-hidden rounded-xl border border-border">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        className="block aspect-[8/5] w-full touch-none cursor-crosshair"
        aria-label="Firewall Defender game canvas"
      />
      <GameOverlay
        phase={phase}
        title="FIREWALL DEFENDER"
        tagline="Hostile packets are inbound. Protect the core."
        controls={[
          "Click / tap RED threats to neutralize them",
          "Let GREEN legit traffic reach the core",
          "Grab PURPLE patches to repair integrity",
          "WORMS take 3 hits. SPACE fires the EMP",
          "P to pause, ESC to exit",
        ]}
        score={result.score}
        best={best}
        isRecord={result.record}
        onStart={start}
        onResume={() => setPhase("playing")}
      >
        <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs">
          <div className="panel p-2"><div className="text-lg text-bad">{result.stats.neutralized}</div>neutralized</div>
          <div className="panel p-2"><div className="text-lg text-good">{result.stats.served}</div>served</div>
          <div className="panel p-2"><div className="text-lg text-warn">{result.stats.breaches}</div>breaches</div>
        </div>
      </GameOverlay>
    </div>
  );
}
