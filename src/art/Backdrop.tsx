/**
 * @file The generative backdrop: a full-page WebGL2 canvas behind the whole site.
 *
 * How it stays fast
 * -----------------
 * - All per-pixel work happens in a fragment shader on the GPU. Per frame, the CPU
 *   uploads eight uniforms and issues one draw call. No allocations in the loop.
 * - Shader programs are compiled lazily, the first time a scene is shown, then cached.
 * - Adaptive resolution: if frames run slow, the canvas renders at a lower internal
 *   resolution and is scaled up by the browser, trading a little sharpness for speed.
 * - The loop stops while the tab is hidden, and while a game or tool window is open,
 *   so the GPU is free for whatever the visitor is actually using.
 * - With "prefers-reduced-motion", nothing animates. A single still frame is drawn
 *   when the scene, the window size, or the scroll position changes.
 *
 * Telemetry: a few times per second the engine writes the pointer position and the
 * measured frame rate into any element with `data-telemetry`, as plain text. It is a
 * direct DOM write, so the readout costs no React renders.
 *
 * Everything animated lives in refs and plain variables, so React renders this
 * component exactly once.
 */
import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useActiveItem } from "../lib/launcher";
import { getScene, useScene, type SceneId } from "../lib/scene";
import { FRAGMENT_SHADERS, VERTEX_SHADER } from "./shaders";

/** Internal resolution multipliers, from sharpest to cheapest. */
const QUALITY_STEPS = [1, 0.75, 0.6] as const;
/** Average frame time (ms) above which quality drops one step. */
const SLOW_FRAME_MS = 26;
const MAX_PIXEL_RATIO = 1.5;
/** Seconds without pointer movement before the focal point starts drifting on its own. */
const IDLE_AFTER = 3;

type Vec3 = [number, number, number];

interface Program {
  program: WebGLProgram;
  uniforms: Record<"u_res" | "u_time" | "u_mouse" | "u_dim" | "u_pulse" | "u_clear" | "u_bg" | "u_ink" | "u_accent", WebGLUniformLocation | null>;
}

/** Strength of the next pulse. UI code bumps this, and the render loop decays it. */
let pendingPulse = 0;

/** Sends a short ripple through the backdrop. Call it from clicks and other key moments. */
export function pulse(strength = 1) {
  pendingPulse = Math.max(pendingPulse, strength);
}

