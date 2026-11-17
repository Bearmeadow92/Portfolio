/**
 * @file GLSL fragment shaders for the generative backdrop.
 *
 * Each scene is one fragment shader that runs once per pixel on the GPU. The CPU does
 * almost nothing per frame (it uploads a handful of uniforms and draws one triangle),
 * which is why a full-screen animation can hold 60 fps.
 *
 * Scenes
 *   Breach      A 3D network flown over in perspective, where an attack lands every nine seconds.
 *   Glyph       A spinning donut drawn in text characters, in the spirit of donut.c.
 *   Drivetrain  A V-twin engine in blueprint linework that revs with pointer and scroll speed.
 *   Chrome      A machined hex bolt and nut in polished chrome, under shifting studio light.
 *
 * Shared uniforms
 *   u_res     Drawing buffer size in pixels.
 *   u_time    Seconds since start.
 *   u_mouse   Smoothed pointer position in pixels, origin at the bottom left.
 *   u_dim     Art intensity: 1 in the hero, lower behind text so content stays readable.
 *   u_pulse   A short kick (1 fading to 0) fired by UI events like clicks.
 *   u_clear   How strongly the art steps back behind the hero's text column (0 to 1).
 *   u_crank   Accumulated engine crank angle in radians (integrated on the CPU).
 *   u_rpm     Engine speed above idle, 0 to 1.
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
uniform float u_crank;
uniform float u_rpm;
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
  float side = mix(1.0 - 0.72 * (1.0 - smoothstep(0.28, 0.82, x)), 0.32, portrait);
  return u_dim * mix(1.0, side, u_clear);
}

// Pixel coordinates to aspect-correct coordinates centered on the screen (height = 1).
vec2 toUv(vec2 frag) {
  return (frag - 0.5 * u_res) / u_res.y;
}

// Where the art's focal object sits: right of center on wide screens (the hero copy is on
// the left), and lower center on portrait screens.
vec2 focus() {
  return u_res.x > u_res.y ? vec2(0.42 * u_res.x / u_res.y - 0.15, 0.0) : vec2(0.0, -0.3);
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
 * A 3D attack map. The network lies on a floor in perspective and scrolls toward the
 * camera, as if flying over a city of data. Every nine seconds an incident plays out:
 *   1. Lock-on    A targeting ring closes in on one node.
 *   2. Strike     An attack arc drops out of the sky onto it.
 *   3. Impact     A flash, a shockwave across the floor, and a red pulse at the edges.
 *   4. Spread     Infection races outward along the links.
 *   5. Contain    A firewall curtain rises from the floor and stops the spread cold.
 *   6. Recover    The red fades and normal traffic resumes.
 * Incident positions come from hashing the incident number, so the shader is stateless.
 *
 * Rendering: each pixel's ray is intersected with the floor plane (y = 0), and the
 * network is drawn in floor coordinates, checking only the 3x3 nearby grid cells, so
 * the cost is constant. fwidth() keeps lines one pixel wide at any distance. The
 * firewall is an analytic ray-cylinder intersection, and the attack arc is a 3D curve
 * projected to the screen as a short polyline.
 */
