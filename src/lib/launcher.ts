/**
 * @file Launcher state: which game or app window is open, if any.
 *
 * Any module can open a window by id (cards, the terminal, the command palette)
 * without prop drilling or a context provider.
 */
import { createStore, useStore } from "./store";

const launcherStore = createStore<string | null>(null);

export const openItem = (id: string) => launcherStore.set(id);
export const closeItem = () => launcherStore.set(null);
export const useActiveItem = () => useStore(launcherStore);
