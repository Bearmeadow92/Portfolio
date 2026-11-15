import { Reveal } from "./Reveal";

export function SectionHeading({ index, kicker, title, children }: { index: string; kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <Reveal className="mb-10 max-w-2xl">
      <p className="font-mono text-sm text-accent">
        <span className="text-muted">{index} //</span> {kicker}
      </p>
      <h2 className="glitch mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {children && <p className="mt-3 text-lg text-muted">{children}</p>}
    </Reveal>
  );
}
