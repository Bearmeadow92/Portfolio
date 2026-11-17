/**
 * @file Scene state: which generative backdrop (and its color palette) is active.
 *
 * A scene is a `data-scene` attribute on <html>. The palette for each scene lives in
 * index.css as CSS variables, so switching scenes re-tints the whole interface with a
 * single attribute write and no React re-render. The WebGL backdrop subscribes to this
 * store and swaps its shader to match.
 */
import { createStore, useStore } from "./store";

export const SCENES = [
  { id: "breach", name: "Breach", blurb: "A quiet network. Every few seconds an attack lands, spreads, and gets contained." },
  { id: "glyph", name: "Glyph", blurb: "A spinning donut drawn in text characters, in the spirit of donut.c." },
  { id: "drivetrain", name: "Drivetrain", blurb: "A V-twin engine in blueprint. Move fast or scroll to rev it." },
  { id: "chrome", name: "Chrome", blurb: "A machined chrome bolt and nut. Sweep across to screw the nut along the thread." },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

const STORAGE_KEY = "ngt:scene";

/** Type guard for untrusted strings, such as terminal input or saved settings. */
export const isScene = (v: string): v is SceneId => SCENES.some((s) => s.id === v);

/** Display name for a scene id. */
export const sceneName = (id: SceneId) => SCENES.find((s) => s.id === id)!.name;

/**
 * Picks the starting scene: the visitor's saved choice, or else a light or dark
 * scene matching their operating system preference.
 */
function initialScene(): SceneId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isScene(saved)) return saved;
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "glyph";
  } catch {
    /* Storage or matchMedia unavailable. Use the default. */
  }
  return "breach";
}

const sceneStore = createStore<SceneId>(typeof window === "undefined" ? "breach" : initialScene());

/** Switches the scene, saves the choice, and notifies subscribers. O(1). */
export function applyScene(scene: SceneId) {
  document.documentElement.dataset.scene = scene;
  try {
    localStorage.setItem(STORAGE_KEY, scene);
  } catch {
    /* ignore */
  }
  sceneStore.set(scene);
}

/** Advances to the next (or previous) scene, wrapping around. */
export function cycleScene(step: 1 | -1 = 1) {
  const index = SCENES.findIndex((s) => s.id === sceneStore.get());
  applyScene(SCENES[(index + step + SCENES.length) % SCENES.length]!.id);
}

export const getScene = sceneStore.get;
export const useScene = () => useStore(sceneStore);
