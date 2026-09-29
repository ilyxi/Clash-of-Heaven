'use strict';
// ---------------------------------------------------------------------------
// Shared math / color / misc helpers. Loaded first; everything else uses U.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

// Isometric tile dimensions (screen pixels at 1x).
const TILE_W = 32;
const TILE_H = 16;
const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;
// A world circle of radius r tiles projects to an ellipse with these radii (px).
const ISO_RX = HALF_W * Math.SQRT2;
const ISO_RY = HALF_H * Math.SQRT2;

const U = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a = 0, b = 1) { return a + Math.random() * (b - a); },
  randi(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  chance(p) { return Math.random() < p; },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  },
  dist(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  angle(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
  angDiff(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  },
  turnToward(a, target, maxStep) {
    const d = U.angDiff(a, target);
    if (Math.abs(d) <= maxStep) return target;
    return a + Math.sign(d) * maxStep;
  },
  approach(v, target, delta) {
    if (v < target) return Math.min(v + delta, target);
    return Math.max(v - delta, target);
  },
  norm(x, y) {
    const l = Math.sqrt(x * x + y * y);
    return l > 1e-6 ? [x / l, y / l] : [0, 0];
  },
  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  easeInCubic(t) { return t * t * t; },
  easeOutBack(t) { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },

  // Distance from point to segment, plus projection param t along segment.
  pointSegDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = U.clamp(t, 0, 1);
    const cx = ax + dx * t, cy = ay + dy * t;
    return { d: Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy)), t };
  },

  // Deterministic PRNG (mulberry32) for map generation.
  rng(seed) {
    let a = seed >>> 0;
    const f = () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    return f;
  },

  // Cheap hash-based value noise, deterministic per seed.
  hash2(x, y, seed = 0) {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },
  valueNoise(x, y, seed = 0) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const s = (t) => t * t * (3 - 2 * t);
    const a = U.hash2(xi, yi, seed), b = U.hash2(xi + 1, yi, seed);
    const c = U.hash2(xi, yi + 1, seed), d = U.hash2(xi + 1, yi + 1, seed);
    const u = s(xf), v = s(yf);
    return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
  },
  fbm(x, y, seed = 0, oct = 3) {
    let amp = 0.5, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * U.valueNoise(x * freq, y * freq, seed + i * 17);
      norm += amp; amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  },

  // ---- colors -------------------------------------------------------------
  hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgbToHex(r, g, b) {
    const c = (v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  },
  // amt > 0 lightens toward white, < 0 darkens toward black.
  shade(hex, amt) {
    const [r, g, b] = U.hexToRgb(hex);
    if (amt >= 0) return U.rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
    const k = 1 + amt;
    return U.rgbToHex(r * k, g * k, b * k);
  },
  mix(a, b, t) {
    const A = U.hexToRgb(a), B = U.hexToRgb(b);
    return U.rgbToHex(U.lerp(A[0], B[0], t), U.lerp(A[1], B[1], t), U.lerp(A[2], B[2], t));
  },
  rgba(hex, a) {
    const [r, g, b] = U.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  },

  makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return c;
  },

  uid: (() => { let n = 1; return () => n++; })(),

  fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  },

  deepCopy(o) { return JSON.parse(JSON.stringify(o)); },
};

// ---- isometric projection --------------------------------------------------
const ISO = {
  // world (tile units) -> screen pixels (before camera offset)
  sx(x, y) { return (x - y) * HALF_W; },
  sy(x, y, z = 0) { return (x + y) * HALF_H - z; },
  // screen pixels (before camera) -> world ground position
  toWorld(px, py) {
    const a = px / HALF_W, b = py / HALF_H;
    return { x: (a + b) / 2, y: (b - a) / 2 };
  },
  // Screen-space direction (dx right, dy down) -> normalized world direction.
  screenDirToWorld(dx, dy) { return U.norm(dx + dy, dy - dx); },
  // Facing index for sprites from world angle: 0=SE(front,right) 1=SW(front,left) 2=NE(back,right) 3=NW(back,left)
  facingFromAngle(ang) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const sx = dx - dy, sy = dx + dy; // screen direction
    const front = sy >= -0.05;
    const right = sx >= 0;
    return front ? (right ? 0 : 1) : (right ? 2 : 3);
  },
};

// ---- pixel primitives (crisp, no anti-aliasing) ----------------------------
const PX = {
  circle(ctx, cx, cy, r) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.max(0, Math.round(r));
    for (let y = -r; y <= r; y++) {
      const w = Math.round(Math.sqrt(r * r - y * y + r * 0.8));
      ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
  },
  ellipse(ctx, cx, cy, rx, ry) {
    cx = Math.round(cx); cy = Math.round(cy);
    rx = Math.max(0.5, rx); ry = Math.max(0.5, ry);
    const R = Math.round(ry);
    for (let y = -R; y <= R; y++) {
      const t = 1 - (y * y) / (ry * ry + ry * 0.6);
      if (t <= 0) continue;
      const w = Math.round(rx * Math.sqrt(t));
      ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
    }
  },
  ellipseRing(ctx, cx, cy, rx, ry, thick = 1) {
    cx = Math.round(cx); cy = Math.round(cy);
    const steps = Math.max(16, Math.round((rx + ry) * 2.2));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), thick, thick);
    }
  },
  line(ctx, x0, y0, x1, y1, w = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, guard = 0;
    const o = Math.floor(w / 2);
    while (guard++ < 2000) {
      ctx.fillRect(x0 - o, y0 - o, w, w);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  },
};
