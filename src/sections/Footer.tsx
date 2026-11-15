/**
 * @file Page footer.
 */
import { profile } from "../data/profile";
import { sceneName, useScene } from "../lib/scene";

export function Footer() {
  const scene = useScene();
  return (
    <footer className="border-t border-border">
      <div className="label mx-auto flex max-w-[1400px] flex-col gap-3 px-5 py-8 opacity-70 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p>
          © {new Date().getFullYear()} {profile.name} / {profile.brand}
        </p>
        <p>Hand built with React, TypeScript, and WebGL</p>
        <p title="Up, up, down, down, left, right, left, right, B, A">Now showing: {sceneName(scene)}</p>
      </div>
    </footer>
  );
}
