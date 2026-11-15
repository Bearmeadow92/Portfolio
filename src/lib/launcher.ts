import { createStore, useStore } from "./store";

/** Which game or app window is open, if any. Any component can open one by id. */
const launcherStore = createStore<string | null>(null);

export const openItem = (id: string) => launcherStore.set(id);
export const closeItem = () => launcherStore.set(null);
export const useActiveItem = () => useStore(launcherStore);
