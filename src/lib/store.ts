/**
 * @file A minimal observable store.
 */
import { useSyncExternalStore } from "react";

/**
 * A minimal observable store (think a tiny Zustand) for app-wide state that many
 * unrelated components need, such as the scene or the open window. No provider needed.
 */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    /** Current value. O(1). */
    get: () => state,
    /** Replaces the value and notifies subscribers, unless nothing changed. O(listeners). */
    set(next: T) {
      if (Object.is(next, state)) return;
      state = next;
      listeners.forEach((l) => l());
    },
    /** Registers a listener and returns an unsubscribe function. O(1) thanks to the Set. */
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Subscribes a component to a store. It re-renders only when the value changes. */
export function useStore<T>(store: ReturnType<typeof createStore<T>>) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
