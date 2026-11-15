/**
 * @file Skills shown in the Skills section and the terminal `skills` command.
 *
 * Levels are honest self assessments. To add a skill, append to `skills`. The
 * category index and radar averages below update automatically.
 */

export type SkillCategory = "Frontend" | "Languages" | "Security" | "Tools";

export interface Skill {
  name: string;
  category: SkillCategory;
  /** Self-assessed proficiency from 0 to 100. */
  level: number;
  /** One line of evidence or context. */
  note: string;
}

export const skills: readonly Skill[] = [
  { name: "React", category: "Frontend", level: 88, note: "Hooks, context, lazy loading, custom hooks, performance tuning." },
  { name: "TypeScript", category: "Languages", level: 84, note: "Strict mode everywhere. Types are free documentation." },
  { name: "HTML5", category: "Frontend", level: 92, note: "Canvas, dialog, drag and drop, Web Audio, semantic markup." },
  { name: "CSS / Tailwind", category: "Frontend", level: 86, note: "Design tokens, theming with CSS variables, responsive layouts." },
  { name: "Astro", category: "Frontend", level: 72, note: "Content-driven sites and blogs with islands architecture." },
  { name: "JavaScript", category: "Languages", level: 90, note: "The language of the web, from DOM to game loops." },
  { name: "Python", category: "Languages", level: 82, note: "Automation, scripting, security tooling, data wrangling." },
  { name: "Java", category: "Languages", level: 74, note: "OOP fundamentals, data structures, and algorithms." },
  { name: "Rust", category: "Languages", level: 58, note: "Ownership, borrowing, and fearless concurrency. Still leveling up." },
  { name: "C++", category: "Languages", level: 62, note: "Memory management and performance-minded code." },
  { name: "PowerShell", category: "Tools", level: 78, note: "Windows administration and IT automation." },
  { name: "Git / GitHub", category: "Tools", level: 85, note: "Branching, pull requests, code review, CI with Actions." },
  { name: "Netlify / CI", category: "Tools", level: 76, note: "Automated builds, deploy previews, forms, and headers." },
  { name: "Network Security", category: "Security", level: 80, note: "Subnetting, firewalls, traffic analysis, Wireshark." },
  { name: "Secure Coding", category: "Security", level: 83, note: "OWASP Top 10, input validation, CSP, least privilege." },
  { name: "Cryptography", category: "Security", level: 70, note: "Hashing, encoding, entropy, and the Web Crypto API." },
  { name: "Linux", category: "Tools", level: 79, note: "Bash, permissions, services, and hardening." },
];

export const skillCategories: readonly SkillCategory[] = ["Frontend", "Languages", "Security", "Tools"];

/**
 * Skills grouped by category, built once at module load in a single O(n) pass.
 * Filtering the grid by category is then an O(1) Map lookup instead of an O(n)
 * `filter` on every click.
 */
export const skillsByCategory: ReadonlyMap<SkillCategory, readonly Skill[]> = (() => {
  const index = new Map<SkillCategory, Skill[]>(skillCategories.map((c) => [c, []]));
  for (const skill of skills) index.get(skill.category)!.push(skill);
  return index;
})();

/** Average level per category for the radar chart. Computed once, never during render. */
export const categoryAverages: readonly { category: SkillCategory; average: number }[] = skillCategories.map((category) => {
  const list = skillsByCategory.get(category)!;
  return { category, average: list.reduce((sum, s) => sum + s.level, 0) / list.length };
});