const BREACH = `
const float SP = 0.34;     // Node spacing on the floor, in world units.
const float PERIOD = 9.0;  // Seconds between incidents.
const float FW = 0.62;     // Firewall radius.
const float SCROLL = 0.07; // How fast the network glides toward the camera.
const float FOCAL = 1.5;

vec3 ro;
vec3 camF;
vec3 camR;
vec3 camU;

vec2 nodePos(vec2 cell) {
  return (cell + 0.2 + 0.6 * vec2(hash(cell), hash(cell + 17.3))) * SP;
}

// Projects a world point to screen coordinates (the same space as toUv).
vec2 project(vec3 x) {
  vec3 v = x - ro;
  float z = max(dot(v, camF), 0.01);
  return vec2(dot(v, camR), dot(v, camU)) * FOCAL / z;
}

// Places the camera high over the floor, looking toward the right of the screen.
void setCamera(float yaw) {
  vec3 target = vec3(0.55, 0.0, 1.9);
  ro = target + vec3(-sin(yaw) * 4.0, 1.45, -cos(yaw) * 4.0);
  camF = normalize(target - ro);
  camR = normalize(cross(vec3(0.0, 1.0, 0.0), camF));
  camU = cross(camF, camR);
}

vec3 rayDir(vec2 uv) {
  return normalize(camF * FOCAL + camR * uv.x + camU * uv.y);
}

void main() {
  float pres = presence();
  float hot = max(pres, 0.45 * u_clear); // Incidents stay vivid in the hero, calmer behind text.
  vec2 uv = toUv(gl_FragCoord.xy);
  vec2 m = toUv(u_mouse);

  /* ------------------------------ The incident ----------------------------- */
  float incident = floor(u_time / PERIOD);
  float phase = fract(u_time / PERIOD);
  float startTime = incident * PERIOD;

  // Choose the target on SCREEN first (in the open space beside the hero copy), then
  // trace it down to the floor. Picking in world space let incidents land behind the
  // headline. The pick uses the camera as it was at the incident's start, without the
  // cursor's influence, so the target node never jumps while the incident plays.
  float aspect = u_res.x / u_res.y;
  vec2 pickScreen = aspect > 1.0
    ? vec2(mix(0.06, 0.4, hash(vec2(incident, 1.3))) * aspect, mix(-0.2, 0.0, hash(vec2(incident, 7.1))))
    : vec2(mix(-0.25, 0.25, hash(vec2(incident, 1.3))), mix(-0.44, -0.3, hash(vec2(incident, 7.1))));
  setCamera(sin(startTime * 0.05) * 0.05);
  vec3 pd = rayDir(pickScreen);
  vec2 pickWorld = (ro + pd * (ro.y / max(-pd.y, 0.05))).xz;
  vec2 originNet = nodePos(floor((pickWorld + vec2(0.0, startTime * SCROLL)) / SP));

  // The live camera, nudged by the cursor.
  setCamera(m.x * 0.12 + sin(u_time * 0.05) * 0.05);
  vec3 rd = rayDir(uv);

  // Floor intersection. Computed for every pixel (fwidth needs uniform control flow),
  // then masked to pixels that actually look down at the floor.
  float tFloor = ro.y / max(-rd.y, 0.001);
  float onFloor = step(rd.y, -0.002);
  vec2 world = (ro + rd * tFloor).xz;
  vec2 q = world + vec2(0.0, u_time * SCROLL); // Network space scrolls with the floor.
  float px = max(fwidth(q.x), fwidth(q.y));
  float fog = onFloor * exp(-tFloor * 0.15) * smoothstep(0.0, 0.06, -rd.y);
  // Level of detail: once grid cells shrink to a few pixels, the lines would alias into
  // grain, so the network fades out smoothly before that happens.
  float lod = 1.0 - smoothstep(0.022, 0.055, px);

  vec2 originW = originNet - vec2(0.0, u_time * SCROLL);
  vec3 T = vec3(originW.x, 0.0, originW.y);

  float hit = smoothstep(0.14, 0.16, phase);
  float alive = hit * (1.0 - smoothstep(0.66, 0.86, phase));
  float spread = min(smoothstep(0.17, 0.42, phase) * FW * 1.08, FW);
  float wallUp = smoothstep(0.26, 0.34, phase) * (1.0 - smoothstep(0.72, 0.9, phase));
  float wallFlash = smoothstep(0.39, 0.42, phase) * (1.0 - smoothstep(0.42, 0.56, phase));
  float impact = smoothstep(0.145, 0.155, phase) * (1.0 - smoothstep(0.155, 0.32, phase));

  /* ------------------------------- The network ----------------------------- */
  float links = 0.0, packets = 0.0, nodes = 0.0, redLinks = 0.0, redNodes = 0.0;

  // The cursor's spot on the floor, for the sensor ring.
  vec3 mrd = rayDir(m);
  float mt = ro.y / max(-mrd.y, 0.02);
  vec2 mq = (ro + mrd * mt).xz + vec2(0.0, u_time * SCROLL);
  float near = exp(-dot(q - mq, q - mq) * 3.0);

  vec2 cell = floor(q / SP);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 k = cell + vec2(float(i), float(j));
      vec2 a = nodePos(k);
      float infectedA = step(length(a - originNet), spread) * alive;
      float r = max(0.014, px * 1.3);
      float dn = length(q - a);
      float dot_ = 1.0 - smoothstep(r - px, r, dn);
      nodes = max(nodes, dot_ * (1.0 - infectedA));
      float ring = stroke(dn - 0.035 - 0.01 * sin(u_time * 10.0), px) * infectedA;
      redNodes = max(redNodes, max(dot_ * infectedA, ring));

      for (int e = 0; e < 3; e++) {
        vec2 dir = e == 0 ? vec2(1.0, 0.0) : e == 1 ? vec2(0.0, 1.0) : vec2(1.0, -1.0);
        vec2 id = k * 3.0 + float(e);
        if (hash(id + 3.1) > (e == 2 ? 0.3 : 0.75)) continue;
        vec2 b = nodePos(k + dir);
        float infected = step(length(mix(a, b, 0.5) - originNet), spread) * alive;
        float l = stroke(sdSegment(q, a, b), px);
        links = max(links, l * (1.0 - infected));
        redLinks = max(redLinks, l * infected);

        float speed = mix(0.1 + 0.15 * hash(id + 5.5), 0.9, infected);
        float t = fract(u_time * speed + hash(id));
        if (hash(id + 2.2) > 0.5) t = 1.0 - t;
        float pr = max(0.011, px * 1.1);
        float pkt = 1.0 - smoothstep(pr - px, pr, length(q - mix(a, b, t)));
        packets = max(packets, pkt * (1.0 - infected));
        redLinks = max(redLinks, pkt * infected);
      }
    }
  }

  /* ------------------------- Floor effects (network space) ------------------ */
  float dO = length(q - originNet);
  float angO = atan(q.y - originNet.y, q.x - originNet.x);
  // Lock-on: a dashed ring closing in on the target before the strike.
  float lockR = mix(0.6, 0.07, smoothstep(0.0, 0.14, phase));
  float lock = stroke(dO - lockR, px * 1.3) * step(0.4, fract(angO * 4.0 / PI + u_time * 0.8)) * (1.0 - smoothstep(0.14, 0.16, phase));
  // Impact flash and shockwave.
  float flash = exp(-dO * 5.0) * impact;
  float shock = stroke(dO - (phase - 0.15) / 0.17 * 1.3, px * 2.5) * impact;
  // Firewall base ring.
  float wallBase = stroke(dO - FW, px * 1.5) * wallUp;
  // Cursor sensor ring and click probe.
  float dM = length(q - mq);
  float sensor = stroke(dM - 0.16, px * 1.2) * step(0.35, fract(atan(q.y - mq.y, q.x - mq.x) * 6.0 / PI - u_time * 0.4));
  float probe = u_pulse * stroke(dM - (1.0 - u_pulse) * 2.8, px * 2.5);

  /* --------------------------- Firewall curtain (3D) ------------------------ */
  float wall = 0.0;
  float H = 0.32 * wallUp;
  vec2 oc = ro.xz - originW;
  float A = dot(rd.xz, rd.xz);
  float B = dot(oc, rd.xz);
  float C = dot(oc, oc) - FW * FW;
  float disc = B * B - A * C;
  if (disc > 0.0 && H > 0.001) {
    float sq = sqrt(disc);
    for (int s = 0; s < 2; s++) {
      float ti = (-B + (s == 0 ? -sq : sq)) / A;
      if (ti <= 0.0 || (onFloor > 0.5 && ti > tFloor)) continue;
      vec3 p = ro + rd * ti;
      if (p.y < 0.0 || p.y > H) continue;
      float ang = atan(p.z - originW.y, p.x - originW.x);
      float rib = smoothstep(0.9, 0.97, fract(ang * 36.0 / (2.0 * PI)));
      float scan = smoothstep(0.75, 1.0, fract(p.y * 26.0 - u_time * 2.5));
      float top = smoothstep(H - 0.03, H, p.y);
      float face = s == 0 ? 1.0 : 0.45; // The far side of the curtain is dimmer.
      wall = max(wall, (0.07 + rib * 0.35 + scan * 0.12 + top * 0.9) * face * exp(-ti * 0.12) * (1.0 + 2.5 * wallFlash));
    }
  }

  /* ------------------------------ Attack arc (3D) --------------------------- */
  float arc = 0.0;
  float head = smoothstep(0.0, 0.15, phase);
  if (phase < 0.18) {
    vec3 S = T + vec3((hash(vec2(incident, 3.3)) - 0.5) * 3.4, 2.8, 2.6);
    float tail = max(head - 0.45, 0.0);
    vec2 prev = project(mix(S, T, tail) + vec3(0.0, sin(PI * tail) * 0.9, 0.0));
    float spx = 1.0 / u_res.y;
    for (int k = 1; k <= 18; k++) {
      float sk = mix(tail, head, float(k) / 18.0);
      vec2 cur = project(mix(S, T, sk) + vec3(0.0, sin(PI * sk) * 0.9, 0.0));
      float fade = float(k) / 18.0; // Brighter toward the head.
      arc = max(arc, stroke(sdSegment(uv, prev, cur), spx * 1.8) * fade);
      prev = cur;
    }
    arc = max(arc, exp(-length(uv - prev) * 120.0) * 1.5); // Glowing warhead.
    arc *= 1.0 - smoothstep(0.15, 0.18, phase);
  }

  /* -------------------------------- Compose -------------------------------- */
  float haze = exp(-abs(rd.y) * 28.0) * 0.07;
  vec3 color = u_bg;
  color = mix(color, u_ink, haze * pres);
  color = mix(color, u_ink, links * 0.17 * fog * lod * pres);
  color = mix(color, u_ink, nodes * (0.5 + 0.5 * near) * fog * lod * pres);
  color = mix(color, u_ink, packets * (0.55 + 0.45 * near) * fog * lod * pres);
  color = mix(color, u_ink, sensor * 0.55 * fog * pres);
  color = mix(color, u_ink, probe * 0.7 * fog);
  color = mix(color, u_accent, redLinks * 0.9 * fog * hot);
  color = mix(color, u_accent, redNodes * fog * hot);
  color = mix(color, u_accent, lock * fog * hot);
  color = mix(color, u_accent, clamp(flash + shock * 0.8, 0.0, 1.0) * fog * hot);
  color = mix(color, u_ink, wallBase * 0.8 * fog * hot);
  color = mix(color, u_ink, clamp(wall, 0.0, 1.0) * hot);
  color = mix(color, u_accent, clamp(arc, 0.0, 1.0) * hot);
  // The screen edges pulse red on impact.
  float vignette = smoothstep(0.35, 1.1, length(uv * vec2(0.75, 1.15)));
  color = mix(color, u_accent, vignette * impact * 0.22 * hot);
  outColor = vec4(color, 1.0);
}`;

