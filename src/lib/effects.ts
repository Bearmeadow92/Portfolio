import { createStore, useStore } from "./store";

/** Toggles the full screen Matrix rain easter egg. */
const matrixStore = createStore(false);
export const setMatrix = (on: boolean) => matrixStore.set(on);
export const useMatrix = () => useStore(matrixStore);

/** Smoothly scrolls to a section by id. */
export function scrollToSection(id: string) {
  const target = id === "home" ? document.body : document.getElementById(id);
  if (id === "home") window.scrollTo({ top: 0, behavior: "smooth" });
  else target?.scrollIntoView({ behavior: "smooth", block: "start" });
}
