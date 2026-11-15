/**
 * @file Mute and unmute control for the synthesized sound effects.
 */
import { setMuted, sfx, useMuted } from "../lib/sound";

/** Toggles the global mute flag. Plays a click when unmuting, as instant confirmation. */
export function SoundToggle() {
  const muted = useMuted();
  return (
    <button
      onClick={() => {
        setMuted(!muted);
        if (muted) sfx.click();
      }}
      className="label py-1 hover:text-accent"
      aria-pressed={!muted}
      title={muted ? "Unmute sound effects" : "Mute sound effects"}
    >
      Sound {muted ? "off" : "on"}
    </button>
  );
}