/* -------------------------------------------------------------------------- */
/*                                    Glyph                                   */
/* -------------------------------------------------------------------------- */

/**
 * A spinning donut drawn in text, in the spirit of Andy Sloane's famous donut.c.
 *
 * A torus tumbles on two axes. Each character cell raymarches the torus once, lights the
 * hit with a fixed overhead key light (nudged by the cursor), and picks a character from
 * the classic ramp ".,-~:;=!*#$@" by brightness. Characters come from a 5x7 bitmap font
 * stored in two int arrays (35 bits do not fit in one 32-bit int).
 */
const GLYPH = `
// Thirteen glyphs, dark to bright: " .,-~:;=!*#$@". TOP holds rows 0-3, BOT rows 4-6.
const int TOP[13] = int[13](0, 0, 0, 458752, 690176, 128, 128, 31744, 135300, 1030816, 359754, 464836, 718382);
const int BOT[13] = int[13](0, 128, 2180, 0, 8, 128, 2180, 31, 4100, 686, 10591, 4596, 30781);

// Is the pixel at column c, row r (row 0 at the top) of glyph g lit?
float glyphBit(int g, int c, int r) {
  int bits = r < 4 ? TOP[g] : BOT[g];
  int index = (r < 4 ? r : r - 4) * 5 + c;
  return float((bits >> index) & 1);
}

// Two axis tumble, like donut.c: A spins around X, B around Z. The cursor adds a lean.
mat3 tumble() {
  vec2 m = toUv(u_mouse) - focus();
  float A = u_time * 0.7 + m.y * 1.2;
  float B = u_time * 0.35 + m.x * 1.2;
  float ca = cos(A), sa = sin(A), cb = cos(B), sb = sin(B);
  mat3 rx = mat3(1.0, 0.0, 0.0, 0.0, ca, sa, 0.0, -sa, ca);
  mat3 rz = mat3(cb, sb, 0.0, -sb, cb, 0.0, 0.0, 0.0, 1.0);
  return rz * rx;
}

float sdTorus(vec3 p) {
  return length(vec2(length(p.xy) - 1.0, p.z)) - 0.48;
}

void main() {
  float pres = presence();
  float cellH = max(11.0, floor(u_res.y / 58.0));
  float cellW = floor(cellH * 0.62);
  vec2 cellId = floor(gl_FragCoord.xy / vec2(cellW, cellH));
  vec2 local = fract(gl_FragCoord.xy / vec2(cellW, cellH));
  vec2 center = (cellId + 0.5) * vec2(cellW, cellH);

  // Raymarch the torus from this cell's center. Every pixel in a cell shares one sample.
  mat3 r = tumble();
  mat3 inv = transpose(r);
  // On portrait screens the donut shrinks so it fits under the text instead of behind it.
  vec2 uv = (toUv(center) - focus()) * mix(1.0, 1.8, step(u_res.x, u_res.y));
  vec3 ro = inv * vec3(0.0, 0.0, -7.2);
  vec3 rd = inv * normalize(vec3(uv, 1.55));
  float dist = 0.0;
  float hit = 0.0;
  for (int i = 0; i < 56; i++) {
    float d = sdTorus(ro + rd * dist);
    if (d < 0.003) { hit = 1.0; break; }
    dist += d;
    if (dist > 11.0) break;
  }

  float lum = 0.0;
  float spec = 0.0;
  if (hit > 0.5) {
    vec3 p = ro + rd * dist;
    vec2 ring = normalize(p.xy) * 1.0;
    vec3 n = r * normalize(p - vec3(ring, 0.0)); // Exact torus normal, back in view space.
    vec2 m = toUv(u_mouse) - focus();
    vec3 light = normalize(vec3(-0.4 + m.x * 0.6, 0.85, -0.7));
    float diffuse = dot(n, light);
    spec = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, -1.0)), 0.0), 24.0);
    // Map lighting to the ramp the way donut.c does: surfaces facing away from the light
    // get the dimmest glyph (so the silhouette still reads), lit ones climb the ramp.
    lum = diffuse <= 0.0 ? 0.09 : 0.16 + 0.84 * diffuse;
    // Depth shading: the far side of the ring recedes, which sells the 3D form.
    lum *= mix(1.0, 0.72, smoothstep(6.4, 8.0, dist));
  }

  // A click scrambles a ring of glyphs spreading outward.
  float wave = u_pulse * exp(-abs(length(toUv(center) - toUv(u_mouse)) - (1.0 - u_pulse) * 1.2) * 30.0);
  lum = clamp(lum + wave * hash(cellId + floor(u_time * 20.0)), 0.0, 0.999);

  int g = int(lum * 13.0);
  int c = int(local.x * 6.0);          // Columns 0-4 are the glyph, column 5 is spacing.
  int row = 6 - int(local.y * 8.0);    // Rows 0-6 are the glyph (top first), one row of spacing.
  float on = (c < 5 && row >= 0 && row < 7) ? glyphBit(g, c, row) : 0.0;

  vec3 ink = mix(u_ink, u_accent, step(0.5, spec) + step(0.2, wave));
  outColor = vec4(mix(u_bg, ink, on * mix(0.3, 1.0, hit) * pres), 1.0);
}`;

