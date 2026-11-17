/**
 * @file GLSL fragment shaders for the generative backdrop.
 *
 * Each scene is one fragment shader that runs once per pixel on the GPU. The CPU does
 * almost nothing per frame (it uploads a handful of uniforms and draws one triangle),
 * which is why a full-screen animation can hold 60 fps.
 *
 * Scenes
 *   Breach      A live attack map: a node graph carrying packets, with the cursor as a sensor.
 *   Glyph       A raymarched 3D sculpture, rendered as text characters from a bitmap font.
 *   Drivetrain  Meshing gears, a crankshaft and a piston, drawn as precise linework.
 *   Chrome      A raymarched liquid metal sculpture with studio lighting.
 *
 * Shared uniforms
 *   u_res     Drawing buffer size in pixels.
 *   u_time    Seconds since start.
 *   u_mouse   Smoothed pointer position in pixels, origin at the bottom left.
 *   u_dim     Art intensity: 1 in the hero, lower behind text so content stays readable.
 *   u_pulse   A short kick (1 fading to 0) fired by UI events like clicks.
 *   u_clear   How strongly the art steps back behind the hero's text column (0 to 1).
 *   u_bg, u_ink, u_accent   The active scene's palette, read from CSS variables.
 */
import type { SceneId } from "../lib/scene";

/** One oversized triangle that covers the screen. Cheaper than a quad (no diagonal seam). */
export const VERTEX_SHADER = `#version 300 es
in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

/** Declarations and helpers shared by every scene. */
const COMMON = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_dim;
uniform float u_pulse;
uniform float u_clear;
uniform vec3 u_bg;
uniform vec3 u_ink;
uniform vec3 u_accent;
out vec4 outColor;

const float PI = 3.14159265;

// Cheap hash: maps a 2D point to a pseudo random number in [0, 1).
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 2D rotation matrix.
mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// Distance from p to the line segment ab.
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}

// Smooth minimum: blends two distance fields so shapes melt into each other.
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// How present the art should be at this pixel. Starts from u_dim (scroll based), then,
// while u_clear is up, fades the left side where the hero copy sits. On portrait screens
// the copy spans the full width, so the whole canvas steps back evenly instead.
float presence() {
  float x = gl_FragCoord.x / u_res.x;
  float portrait = step(u_res.x, u_res.y);
  float side = mix(1.0 - 0.72 * (1.0 - smoothstep(0.28, 0.82, x)), 0.5, portrait);
  return u_dim * mix(1.0, side, u_clear);
}

// Pixel coordinates to aspect-correct coordinates centered on the screen (height = 1).
vec2 toUv(vec2 frag) {
  return (frag - 0.5 * u_res) / u_res.y;
}

// Where the art's focal object sits: right of center on wide screens (the hero copy is on
// the left), and lower center on portrait screens.
vec2 focus() {
  return u_res.x > u_res.y ? vec2(0.4 * u_res.x / u_res.y - 0.18, 0.0) : vec2(0.0, -0.18);
}

// One-pixel anti-aliased line from a distance value.
float stroke(float d, float px) {
  return 1.0 - smoothstep(px * 0.5, px * 1.5, abs(d));
}
`;

/* -------------------------------------------------------------------------- */
/*                                   Breach                                   */
/* -------------------------------------------------------------------------- */

/**
 * A live attack map. Nodes sit on a jittered grid and links join neighbors. Packets
 * travel along the links. About one link in five carries hostile traffic, drawn red.
 * The cursor is a sensor: links and nodes in range light up, and hostile packets in
 * range get a lock-on ring. A click fires a probe ring outward from the cursor.
 *
 * Per pixel, only the 3x3 neighborhood of grid cells is checked (27 links at most),
 * so the cost is constant no matter how large the map is.
 */
