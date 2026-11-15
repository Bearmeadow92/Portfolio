/**
 * @file Encoders, decoders, and hashing. All of it runs locally in the browser.
 * Text is converted with TextEncoder so emoji and non-Latin characters round-trip correctly.
 */

const enc = new TextEncoder();
const dec = new TextDecoder("utf-8", { fatal: true });

/** Encodes text as Base64. Goes through UTF-8 bytes first, so emoji and accents survive. O(n). */
export function toBase64(text: string): string {
  let bin = "";
  for (const byte of enc.encode(text)) bin += String.fromCharCode(byte);
  return btoa(bin);
}

/** Decodes Base64 back to text. Throws on malformed input or invalid UTF-8. O(n). */
export function fromBase64(b64: string): string {
  const bin = atob(b64.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return dec.decode(bytes);
}

/** Text to space separated hex bytes, such as "68 69". O(n). */
export function toHex(text: string): string {
  return Array.from(enc.encode(text), (b) => b.toString(16).padStart(2, "0")).join(" ");
}

/** Hex to text. Ignores spaces and other separators. Throws on an odd number of digits. O(n). */
export function fromHex(hex: string): string {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  if (clean.length % 2 !== 0) throw new Error("Hex input must have an even number of digits.");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return dec.decode(bytes);
}

/** Text to space separated 8-bit binary groups. O(n). */
export function toBinaryString(text: string): string {
  return Array.from(enc.encode(text), (b) => b.toString(2).padStart(8, "0")).join(" ");
}

/** Binary groups back to text. Throws if any group is not made of 0s and 1s. O(n). */
export function fromBinaryString(bin: string): string {
  const groups = bin.trim().split(/\s+/).filter(Boolean);
  if (groups.some((g) => !/^[01]{1,8}$/.test(g))) throw new Error("Binary input must be groups of 0s and 1s.");
  return dec.decode(Uint8Array.from(groups, (g) => parseInt(g, 2)));
}

/** ROT13 is its own inverse, so one function both encodes and decodes. */
export function rot13(text: string): string {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

export type HashAlgo = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

/** Hash via the native Web Crypto API (SubtleCrypto), which is fast and constant memory. */
export async function hash(text: string, algo: HashAlgo): Promise<string> {
  const digest = await crypto.subtle.digest(algo, enc.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type Codec = "base64" | "hex" | "binary" | "url" | "rot13";

/** Every reversible codec, keyed by id, so the UI can list them without a switch statement. */
export const codecs: Record<Codec, { label: string; encode: (s: string) => string; decode: (s: string) => string }> = {
  base64: { label: "Base64", encode: toBase64, decode: fromBase64 },
  hex: { label: "Hex", encode: toHex, decode: fromHex },
  binary: { label: "Binary", encode: toBinaryString, decode: fromBinaryString },
  url: { label: "URL", encode: encodeURIComponent, decode: decodeURIComponent },
  rot13: { label: "ROT13", encode: rot13, decode: rot13 },
};
