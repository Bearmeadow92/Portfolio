/**
 * @file Terminal command interpreter.
 * Pure function: input string in, output lines plus an optional side effect description out.
 * Keeping it free of React and the DOM makes it trivial to unit test.
 *
 * Dispatch is an O(1) object lookup by command name, so adding commands never slows
 * the interpreter down.
 */
import { profile } from "../data/profile";
import { skills } from "../data/skills";
import { catalog, findItem, itemsByKind } from "../data/catalog";
import { SCENES, isScene, sceneName, type SceneId } from "../lib/scene";

/** Color hint for a line of output. */
export type Tone = "text" | "accent" | "muted" | "good" | "bad" | "warn";
export interface Line {
  text: string;
  tone?: Tone;
}

/** A side effect requested by a command. The UI layer decides how to carry it out. */
export type Action =
  | { type: "clear" }
  | { type: "navigate"; target: string }
  | { type: "scene"; value: SceneId }
  | { type: "matrix" }
  | { type: "open"; id: string };

export interface CommandResult {
  lines: Line[];
  action?: Action;
}

export interface CommandContext {
  /** Previously run commands, oldest first. */
  history: string[];
  /** Injectable clock, so tests are deterministic. */
  now?: Date;
}

/** Section ids that `goto` (and the command palette) can scroll to. */
export const SECTIONS = ["home", "work", "about", "skills", "terminal", "source", "contact"] as const;

/** The pretend filesystem behind `ls` and `cat`. */
const FILES: Record<string, string[]> = {
  "about.txt": [profile.about.lead, ...profile.about.body],
  "mission.txt": [
    "Build software that holds up when it matters.",
    "Keep learning out loud, and help the next technologist up the ladder.",
  ],
  "secrets.txt": ["Permission denied. Nice try though. Least privilege is a lifestyle."],
};

/** Shorthand for building an output line. */
const l = (text: string, tone?: Tone): Line => ({ text, tone });

interface Command {
  description: string;
  /** Shown in `help` instead of the bare name when the command takes arguments. */
  usage?: string;
  /** Hidden commands work but are left out of `help` and tab completion. */
  hidden?: boolean;
  run: (args: string[], ctx: CommandContext) => CommandResult;
}