const BREACH = `
const float SP = 0.15; // Grid spacing between nodes.

vec2 nodePos(vec2 cell) {
  return (cell + 0.2 + 0.6 * vec2(hash(cell), hash(cell + 17.3))) * SP;
}

void main() {
  float pres = presence();
  float px = 1.0 / u_res.y;
  vec2 drift = vec2(u_time * 0.01, u_time * 0.004);
  vec2 q = toUv(gl_FragCoord.xy) + drift;
  vec2 m = toUv(u_mouse) + drift;
  float sense = 0.3;
  float near = exp(-pow(length(q - m) / sense, 2.0) * 2.0); // 1 at the cursor, fading out.

  float links = 0.0;   // Ordinary link lines.
  float hostileLinks = 0.0;
  float packets = 0.0; // Normal packet dots.
  float threats = 0.0; // Hostile packet dots and trails.
  float locks = 0.0;   // Lock-on rings around hostile packets near the cursor.
  float nodes = 0.0;

  vec2 cell = floor(q / SP);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 k = cell + vec2(float(i), float(j));
      vec2 a = nodePos(k);

      // Nodes: a dot, and a ring around the rare hub nodes.
      float hub = step(hash(k + 31.7), 0.1);
      float dn = length(q - a);
      nodes = max(nodes, 1.0 - smoothstep(0.0035, 0.0035 + px, dn));
      nodes = max(nodes, hub * stroke(dn - 0.012, px));

      // Up to three links per node: right, up, and sometimes diagonal.
      for (int e = 0; e < 3; e++) {
        vec2 dir = e == 0 ? vec2(1.0, 0.0) : e == 1 ? vec2(0.0, 1.0) : vec2(1.0, 1.0);
        vec2 id = k * 3.0 + float(e);
        float keep = e == 2 ? 0.22 : 0.72;
        if (hash(id + 3.1) > keep) continue;
        vec2 b = nodePos(k + dir);
        float hostile = step(hash(id + 8.4), 0.2);
        float l = stroke(sdSegment(q, a, b), px);
        links = max(links, l * (1.0 - hostile));
        hostileLinks = max(hostileLinks, l * hostile);

        // One packet per link, at its own speed and direction.
        float speed = 0.12 + 0.25 * hash(id + 5.5);
        float t = fract(u_time * speed + hash(id));
        if (hash(id + 2.2) > 0.5) t = 1.0 - t;
        vec2 p = mix(a, b, t);
        float dp = length(q - p);
        float dot_ = 1.0 - smoothstep(0.0028, 0.0028 + px, dp);
        if (hostile > 0.5) {
          // Hostile packets drag a short trail behind them.
          vec2 tail = mix(a, b, clamp(t + (hash(id + 2.2) > 0.5 ? 0.12 : -0.12), 0.0, 1.0));
          float trail = stroke(sdSegment(q, tail, p), px * 1.6) * 0.6;
          threats = max(threats, max(dot_, trail));
          float inRange = step(length(p - m), sense);
          locks = max(locks, inRange * stroke(dp - 0.014, px));
        } else {
          packets = max(packets, dot_);
        }
      }
    }
  }

  // A slow scan line sweeps across the map and briefly lights what it passes.
  float scanX = (fract(u_time * 0.035) - 0.5) * 2.4 * u_res.x / u_res.y;
  float scan = exp(-abs(toUv(gl_FragCoord.xy).x - scanX) * 40.0);

  // The sensor ring around the cursor, and the probe ring fired by clicks.
  float sensor = stroke(length(q - m) - sense, px) * (0.5 + 0.5 * step(0.5, fract(atan(q.y - m.y, q.x - m.x) * 12.0 / PI + u_time * 0.3)));
  float probe = u_pulse * stroke(length(q - m) - (1.0 - u_pulse) * 1.1, px * 2.0);

  float lift = 0.14 + 0.5 * near + 0.25 * scan;
  vec3 color = u_bg;
  color = mix(color, u_ink, links * lift * pres);
  color = mix(color, u_accent, hostileLinks * (0.38 + 0.5 * near) * pres);
  color = mix(color, u_ink, nodes * (0.35 + 0.65 * near) * pres);
  color = mix(color, u_ink, packets * (0.55 + 0.45 * near) * pres);
  color = mix(color, u_accent, threats * (0.75 + 0.25 * near) * max(pres, 0.35));
  color = mix(color, u_accent, locks * 0.95);
  color = mix(color, u_ink, sensor * 0.35 * pres);
  color = mix(color, u_accent, probe * 0.8);
  outColor = vec4(color, 1.0);
}`;

