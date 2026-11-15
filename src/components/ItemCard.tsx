import type { CatalogItem } from "../data/catalog";
import { openItem } from "../lib/launcher";
import { preload } from "./registry";
import { TiltCard } from "./TiltCard";

/** Reads a saved best score without subscribing, which is fine for a card preview. */
function readBest(id: string): string | null {
  try {
    const keys = id === "memory" ? ["ngt:hs:memory-recruit"] : [`ngt:hs:${id}`];
    const raw = localStorage.getItem(keys[0]!);
    const val = raw ? (JSON.parse(raw) as number | null) : null;
    if (val === null) return null;
    return id === "memory" ? `${val} moves` : val.toLocaleString();
  } catch {
    return null;
  }
}

export function ItemCard({ item }: { item: CatalogItem }) {
  const best = item.kind === "game" ? readBest(item.id) : null;
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
