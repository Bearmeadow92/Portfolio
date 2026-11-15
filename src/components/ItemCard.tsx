/**
 * @file Card for one game or app in the Arcade and Toolkit grids.
 */
import type { CatalogItem } from "../data/catalog";
import { openItem } from "../lib/launcher";
import { preload } from "./registry";
import { TiltCard } from "./TiltCard";

/**
 * Reads a saved best score for display on the card.
 * This is a one-off read during render (not a subscription), which is fine because the
 * parent section re-renders whenever a game window closes.
 */
function readBest(id: string): string | null {
  try {
    // Cipher Memory keeps one record per difficulty. The card shows the entry tier.
    const key = id === "memory" ? "ngt:hs:memory-junior" : `ngt:hs:${id}`;
    const raw = localStorage.getItem(key);
    const value = raw ? (JSON.parse(raw) as number | null) : null;
    if (value === null) return null;
    return id === "memory" ? `${value} moves` : value.toLocaleString();
  } catch {
    return null;
  }
}

export function ItemCard({ item }: { item: CatalogItem }) {
  const best = item.kind === "game" ? readBest(item.id) : null;
  /** Start downloading the code chunk as soon as the user shows intent, so the click feels instant. */
  const warm = () => preload(item.id);

  return (
    <TiltCard className="h-full">
      <div className="flex h-full flex-col p-6">
        <div className="flex items-start justify-between">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-surface-2 text-3xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" aria-hidden>
            {item.icon}
          </span>
          {best && <span className="chip border-warn/40 text-warn">🏆 {best}</span>}
        </div>
        <h3 className="mt-5 text-xl font-bold">{item.title}</h3>
        <p className="mt-2 flex-1 text-muted">{item.blurb}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.tech.map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
        <button onClick={() => openItem(item.id)} onPointerEnter={warm} onFocus={warm} className="btn btn-primary mt-6 w-full">
          {item.kind === "game" ? "▶ Play now" : "⚡ Launch app"}
        </button>
      </div>
    </TiltCard>
  );
}
