/**
 * @file Color parsing for shader uniforms.
 *
 * Kept in its own DOM-free module so it can be unit tested. This exists because of a
 * real bug: the production CSS minifier rewrites colors like `#ff4433` as `#f43`, and a
 * parser that only understood six digits read that as the dark navy `#000f43`.
 */

export type Vec3 = [number, number, number];

/**
 * Parses a CSS hex color (#rgb, #rgba, #rrggbb, or #rrggbbaa) into three 0..1 channels.
 * Alpha is ignored, since the backdrop is always opaque. Returns black for anything else,
 * so a bad value can never crash the render loop.
 */
export function hexToVec3(input: string): Vec3 {
  let hex = input.trim().replace(/^#/, "");
  // Short forms double each digit: "f43" -> "ff4433", "f43a" -> "ff4433aa".
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return [0, 0, 0];
  const n = parseInt(hex.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