/* -------------------------------------------------------------------------- */
/*                                 Drivetrain                                 */
/* -------------------------------------------------------------------------- */

/**
 * A 60 degree V-twin in blueprint linework: two cylinders sharing one crank pin, valves
 * driven by a half speed cam, a timing belt, and a flywheel with a starter ring gear
 * meshing an accessory gear.
 *
 * The crank angle (u_crank) and speed (u_rpm) come from the CPU, which revs the engine
 * with pointer and scroll speed. At high RPM the flywheel spokes motion blur into a disc.
 * Everything is a 2D distance field, so this scene is cheap.
 */
const DRIVETRAIN = `
float boxOutline(vec2 p, vec2 h) {
  vec2 d = abs(p) - h;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Flywheel: toothed ring gear, rim, hub, and six spokes that blur with speed.
void flywheel(vec2 p, float radius, float angle, float px, inout float lines, inout float blur) {
  float len = length(p);
  float a = atan(p.y, p.x) - angle;
  float teeth = clamp(cos(a * 36.0) * 2.4, -1.0, 1.0) * 0.011 * (1.0 - u_rpm * 0.85);
  lines = max(lines, stroke(len - radius - teeth, px));
  lines = max(lines, stroke(len - radius * 0.84, px));
  lines = max(lines, stroke(len - radius * 0.22, px));
  lines = max(lines, stroke(len - radius * 0.08, px));
  float sector = 2.0 * PI / 6.0;
  float local = mod(a + sector * 0.5, sector) - sector * 0.5;
  float inBand = step(radius * 0.22, len) * step(len, radius * 0.84);
  float spoke = stroke(abs(len * sin(local)) - radius * 0.035, px) * inBand;
  lines = max(lines, spoke * (1.0 - 0.8 * u_rpm));
  blur = max(blur, inBand * u_rpm); // The spokes smear into a translucent disc.
}

void main() {
  float pres = presence();
  float px = 1.0 / u_res.y;
  float portrait = step(u_res.x, u_res.y);
  float scale = mix(0.72, 0.6, portrait);
  vec2 uv = (toUv(gl_FragCoord.xy) - focus()) / scale;
  px /= scale;

  // Blueprint grid: minor and major lines.
  vec2 g = abs(fract(uv / 0.05 + 0.5) - 0.5) * 0.05;
  vec2 G = abs(fract(uv / 0.25 + 0.5) - 0.5) * 0.25;
  float grid = max(stroke(min(g.x, g.y), px) * 0.4, stroke(min(G.x, G.y), px) * 0.8);

  float lines = 0.0;
  float hot = 0.0;   // Accent colored parts: rods, pins, the belt.
  float blur = 0.0;

  vec2 crankCenter = vec2(0.0, -0.3);
  float angle = u_crank;
  float throw_ = 0.07;
  float rodLength = 0.3;
  vec2 pin = crankCenter + throw_ * vec2(cos(angle), sin(angle));
  hot = max(hot, stroke(length(uv - pin) - 0.014, px));

  // Two cylinders, 30 degrees either side of vertical, sharing the one crank pin.
  for (int i = 0; i < 2; i++) {
    float side = i == 0 ? -1.0 : 1.0;
    vec2 axis = vec2(sin(side * PI / 6.0), cos(side * PI / 6.0));
    vec2 normal = vec2(axis.y, -axis.x);
    vec2 rel = pin - crankCenter;
    float along = dot(rel, axis);
    float across = dot(rel, normal);
    float s = along + sqrt(rodLength * rodLength - across * across); // Slider crank.
    vec2 wrist = crankCenter + axis * s;

    // Work in the cylinder's own frame: x across the bore, y along the axis.
    vec2 c = vec2(dot(uv - crankCenter, normal), dot(uv - crankCenter, axis));
    float boreTop = rodLength + throw_ + 0.12;
    float boreBottom = rodLength - throw_ - 0.02;
    float walls = min(abs(abs(c.x) - 0.07), 1.0) + max(max(boreBottom - c.y, c.y - boreTop), 0.0);
    lines = max(lines, stroke(walls, px));
    // Cooling fins on the outside of the barrel.
    float fins = stroke(fract((c.y - boreBottom) / 0.04) * 0.04 - 0.02, px) * step(boreBottom, c.y) * step(c.y, boreTop - 0.02) * step(0.07, abs(c.x)) * step(abs(c.x), 0.1);
    lines = max(lines, fins * 0.6);
    // Piston, wrist pin, and connecting rod.
    float pistonY = s + 0.03;
    lines = max(lines, stroke(boxOutline(c - vec2(0.0, pistonY), vec2(0.062, 0.045)), px));
    lines = max(lines, stroke(abs(c.y - pistonY - 0.025) - 0.0, px) * step(abs(c.x), 0.062) * 0.6);
    hot = max(hot, stroke(sdSegment(uv, pin, wrist), px * 1.6));
    hot = max(hot, stroke(length(uv - wrist) - 0.01, px));

    // Cylinder head with four head bolts, and a spark plug on top.
    lines = max(lines, stroke(boxOutline(c - vec2(0.0, boreTop + 0.04), vec2(0.11, 0.04)), px));
    for (int hb = 0; hb < 2; hb++) {
      float hx = hb == 0 ? -0.088 : 0.088;
      lines = max(lines, stroke(length(c - vec2(hx, boreTop + 0.04)) - 0.008, px));
    }
    lines = max(lines, stroke(boxOutline(c - vec2(0.0, boreTop + 0.1), vec2(0.012, 0.02)), px));
    lines = max(lines, stroke(sdSegment(c, vec2(0.0, boreTop + 0.12), vec2(0.0, boreTop + 0.145)), px));
    // Valves opened by a half speed cam (one cycle per two crank turns).
    for (int v = 0; v < 2; v++) {
      float vs = v == 0 ? -1.0 : 1.0;
      float cam = angle * 0.5 + side * 0.9 + vs * 1.9;
      float lift = max(sin(cam), 0.0) * 0.018;
      vec2 stemTop = vec2(vs * 0.035, boreTop + 0.07);
      vec2 stemBottom = vec2(vs * 0.035, boreTop + 0.005 - lift);
      float valve = sdSegment(c, stemTop, stemBottom);
      valve = min(valve, sdSegment(c, stemBottom - vec2(0.018, 0.0), stemBottom + vec2(0.018, 0.0)));
      lines = max(lines, stroke(valve, px));
    }
  }

  // Timing belt from the crank pulley up to the cam pulley in the V.
  vec2 camCenter = crankCenter + vec2(0.0, 0.5);
  float r1 = 0.045;
  float r2 = 0.075;
  lines = max(lines, stroke(length(uv - crankCenter) - r1, px));
  lines = max(lines, stroke(length(uv - camCenter) - r2, px));
  vec2 dir = normalize(camCenter - crankCenter);
  float sinT = (r2 - r1) / length(camCenter - crankCenter);
  float cosT = sqrt(1.0 - sinT * sinT);
  vec2 perp = vec2(-dir.y, dir.x);
  vec2 n1 = perp * cosT - dir * sinT;
  vec2 n2 = -perp * cosT - dir * sinT;
  float belt = min(sdSegment(uv, crankCenter + n1 * r1, camCenter + n1 * r2), sdSegment(uv, crankCenter + n2 * r1, camCenter + n2 * r2));
  hot = max(hot, stroke(belt, px) * 0.9);
  // Belt teeth marching along with the crank.
  float camAngle = angle * 0.5;
  float camMark = stroke(sdSegment(uv, camCenter, camCenter + r2 * 0.8 * vec2(cos(camAngle), sin(camAngle))), px);
  lines = max(lines, camMark);

  // Flywheel behind the crank, and an accessory gear meshed with its ring gear.
  flywheel(uv - crankCenter, 0.2, angle, px, lines, blur);
  vec2 acc = crankCenter + vec2(cos(-0.55), sin(-0.55)) * (0.2 + 0.067);
  float accAngle = -angle * 3.0 + PI / 12.0;
  vec2 pa = uv - acc;
  float aa = atan(pa.y, pa.x) - accAngle;
  float accTeeth = clamp(cos(aa * 12.0) * 2.4, -1.0, 1.0) * 0.011 * (1.0 - u_rpm * 0.85);
  lines = max(lines, stroke(length(pa) - 0.067 - accTeeth, px));
  lines = max(lines, stroke(length(pa) - 0.022, px));

  // Dashed center lines through the crank, like a technical drawing.
  float dash = step(0.5, fract((uv.x + uv.y) * 24.0));
  float centers = stroke(uv.y - crankCenter.y, px) * step(abs(uv.x - crankCenter.x), 0.3);
  centers = max(centers, stroke(uv.x - crankCenter.x, px) * step(abs(uv.y - crankCenter.y), 0.3));

  vec3 color = u_bg;
  color = mix(color, u_ink, grid * 0.08 * pres);
  color = mix(color, u_ink, blur * 0.08 * pres);
  color = mix(color, u_ink, centers * dash * 0.35 * pres);
  color = mix(color, u_ink, lines * 0.85 * pres);
  color = mix(color, u_accent, hot * min(1.0, pres * 1.3));
  outColor = vec4(color, 1.0);
}`;

