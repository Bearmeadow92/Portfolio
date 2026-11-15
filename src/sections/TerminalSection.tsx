/**
 * @file Section wrapper around the interactive terminal.
 */
import { Terminal } from "../terminal/Terminal";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";

export function TerminalSection() {
  return (
    <section id="terminal" className="relative mx-auto max-w-4xl scroll-mt-20 px-4 py-28 sm:px-6">
      <SectionHeading index="05" kicker="terminal" title="Prefer the command line?">
        A real interactive shell with history, tab completion, and commands that control this site. Start with <code className="font-mono text-accent">help</code>.
      </SectionHeading>
      <Reveal>
        <Terminal />
      </Reveal>
    </section>
  );
}
