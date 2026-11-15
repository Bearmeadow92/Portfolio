import { profile } from "../data/profile";

export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center text-sm text-muted sm:flex-row sm:justify-between sm:px-6 sm:text-left">
        <p>
          © {new Date().getFullYear()} {profile.name} · {profile.brand}. Built from scratch with React, TypeScript, Tailwind, and HTML5.
        </p>
        <p className="font-mono text-xs">
          Semper Fi 🦅 · <span title="↑ ↑ ↓ ↓ ← → ← → B A">psst, try the Konami code</span>
        </p>
      </div>
    </footer>
  );
}
