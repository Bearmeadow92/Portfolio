/**
 * @file Small site-wide effects: the Matrix rain toggle and smooth section scrolling.
 */
import { createStore, useStore } from "./store";

/** Toggles the full screen Matrix rain easter egg. */
const matrixStore = createStore(false);
export const setMatrix = (on: boolean) => matrixStore.set(on);
export const useMatrix = () => useStore(matrixStore);

/** Smoothly scrolls to a section by id. */
export function scrollToSection(id: string) {
  if (id === "home") window.scrollTo({ top: 0, behavior: "smooth" });
  else document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
