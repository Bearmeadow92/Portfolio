/**
 * @file Section wrapper around the interactive terminal.
 */
import { Terminal } from "../terminal/Terminal";
import { Reveal } from "../components/Reveal";
import { SectionHeading } from "../components/SectionHeading";

export function TerminalSection() {
  return (
    <section id="terminal" className="mx-auto max-w-[1400px] scroll-mt-20 px-5 py-28 sm:px-10">
      <SectionHeading index="04" label="Terminal" title="Or just type.">
        A working shell with history and tab completion. It can drive this whole site. Start with <code className="font-mono text-text">help</code>.
      </SectionHeading>
      <div className="md:pl-[10rem]">
        <Reveal className="md:ml-4">
          <Terminal />
        </Reveal>
      </div>
    </section>
  );
}
