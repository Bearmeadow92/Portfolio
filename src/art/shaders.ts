/**
 * @file GLSL fragment shaders for the generative backdrop.
 *
 * Each scene is one fragment shader that runs once per pixel on the GPU. The CPU does
 * almost nothing per frame (it uploads a handful of uniforms and draws one triangle),
 * which is why a full-screen animation can hold 60 fps.
 *
 * Shared uniforms
 *   u_res     Drawing buffer size in pixels.
 *   u_time    Seconds since start.
 *   u_mouse   Smoothed pointer position in pixels, origin at the bottom left.
 *   u_dim     Art intensity: 1 in the hero, lower behind text so content stays readable.
 *   u_pulse   A short kick (1 fading to 0) fired by UI events like clicks.
 *   u_bg, u_ink, u_accent   The active scene's palette, read from CSS variables.
 */
import type { SceneId } from "../lib/scene";

/** One oversized triangle that covers the screen. Cheaper than a quad (no diagonal seam). */
export const VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

/** Declarations and noise helpers shared by every scene. */
const COMMON = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_dim;
uniform float u_pulse;
uniform vec3 u_bg;
uniform vec3 u_ink;
uniform vec3 u_accent;
out vec4 outColor;

// Cheap hash: maps a 2D point to a pseudo random number in [0, 1).
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Value noise: random values on a grid, smoothly interpolated between grid points.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Fractal Brownian motion: four octaves of noise layered at doubling frequencies.
// The rotation between octaves hides the grid the noise is built on.
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = rot * p * 2.0 + 7.3;
    amplitude *= 0.5;
  }
  return value;
}

// Pixel coordinates to aspect-correct coordinates centered on the screen (height = 1).
vec2 toUv(vec2 frag) {
  return (frag - 0.5 * u_res) / u_res.y;
}
`;

/** Contour: iso-lines of a drifting height field, like a living topographic map. */
const CONTOUR = `
void main() {
  vec2 uv = toUv(gl_FragCoord.xy);
  vec2 toMouse = uv - toUv(u_mouse);
  float t = u_time * 0.035;

  // Height field, plus a hill that follows the cursor.
  float height = fbm(uv * 1.5 + vec2(t, -t * 0.7));
  height += 0.22 * exp(-dot(toMouse, toMouse) * 7.0) + u_pulse * 0.04;

  // Draw a line wherever the height crosses a whole number of levels.
  // fwidth() gives the per-pixel rate of change, which keeps every line one pixel wide.
  float level = height * 18.0;
  float nearest = floor(level + 0.5);
  float width = fwidth(level);
  float line = 1.0 - smoothstep(width * 0.6, width * 1.6, abs(level - nearest));

  float major = mod(nearest, 5.0) < 0.5 ? 1.0 : 0.0; // Every fifth line is bolder.
  vec3 color = mix(u_bg, u_ink, line * mix(0.2, 0.55, major) * u_dim);

  float highlighted = abs(nearest - 11.0) < 0.5 ? 1.0 : 0.0; // One level is drawn in the accent.
  color = mix(color, u_accent, line * highlighted * u_dim * 0.9);
  outColor = vec4(color, 1.0);
}`;

/** Halftone: a grid of dots whose size follows a slow wave and swells near the cursor. */
const HALFTONE = `
void main() {
  float cell = max(18.0, u_res.y / 34.0);
  vec2 grid = gl_FragCoord.xy / cell;
  vec2 offset = fract(grid) - 0.5;                       // Position inside this cell.
  vec2 center = toUv((floor(grid) + 0.5) * cell);        // This dot's center on screen.
  vec2 toMouse = center - toUv(u_mouse);

  float n = fbm(center * 1.4 + vec2(u_time * 0.05, u_time * 0.03));
  float wave = 0.5 + 0.5 * sin(center.x * 4.0 - center.y * 2.5 + n * 7.0 + u_time * 0.5);
  float near = exp(-dot(toMouse, toMouse) * 9.0);

  float radius = 0.045 + 0.3 * wave * smoothstep(0.3, 0.75, n) + 0.2 * near + 0.06 * u_pulse;
  float edge = 1.2 / cell;                               // One pixel of anti-aliasing.
  float dot_ = 1.0 - smoothstep(radius - edge, radius + edge, length(offset));

  vec3 dotColor = mix(u_ink, u_accent, smoothstep(0.15, 0.6, near));
  // Dots under the cursor glow at full strength in the hero, and more gently behind text.
  float strength = mix(0.24 * u_dim, 0.45 + 0.55 * u_dim, near);
  outColor = vec4(mix(u_bg, dotColor, dot_ * strength), 1.0);
}`;

/** Ripple: rings spreading from the cursor and two drifting sources, drawn where the waves cancel out. */
const RIPPLE = `
void main() {
  vec2 uv = toUv(gl_FragCoord.xy);
  vec2 mouse = toUv(u_mouse);

  // Two sources wander slowly on their own. The cursor is the third.
  vec2 a = vec2(0.62 * cos(u_time * 0.07), 0.3 * sin(u_time * 0.09));
  vec2 b = vec2(-0.66 * cos(u_time * 0.05 + 1.0), 0.36 * sin(u_time * 0.06 + 2.0));
  float dm = length(uv - mouse);

  // Sum the three waves. Where they overlap they interfere, which creates the pattern.
  float wave = sin(dm * 40.0 - u_time * 1.3) * exp(-dm * 1.5) * 1.3;
  wave += sin(length(uv - a) * 27.0 - u_time * 0.7) * 0.6;
  wave += sin(length(uv - b) * 23.0 - u_time * 0.55) * 0.6;
  wave += u_pulse * 0.5 * sin(dm * 18.0 - u_time * 6.0);

  // Draw a one pixel line wherever the combined wave crosses zero.
  float width = fwidth(wave);
  float line = 1.0 - smoothstep(width * 0.7, width * 1.8, abs(wave));

  vec3 color = mix(u_bg, u_ink, line * 0.3 * u_dim);
  color = mix(color, u_accent, line * exp(-dm * 2.4) * min(1.0, u_dim * 1.2)); // Gold near the cursor.
  outColor = vec4(color, 1.0);
}`;

/** Signal: stacked horizontal lines displaced by noise, like ridgelines of a waveform. */
const SIGNAL = `
float ridge(vec2 p) {
  return noise(p) * 0.65 + noise(p * 2.1 + 3.1) * 0.35;
}

