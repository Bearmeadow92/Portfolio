import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type Loader = () => Promise<{ default: ComponentType }>;

/** One import per game or app. Vite turns each into its own chunk, downloaded only when needed. */
const loaders: Record<string, Loader> = {
  firewall: () => import("../games/FirewallDefender"),
  bytebreaker: () => import("../games/ByteBreaker"),
  memory: () => import("../games/CipherMemory"),
  password: () => import("../apps/PasswordLab"),
  crypto: () => import("../apps/CryptoKit"),
  subnet: () => import("../apps/SubnetCalc"),
  kanban: () => import("../apps/KanbanBoard"),
};

export const registry: Record<string, LazyExoticComponent<ComponentType>> = Object.fromEntries(
  Object.entries(loaders).map(([id, load]) => [id, lazy(load)]),
);

/** Warm a chunk on hover or focus so the window opens instantly on click. */
export function preload(id: string) {
  void loaders[id]?.();
}
