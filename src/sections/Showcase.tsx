import { catalog, type ItemKind } from "../data/catalog";
import { ItemCard } from "../components/ItemCard";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";
import { useActiveItem } from "../lib/launcher";

const COPY: Record<ItemKind, { id: string; index: string; kicker: string; title: string; body: string }> = {
  game: {
    id: "arcade",
    index: "03",
    kicker: "arcade",
    title: "Insert coin to continue",
    body: "Original mini games built from scratch on HTML5 Canvas. No engines, no libraries, just math, a game loop, and a lot of playtesting. High scores save locally.",
  },
  app: {
    id: "toolkit",
    index: "04",
    kicker: "toolkit",
    title: "Useful mini apps",
    body: "Small tools I actually use, built with React and native browser APIs. Everything runs client side, so your data never leaves your device.",
  },
};

/** Renders the Arcade or the Toolkit grid from the shared catalog. */
export function Showcase({ kind }: { kind: ItemKind }) {
  const copy = COPY[kind];
  // Re-render when a window closes so updated high scores appear on the cards.
  useActiveItem();
  const items = catalog.filter((c) => c.kind === kind);

  return (
    <section id={copy.id} className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-28 sm:px-6">
      <SectionHeading index={copy.index} kicker={copy.kicker} title={copy.title}>
        {copy.body}
      </SectionHeading>
      <div className={`grid gap-5 sm:grid-cols-2 ${kind === "game" ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        {items.map((item, i) => (
          <Reveal key={item.id} delay={i * 90} className="h-full">
            <ItemCard item={item} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
