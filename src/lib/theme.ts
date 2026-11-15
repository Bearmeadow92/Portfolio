import { createStore, useStore } from "./store";

export const THEMES = ["cyber", "matrix", "sunset", "marine"] as const;
export type ThemeName = (typeof THEMES)[number];

export const THEME_LABELS: Record<ThemeName, string> = {
  cyber: "Cyber",
  matrix: "Matrix",
  sunset: "Synthwave",
  marine: "Semper Fi",
};

function initialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem("ngt:theme");
    if (saved && (THEMES as readonly string[]).includes(saved)) return saved as ThemeName;
  } catch {
    /* ignore */
  }
  return "cyber";
}

const themeStore = createStore<ThemeName>(typeof window === "undefined" ? "cyber" : initialTheme());

export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("ngt:theme", theme);
  } catch {
    /* ignore */
  }
  themeStore.set(theme);
}

export const isTheme = (v: string): v is ThemeName => (THEMES as readonly string[]).includes(v);
export const getTheme = themeStore.get;
export const useTheme = () => useStore(themeStore);