/** Parses "#rrggbb" into three 0..1 channels for a shader uniform. */
function hexToVec3(hex: string): Vec3 {
  const n = parseInt(hex.trim().slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Reads the active scene's palette from the CSS variables on <html>. */
function readPalette(): { bg: Vec3; ink: Vec3; accent: Vec3 } {
  const styles = getComputedStyle(document.documentElement);
  return {
    bg: hexToVec3(styles.getPropertyValue("--bg")),
    ink: hexToVec3(styles.getPropertyValue("--text")),
    accent: hexToVec3(styles.getPropertyValue("--accent")),
  };
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader failed to compile: ${log}`);
  }
  return shader;
}

/** Compiles and links one scene's program and looks up its uniform locations once. */
function buildProgram(gl: WebGL2RenderingContext, vertex: WebGLShader, scene: SceneId): Program {
  const program = gl.createProgram()!;
  gl.attachShader(program, vertex);
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADERS[scene]));
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Program failed to link: ${gl.getProgramInfoLog(program)}`);
  const loc = (name: string) => gl.getUniformLocation(program, name);
  return {
    program,
    uniforms: {
      u_res: loc("u_res"), u_time: loc("u_time"), u_mouse: loc("u_mouse"), u_dim: loc("u_dim"),
      u_pulse: loc("u_pulse"), u_clear: loc("u_clear"), u_bg: loc("u_bg"), u_ink: loc("u_ink"), u_accent: loc("u_accent"),
    },
  };
}

export function Backdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const scene = useScene();
  /** Lets the scene effect below reach into the running engine without restarting it. */
  const engine = useRef<{ setScene: (scene: SceneId) => void; setPaused: (paused: boolean) => void } | null>(null);
  const windowOpen = useActiveItem() !== null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
    // No WebGL2: the canvas stays hidden and the plain page background shows instead.
    if (!gl) return;
    canvas.style.opacity = "1";

    /* --------------------------------- GPU setup --------------------------------- */
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // One triangle that extends past the screen edges and so covers all of it.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const programs = new Map<SceneId, Program>();
    /** Returns the cached program for a scene, compiling it on first use. */
    const programFor = (id: SceneId) => {
      let entry = programs.get(id);
      if (!entry) {
        entry = buildProgram(gl, vertex, id);
        programs.set(id, entry);
      }
      return entry;
    };

    /* ---------------------------------- State ----------------------------------- */
    let active = programFor(getScene());
    let nextScene: SceneId | null = null;
    let palette = readPalette();
    // Colors currently on screen. They ease toward `palette` so scene changes crossfade.
    const bg: Vec3 = [...palette.bg];
    const ink: Vec3 = [...palette.ink];
    const accent: Vec3 = [...palette.accent];
    let fade = 1; // 1 = art fully visible. Dips to 0 while the shader is swapped.
    let quality = 0;
    let width = 0;
    let height = 0;
    let raf = 0;
    let last = performance.now();
    let time = reduced ? 12 : 0; // A pleasant still frame when motion is disabled.
    let pulseLevel = 0;
    let dim = 1;
    let clear = 1;
    // Telemetry: frames counted since the last readout, and when that readout happened.
    let telemetryFrames = 0;
    let telemetryAt = performance.now();
    let fps = 60;
    const readouts = document.querySelectorAll<HTMLElement>("[data-telemetry]");
    let slowFrames = 0;
    let frames = 0;
    let idle = IDLE_AFTER;
    let paused = false;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO) * QUALITY_STEPS[quality]!;
      width = Math.max(1, Math.floor(window.innerWidth * ratio));
      height = Math.max(1, Math.floor(window.innerHeight * ratio));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      if (idle >= IDLE_AFTER) {
        mouse.x = mouse.tx = width * 0.68;
        mouse.y = mouse.ty = height * 0.55;
      }
    };

    /** Moves `current` a fraction of the way to `target`, in place. */
    const ease = (current: Vec3, target: Vec3, amount: number) => {
      for (let i = 0; i < 3; i++) current[i]! += (target[i]! - current[i]!) * amount;
    };

    const draw = (dt: number) => {
      // Art is strongest in the hero and recedes behind the content further down.
      const targetDim = 1 - 0.78 * Math.min(1, window.scrollY / (window.innerHeight * 0.75));
      const k = reduced ? 1 : Math.min(1, dt * 6);
      dim += (targetDim - dim) * k;
      // The clear zone behind the hero copy is strongest at the top and gone once scrolled.
      const targetClear = 1 - Math.min(1, window.scrollY / (window.innerHeight * 0.6));
      clear += (targetClear - clear) * k;
      ease(bg, palette.bg, k);
      ease(ink, palette.ink, k);
      ease(accent, palette.accent, k);

      // Scene change: fade the art out, swap the program at the darkest point, fade back in.
      if (nextScene) {
        fade = reduced ? 0 : Math.max(0, fade - dt * 5);
        if (fade === 0) {
          active = programFor(nextScene);
          nextScene = null;
        }
      } else if (fade < 1) {
        fade = reduced ? 1 : Math.min(1, fade + dt * 3);
      }

      if (pendingPulse > 0) {
        pulseLevel = Math.max(pulseLevel, pendingPulse);
        pendingPulse = 0;
      }
      pulseLevel *= Math.exp(-dt * 3.2);

      // With no pointer activity (or on touch screens), the focal point wanders by itself.
      idle += dt;
      if (idle >= IDLE_AFTER && !reduced) {
        mouse.tx = width * (0.5 + 0.3 * Math.cos(time * 0.21));
        mouse.ty = height * (0.5 + 0.28 * Math.sin(time * 0.33));
      }
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 4);
      mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 4);

      const u = active.uniforms;
      gl.useProgram(active.program);
      gl.uniform2f(u.u_res, width, height);
      gl.uniform1f(u.u_time, time);
      gl.uniform2f(u.u_mouse, mouse.x, mouse.y);
      gl.uniform1f(u.u_dim, dim * fade);
      gl.uniform1f(u.u_pulse, pulseLevel);
      gl.uniform1f(u.u_clear, clear);
      gl.uniform3f(u.u_bg, bg[0], bg[1], bg[2]);
      gl.uniform3f(u.u_ink, ink[0], ink[1], ink[2]);
      gl.uniform3f(u.u_accent, accent[0], accent[1], accent[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      const elapsed = now - last;
      last = now;
      const dt = Math.min(elapsed / 1000, 0.05);
      time += dt;
      draw(dt);

      // Telemetry readout, about four times a second.
      telemetryFrames++;
      if (now - telemetryAt > 250) {
        fps = Math.round((telemetryFrames * 1000) / (now - telemetryAt));
        telemetryFrames = 0;
        telemetryAt = now;
        const scale = window.innerWidth / width;
        const px = String(Math.round(mouse.x * scale)).padStart(4, "0");
        const py = String(Math.round(window.innerHeight - mouse.y * scale)).padStart(4, "0");
        const text = `X ${px}  Y ${py}  ${String(fps).padStart(3, " ")} FPS`;
        readouts.forEach((el) => {
          el.textContent = text;
        });
      }

      // Adaptive resolution: sample 90 frames, and step quality down if most were slow.
      frames++;
      if (elapsed > SLOW_FRAME_MS) slowFrames++;
      if (frames >= 90) {
        if (slowFrames > 45 && quality < QUALITY_STEPS.length - 1) {
          quality++;
          resize();
        }
        frames = slowFrames = 0;
      }
      raf = requestAnimationFrame(frame);
    };

    /** Reduced motion path: draw one still frame on demand, coalesced per animation frame. */
    let stillQueued = false;
    const drawStill = () => {
      if (stillQueued) return;
      stillQueued = true;
      requestAnimationFrame(() => {
        stillQueued = false;
        draw(1);
        // A scene swap takes two passes (fade out, then in), so draw once more if needed.
        if (nextScene || fade < 1) drawStill();
      });
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (paused || document.hidden) return;
      if (reduced) drawStill();
      else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    /* --------------------------------- Listeners -------------------------------- */
    const onPointerMove = (e: PointerEvent) => {
      const ratio = width / window.innerWidth;
      mouse.tx = e.clientX * ratio;
      mouse.ty = (window.innerHeight - e.clientY) * ratio; // WebGL's origin is the bottom left.
      idle = 0;
    };
    const onPointerDown = () => pulse(1);
    const onResize = () => {
      resize();
      if (reduced) drawStill();
    };
    const onScroll = () => reduced && drawStill();
    const onVisibility = () => start();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    engine.current = {
      setScene(id) {
        nextScene = id;
        palette = readPalette();
        if (reduced) drawStill();
      },
      setPaused(value) {
        paused = value;
        start();
      },
    };

    resize();
    start();

    return () => {
      engine.current = null;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      // Free GPU memory explicitly instead of waiting for garbage collection.
      programs.forEach((p) => gl.deleteProgram(p.program));
      gl.deleteBuffer(buffer);
      gl.deleteShader(vertex);
    };
  }, [reduced]);

  // When the scene changes, tell the running engine. The engine itself is not rebuilt.
  useEffect(() => {
    engine.current?.setScene(scene);
  }, [scene]);

  // Freeze the art while a window covers the page.
  useEffect(() => {
    engine.current?.setPaused(windowOpen);
  }, [windowOpen]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-0" aria-hidden />;
}
