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
    <Reveal className="mb-14 grid gap-4 border-t border-border pt-5 md:grid-cols-[10rem_1fr]">
      <p className="label pt-2 text-muted">
        <span className="text-accent">{index}</span>&nbsp;&nbsp;{label}
      </p>
      <div>
        <h2 className="display text-[clamp(2.25rem,5vw,4.25rem)]">{title}</h2>
        {children && <p className="mt-4 max-w-xl text-lg text-muted">{children}</p>}
      </div>
    </Reveal>
  );
}
