/**
 * @file Tiny synthesizer built on the Web Audio API.
 * No audio files are downloaded: every sound effect is generated from oscillators,
 * which keeps the bundle small and shows off a lesser-known HTML5 API.
 */
import { useSyncExternalStore } from "react";

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted() {
  try {
    return localStorage.getItem("ngt:muted") === "1";
  } catch {
    return false;
  }
}

function audio() {
  // Browsers only allow audio after a user gesture, so the context is created lazily.
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/**
 * Plays one synthesized note.
 * @param freq     Starting pitch in hertz.
 * @param duration Length in seconds.
 * @param wave     Oscillator shape, which sets the timbre.
 * @param volume   Peak gain. Kept low so effects never startle.
 * @param slideTo  Optional pitch to glide to, for "pew" style sweeps.
 */
function tone(freq: number, duration: number, wave: Wave = "square", volume = 0.06, slideTo?: number) {
  if (muted) return;
  try {
    const ac = audio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const now = ac.currentTime;
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    // Quick attack and exponential decay avoid clicks.
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    /* audio not supported, fail silently */
  }
}

/** Named sound effects used by the games and UI. Each is a no-op while muted. */
export const sfx = {
  click: () => tone(660, 0.05, "square", 0.03),
  hit: () => tone(880, 0.08, "square", 0.05, 1320),
  zap: () => tone(1200, 0.12, "sawtooth", 0.04, 200),
  bounce: () => tone(440, 0.06, "triangle", 0.07),
  bad: () => tone(160, 0.3, "sawtooth", 0.06, 60),
  power: () => {
    tone(523, 0.08, "square", 0.04);
    setTimeout(() => tone(659, 0.08, "square", 0.04), 80);
    setTimeout(() => tone(784, 0.14, "square", 0.04), 160);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, "triangle", 0.06), i * 110));
  },
  lose: () => {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.2, "sawtooth", 0.04), i * 140));
  },
};

/** Mutes or unmutes all sound, remembers the choice, and notifies subscribed components. */
export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem("ngt:muted", value ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** React binding for the global mute flag. */
export function useMuted() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => muted,
    () => false,
  );
}

/** Current mute flag, for non-React callers. */
export const getMuted = () => muted;
