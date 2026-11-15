/**
 * @file Theme state: which color theme is active, persisted across visits.
 *
 * A theme is just a `data-theme` attribute on <html>. All colors are CSS variables
 * (see index.css), so switching themes is one attribute write with no re-render of
 * the component tree. Only components that display the theme name subscribe.
 */
import { createStore, useStore } from "./store";

export const THEMES = ["cyber", "matrix", "sunset", "daylight"] as const;
export type ThemeName = (typeof THEMES)[number];

export const THEME_LABELS: Record<ThemeName, string> = {
  cyber: "Cyber",
  matrix: "Matrix",
  sunset: "Synthwave",
  daylight: "Daylight",
};

/** Reads the saved theme, falling back to the default if storage is empty or blocked. */
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

/** Switches the theme, saves the choice, and notifies subscribers. O(1). */
export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("ngt:theme", theme);
  } catch {
    /* ignore */
  }
  themeStore.set(theme);
}

/** Type guard for untrusted strings, such as terminal input. */
export const isTheme = (v: string): v is ThemeName => (THEMES as readonly string[]).includes(v);
export const getTheme = themeStore.get;
export const useTheme = () => useStore(themeStore);
