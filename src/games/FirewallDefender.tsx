/**
 * @file FIREWALL DEFENDER
 *
 * A network tower defense game with real security concepts underneath it. Threats enter
 * at the gates on the edge of a network map and route node to node toward your core.
 * Between waves you place defenses on nodes. During waves you click threats yourself,
 * fire abilities, and watch out for the ones that do not play fair.
 *
 * The code is split into layers, so each one stays small and testable:
 * - firewall/rules.ts  Pure data and math: the map, waves, towers, research. Unit tested.
 * - firewall/sim.ts    The world and everything that happens in it each frame.
 * - firewall/draw.ts   The renderer and the canvas HUD.
 * - this file          React: phases, overlays, input, and the Research Lab.
 *
 * The simulation lives in a ref and is mutated in place, so React only re-renders when
 * the phase changes (menu, playing, paused, research, over), never per frame.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "../lib/sound";
import { useHighScore } from "../hooks/useHighScore";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { toLocal, useGameCanvas, useGameLoop, usePauseOnHide } from "./engine";
import { H, PLAY_H, RESEARCH, TOWERS, TOWER_ORDER, ABILITY_ORDER, ABILITIES, W, canResearch, modifiers, researchEarned, sanitizeLab, type Lab, type ResearchId, type TowerKind } from "./firewall/rules";
import { buildableNodeAt, clickAt, launchWave, newWorld, placeTower, quarantineAt, sellTowerAt, step, fireAbility, type Stats, type World } from "./firewall/sim";
import { barHit, drawFrame, paintBackground } from "./firewall/draw";

type Phase = "menu" | "playing" | "paused" | "research" | "over";

interface RunResult {
  score: number;
  wave: number;
  stats: Stats;
  earned: number;
  record: boolean;
}

const BRANCHES = ["Hardening", "Tooling", "Response"] as const;

export default function FirewallDefender() {
  const { canvasRef, ctxRef, paletteRef } = useGameCanvas(W, H);
  const [phase, setPhase] = useState<Phase>("menu");
  const [rawLab, setLab] = useLocalStorage<Lab>("ngt:fd:research", { points: 0, owned: [] });
  const lab = sanitizeLab(rawLab);
  const [result, setResult] = useState<RunResult | null>(null);
  /** Mirrors world.stage so the touch "Launch wave" button can show and hide. Changes only between waves. */
  const [stage, setStage] = useState<World["stage"]>("build");
  const { best, submit } = useHighScore("firewall");

  const world = useRef<World>(newWorld(modifiers(lab.owned)));
  const background = useRef<HTMLCanvasElement | null>(null);
  const clock = useRef(0);

  /** Draws the current world once. Used for the idle screens behind the overlays. */
  const render = useCallback(() => {
    const ctx = ctxRef.current;
    const p = paletteRef.current;
    if (!ctx || !p) return;
    background.current ??= paintBackground(world.current.graph, p);
    drawFrame(ctx, world.current, p, background.current, clock.current);
  }, [ctxRef, paletteRef]);

  // Paint the idle board once the canvas is ready, so the menu sits over the real map.
  useEffect(() => {
    render();
  }, [render, phase]);

  const start = () => {
    world.current = newWorld(modifiers(lab.owned));
    background.current = null;
    setStage("build");
    setResult(null);
    setPhase("playing");
    sfx.click();
  };

  const finish = () => {
    const w = world.current;
    const earned = researchEarned(w.stats.wavesCleared, w.stats.bossesKilled);
    setLab({ points: Math.min(999, lab.points + earned), owned: lab.owned });
    setResult({ score: w.score, wave: w.wave, stats: { ...w.stats }, earned, record: submit(w.score) });
    setPhase("over");
    sfx.lose();
  };

  useGameLoop((dt) => {
    const p = paletteRef.current;
    if (!p) return;
    clock.current += dt;
    const out = step(world.current, dt, p);
    if (world.current.stage !== stage) setStage(world.current.stage);
    render();
    if (out.gameOver) finish();
  }, phase === "playing");

  usePauseOnHide(() => setPhase((ph) => (ph === "playing" ? "paused" : ph)));

  /* ------------------------------- Input ------------------------------- */

  const selectTower = (kind: TowerKind) => {
    const w = world.current;
    w.targeting = w.targeting?.kind === "tower" && w.targeting.tower === kind ? null : { kind: "tower", tower: kind };
    sfx.click();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toLocal(e.currentTarget, e, W, H);
    world.current.mouse = { x: pt.x, y: pt.y, inside: true };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "playing" || e.button === 2) return;
    const w = world.current;
    const p = paletteRef.current!;
    const { x, y } = toLocal(e.currentTarget, e, W, H);
    w.mouse = { x, y, inside: true };

    // 1. The HUD bar along the bottom.
    const hit = barHit(x, y);
    if (hit?.type === "tower") return selectTower(hit.kind);
    if (hit?.type === "ability") return fireAbility(w, hit.kind, p);
    if (y >= PLAY_H) return;

    // 2. Whatever is armed: a tower to place, or the Quarantine target.
    if (w.targeting?.kind === "quarantine") return quarantineAt(w, x, y);
    if (w.targeting?.kind === "tower") {
      const node = buildableNodeAt(w, x, y);
      if (node >= 0) {
        placeTower(w, w.targeting.tower, node);
        return;
      }
    }

    // 3. Otherwise a click is a direct hit on whatever is under the cursor.
    clickAt(w, x, y, p);
  };

  /** Right click cancels whatever is armed, or sells the tower under the cursor. */
  const onContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (phase !== "playing") return;
    const w = world.current;
    if (w.targeting) {
      w.targeting = null;
      return;
    }
    const { x, y } = toLocal(e.currentTarget, e, W, H);
    sellTowerAt(w, x, y, paletteRef.current!);
  };

  // Keyboard: 1 to 4 pick a tower, Q W E R fire abilities, Space launches, P pauses.
  // Escape is left alone because it closes the game window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      if (key === "P") {
        setPhase((ph) => (ph === "playing" ? "paused" : ph === "paused" ? "playing" : ph));
        return;
      }
      if (phase !== "playing") return;
      const w = world.current;
      const tower = TOWER_ORDER.find((k) => TOWERS[k].hotkey === key);
      const ability = ABILITY_ORDER.find((k) => ABILITIES[k].hotkey === key);
      if (tower) selectTower(tower);
      else if (ability) fireAbility(w, ability, paletteRef.current!);
      else if (e.key === " " && w.stage === "build") launchWave(w);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, paletteRef]);

  /* ---------------------------- Research Lab ---------------------------- */

  const buy = (id: ResearchId) => {
    if (!canResearch(id, lab.owned, lab.points)) return;
    const def = RESEARCH.find((r) => r.id === id)!;
    setLab({ points: lab.points - def.cost, owned: [...lab.owned, id] });
    sfx.power();
  };

  const respec = () => {
    const refund = lab.owned.reduce((sum, id) => sum + RESEARCH.find((r) => r.id === id)!.cost, 0);
    setLab({ points: lab.points + refund, owned: [] });
    sfx.zap();
  };

  /* -------------------------------- View -------------------------------- */

  return (
    <div className="relative mx-auto w-full max-w-[960px] overflow-hidden border border-border">
      <canvas
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerLeave={() => (world.current.mouse.inside = false)}
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
        className="block aspect-[8/5] w-full touch-none cursor-crosshair select-none"
        aria-label="Firewall Defender game canvas"
      />

      {phase === "playing" && stage === "build" && (
        <button
          className="chip absolute bottom-[14%] left-1/2 -translate-x-1/2 border-accent-2 bg-bg text-accent-2 sm:hidden"
          onClick={() => launchWave(world.current)}
        >
          Launch wave
        </button>
      )}

      {phase === "menu" && (
        <Screen>
          <p className="label text-bad">Network under attack</p>
          <h3 className="display mt-2 text-4xl text-text sm:text-6xl">Firewall Defender</h3>
          <p className="mx-auto mt-3 max-w-md text-muted">
            Build defenses on the network, then hold the line as real world threats route toward your core. Every threat teaches you something.
          </p>
          <ul className="mx-auto mt-5 grid max-w-lg gap-1 text-left font-mono text-xs text-text/90 sm:grid-cols-2">
            <li><span className="text-accent-2">1-4</span> pick a defense, click a node</li>
            <li><span className="text-accent-2">Q W E R</span> abilities</li>
            <li><span className="text-accent-2">Click</span> red threats directly</li>
            <li><span className="text-accent-2">Space</span> launch the next wave</li>
            <li><span className="text-accent-2">Right click</span> cancel or sell</li>
            <li><span className="text-accent-2">P</span> pause</li>
          </ul>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="btn btn-primary" onClick={start} autoFocus>Start run</button>
            <button className="btn" onClick={() => setPhase("research")}>
              Research Lab <span className="text-accent">{lab.points} RP</span>
            </button>
          </div>
          {best !== null && <p className="mt-4 font-mono text-xs text-muted">Personal best {best.toLocaleString()}</p>}
        </Screen>
      )}

      {phase === "paused" && (
        <Screen>
          <h3 className="display text-5xl text-text">Paused</h3>
          <p className="mt-2 text-muted">Take a breather. The packets will wait.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button className="btn btn-primary" onClick={() => setPhase("playing")} autoFocus>Resume</button>
            <button className="btn" onClick={() => setPhase("menu")}>Quit to menu</button>
          </div>
        </Screen>
      )}

      {phase === "research" && (
        <Screen>
          <p className="label text-accent-2">Permanent upgrades</p>
          <h3 className="display mt-1 text-4xl text-text">Research Lab</h3>
          <p className="mt-2 text-sm text-muted">
            Earn research points every run, one per wave cleared and three per boss. Spend them here. Progress saves in this browser.
          </p>
          <p className="mt-3 font-mono text-2xl text-accent">{lab.points} RP</p>
          <div className="mt-4 grid gap-3 text-left sm:grid-cols-3">
            {BRANCHES.map((branch) => (
              <div key={branch} className="space-y-2">
                <p className="label text-muted">{branch}</p>
                {RESEARCH.filter((r) => r.branch === branch).map((r) => {
                  const owned = lab.owned.includes(r.id);
                  const available = canResearch(r.id, lab.owned, lab.points);
                  const locked = r.requires !== null && !lab.owned.includes(r.requires);
                  return (
                    <button
                      key={r.id}
                      onClick={() => buy(r.id)}
                      disabled={!available}
                      aria-pressed={owned}
                      className={`panel block w-full p-3 text-left transition-colors ${
                        owned ? "border-accent-2" : available ? "panel-hover" : "opacity-50"
                      }`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`font-mono text-sm font-medium ${owned ? "text-accent-2" : "text-text"}`}>{r.name}</span>
                        <span className="font-mono text-xs text-accent">{owned ? "OWNED" : locked ? "LOCKED" : `${r.cost} RP`}</span>
                      </span>
                      <span className="mt-1 block text-xs text-muted">{r.blurb}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-center gap-3">
            <button className="btn btn-primary" onClick={() => setPhase("menu")} autoFocus>Back</button>
            <button className="btn" onClick={respec} disabled={lab.owned.length === 0}>Refund all</button>
          </div>
        </Screen>
      )}

      {phase === "over" && result && (
        <Screen>
          <p className="label text-bad">Core offline</p>
          <h3 className="display mt-1 text-4xl text-text sm:text-5xl">{result.record ? "New record" : "Run complete"}</h3>
          <p className="mt-4 font-mono text-5xl font-medium text-accent">{result.score.toLocaleString()}</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">Score · reached wave {result.wave}</p>
          <div className="mx-auto mt-4 grid max-w-lg grid-cols-3 gap-2 font-mono text-[11px] sm:grid-cols-5">
            <Stat value={result.stats.neutralized} label="neutralized" tone="text-bad" />
            <Stat value={result.stats.served} label="users served" tone="text-good" />
            <Stat value={result.stats.breaches} label="breaches" tone="text-warn" />
            <Stat value={result.stats.bestCombo} label="best combo" tone="text-accent" />
            <Stat value={result.stats.bossesKilled} label="bosses" tone="text-accent-2" />
          </div>
          <p className="mt-4 text-sm text-muted">
            <span className="text-accent-2">+{result.earned} research points.</span> Every run makes the next one stronger. That is how real defenders grow too.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="btn btn-primary" onClick={start} autoFocus>Run it back</button>
            <button className="btn" onClick={() => setPhase("research")}>Research Lab</button>
          </div>
        </Screen>
      )}
    </div>
  );
}

/** Full cover overlay with a scroll fallback for short screens. */
function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-bg/85 p-4 text-center">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="panel p-2">
      <div className={`text-lg ${tone}`}>{value}</div>
      {label}
    </div>
  );
}
