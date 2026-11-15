/**
 * @file Crypto Kit: hashing plus encoders and decoders.
 * All logic lives in lib/encoding.ts. This file is the UI.
 */
import { useEffect, useState } from "react";
import { codecs, hash, type Codec, type HashAlgo } from "../lib/encoding";
import { CopyButton } from "../components/CopyButton";

const ALGOS: HashAlgo[] = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

/** A pocket CyberChef: hashing via SubtleCrypto plus common encoders and decoders. */
export default function CryptoKit() {
  const [tab, setTab] = useState<"hash" | "encode">("hash");
  const [input, setInput] = useState("Hello, world!");
  const [hashes, setHashes] = useState<Partial<Record<HashAlgo, string>>>({});
  const [codec, setCodec] = useState<Codec>("base64");
  const [mode, setMode] = useState<"encode" | "decode">("encode");

  // Recompute hashes whenever the input changes. The `cancelled` flag drops stale async results.
  useEffect(() => {
    if (tab !== "hash") return;
    let cancelled = false;
    Promise.all(ALGOS.map(async (a) => [a, await hash(input, a)] as const)).then((entries) => {
      if (!cancelled) setHashes(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [input, tab]);

  // Encoding is synchronous and cheap, so it is derived during render instead of stored in state.
  let output = "";
  let error = "";
  if (tab === "encode") {
    try {
      output = codecs[codec][mode](input);
    } catch (e) {
      error = e instanceof Error ? e.message : "Could not decode that input.";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {(["hash", "encode"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`chip ${tab === t ? "border-accent text-accent" : ""}`}>
            {t === "hash" ? "# Hash" : "⇄ Encode / Decode"}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="ck-input" className="mb-1 block text-sm text-muted">Input</label>
        <textarea id="ck-input" className="input min-h-24 resize-y" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
      </div>

      {tab === "hash" ? (
        <div className="space-y-2">
          {ALGOS.map((a) => (
            <div key={a} className="panel flex items-center gap-3 p-3">
              <span className="w-16 shrink-0 font-mono text-xs text-accent">{a}</span>
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-text/90">{hashes[a] ?? "…"}</code>
              <CopyButton text={hashes[a] ?? ""} />
            </div>
          ))}
          <p className="text-xs text-muted">Hashing is one way. Change a single character and the whole digest changes (the avalanche effect).</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(codecs) as Codec[]).map((c) => (
              <button key={c} onClick={() => setCodec(c)} aria-pressed={codec === c} className={`chip ${codec === c ? "border-accent text-accent" : ""}`}>
                {codecs[c].label}
              </button>
            ))}
            <span className="mx-1 text-border">|</span>
            {(["encode", "decode"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`chip capitalize ${mode === m ? "border-accent-2 text-accent-2" : ""}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="panel p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-muted">Output</span>
              <div className="flex gap-2">
                <button className="chip hover:text-text" disabled={!output} onClick={() => { setInput(output); setMode(mode === "encode" ? "decode" : "encode"); }}>
                  ↻ Swap
                </button>
                <CopyButton text={output} />
              </div>
            </div>
            {error ? (
              <p className="font-mono text-sm text-bad" role="alert">{error}</p>
            ) : (
              <code className="block break-all font-mono text-sm text-text/90">{output || "…"}</code>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
