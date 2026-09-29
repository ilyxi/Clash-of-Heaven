'use strict';
// ---------------------------------------------------------------------------
// Procedural pixel art for map props: iso cubes (walls, houses, cliffs),
// trees, rocks, crates and friends. Every sprite is generated once and cached.
// Each sprite returns { c: canvas, ox, oy } where (ox, oy) is the offset from
// the tile's top vertex on screen.
// ---------------------------------------------------------------------------

const Art = (() => {
  const cache = new Map();

  function rgb(hex) { return U.hexToRgb(hex); }

  // Pixel-exact iso cube of height H with per-face texture callbacks.
  // tex(face, u, v, x, y) -> [r,g,b] | null  (face: 'top' | 'left' | 'right')
  function cube(H, tex) {
    const w = TILE_W, h = TILE_H + H;
    const c = U.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let face = null, u = 0, v = 0;
        const cx = x + 0.5, cy = y + 0.5;
        if (Math.abs(cx - 16) / 16 + Math.abs(cy - 8) / 8 <= 1) {
          face = 'top';
          u = cx / 16 + cy / 8 - 1;    // along +x axis (0..1)
          v = cy / 8 - cx / 16 + 1;    // along +y axis (0..1)
        } else if (cx < 16) {
          const e = 8 + cx / 2;
          if (cy >= e && cy <= e + H) { face = 'left'; u = x; v = cy - e; }
        } else {
          const e = 16 - (cx - 16) / 2;
          if (cy >= e && cy <= e + H) { face = 'right'; u = x - 16; v = cy - e; }
        }
        if (!face) continue;
        const col = tex(face, u, v, x, y);
        if (!col) continue;
        const i = (y * w + x) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = col[3] === undefined ? 255 : col[3];
      }
    }
    ctx.putImageData(img, 0, 0);
    return { c, ox: -16, oy: -H };
  }

  function mul(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function jitter(c, x, y, seed, amt) {
    const n = (U.hash2(x, y, seed) - 0.5) * amt;
    return [c[0] + n * 255, c[1] + n * 255, c[2] + n * 255];
  }

  // ---- cube textures ---------------------------------------------------------
  function stoneWall(H, seed, base = '#8e8e96') {
    const B = rgb(base);
    return cube(H, (f, u, v, x, y) => {
      if (f === 'top') {
        const edge = u < 0.08 || v < 0.08 || u > 0.92 || v > 0.92;
        return jitter(mul(B, edge ? 1.0 : 1.18), x, y, seed, 0.06);
      }
      const k = f === 'left' ? 0.92 : 0.7;
      const row = Math.floor(v / 5);
      const off = row % 2 ? 4 : 0;
      const mortar = v % 5 < 1 || ((u + off) % 8) < 1;
      return jitter(mul(B, mortar ? k * 0.72 : k), x, y, seed, 0.07);
    });
  }

  function house(H, seed, roof, wall) {
    const R = rgb(roof), W = rgb(wall);
    const win = seed % 3 !== 0;
    return cube(H, (f, u, v, x, y) => {
      if (f === 'top') {
        const stripe = Math.floor((u * 8)) % 2 === 0;
        const edge = u < 0.07 || v < 0.07 || u > 0.93 || v > 0.93;
        return jitter(mul(R, edge ? 0.7 : stripe ? 1.05 : 0.9), x, y, seed, 0.04);
      }
      const k = f === 'left' ? 1 : 0.72;
      if (v < 3) return mul(R, 0.62 * k); // eave shadow
      if (v > H - 3) return mul([90, 70, 55], k); // foundation
      if (win && f === 'right' && u > 5 && u < 11 && v > 7 && v < 14) {
        if (u < 6 || u > 9.5 || v < 8 || v > 12.5) return mul([70, 45, 30], k);
        return [40, 50, 70];
      }
      if (win && f === 'left' && seed % 4 === 1 && u > 5 && u < 11 && v > 9) {
        return (u < 6 || u > 10) ? mul([70, 45, 30], k) : mul([60, 38, 24], k); // door
      }
      const beam = u % 16 < 1 || v % 12 < 1;
      return jitter(mul(W, beam ? k * 0.75 : k), x, y, seed, 0.05);
    });
  }

  function rockCube(H, seed, base, topCol) {
    const B = rgb(base), T = topCol ? rgb(topCol) : null;
    return cube(H, (f, u, v, x, y) => {
      const n = U.fbm(x * 0.35, y * 0.35, seed, 2);
      if (f === 'top') {
        if (T) return jitter(mul(T, 0.9 + n * 0.3), x, y, seed, 0.1);
        return jitter(mul(B, 1.1 + n * 0.2), x, y, seed, 0.06);
      }
      if (T && v < 2 + U.hash2(x, 0, seed) * 2) return mul(T, f === 'left' ? 0.85 : 0.65);
      const k = f === 'left' ? 0.95 : 0.68;
      const crack = U.hash2(Math.floor(x / 3), Math.floor(y / 4), seed) > 0.86;
      return jitter(mul(B, k * (0.8 + n * 0.4) * (crack ? 0.7 : 1)), x, y, seed, 0.05);
    });
  }

  function crate(seed) {
    const W = rgb('#a8763e');
    const H = 12;
    return cube(H, (f, u, v, x, y) => {
      if (f === 'top') {
        const edge = u < 0.12 || v < 0.12 || u > 0.88 || v > 0.88;
        return mul(W, edge ? 0.75 : 1.08);
      }
      const k = f === 'left' ? 1 : 0.72;
      const frame = u < 2 || u > 14 || v < 2 || v > H - 2;
      const cross = Math.abs(u - v * 16 / H) < 1.3 || Math.abs(u - (H - v) * 16 / H) < 1.3;
      return jitter(mul(W, k * (frame || cross ? 0.7 : 1)), x, y, seed, 0.05);
    });
  }

  // ---- freeform sprites ---------------------------------------------------------
  function sprite(w, h, ax, ay, drawFn) {
    const c = U.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    drawFn(ctx);
    outlineCanvas(c, '#140c16');
    // anchor (ax, ay) sits at tile centre = top vertex + (0, 8)
    return { c, ox: -ax, oy: 8 - ay };
  }

  function outlineCanvas(canvas, color) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const [r, g, b] = U.hexToRgb(color);
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 200 ? 1 : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function dither(ctx, cx, cy, r, color, seed, density) {
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      if (U.hash2(cx + x, cy + y, seed) < density) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }

  function shadow(ctx, cx, cy, rx, ry) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    PX.ellipse(ctx, cx, cy, rx, ry);
  }

  function tree(seed, pal) {
    const r = U.rng(seed);
    return sprite(44, 56, 22, 50, (ctx) => {
      shadow(ctx, 22, 50, 12, 5);
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(20, 34, 5, 16);
      ctx.fillStyle = '#7a5232'; ctx.fillRect(20, 34, 2, 16);
      ctx.fillStyle = '#3e2616'; ctx.fillRect(24, 34, 1, 16);
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(18, 48, 2, 2); ctx.fillRect(25, 48, 2, 2);
      const blobs = [[22, 20, 12], [13, 27, 8], [31, 27, 8], [22, 29, 9], [16, 14, 7], [28, 15, 7]];
      for (const b of blobs) { ctx.fillStyle = pal[0]; PX.circle(ctx, b[0] + r.int(-1, 1), b[1] + 1, b[2]); }
      for (const b of blobs) { ctx.fillStyle = pal[1]; PX.circle(ctx, b[0] - 1, b[1] - 1, b[2] - 2); }
      for (const b of blobs) { ctx.fillStyle = pal[2]; PX.circle(ctx, b[0] - 3, b[1] - 3, Math.max(1, b[2] - 6)); }
      dither(ctx, 22, 22, 15, pal[3], seed, 0.08);
      dither(ctx, 26, 28, 12, pal[0], seed + 5, 0.12);
    });
  }

  function pine(seed, pal, snowy) {
    return sprite(36, 60, 18, 54, (ctx) => {
      shadow(ctx, 18, 54, 10, 4);
      ctx.fillStyle = '#4a2e1a'; ctx.fillRect(16, 42, 4, 12);
      ctx.fillStyle = '#6a4428'; ctx.fillRect(16, 42, 1, 12);
      const layers = [[44, 16, 10], [34, 13, 10], [24, 10, 10], [15, 7, 9]];
      for (const [by, hw, hh] of layers) {
        for (let y = 0; y < hh; y++) {
          const w = Math.round(hw * (y + 1) / hh);
          ctx.fillStyle = pal[0]; ctx.fillRect(18 - w, by - hh + y, w * 2, 1);
          ctx.fillStyle = pal[1]; ctx.fillRect(18 - w, by - hh + y, Math.max(1, w - 1), 1);
          if (y % 3 === 0) { ctx.fillStyle = pal[2]; ctx.fillRect(18 - w + 1, by - hh + y, Math.max(1, (w >> 1)), 1); }
          if (snowy && (y < 3 || (y === hh - 1 && U.hash2(by, y, seed) > 0.3))) {
            ctx.fillStyle = y < 2 ? '#f4f8ff' : '#d8e4f4';
            ctx.fillRect(18 - w, by - hh + y, w * 2 - (y === hh - 1 ? w : 0), 1);
          }
        }
      }
      ctx.fillStyle = pal[2]; ctx.fillRect(17, 5, 2, 3);
      dither(ctx, 18, 30, 14, pal[3], seed, 0.05);
    });
  }

  function palm(seed) {
    const r = U.rng(seed);
    return sprite(48, 56, 24, 50, (ctx) => {
      shadow(ctx, 24, 50, 11, 4);
      const lean = r.pick([-1, 1]);
      let x = 23, y = 50;
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = i % 3 === 0 ? '#7a5a36' : '#9a7446';
        ctx.fillRect(Math.round(x), y, 4, 1);
        y--; x += lean * (i / 40);
      }
      const tx = Math.round(x) + 2, ty = y;
      const fronds = [[-18, 6], [-12, -6], [0, -9], [12, -6], [18, 6], [-6, 9], [8, 9]];
      for (const [fx, fy] of fronds) {
        for (let t = 0; t <= 1; t += 0.05) {
          const px = tx + fx * t, py = ty + fy * t + (t * t) * 8 - (1 - t) * t * 6;
          ctx.fillStyle = '#2f7a2f'; ctx.fillRect(Math.round(px) - 1, Math.round(py), 3, 2);
          ctx.fillStyle = '#5fb04a'; ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
      }
      ctx.fillStyle = '#6a4a2a'; ctx.fillRect(tx - 2, ty, 4, 3);
    });
  }

  function bush(seed, pal) {
    return sprite(24, 18, 12, 14, (ctx) => {
      shadow(ctx, 12, 14, 8, 3);
      ctx.fillStyle = pal[0]; PX.circle(ctx, 8, 10, 5); PX.circle(ctx, 15, 10, 5); PX.circle(ctx, 12, 7, 5);
      ctx.fillStyle = pal[1]; PX.circle(ctx, 7, 9, 3); PX.circle(ctx, 11, 6, 3);
      dither(ctx, 12, 9, 6, pal[2], seed, 0.12);
      if (seed % 2) { ctx.fillStyle = '#ff6fa8'; ctx.fillRect(9, 7, 1, 1); ctx.fillRect(14, 9, 1, 1); ctx.fillRect(12, 11, 1, 1); }
    });
  }

  function rock(seed, base, big) {
    const r = U.rng(seed);
    const R = big ? 11 : 8;
    return sprite(32, 30, 16, 24, (ctx) => {
      const pts = [];
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const rr = R * r.range(0.75, 1.1);
        pts.push([16 + Math.cos(a) * rr, 18 + Math.sin(a) * rr * 0.75 - (Math.sin(a) < 0 ? 3 : 0)]);
      }
      ctx.fillStyle = U.shade(base, -0.25);
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
      ctx.fillStyle = base;
      ctx.beginPath(); pts.forEach((p, i) => { const x = p[0] - 1.5, y = p[1] - 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill();
      ctx.fillStyle = U.shade(base, 0.25);
      PX.ellipse(ctx, 13, 13, R * 0.45, R * 0.28);
      // crack
      ctx.fillStyle = U.shade(base, -0.4);
      PX.line(ctx, 16, 12, 18, 17); PX.line(ctx, 18, 17, 17, 20);
      // pixelize (remove antialiased edges), then tuck the shadow underneath
      const img = ctx.getImageData(0, 0, 32, 30);
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] >= 128 ? 255 : 0;
      ctx.putImageData(img, 0, 0);
      ctx.globalCompositeOperation = 'destination-over';
      shadow(ctx, 16, 24, R + 2, 4);
      ctx.globalCompositeOperation = 'source-over';
    });
  }

  function barrel(seed) {
    return sprite(20, 24, 10, 20, (ctx) => {
      shadow(ctx, 10, 20, 6, 2);
      ctx.fillStyle = '#8a5a2c'; ctx.fillRect(5, 6, 10, 14);
      ctx.fillStyle = '#a8763e'; ctx.fillRect(5, 6, 4, 14);
      ctx.fillStyle = '#5a3a1c'; ctx.fillRect(13, 6, 2, 14);
      ctx.fillStyle = '#50505a'; ctx.fillRect(5, 8, 10, 1); ctx.fillRect(5, 17, 10, 1);
      ctx.fillStyle = '#6a4424'; PX.ellipse(ctx, 10, 6, 5, 2);
      ctx.fillStyle = '#4a2e18'; PX.ellipse(ctx, 10, 6, 3, 1);
    });
  }

  function fence(seed, dir) {
    return sprite(34, 22, 17, 16, (ctx) => {
      ctx.fillStyle = '#8a6036';
      const dx = dir ? 1 : -1;
      for (let i = -1; i <= 1; i++) {
        const x = 17 + i * 8 * dx, y = 16 + i * 4;
        ctx.fillStyle = '#6a4424'; ctx.fillRect(x - 1, y - 11, 3, 11);
        ctx.fillStyle = '#9a7040'; ctx.fillRect(x - 1, y - 11, 1, 11);
      }
      ctx.fillStyle = '#a07848';
      PX.line(ctx, 17 - 10 * dx, 16 - 5 - 8, 17 + 10 * dx, 16 + 5 - 8, 2);
      PX.line(ctx, 17 - 10 * dx, 16 - 5 - 4, 17 + 10 * dx, 16 + 5 - 4, 2);
    });
  }

  function lantern() {
    return sprite(16, 30, 8, 26, (ctx) => {
      shadow(ctx, 8, 26, 5, 2);
      ctx.fillStyle = '#7a7a82'; ctx.fillRect(6, 14, 4, 12);
      ctx.fillStyle = '#9a9aa2'; ctx.fillRect(6, 14, 1, 12);
      ctx.fillStyle = '#8a8a92'; ctx.fillRect(3, 24, 10, 3); ctx.fillRect(3, 11, 10, 3);
      ctx.fillStyle = '#ffd36a'; ctx.fillRect(5, 6, 6, 5);
      ctx.fillStyle = '#fff2b0'; ctx.fillRect(6, 7, 2, 3);
      ctx.fillStyle = '#6a6a72'; ctx.fillRect(2, 4, 12, 2); ctx.fillRect(5, 2, 6, 2);
    });
  }

  function pillar(base, H) {
    return sprite(22, H + 14, 11, H + 10, (ctx) => {
      shadow(ctx, 11, H + 10, 8, 3);
      const B = base;
      ctx.fillStyle = U.shade(B, -0.1); ctx.fillRect(3, H + 3, 16, 6);
      ctx.fillStyle = B; ctx.fillRect(5, 6, 12, H);
      ctx.fillStyle = U.shade(B, 0.2); ctx.fillRect(5, 6, 3, H);
      ctx.fillStyle = U.shade(B, -0.3); ctx.fillRect(15, 6, 2, H);
      ctx.fillStyle = U.shade(B, -0.15);
      for (let y = 10; y < H + 4; y += 6) ctx.fillRect(9, y, 1, 4);
      ctx.fillStyle = U.shade(B, 0.1); ctx.fillRect(2, 2, 18, 5);
      ctx.fillStyle = U.shade(B, 0.3); ctx.fillRect(2, 2, 18, 1);
    });
  }

  function statue(seed) {
    // A huge carved warrior statue occupying one tile (placed in groups).
    return sprite(40, 92, 20, 86, (ctx) => {
      shadow(ctx, 20, 86, 14, 5);
      const S = '#8a8478', L = '#aaa496', D = '#5e584e';
      ctx.fillStyle = D; ctx.fillRect(6, 74, 28, 12);
      ctx.fillStyle = S; ctx.fillRect(6, 74, 26, 10);
      ctx.fillStyle = S; ctx.fillRect(12, 40, 16, 34);         // body
      ctx.fillStyle = L; ctx.fillRect(12, 40, 5, 34);
      ctx.fillStyle = D; ctx.fillRect(26, 40, 2, 34);
      ctx.fillStyle = S; ctx.fillRect(13, 22, 14, 18);          // head
      ctx.fillStyle = L; ctx.fillRect(13, 22, 4, 18);
      ctx.fillStyle = D; ctx.fillRect(17, 30, 2, 2); ctx.fillRect(22, 30, 2, 2);
      ctx.fillStyle = D; for (let i = 0; i < 6; i++) ctx.fillRect(11 + i * 3, 14 + (i % 2) * 3, 3, 9 - (i % 2) * 3); // spiky hair
      ctx.fillStyle = S; ctx.fillRect(4, 42, 8, 6); ctx.fillRect(28, 42, 8, 6);  // shoulders
      ctx.fillStyle = S; ctx.fillRect(28, 26, 6, 18);           // raised arm
      ctx.fillStyle = L; ctx.fillRect(28, 20, 6, 7);            // hand seal
      ctx.fillStyle = D; ctx.fillRect(15, 56, 10, 2);
      dither(ctx, 20, 55, 18, D, seed, 0.06);
    });
  }

  function cactus(seed) {
    return sprite(22, 30, 11, 26, (ctx) => {
      shadow(ctx, 11, 26, 6, 2);
      ctx.fillStyle = '#3f8a3a'; ctx.fillRect(9, 6, 5, 20);
      ctx.fillStyle = '#6ab04a'; ctx.fillRect(9, 6, 2, 20);
      ctx.fillStyle = '#3f8a3a'; ctx.fillRect(4, 12, 3, 8); ctx.fillRect(4, 18, 6, 3);
      ctx.fillRect(15, 9, 3, 7); ctx.fillRect(13, 14, 5, 3);
      ctx.fillStyle = '#6ab04a'; ctx.fillRect(4, 12, 1, 8); ctx.fillRect(15, 9, 1, 7);
      if (seed % 2) { ctx.fillStyle = '#ff5f8a'; ctx.fillRect(10, 4, 3, 2); }
    });
  }

  function trainingLog() {
    return sprite(16, 26, 8, 22, (ctx) => {
      shadow(ctx, 8, 22, 5, 2);
      ctx.fillStyle = '#8a5a2c'; ctx.fillRect(4, 4, 8, 18);
      ctx.fillStyle = '#a8763e'; ctx.fillRect(4, 4, 3, 18);
      ctx.fillStyle = '#5a3a1c'; ctx.fillRect(11, 4, 1, 18);
      ctx.fillStyle = '#c89a5e'; PX.ellipse(ctx, 8, 4, 4, 1);
      ctx.fillStyle = '#e8e4da'; ctx.fillRect(4, 10, 8, 2); ctx.fillRect(4, 15, 8, 1);
    });
  }

  function iceSpike(seed) {
    return sprite(20, 30, 10, 26, (ctx) => {
      ctx.fillStyle = '#8fd0ff';
      for (let y = 0; y < 22; y++) { const w = Math.round((y / 22) * 6); ctx.fillRect(10 - w, 4 + y, w * 2 + 1, 1); }
      ctx.fillStyle = '#e8f8ff';
      for (let y = 4; y < 22; y++) ctx.fillRect(9, 4 + y, 1, 1);
    });
  }

  // Public: get sprite for a block.
  function get(type, variant, theme) {
    const key = type + ':' + variant + ':' + (theme || '');
    let s = cache.get(key);
    if (s) return s;
    const v = variant | 0;
    const leafPal = theme === 'valley'
      ? [['#4a6a2a', '#6a8a36', '#9ab04a', '#c8d070'], ['#6a5a2a', '#8a7a36', '#b0a04a', '#e0c070']][v % 2]
      : [['#2f6a2a', '#3f8a36', '#62b04a', '#a8e070'], ['#285a36', '#357a44', '#4f9e56', '#8fd08a'], ['#3a6a1f', '#4f8a2a', '#7ab03f', '#c8e070']][v % 3];
    switch (type) {
      case 'tree': s = tree(v * 7 + 3, leafPal); break;
      case 'pine': s = pine(v * 5 + 1, ['#1f4a2f', '#2f6a3f', '#4f8a4f', '#8fc08a'], theme === 'snow'); break;
      case 'palm': s = palm(v * 3 + 11); break;
      case 'bush': s = bush(v, leafPal); break;
      case 'rock': s = rock(v * 13 + 7, theme === 'desert' ? '#c8a070' : theme === 'valley' ? '#8a7a6a' : '#8a8a90', false); break;
      case 'boulder': s = rock(v * 17 + 5, theme === 'desert' ? '#b89060' : theme === 'valley' ? '#7a6a5a' : '#7a7a82', true); break;
      case 'crate': s = crate(v); break;
      case 'barrel': s = barrel(v); break;
      case 'fence': s = fence(v, v % 2); break;
      case 'lantern': s = lantern(); break;
      case 'log': s = trainingLog(); break;
      case 'pillar': s = pillar(theme === 'desert' ? '#d0a870' : '#a09a90', 30); break;
      case 'statue': s = statue(v); break;
      case 'cactus': s = cactus(v); break;
      case 'ice': s = iceSpike(v); break;
      case 'wall': s = stoneWall(22, v, theme === 'desert' ? '#c8a070' : '#8e8e96'); break;
      case 'ruin': s = stoneWall(14 + (v % 3) * 6, v, '#c8a070'); break;
      case 'house': {
        const roofs = ['#b8483a', '#3a6ab8', '#4a8a4a', '#c07a2a', '#8a4ab0'];
        const walls = ['#e8d8b8', '#d8c8a8', '#f0e0c8'];
        s = house(26, v, roofs[Math.floor(v / 7) % roofs.length], walls[v % 3]);
        break;
      }
      case 'cliff': {
        const top = theme === 'desert' ? '#d8b070' : theme === 'valley' ? '#7a8a4a' : theme === 'snow' ? '#e4ecf6' : '#4f8a36';
        const base = theme === 'desert' ? '#a87a4a' : theme === 'valley' ? '#7a6a5e' : theme === 'snow' ? '#6e7686' : '#6e6a64';
        s = rockCube(40 + (v % 4) * 6, v, base, top);
        break;
      }
      case 'earthwall': s = rockCube(22, v, '#9a6a3a', '#b8864a'); break;
      case 'stonepile': s = rockCube(10, v, '#8a8a90'); break;
      default: s = crate(v);
    }
    cache.set(key, s);
    return s;
  }

  // Cracked overlay reused for damaged blocks.
  function crackOverlay(ctx, x, y, w, h, seed, amount) {
    ctx.fillStyle = 'rgba(20,10,10,0.55)';
    const n = Math.floor(amount * 6) + 1;
    const r = U.rng(seed);
    for (let i = 0; i < n; i++) {
      let px = x + r.range(w * 0.2, w * 0.8), py = y + r.range(h * 0.2, h * 0.8);
      for (let k = 0; k < 5; k++) {
        const nx = px + r.range(-3, 3), ny = py + r.range(1, 3);
        PX.line(ctx, px, py, nx, ny);
        px = nx; py = ny;
      }
    }
  }

  return { get, crackOverlay, outlineCanvas };
})();
