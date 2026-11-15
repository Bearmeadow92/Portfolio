/**
 * Terminal command interpreter.
 * Pure function: input string in, output lines plus an optional side effect description out.
 * Keeping it free of React and the DOM makes it trivial to unit test.
 */
import { profile } from "../data/profile";
import { skills } from "../data/skills";
import { catalog, findItem } from "../data/catalog";
import { THEMES, THEME_LABELS, isTheme, type ThemeName } from "../lib/theme";

export type Tone = "text" | "accent" | "muted" | "good" | "bad" | "warn";
export interface Line {
  text: string;
  tone?: Tone;
}

export type Action =
  | { type: "clear" }
  | { type: "navigate"; target: string }
  | { type: "theme"; value: ThemeName }
  | { type: "matrix" }
  | { type: "open"; id: string };

export interface CommandResult {
  lines: Line[];
  action?: Action;
}

export interface CommandContext {
  history: string[];
  now?: Date;
}

export const SECTIONS = ["home", "about", "skills", "arcade", "toolkit", "terminal", "github", "contact"] as const;

const FILES: Record<string, string[]> = {
  "about.txt": [...profile.about],
  "mission.txt": [
    "Mission: land a software engineering role on a team that ships great products.",
    "Method: keep learning, build in public, help the next technologist up the ladder.",
  ],
  "secrets.txt": ["Permission denied. Nice try though. Least privilege is a lifestyle. 🔒"],
};

const l = (text: string, tone?: Tone): Line => ({ text, tone });

interface Command {
  description: string;
  usage?: string;
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
        l("Tip: use ↑ ↓ for history and Tab to autocomplete. There may be hidden commands. 👀", "muted"),
      ],
    }),
  },
  whoami: {
    description: "Who is behind this portfolio",
    run: () => ({ lines: [l(`${profile.name}, ${profile.role}`, "accent"), l(profile.tagline)] }),
  },
  about: {
    description: "Read my story",
    run: () => ({ lines: profile.about.map((p) => l(p)), action: { type: "navigate", target: "about" } }),
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
        l("games/  " + catalog.filter((c) => c.kind === "game").map((c) => c.id).join("  ")),
        l("apps/   " + catalog.filter((c) => c.kind === "app").map((c) => c.id).join("  ")),
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
  theme: {
    description: "Switch the color theme",
    usage: "theme [name]",
    run: (args) => {
      const name = args[0]?.toLowerCase();
      if (!name) return { lines: [l("Themes: " + THEMES.map((t) => `${t} (${THEME_LABELS[t]})`).join(", "))] };
      if (!isTheme(name)) return { lines: [l(`Unknown theme "${name}". Options: ${THEMES.join(", ")}`, "bad")] };
      return { lines: [l(`Theme set to ${THEME_LABELS[name]}.`, "good")], action: { type: "theme", value: name } };
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
          l("                Branch: U.S. Marine Corps → Software", "accent"),
          l("                Status: Open to work ✅", "good"),
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
            l("Access granted. Excellent decision. 🎉", "good"),
            l("Scrolling to the contact form so we can make it official.", "accent"),
          ],
          action: { type: "navigate", target: "contact" },
        };
      }
      return { lines: [l("jesse is not in the sudoers file. This incident will be reported. 🚨", "bad"), l("(Hint: try 'sudo hire-jesse')", "muted")] };
    },
  },
  matrix: {
    description: "Follow the white rabbit",
    hidden: true,
    run: () => ({ lines: [l("Wake up, Neo...", "good")], action: { type: "matrix" } }),
  },
  oorah: {
    description: "Motivation",
    hidden: true,
    run: () => ({ lines: [l("OORAH! 🦅 Semper Fidelis. Always faithful, always shipping.", "warn")], action: { type: "theme", value: "marine" } }),
  },
  coffee: {
    description: "Refuel",
    hidden: true,
    run: () => ({ lines: [l("☕ Brewing... done. Productivity +25%. Bugs fear you now.", "warn")] }),
  },
  rm: {
    description: "Remove files",
    hidden: true,
    run: (args) =>
      args.join(" ").includes("-rf")
        ? { lines: [l("Nice try. This system practices defense in depth. 😄", "bad")] }
        : { lines: [l("rm: refusing to delete anything on a portfolio. It took a while to build!", "warn")] },
  },
  exit: {
    description: "Leave the terminal",
    hidden: true,
    run: () => ({ lines: [l("There is no exit. Only more features. Try 'play firewall'.", "muted")] }),
  },
};

/** Aliases map familiar commands from other shells onto ours. */
const ALIASES: Record<string, string> = { cd: "goto", open: "play", dir: "ls", cls: "clear", "?": "help", man: "help" };

export const commandNames = Object.keys(commands).filter((n) => !commands[n]!.hidden);

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
    resolved === "play" ? catalog.map((c) => c.id) : resolved === "goto" ? SECTIONS : resolved === "theme" ? THEMES : resolved === "cat" ? Object.keys(FILES) : [];
  return pool.filter((p) => p.startsWith(arg.toLowerCase())).map((p) => `${cmd} ${p}`);
}