/* -------------------------------------------------------------------------- */
/*                                    Glyph                                   */
/* -------------------------------------------------------------------------- */

/**
 * A 3D sculpture (a torus with a sphere orbiting through it) is raymarched once per
 * character cell. The lit brightness picks one of ten glyphs, from " " (dark) to "@"
 * (bright), and the glyph is drawn from a 5x7 bitmap font stored in two int arrays.
 * The light follows the cursor, and the brightest highlights switch to the accent color.
 */
const GLYPH = `
// Ten glyphs, dark to bright: " .:-=+*#%@". Each 5x7 bitmap is split into its top four
// rows (20 bits) and bottom three rows (15 bits), because 35 bits do not fit in one int.
const int TOP[10] = int[10](0, 0, 128, 458752, 31744, 1020032, 1030816, 359754, 139635, 718382);
const int BOT[10] = int[10](0, 128, 128, 0, 31, 132, 686, 10591, 26434, 30781);

// Is the pixel at column c, row r (row 0 at the top) of glyph g lit?
float glyphBit(int g, int c, int r) {
  int bits = r < 4 ? TOP[g] : BOT[g];
  int index = (r < 4 ? r : r - 4) * 5 + c;
  return float((bits >> index) & 1);
}

float sdTorus(vec3 p, vec2 t) {
  return length(vec2(length(p.xz) - t.x, p.y)) - t.y;
}

float scene(vec3 p) {
  float t = u_time * 0.5;
  vec3 q = p;
  q.yz = rot(0.9 + sin(t * 0.3) * 0.2) * q.yz;
  q.xz = rot(t * 0.6) * q.xz;
  float torus = sdTorus(q, vec2(0.95, 0.34));
  vec3 orbit = vec3(0.0, sin(t * 1.3) * 1.1, 0.0);
  orbit.xz = rot(t * 0.6) * vec2(0.95, 0.0);
  return smin(torus, length(q - orbit) - 0.32, 0.3);
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.002, -0.002);
  return normalize(e.xyy * scene(p + e.xyy) + e.yyx * scene(p + e.yyx) + e.yxy * scene(p + e.yxy) + e.xxx * scene(p + e.xxx));
}

void main() {
  float pres = presence();
  float cellH = max(11.0, floor(u_res.y / 54.0));
  float cellW = floor(cellH * 0.66);
  vec2 cellId = floor(gl_FragCoord.xy / vec2(cellW, cellH));
  vec2 local = fract(gl_FragCoord.xy / vec2(cellW, cellH));
  vec2 center = (cellId + 0.5) * vec2(cellW, cellH);

  // Raymarch from this cell's center (every pixel in a cell shares one sample).
  vec2 uv = toUv(center) - focus();
  vec3 ro = vec3(0.0, 0.0, -5.0);
  vec3 rd = normalize(vec3(uv * 1.15, 1.6));
  float dist = 0.0;
  float hit = 0.0;
  for (int i = 0; i < 48; i++) {
    float d = scene(ro + rd * dist);
    if (d < 0.002) { hit = 1.0; break; }
    dist += d;
    if (dist > 8.5) break;
  }

  float lum = 0.0;
  float spec = 0.0;
  if (hit > 0.5) {
    vec3 p = ro + rd * dist;
    vec3 n = normalAt(p);
    vec2 m = toUv(u_mouse) - focus();
    vec3 light = normalize(vec3(m * 2.6, -1.4)); // The light comes from the cursor.
    float diffuse = max(dot(n, light), 0.0);
    spec = pow(max(dot(reflect(-light, n), -rd), 0.0), 18.0);
    lum = 0.08 + 0.82 * diffuse + 0.3 * spec;
  } else if (hash(cellId) < 0.035) {
    lum = 0.11; // A sparse field of dots in the empty space.
  }

  // A click scrambles a ring of glyphs spreading outward.
  float ring = u_pulse * exp(-abs(length(toUv(center) - toUv(u_mouse)) - (1.0 - u_pulse) * 1.2) * 30.0);
  lum = clamp(lum + ring * hash(cellId + floor(u_time * 20.0)), 0.0, 0.999);

  int g = int(lum * 10.0);
  int c = int(local.x * 6.0);       // Columns 0-4 are the glyph, column 5 is spacing.
  int r = 7 - int(local.y * 8.0) - 1; // Rows 0-6 are the glyph (top first), one row of spacing.
  float on = (c < 5 && r >= 0 && r < 7) ? glyphBit(g, c, r) : 0.0;

  vec3 ink = mix(u_ink, u_accent, step(0.55, spec) + step(0.2, ring));
  outColor = vec4(mix(u_bg, ink, on * mix(0.25, 1.0, step(0.5, hit)) * pres), 1.0);
}`;

