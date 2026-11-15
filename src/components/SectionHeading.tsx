/**
 * @file Consistent heading used at the top of every page section.
 */
import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

/**
 * @param index Two digit section number, such as "03".
 * @param label Short name of the section, shown small beside the number.
 * @param title The headline.
 */
export function SectionHeading({ index, label, title, children }: { index: string; label: string; title: string; children?: ReactNode }) {
  return (
    <Reveal className="mb-12 grid gap-4 md:grid-cols-[10rem_1fr]">
      <p className="label pt-3 opacity-70">
        <span className="text-accent">{index}</span> &nbsp;{label}
      </p>
      <div>
        <h2 className="display text-[clamp(2.4rem,6.5vw,5.5rem)]">{title}</h2>
        {children && <p className="mt-5 max-w-2xl text-xl text-muted">{children}</p>}
      </div>
    </Reveal>
  );
}
