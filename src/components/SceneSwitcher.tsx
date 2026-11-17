/**
 * @file Controls for choosing the generative backdrop scene.
 */
import { SCENES, applyScene, cycleScene, sceneName, useScene } from "../lib/scene";
import { pulse } from "../art/Backdrop";

/** Compact button for the navbar: shows the current scene and steps to the next one. */
export function SceneButton() {
  const scene = useScene();
  const index = SCENES.findIndex((s) => s.id === scene);
  return (
    <button
      onClick={() => {
        cycleScene(1);
        pulse();
      }}
      className="label flex items-center gap-2 py-1 hover:text-accent"
      title="Change the background scene"
      aria-label={`Background scene: ${sceneName(scene)}. Activate to switch to the next scene.`}
    >
      <span className="flex gap-1" aria-hidden>
        {SCENES.map((s, i) => (
          <span key={s.id} className={`h-1.5 w-1.5 ${i === index ? "bg-accent" : "bg-current opacity-30"}`} />
        ))}
      </span>
      <span className="hidden sm:inline">{sceneName(scene)}</span>
    </button>
  );
}

/** Full row of scene tabs, shown at the bottom of the hero. */
export function SceneTabs() {
  const scene = useScene();
  return (
    <div role="tablist" aria-label="Background scene" className="flex flex-wrap gap-x-5 gap-y-1">
      {SCENES.map((s, i) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={s.id === scene}
          title={s.blurb}
          onClick={() => applyScene(s.id)}
          className={`label flex items-baseline gap-2 py-1 transition-colors ${s.id === scene ? "text-text" : "text-muted hover:text-text"}`}
        >
          <span className={s.id === scene ? "text-accent" : ""}>{s.id === scene ? "■" : "□"}</span>
          <span className="sr-only">Scene {i + 1}:</span>
          {s.name}
        </button>
      ))}
    </div>
  );
}