const commands: Record<string, Command> = {
  help: {
    description: "List available commands",
    run: () => ({
      lines: [
        l("Available commands:", "accent"),
        ...Object.entries(commands)
          .filter(([, c]) => !c.hidden)
          .map(([name, c]) => l(`  ${(c.usage ?? name).padEnd(18)} ${c.description}`)),
        l(""),
        l("Tip: use ↑ ↓ for history and Tab to autocomplete. There may be hidden commands.", "muted"),
      ],
    }),
  },
  whoami: {
    description: "Who is behind this portfolio",
    run: () => ({ lines: [l(`${profile.name}, ${profile.role}`, "accent"), l(profile.intro)] }),
  },
  about: {
    description: "Read my story",
    run: () => ({ lines: [profile.about.lead, ...profile.about.body].map((p) => l(p)), action: { type: "navigate", target: "about" } }),
  },
  skills: {
    description: "Show skills, optionally by category",
    usage: "skills [category]",
    run: (args) => {
      const filter = args[0]?.toLowerCase();
      const list = filter ? skills.filter((s) => s.category.toLowerCase().startsWith(filter)) : skills;
      if (!list.length) return { lines: [l(`No skills match "${args[0]}". Try frontend, languages, security, or tools.`, "warn")] };
      return {
        lines: list.map((s) => {
          const filled = Math.round(s.level / 10);
          return l(`  ${s.name.padEnd(18)} ${"█".repeat(filled)}${"░".repeat(10 - filled)} ${s.level}%`, s.level >= 80 ? "good" : "text");
        }),
      };
    },
  },
  ls: {
    description: "List files, games, and apps",
    run: () => ({
      lines: [
        l(Object.keys(FILES).join("   "), "accent"),
        l("games/  " + itemsByKind.game.map((c) => c.id).join("  ")),
        l("apps/   " + itemsByKind.app.map((c) => c.id).join("  ")),
      ],
    }),
  },
  cat: {
    description: "Print a file",
    usage: "cat <file>",
    run: (args) => {
      const file = args[0];
      if (!file) return { lines: [l("usage: cat <file>. Try 'ls' to see files.", "warn")] };
      const content = FILES[file];
      if (!content) return { lines: [l(`cat: ${file}: No such file or directory`, "bad")] };
      return { lines: content.map((c) => l(c, file === "secrets.txt" ? "bad" : "text")) };
    },
  },
  play: {
    description: "Launch a game or app",
    usage: "play <id>",
    run: (args) => {
      const item = args[0] ? findItem(args[0].toLowerCase()) : undefined;
      if (!item) {
        return { lines: [l("usage: play <id>", "warn"), l("ids: " + catalog.map((c) => c.id).join(", "), "muted")] };
      }
      return { lines: [l(`Launching ${item.title}...`, "good")], action: { type: "open", id: item.id } };
    },
  },
  scene: {
    description: "Switch the background scene",
    usage: "scene [name]",
    run: (args) => {
      const name = args[0]?.toLowerCase();
      if (!name) return { lines: SCENES.map((s) => l(`  ${s.id.padEnd(10)} ${s.blurb}`)) };
      if (!isScene(name)) return { lines: [l(`Unknown scene "${name}". Options: ${SCENES.map((s) => s.id).join(", ")}`, "bad")] };
      return { lines: [l(`Scene set to ${sceneName(name)}.`, "good")], action: { type: "scene", value: name } };
    },
  },
  goto: {
    description: "Scroll to a section",
    usage: "goto <section>",
    run: (args) => {
      const target = args[0]?.toLowerCase();
      if (!target || !(SECTIONS as readonly string[]).includes(target)) {
        return { lines: [l(`Sections: ${SECTIONS.join(", ")}`, "warn")] };
      }
      return { lines: [l(`Navigating to #${target}`, "good")], action: { type: "navigate", target } };
    },
  },
  contact: {
    description: "How to reach me",
    run: () => ({
      lines: [
        l(`GitHub    ${profile.links.github}`),
        l(`LinkedIn  ${profile.links.linkedin}`),
        l("Or use the contact form, which I'm scrolling you to now.", "muted"),
      ],
      action: { type: "navigate", target: "contact" },
    }),
  },
  neofetch: {
    description: "System info, portfolio edition",
    run: (_args, ctx) => {
      const uptime = Math.floor(performance.now() / 1000);
      return {
        lines: [
          l("   ▄▄▄▄▄▄▄     jesse@nextgen", "accent"),
          l("  █ ▀▄ ▄▀ █    ─────────────", "accent"),
          l("  █  ▄▀▄  █    OS: NextGenOS (React 19)", "accent"),
          l("  █▄▄▄▄▄▄▄█    Shell: ngt-sh 1.0", "accent"),
          l(`                Uptime: ${uptime}s`, "accent"),
          l(`                Commands run: ${ctx.history.length}`, "accent"),
          l("                Status: Open to work", "good"),
        ],
      };
    },
  },
  history: {
    description: "Show command history",
    run: (_args, ctx) => ({
      lines: ctx.history.length ? ctx.history.map((h, i) => l(`  ${String(i + 1).padStart(3)}  ${h}`)) : [l("No history yet.", "muted")],
    }),
  },
  date: {
    description: "Print the date",
    run: (_args, ctx) => ({ lines: [l((ctx.now ?? new Date()).toString())] }),
  },
  echo: {
    description: "Print text",
    usage: "echo <text>",
    run: (args) => ({ lines: [l(args.join(" "))] }),
  },
  clear: {
    description: "Clear the screen",
    run: () => ({ lines: [], action: { type: "clear" } }),
  },
  sudo: {
    description: "Run as superuser",
    usage: "sudo <command>",
    run: (args) => {
      const joined = args.join(" ").toLowerCase();
      if (joined === "hire-jesse" || joined === "hire jesse") {
        return {
          lines: [
            l("[sudo] verifying credentials... ✓", "muted"),
            l("Access granted. Excellent decision.", "good"),
            l("Scrolling to the contact form so we can make it official.", "accent"),
          ],
          action: { type: "navigate", target: "contact" },
        };
      }
      return { lines: [l("jesse is not in the sudoers file. This incident will be reported.", "bad"), l("(Hint: try 'sudo hire-jesse')", "muted")] };
    },
  },
  matrix: {
    description: "Follow the white rabbit",
    hidden: true,
    run: () => ({ lines: [l("Wake up, Neo...", "good")], action: { type: "matrix" } }),
  },
  coffee: {
    description: "Refuel",
    hidden: true,
    run: () => ({ lines: [l("Brewing... done. Productivity +25%. Bugs fear you now.", "warn")] }),
  },
  rm: {
    description: "Remove files",
    hidden: true,
    run: (args) =>
      args.join(" ").includes("-rf")
        ? { lines: [l("Nice try. This system practices defense in depth.", "bad")] }
        : { lines: [l("rm: refusing to delete anything on a portfolio. It took a while to build!", "warn")] },
  },
  exit: {
    description: "Leave the terminal",
    hidden: true,
    run: () => ({ lines: [l("There is no exit. Only more features. Try 'play firewall'.", "muted")] }),
  },
};

/** Aliases map familiar commands from other shells onto ours. */
const ALIASES: Record<string, string> = { cd: "goto", open: "play", dir: "ls", cls: "clear", "?": "help", man: "help", theme: "scene" };

/** Visible command names, used for tab completion. */
export const commandNames = Object.keys(commands).filter((n) => !commands[n]!.hidden);

/**
 * Parses and runs one line of input.
 * @returns Output lines and, optionally, a side effect for the UI to perform.
 */
export function runCommand(raw: string, ctx: CommandContext): CommandResult {
  const input = raw.trim();
  if (!input) return { lines: [] };
  // Lightweight tokenizer: split on whitespace. Quotes are not needed for any command here.
  const [first = "", ...args] = input.split(/\s+/);
  const name = ALIASES[first.toLowerCase()] ?? first.toLowerCase();
  const cmd = commands[name];
  if (!cmd) return { lines: [l(`command not found: ${first}. Type 'help' for a list.`, "bad")] };
  return cmd.run(args, ctx);
}

/** Tab completion over command names, plus ids for `play` and section names for `goto`. */
export function complete(partial: string): string[] {
  const parts = partial.split(/\s+/);
  if (parts.length <= 1) return commandNames.filter((c) => c.startsWith(partial.toLowerCase()));
  const [cmd, arg = ""] = parts;
  const resolved = ALIASES[cmd!.toLowerCase()] ?? cmd!.toLowerCase();
  const pool: readonly string[] =
    resolved === "play" ? catalog.map((c) => c.id) : resolved === "goto" ? SECTIONS : resolved === "scene" ? SCENES.map((s) => s.id) : resolved === "cat" ? Object.keys(FILES) : [];
  return pool.filter((p) => p.startsWith(arg.toLowerCase())).map((p) => `${cmd} ${p}`);
}
