/**
 * @file Arcade and Toolkit sections.
 *
 * Both sections are the same component rendering a different slice of the catalog,
 * so adding a new game or app is a data change, not a layout change.
 */
import { itemsByKind, type ItemKind } from "../data/catalog";
import { ItemCard } from "../components/ItemCard";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { useActiveItem } from "../lib/launcher";

const COPY: Record<ItemKind, { id: string; index: string; kicker: string; title: string; body: string; grid: string }> = {
  game: {
    id: "arcade",
    index: "03",
    kicker: "arcade",
    title: "Insert coin to continue",
    body: "Original mini games built from scratch on HTML5 Canvas. No engines, no libraries, just math, a game loop, and a lot of playtesting. High scores save locally.",
    grid: "lg:grid-cols-3",
  },
  app: {
    id: "toolkit",
    index: "04",
    kicker: "toolkit",
    title: "Useful mini apps",
    body: "Small tools I actually use, built with React and native browser APIs. Everything runs client side, so your data never leaves your device.",
    grid: "lg:grid-cols-4",
  },
};

/** Renders the Arcade (`kind="game"`) or the Toolkit (`kind="app"`) grid. */
export function Showcase({ kind }: { kind: ItemKind }) {
  const copy = COPY[kind];
  // Subscribing re-renders the grid when a window closes, so new high scores show up on the cards.
  useActiveItem();

  return (
    <section id={copy.id} className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-28 sm:px-6">
      <SectionHeading index={copy.index} kicker={copy.kicker} title={copy.title}>
        {copy.body}
      </SectionHeading>
      <div className={`grid gap-5 sm:grid-cols-2 ${copy.grid}`}>
        {itemsByKind[kind].map((item, i) => (
          <Reveal key={item.id} delay={i * 90} className="h-full">
            <ItemCard item={item} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
