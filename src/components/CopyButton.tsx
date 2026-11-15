/**
 * @file Copy to clipboard button with brief "Copied" feedback.
 */
import { useState } from "react";

/** Copies text with the async Clipboard API and shows brief feedback. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked, nothing to do */
    }
  };

  return (
    <button type="button" onClick={copy} disabled={!text} className="chip shrink-0 hover:border-accent hover:text-accent disabled:opacity-40">
      {copied ? "✓ Copied" : label}
    </button>
  );
}