/* -------------------------------------------------------------------------- */
/*                                   Chrome                                   */
/* -------------------------------------------------------------------------- */

/**
 * A machined hex bolt with a nut threaded onto it, in polished chrome.
 *
 * The parts are signed distance fields: chamfered hex prisms for the head and nut, and a
 * shaft with a helical thread. Moving the cursor across the screen screws the nut along
 * the thread (it turns as it travels, so it stays in the thread), and a click spins it.
 * The metal reflects a procedural studio: hard edged softboxes for crisp highlights, and
 * a rim light that slowly cycles through colors.
 */
const CHROME = `
const float PITCH = 0.06; // Thread pitch: how far the nut travels per full turn.

// Hexagonal prism lying in the XZ plane, extruded along Y. h.x is the inradius, h.y the
// half height. Adapted from Inigo Quilez's distance function reference.
float sdHex(vec3 p, vec2 h) {
  const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
  vec3 q = abs(p.xzy);
  q.xy -= 2.0 * min(dot(k.xy, q.xy), 0.0) * k.xy;
  vec2 d = vec2(length(q.xy - vec2(clamp(q.x, -k.z * h.x, k.z * h.x), h.x)) * sign(q.y - h.x), q.z - h.y);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// A hex with chamfered corners, made by intersecting it with a slightly larger sphere.
float chamferedHex(vec3 p, float inradius, float halfHeight) {
  return max(sdHex(p, vec2(inradius, halfHeight)), length(p) - inradius * 1.2);
}

// Nut position along the bolt and its matching rotation.
float nutY() {
  return mix(-0.55, 0.3, clamp(toUv(u_mouse).x * 0.7 + 0.5, 0.0, 1.0));
}

float scene(vec3 p) {
  // Present the assembly at a three quarter angle with a slow turn.
  p.xz = rot(0.5 + u_time * 0.12) * p.xz;
  p.xy = rot(0.32) * p.xy;

  // Bolt head (chamfered hex) and shaft with a helical thread.
  vec3 hp = p - vec3(0.0, 0.78, 0.0);
  float head = chamferedHex(hp, 0.38, 0.13);
  float theta = atan(p.z, p.x);
  // The thread runs out just under the head, leaving a smooth neck like a real bolt.
  float threaded = smoothstep(0.52, 0.44, p.y);
  float thread = 0.012 * sin(p.y * 2.0 * PI / PITCH + theta) * threaded;
  float shaft = max(length(p.xz) - 0.2 + thread, abs(p.y + 0.18) - 0.85);
  // Chamfer the tip with a cone so the end of the bolt reads as machined.
  shaft = max(shaft, (length(p.xz) - (p.y + 1.03) * 1.2 - 0.13) * 0.7);
  float bolt = min(head, shaft);

  // The nut: a chamfered hex with a bore, turned to match its height on the thread.
  float y = nutY();
  vec3 np = p - vec3(0.0, y, 0.0);
  np.xz = rot(y * 2.0 * PI / PITCH + u_pulse * 6.0) * np.xz;
  float nut = max(chamferedHex(np, 0.34, 0.15), -(length(np.xz) - 0.215));
  // A flat washer riding just under the nut.
  vec3 wp = p - vec3(0.0, y - 0.175, 0.0);
  float washer = max(abs(length(wp.xz) - 0.3) - 0.085, abs(wp.y) - 0.018);
  return min(min(bolt, nut), washer);
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0008, -0.0008);
  return normalize(e.xyy * scene(p + e.xyy) + e.yyx * scene(p + e.yyx) + e.yxy * scene(p + e.yxy) + e.xxx * scene(p + e.xxx));
}

// The rim light's color drifts slowly around the color wheel.
vec3 rimColor() {
  return 0.55 + 0.45 * cos(2.0 * PI * (u_time * 0.035 + vec3(0.0, 0.33, 0.67)));
}

// The studio the metal reflects. Flat faces of a hex reflect a whole region of this, so
// every element is graded (never one flat color): that is what makes faces read as
// polished metal instead of painted plastic.
vec3 environment(vec3 d) {
  // Dark studio walls: a vertical gradient with a bright horizon band.
  float y = d.y;
  vec3 color = mix(u_bg * 0.5, u_ink * 0.16, smoothstep(-0.4, 0.9, y));
  color += u_ink * 0.22 * exp(-abs(y - 0.05) * 14.0);
  // Overhead softbox: crisp edges, brighter toward its center.
  float topBox = smoothstep(0.58, 0.62, y) * smoothstep(0.62, 0.55, abs(d.x));
  color += u_ink * topBox * (0.9 + 0.8 * smoothstep(0.62, 0.95, y));
  // Tall strip light on the left, graded top to bottom.
  float leftStrip = smoothstep(-0.7, -0.74, d.x) * smoothstep(0.55, 0.45, abs(y - 0.1));
  color += u_ink * leftStrip * (0.5 + 0.7 * smoothstep(-0.4, 0.6, y));
  // Floor: a faint graded reflection.
  color += u_ink * 0.06 * smoothstep(-0.2, -0.9, y);
  return color;
}

void main() {
  float pres = presence();
  vec2 uv = toUv(gl_FragCoord.xy) - focus();
  vec3 ro = vec3(0.0, 0.1, -5.4);
  vec3 rd = normalize(vec3(uv, 1.75));

  float dist = 0.0;
  float hit = 0.0;
  for (int i = 0; i < 110; i++) {
    float d = scene(ro + rd * dist);
    if (d < 0.0007) { hit = 1.0; break; }
    dist += d * 0.8; // Shorter steps: the thread makes the distance field inexact.
    if (dist > 8.0) break;
  }

  vec3 color = u_bg;
  if (hit > 0.5) {
    vec3 p = ro + rd * dist;
    vec3 n = normalAt(p);
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
    vec3 r = reflect(rd, n);
    // Near-field trick: a flat mirror face reflecting lights at infinity shows one flat
    // color. Offsetting the lookup by the surface position makes the studio lights behave
    // as if they were close, so each face picks up a gradient like a real product shot.
    vec3 lookup = normalize(r + p * 0.42);
    color = environment(lookup) * (0.62 + 0.38 * fresnel);
    // The colored rim light catches only grazing edges facing it, like a real kicker light.
    float kicker = smoothstep(0.45, 0.95, lookup.x) * fresnel;
    color += rimColor() * kicker * 1.4;
    color += rimColor() * u_pulse * 0.25 * fresnel; // Clicks flash the edges.
  }
  outColor = vec4(mix(u_bg, color, pres), 1.0);
}`;

/** Complete fragment shader source for each scene. */
export const FRAGMENT_SHADERS: Record<SceneId, string> = {
  breach: COMMON + BREACH,
  glyph: COMMON + GLYPH,
  drivetrain: COMMON + DRIVETRAIN,
  chrome: COMMON + CHROME,
};
