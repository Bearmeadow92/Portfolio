import { setMuted, sfx, useMuted } from "../lib/sound";

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
