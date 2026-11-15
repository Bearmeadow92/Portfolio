import { useMemo, useState } from "react";
import { calculateSubnet } from "../lib/subnet";
import { CopyButton } from "../components/CopyButton";

const PRESETS = ["192.168.1.42/24", "10.0.0.0/8", "172.16.20.5/20", "8.8.8.8/32", "100.64.3.7/10"];

/** IPv4 subnet calculator for network admins, students, and anyone studying for Network+. */
export default function SubnetCalc() {
  const [input, setInput] = useState("192.168.1.42/24");
  const result = useMemo(() => calculateSubnet(input), [input]);
  const cidr = result?.cidr ?? 24;

  const setCidr = (c: number) => setInput(`${input.split("/")[0]}/${c}`);

  const rows = result
    ? [
        ["Network address", result.network],
        ["Broadcast address", result.broadcast],
        ["Subnet mask", result.mask],
        ["Wildcard mask", result.wildcard],
        ["First usable host", result.firstHost],
        ["Last usable host", result.lastHost],
        ["Total addresses", result.totalAddresses.toLocaleString()],
        ["Usable hosts", result.usableHosts.toLocaleString()],
        ["Class", result.ipClass],
        ["Scope", result.scope],
      ]
    : [];

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="subnet-input" className="mb-1 block text-sm text-muted">IPv4 address with CIDR</label>
        <input
          id="subnet-input"
          className={`input ${result ? "" : "border-bad"}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          aria-invalid={!result}
        />
        {!result && <p className="mt-1 text-sm text-bad" role="alert">Enter something like 192.168.1.10/24</p>}
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-muted">/{cidr}</span>
        <input type="range" min={0} max={32} value={cidr} onChange={(e) => setCidr(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" aria-label="CIDR prefix length" />
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p} className="chip hover:border-accent hover:text-accent" onClick={() => setInput(p)}>
            {p}
          </button>
        ))}
      </div>

      {result && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="panel flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-xs text-muted">{k}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  {v}
                  {/\d+\.\d+\.\d+\.\d+/.test(v!) && <CopyButton text={v!} label="⧉" />}
                </span>
              </div>
            ))}
          </div>
          <div className="panel overflow-x-auto p-3 font-mono text-xs">
            <div className="text-muted">Binary view (network bits highlighted)</div>
            <BinaryRow label="IP  " bits={result.binaryIp} cidr={cidr} />
            <BinaryRow label="MASK" bits={result.binaryMask} cidr={cidr} />
          </div>
        </>
      )}
    </div>
  );
}

/** Highlights the first `cidr` bits (the network portion) of a dotted binary string. */
function BinaryRow({ label, bits, cidr }: { label: string; bits: string; cidr: number }) {
  let count = 0;
  return (
    <div className="mt-1 whitespace-pre">
      <span className="text-muted">{label} </span>
      {bits.split("").map((ch, i) => {
        if (ch === ".") return <span key={i} className="text-muted">.</span>;
        const isNet = count++ < cidr;
        return <span key={i} className={isNet ? "text-accent" : "text-accent-2"}>{ch}</span>;
      })}
    </div>
  );
}