/* -------------------------------------------------------------------------- */
/*                                 Drivetrain                                 */
/* -------------------------------------------------------------------------- */

/**
 * A drivetrain drawn as blueprint linework: three meshing gears, and a slider crank
 * (crank pin, connecting rod, piston, cylinder) driven by the big gear. Moving the
 * cursor across the screen turns the crank, and the gear ratios are exact, so the teeth
 * stay meshed. Distances are computed analytically (no raymarching), so this is cheap.
 */
const DRIVETRAIN = `
// Outline distance for a gear: a circle whose radius bumps up for each tooth.
float gearShape(vec2 p, float radius, float teeth, float angle) {
  p = rot(angle) * p;
  float a = atan(p.y, p.x);
  float tooth = clamp(cos(a * teeth) * 2.4, -1.0, 1.0);
  return length(p) - (radius + tooth * 0.018);
}

// All the linework for one gear: outline, rim, hub, bore, and spokes.
float gear(vec2 p, vec2 c, float radius, float teeth, float angle, float px) {
  vec2 d = p - c;
  float len = length(d);
  float lines = stroke(gearShape(d, radius, teeth, angle), px);
  lines = max(lines, stroke(len - radius * 0.72, px));
  lines = max(lines, stroke(len - radius * 0.24, px));
  lines = max(lines, stroke(len - radius * 0.09, px));
  // Five spokes between hub and rim, found with a polar repeat.
  float a = atan(d.y, d.x) - angle;
  float sector = 2.0 * PI / 5.0;
  float local = mod(a + sector * 0.5, sector) - sector * 0.5;
  float spoke = abs(len * sin(local)) - radius * 0.05;
  float inBand = step(radius * 0.24, len) * step(len, radius * 0.72);
  lines = max(lines, stroke(spoke, px) * inBand);
  return lines;
}

// Outline of an axis aligned box centered at c with half size h.
float boxOutline(vec2 p, vec2 c, vec2 h, float px) {
  vec2 d = abs(p - c) - h;
  return stroke(length(max(d, 0.0)) + min(max(d.x, d.y), 0.0), px);
}

void main() {
  float pres = presence();
  float px = 1.0 / u_res.y;
  float portrait = step(u_res.x, u_res.y);
  float scale = mix(0.8, 0.62, portrait);
  vec2 uv = (toUv(gl_FragCoord.xy) - focus()) / scale;
  vec2 m = toUv(u_mouse) / scale;
  px /= scale;

  // Blueprint grid: minor and major lines.
  vec2 g = abs(fract(uv / 0.05 + 0.5) - 0.5) * 0.05;
  vec2 G = abs(fract(uv / 0.25 + 0.5) - 0.5) * 0.25;
  float grid = max(stroke(min(g.x, g.y), px) * 0.35, stroke(min(G.x, G.y), px) * 0.7);

  // Gear train. Radii are proportional to tooth counts, so the pitch circles roll exactly.
  const float NA = 24.0;
  const float NB = 12.0;
  const float NC = 8.0;
  const float RA = 0.3;
  const float RB = RA * NB / NA;
  const float RC = RA * NC / NA;
  vec2 A = vec2(0.02, -0.3);
  vec2 B = A + vec2(cos(3.6), sin(3.6)) * (RA + RB);
  vec2 C = B + vec2(cos(2.0), sin(2.0)) * (RB + RC);

  float angA = u_time * 0.35 + m.x * 3.2 + u_pulse * 0.4; // The cursor turns the crank.
  float angB = -angA * NA / NB + PI / NB;
  float angC = -angB * NB / NC + PI / NC;

  float lines = gear(uv, A, RA, NA, angA, px);
  lines = max(lines, gear(uv, B, RB, NB, angB, px));
  lines = max(lines, gear(uv, C, RC, NC, angC, px));

  // Slider crank: the pin rides on gear A, the rod pushes a piston up a cylinder.
  float crank = RA * 0.55;
  float rodLength = 0.48;
  vec2 pin = A + crank * vec2(cos(-angA), sin(-angA));
  float pistonY = A.y + crank * sin(-angA) + sqrt(rodLength * rodLength - pow(crank * cos(-angA), 2.0));
  vec2 piston = vec2(A.x, pistonY);
  float accentLines = stroke(sdSegment(uv, pin, piston), px * 1.6);
  accentLines = max(accentLines, stroke(length(uv - pin) - 0.016, px));
  accentLines = max(accentLines, stroke(length(uv - piston) - 0.012, px));
  lines = max(lines, boxOutline(uv, piston + vec2(0.0, 0.05), vec2(0.075, 0.06), px));

  // Cylinder walls and head.
  float top = A.y + rodLength + crank + 0.12;
  float bottom = A.y + rodLength - crank - 0.02;
  float walls = min(sdSegment(uv, vec2(A.x - 0.085, bottom), vec2(A.x - 0.085, top)), sdSegment(uv, vec2(A.x + 0.085, bottom), vec2(A.x + 0.085, top)));
  lines = max(lines, stroke(walls, px));
  lines = max(lines, stroke(sdSegment(uv, vec2(A.x - 0.11, top), vec2(A.x + 0.11, top)), px));

  // Dashed center lines through each shaft, like a technical drawing.
  float dash = step(0.5, fract((uv.x + uv.y) * 22.0));
  float centers = 0.0;
  centers = max(centers, stroke(uv.y - A.y, px) * step(abs(uv.x - A.x), RA + 0.08));
  centers = max(centers, stroke(uv.x - A.x, px) * step(abs(uv.y - A.y), RA + 0.08));
  centers = max(centers, stroke(uv.y - B.y, px) * step(abs(uv.x - B.x), RB + 0.06));
  centers = max(centers, stroke(uv.x - C.x, px) * step(abs(uv.y - C.y), RC + 0.06));

  vec3 color = u_bg;
  color = mix(color, u_ink, grid * 0.1 * pres);
  color = mix(color, u_ink, centers * dash * 0.45 * pres);
  color = mix(color, u_ink, lines * 0.9 * pres);
  color = mix(color, u_accent, accentLines * min(1.0, pres * 1.3));
  outColor = vec4(color, 1.0);
}`;