void main() {
  vec2 uv = toUv(gl_FragCoord.xy);
  vec2 mouse = toUv(u_mouse);
  float spacing = 0.042;
  float pixel = 1.0 / u_res.y;
  float row = floor(uv.y / spacing);

  // A line can be displaced into this pixel from a few rows away, so test the neighbors.
  float line = 0.0;
  float hot = 0.0;
  for (int i = -3; i <= 3; i++) {
    float k = row + float(i);
    float baseY = k * spacing;
    float n = ridge(vec2(uv.x * 1.7 + u_time * 0.06, k * 0.21 - u_time * 0.04));
    float dx = uv.x - mouse.x;
    float dy = baseY - mouse.y;
    float bump = exp(-dx * dx * 10.0 - dy * dy * 14.0);  // Lines bulge toward the cursor.
    float y = baseY + (n - 0.5) * 0.2 + bump * 0.07 + u_pulse * 0.012 * sin(k * 1.7);
    float l = 1.0 - smoothstep(pixel * 0.7, pixel * 2.0, abs(uv.y - y));
    line = max(line, l);
    hot = max(hot, l * bump);
  }

  vec3 color = mix(u_bg, u_ink, line * 0.5 * u_dim);
  color = mix(color, u_accent, clamp(hot * 1.6, 0.0, 1.0) * (0.45 + 0.55 * u_dim));
  outColor = vec4(color, 1.0);
}`;

/** Complete fragment shader source for each scene. */
export const FRAGMENT_SHADERS: Record<SceneId, string> = {
  contour: COMMON + CONTOUR,
  halftone: COMMON + HALFTONE,
  ripple: COMMON + RIPPLE,
  signal: COMMON + SIGNAL,
};
