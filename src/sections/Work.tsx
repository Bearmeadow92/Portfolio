/**
 * @file Work: one typographic index of everything playable and usable on the site.
 *
 * There are no cards. Each project is a single row that inverts on hover, which keeps
 * the page calm and lets the backdrop do the decorating. Rows come straight from the
 * catalog, so adding a project is a data change, not a layout change.
 */
import { itemsByKind, type CatalogItem } from "../data/catalog";
import { pulse } from "../art/Backdrop";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { preload } from "../components/registry";
import { openItem, useActiveItem } from "../lib/launcher";

/** Tools lead, because security is the specialty. Games follow as proof of range. */
const GROUPS = [
  { title: "Tools", note: "Everything runs in your browser. Nothing you type leaves this device.", items: itemsByKind.app, action: "Open" },
  { title: "Games", note: "Built from scratch on canvas. No engine, no libraries.", items: itemsByKind.game, action: "Play" },
] as const;

/**
 * Reads a saved best score for a game row.
 * This is a one-off read during render (not a subscription), which is fine because the
 * section re-renders whenever a window closes.
 */
function readBest(id: string): string | null {
  try {
    // Cipher Memory keeps one record per difficulty. The row shows the entry tier.
    const raw = localStorage.getItem(id === "memory" ? "ngt:hs:memory-junior" : `ngt:hs:${id}`);
    const value = raw ? (JSON.parse(raw) as number | null) : null;
    if (value === null) return null;
    return id === "memory" ? `${value} moves` : value.toLocaleString();
  } catch {
    return null;
  }
}

function Row({ item, number, action }: { item: CatalogItem; number: number; action: string }) {
  const best = item.kind === "game" ? readBest(item.id) : null;
  /** Start downloading the code chunk as soon as the user shows intent, so the click feels instant. */
  const warm = () => preload(item.id);

  return (
    <li>
      <button
        onClick={() => openItem(item.id)}
        onPointerEnter={() => {
          warm();
          pulse(0.35);
        }}
        onFocus={warm}
        className="row group grid w-full grid-cols-[2.5rem_1fr_auto] items-baseline gap-x-4 gap-y-1 px-2 py-5 text-left sm:px-4 md:grid-cols-[3rem_minmax(0,1.3fr)_minmax(0,1fr)_6rem]"
      >
        <span className="label opacity-60">{String(number).padStart(2, "0")}</span>
        <span>
          <span className="display block text-[clamp(1.5rem,2.6vw,2.25rem)] !leading-none">{item.title}</span>
          <span className="label mt-2.5 flex flex-wrap gap-x-3 gap-y-1 opacity-70">
            <span>{item.tag}</span>
            {best && <span>Best {best}</span>}
          </span>
        </span>
        <span className="col-span-2 col-start-2 max-w-md text-[0.9375rem] leading-snug opacity-75 md:col-span-1 md:col-start-3">{item.blurb}</span>
        <span className="label col-start-3 row-start-1 flex items-center justify-end gap-2 md:col-start-4">
          {action}
          <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden>→</span>
        </span>
      </button>
    </li>
  );
}

export function Work() {
  // Subscribing re-renders the list when a window closes, so new high scores appear.
  useActiveItem();
  let number = 0;

  return (
    <section id="work" className="mx-auto max-w-[1400px] scroll-mt-20 px-5 py-28 sm:px-10">
      <SectionHeading index="01" label="Work" title="Use it. Play it.">
        Four tools and three games. Open any of them right here.
      </SectionHeading>

      {GROUPS.map((group) => (
        <Reveal key={group.title} className="mb-14 last:mb-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-2 sm:px-4">
            <h3 className="label text-accent">{group.title}</h3>
            <p className="label opacity-60">{group.note}</p>
          </div>
          <ul className="border-b border-border">
            {group.items.map((item) => (
              <Row key={item.id} item={item} number={++number} action={group.action} />
            ))}
          </ul>
        </Reveal>
      ))}
    </section>
  );
}