/* -------------------------------------------------------------------------- */
/*                                   Chrome                                   */
/* -------------------------------------------------------------------------- */

/**
 * A raymarched liquid metal sculpture: a torus with three spheres orbiting and melting
 * into it (smooth minimum). Shading is a reflection of a procedural studio: a dark
 * gradient, a white overhead softbox, and a colored rim light from the side. The cursor
 * orbits the camera.
 */
const CHROME = `
float sdTorus(vec3 p, vec2 t) {
  return length(vec2(length(p.xz) - t.x, p.y)) - t.y;
}

float scene(vec3 p) {
  float t = u_time * 0.35;
  vec3 q = p;
  q.xy = rot(t * 0.4) * q.xy;
  q.yz = rot(1.1) * q.yz;
  float d = sdTorus(q, vec2(0.78, 0.2));
  for (int i = 0; i < 3; i++) {
    float f = float(i);
    vec3 c = vec3(sin(t + f * 2.1) * 0.95, cos(t * 1.3 + f * 1.7) * 0.6, sin(t * 0.7 + f * 2.9) * 0.55);
    d = smin(d, length(p - c) - (0.26 + 0.05 * f), 0.4);
  }
  return d;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy * scene(p + e.xyy) + e.yyx * scene(p + e.yyx) + e.yxy * scene(p + e.yxy) + e.xxx * scene(p + e.xxx));
}

// The studio the metal reflects.
vec3 environment(vec3 d) {
  vec3 color = mix(u_bg * 0.6, u_ink * 0.07, d.y * 0.5 + 0.5);
  float softbox = smoothstep(0.55, 0.62, d.y) * smoothstep(0.98, 0.9, d.y) * smoothstep(0.7, 0.4, abs(d.x));
  color += u_ink * softbox * 1.4;
  float rim = smoothstep(0.5, 0.85, d.x) * smoothstep(-0.6, 0.3, d.y);
  color += u_accent * rim * 1.2;
  float floorGlow = smoothstep(-0.2, -0.7, d.y) * 0.08;
  return color + u_ink * floorGlow;
}

void main() {
  float pres = presence();
  vec2 uv = toUv(gl_FragCoord.xy) - focus();
  vec2 m = toUv(u_mouse);

  // Orbit camera: the cursor sets yaw and pitch.
  float yaw = m.x * 1.4;
  float pitch = clamp(m.y * 0.9, -0.6, 0.6);
  vec3 ro = vec3(0.0, 0.0, -4.9);
  ro.yz = rot(pitch) * ro.yz;
  ro.xz = rot(yaw) * ro.xz;
  vec3 forward = normalize(-ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  vec3 rd = normalize(forward * 1.7 + right * uv.x + up * uv.y);

  float dist = 0.0;
  float hit = 0.0;
  for (int i = 0; i < 72; i++) {
    float d = scene(ro + rd * dist);
    if (d < 0.001) { hit = 1.0; break; }
    dist += d;
    if (dist > 10.0) break;
  }

  vec3 color = u_bg;
  if (hit > 0.5) {
    vec3 p = ro + rd * dist;
    vec3 n = normalAt(p);
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    vec3 reflection = environment(reflect(rd, n));
    color = reflection * (0.55 + 0.45 * fresnel) + u_ink * 0.02;
    color += u_accent * u_pulse * 0.25 * fresnel; // Clicks flash the rim.
  }
  // Soft glow around the sculpture, so it sits in light rather than a void.
  color += u_accent * 0.05 * exp(-length(uv) * 2.2) * (1.0 - hit);
  outColor = vec4(mix(u_bg, color, pres), 1.0);
}`;

/** Complete fragment shader source for each scene. */
export const FRAGMENT_SHADERS: Record<SceneId, string> = {
  breach: COMMON + BREACH,
  glyph: COMMON + GLYPH,
  drivetrain: COMMON + DRIVETRAIN,
  chrome: COMMON + CHROME,
};
