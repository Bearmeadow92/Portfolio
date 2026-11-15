/**
 * @file Mute and unmute button for the synthesized sound effects.
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
      className="chip hover:text-text"
      aria-pressed={!muted}
      title={muted ? "Unmute sound effects" : "Mute sound effects"}
    >
      {muted ? "🔇" : "🔊"}
      <span className="sr-only">{muted ? "Sound off" : "Sound on"}</span>
    </button>
  );
}
