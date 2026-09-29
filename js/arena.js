'use strict';
// ---------------------------------------------------------------------------
// The Arena: tile map, destructible blocks, terrain state (fire, puddles,
// scorch marks), procedural generation per theme, collision & pathfinding.
// ---------------------------------------------------------------------------

const T_GRASS = 0, T_DIRT = 1, T_STONE = 2, T_SAND = 3, T_WATER = 4, T_WOOD = 5, T_ROCK = 6, T_SNOW = 7;

const BLOCK_TYPES = {
  tree:      { hp: 90,  h: 40, mat: 'wood',  burn: true, round: 0.34 },
  pine:      { hp: 90,  h: 44, mat: 'wood',  burn: true, round: 0.32 },
  palm:      { hp: 60,  h: 40, mat: 'wood',  burn: true, round: 0.28 },
  bush:      { hp: 18,  h: 8,  mat: 'leaf',  burn: true, round: 0.3, soft: true },
  rock:      { hp: 150, h: 14, mat: 'stone', round: 0.36 },
  boulder:   { hp: 260, h: 20, mat: 'stone', round: 0.44 },
  crate:     { hp: 35,  h: 12, mat: 'wood',  burn: true },
  barrel:    { hp: 25,  h: 14, mat: 'wood',  burn: true, round: 0.28, explosive: true },
  fence:     { hp: 25,  h: 9,  mat: 'wood',  burn: true, round: 0.3 },
  lantern:   { hp: 45,  h: 20, mat: 'stone', round: 0.25 },
  log:       { hp: 60,  h: 16, mat: 'wood',  burn: true, round: 0.25 },
  pillar:    { hp: 220, h: 34, mat: 'stone', round: 0.36 },
  statue:    { hp: 900, h: 80, mat: 'stone', round: 0.46 },
  cactus:    { hp: 40,  h: 18, mat: 'plant', burn: true, round: 0.26 },
  ice:       { hp: 60,  h: 20, mat: 'ice',   round: 0.3 },
  wall:      { hp: 200, h: 22, mat: 'stone' },
  ruin:      { hp: 160, h: 18, mat: 'stone' },
  house:     { hp: 170, h: 26, mat: 'wood',  burn: true },
  cliff:     { hp: Infinity, h: 46, mat: 'stone' },
  earthwall: { hp: 110, h: 22, mat: 'earth' },
  stonepile: { hp: 120, h: 10, mat: 'stone' },
};

const MATERIALS = {
  wood:  { colors: ['#8a5a2c', '#a8763e', '#5a3a1c', '#c89a5e'], sfx: 'wood', rubble: 'wood' },
  leaf:  { colors: ['#3f8a36', '#62b04a', '#2f6a2a'], sfx: 'wood', rubble: null },
  stone: { colors: ['#8e8e96', '#a8a8b0', '#6e6e76', '#c0c0c6'], sfx: 'crumble', rubble: 'rubble' },
  earth: { colors: ['#9a6a3a', '#b8864a', '#6a4424'], sfx: 'crumble', rubble: 'rubble' },
  plant: { colors: ['#3f8a3a', '#6ab04a'], sfx: 'wood', rubble: null },
  ice:   { colors: ['#8fd0ff', '#e8f8ff', '#5aa0e0'], sfx: 'clink', rubble: null },
};

const THEMES = {
  forest: {
    name: 'Hidden Leaf Valley', size: 64, outside: '#1d3320', tint: null,
    pal: {
      grass: [[52, 110, 40], [66, 130, 48], [84, 150, 56], [110, 172, 70]],
      dirt: [[112, 84, 56], [128, 98, 64], [144, 112, 74]],
      stone: [[132, 130, 124], [150, 148, 140], [166, 164, 156]],
      sand: [[200, 176, 120], [214, 190, 134], [226, 202, 148]],
      wood: [[128, 86, 48], [146, 100, 58], [162, 116, 70]],
      rock: [[104, 98, 92], [118, 112, 104], [132, 126, 116]],
      water: [[34, 86, 160], [46, 110, 190], [70, 140, 214], [180, 220, 255]],
      snow: [[220, 228, 240], [236, 242, 250], [250, 252, 255]],
    },
  },
  valley: {
    name: 'Valley of Echoes', size: 60, outside: '#2a1d24', tint: 'rgba(255,120,60,0.10)',
    pal: {
      grass: [[84, 104, 44], [100, 120, 52], [120, 138, 60], [146, 156, 74]],
      dirt: [[120, 92, 66], [136, 104, 74], [150, 118, 84]],
      stone: [[140, 128, 116], [156, 144, 130], [170, 158, 144]],
      sand: [[190, 160, 116], [204, 174, 128], [216, 188, 140]],
      wood: [[128, 86, 48], [146, 100, 58], [162, 116, 70]],
      rock: [[110, 96, 88], [126, 110, 100], [142, 126, 114]],
      water: [[30, 70, 130], [44, 96, 160], [66, 124, 186], [200, 220, 240]],
      snow: [[220, 228, 240], [236, 242, 250], [250, 252, 255]],
    },
  },
  desert: {
    name: 'Sunken Sand Ruins', size: 64, outside: '#3a2a18', tint: 'rgba(255,220,150,0.06)',
    pal: {
      grass: [[98, 130, 50], [116, 148, 58], [134, 164, 66], [160, 184, 80]],
      dirt: [[176, 136, 90], [190, 150, 100], [204, 164, 112]],
      stone: [[196, 164, 116], [212, 180, 130], [226, 196, 146]],
      sand: [[214, 180, 120], [226, 194, 134], [236, 206, 148]],
      wood: [[128, 86, 48], [146, 100, 58], [162, 116, 70]],
      rock: [[160, 124, 84], [176, 138, 96], [190, 152, 108]],
      water: [[30, 110, 150], [44, 136, 176], [70, 166, 200], [200, 240, 250]],
      snow: [[220, 228, 240], [236, 242, 250], [250, 252, 255]],
    },
  },
  snow: {
    name: 'Frostfang Peaks', size: 60, outside: '#1a2230', tint: 'rgba(160,200,255,0.08)',
    pal: {
      grass: [[70, 110, 80], [84, 126, 92], [100, 140, 104], [124, 160, 124]],
      dirt: [[110, 100, 96], [124, 114, 108], [138, 128, 120]],
      stone: [[140, 146, 156], [156, 162, 172], [172, 178, 188]],
      sand: [[200, 200, 210], [214, 214, 222], [226, 226, 234]],
      wood: [[118, 80, 48], [136, 94, 58], [152, 110, 70]],
      rock: [[100, 106, 118], [116, 122, 134], [132, 138, 150]],
      water: [[60, 110, 170], [90, 150, 210], [140, 196, 236], [230, 245, 255]],
      snow: [[206, 216, 232], [224, 232, 244], [240, 246, 252]],
    },
  },
};

class Arena {
  constructor(theme, seed) {
    this.theme = THEMES[theme] ? theme : 'forest';
    this.T = THEMES[this.theme];
    this.seed = seed >>> 0;
    this.w = this.h = this.T.size;
    const n = this.w * this.h;
    this.tiles = new Uint8Array(n);
    this.blocks = new Array(n).fill(null);
    this.fire = new Float32Array(n);
    this.wet = new Float32Array(n);
    this.burnt = new Uint8Array(n);
    this.stains = [];
    this.stainTiles = new Array(n).fill(null);
    this.tempBlocks = [];
    this.burningList = new Set();
    this.wetList = new Set();
    this.spawnPoints = [];
    this.fireTick = 0;
    this.version = 0; // increments whenever collision changes
    const r = U.rng(this.seed);
    GEN[this.theme](this, r);
    this.finishGeneration(r);
    this.buildGround();
  }

  idx(i, j) { return j * this.w + i; }
  inBounds(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h; }
  tile(i, j) { return this.inBounds(i, j) ? this.tiles[this.idx(i, j)] : T_ROCK; }
  tileAtW(x, y) { return this.tile(Math.floor(x), Math.floor(y)); }
  block(i, j) { return this.inBounds(i, j) ? this.blocks[this.idx(i, j)] : null; }
  isSolid(i, j) {
    if (!this.inBounds(i, j)) return true;
    const b = this.blocks[this.idx(i, j)];
    return !!(b && !b.def.soft);
  }
  isWaterW(x, y) { return this.tileAtW(x, y) === T_WATER; }
  isWetW(x, y) {
    const i = Math.floor(x), j = Math.floor(y);
    if (!this.inBounds(i, j)) return false;
    const k = this.idx(i, j);
    return this.tiles[k] === T_WATER || this.wet[k] > 0;
  }
  isBurningW(x, y) {
    const i = Math.floor(x), j = Math.floor(y);
    return this.inBounds(i, j) && this.fire[this.idx(i, j)] > 0;
  }

  setBlock(i, j, type, variant) {
    if (!this.inBounds(i, j)) return null;
    const def = BLOCK_TYPES[type];
    const b = { type, def, i, j, hp: def.hp, maxHp: def.hp, v: variant === undefined ? U.randi(0, 20) : variant, flash: 0, shake: 0, burning: 0, life: 0 };
    this.blocks[this.idx(i, j)] = b;
    this.version++;
    return b;
  }
  clearBlock(i, j) {
    if (!this.inBounds(i, j)) return;
    this.blocks[this.idx(i, j)] = null;
    this.version++;
  }

  // ---- generation helpers ---------------------------------------------------
  finishGeneration(r) {
    // Border cliffs (indestructible) keep fighters inside the arena.
    for (let i = 0; i < this.w; i++) for (let j = 0; j < this.h; j++) {
      const edge = Math.min(i, j, this.w - 1 - i, this.h - 1 - j);
      if (edge < 2) {
        this.setBlock(i, j, 'cliff', (i * 7 + j * 13) % 11);
        if (this.tiles[this.idx(i, j)] === T_WATER) this.tiles[this.idx(i, j)] = T_ROCK;
      }
    }
    // Spawn ring around the centre.
    const cx = this.w / 2, cy = this.h / 2, R = this.w * 0.3;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU + 0.3;
      let x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      const p = this.nearestOpen(x, y, 6) || { x, y };
      this.clearArea(p.x, p.y, 1.6);
      this.spawnPoints.push({ x: p.x, y: p.y });
    }
    this.clearArea(cx, cy, 2.2);
    this.computeWaterDepth();
  }

  clearArea(x, y, rad) {
    for (let j = Math.floor(y - rad); j <= Math.ceil(y + rad); j++)
      for (let i = Math.floor(x - rad); i <= Math.ceil(x + rad); i++) {
        if (!this.inBounds(i, j)) continue;
        const b = this.block(i, j);
        if (b && b.type !== 'cliff' && U.dist(i + 0.5, j + 0.5, x, y) <= rad) this.clearBlock(i, j);
      }
  }

  nearestOpen(x, y, maxR) {
    for (let rr = 0; rr <= maxR; rr += 0.5) {
      for (let a = 0; a < TAU; a += 0.4) {
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        const i = Math.floor(px), j = Math.floor(py);
        if (this.inBounds(i, j) && !this.isSolid(i, j) && Math.min(i, j, this.w - 1 - i, this.h - 1 - j) >= 3) return { x: i + 0.5, y: j + 0.5 };
      }
    }
    return null;
  }

  randomOpenPoint(margin = 4) {
    for (let t = 0; t < 200; t++) {
      const i = U.randi(margin, this.w - 1 - margin), j = U.randi(margin, this.h - 1 - margin);
      if (!this.isSolid(i, j)) return { x: i + 0.5, y: j + 0.5 };
    }
    return { x: this.w / 2, y: this.h / 2 };
  }

  computeWaterDepth() {
    // BFS distance from shore for every water tile (drives colour banding).
    const n = this.w * this.h;
    this.waterDepth = new Uint8Array(n);
    const q = [];
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      const k = this.idx(i, j);
      if (this.tiles[k] !== T_WATER) continue;
      let shore = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + dx, nj = j + dy;
        if (this.inBounds(ni, nj) && this.tiles[this.idx(ni, nj)] !== T_WATER) shore = true;
      }
      this.waterDepth[k] = shore ? 1 : 0;
      if (shore) q.push(k);
    }
    let h = 0;
    while (h < q.length) {
      const k = q[h++];
      const i = k % this.w, j = (k / this.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + dx, nj = j + dy;
        if (!this.inBounds(ni, nj)) continue;
        const nk = this.idx(ni, nj);
        if (this.tiles[nk] === T_WATER && !this.waterDepth[nk]) { this.waterDepth[nk] = Math.min(250, this.waterDepth[k] + 1); q.push(nk); }
      }
    }
  }

  // ---- ground rendering ----------------------------------------------------------
  get originX() { return this.h * HALF_W; }

  buildGround() {
    const W = (this.w + this.h) * HALF_W, H = (this.w + this.h) * HALF_H + 8;
    this.ground = U.makeCanvas(W, H);
    this.gctx = this.ground.getContext('2d');
    this.gimg = this.gctx.createImageData(W, H);
    this.renderGroundRect(0, 0, W, H);
  }

  // Re-render a screen-space rectangle of the ground canvas.
  renderGroundRect(x0, y0, w, h) {
    const W = this.ground.width, H = this.ground.height;
    x0 = U.clamp(Math.floor(x0), 0, W); y0 = U.clamp(Math.floor(y0), 0, H);
    const x1 = U.clamp(Math.ceil(x0 + w), 0, W), y1 = U.clamp(Math.ceil(y0 + h), 0, H);
    const d = this.gimg.data, ox = this.originX;
    const out = U.hexToRgb(this.T.outside);
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const a = (px - ox + 0.5) / HALF_W, b = (py + 0.5) / HALF_H;
        const wx = (a + b) / 2, wy = (b - a) / 2;
        let c;
        if (wx < 0 || wy < 0 || wx >= this.w || wy >= this.h) {
          const n = U.hash2(px >> 1, py >> 1, 99) * 10;
          c = [out[0] + n, out[1] + n, out[2] + n];
        } else c = this.groundPixel(wx, wy, px, py);
        const k = (py * W + px) * 4;
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
    }
    this.gctx.putImageData(this.gimg, 0, 0, x0, y0, x1 - x0, y1 - y0);
  }

  jitterTile(wx, wy) {
    const s = this.seed;
    const nx = (U.valueNoise(wx * 2.2, wy * 2.2, s) - 0.5) * 0.8;
    const ny = (U.valueNoise(wx * 2.2 + 31, wy * 2.2 + 17, s) - 0.5) * 0.8;
    let i = Math.floor(wx + nx), j = Math.floor(wy + ny);
    i = U.clamp(i, 0, this.w - 1); j = U.clamp(j, 0, this.h - 1);
    return this.idx(i, j);
  }

  groundPixel(wx, wy, px, py) {
    const P = this.T.pal, s = this.seed;
    const k = this.jitterTile(wx, wy);
    const t = this.tiles[k];
    const hsh = U.hash2(px, py, s);
    const n = U.valueNoise(wx * 0.7, wy * 0.7, s + 3) * 0.6 + U.valueNoise(wx * 2.1, wy * 2.1, s + 5) * 0.4;
    let c;
    switch (t) {
      case T_GRASS: {
        let idx = Math.floor(n * 2.6 + hsh * 1.3);
        const blade = U.hash2(px, py >> 1, s + 9);
        if (blade > 0.93) idx += 1;
        c = P.grass[U.clamp(idx, 0, 3)];
        if (hsh > 0.9985) c = [236, 220, 120];
        else if (hsh < 0.0012) c = [240, 130, 170];
        break;
      }
      case T_DIRT: c = P.dirt[U.clamp(Math.floor(n * 2.2 + hsh * 1.1), 0, 2)]; if (hsh > 0.985) c = P.rock[0]; break;
      case T_SAND: {
        const rip = Math.sin((wx + wy) * 5 + n * 5);
        c = P.sand[U.clamp(Math.floor(n * 1.5 + hsh * 0.8 + (rip > 0.8 ? 1 : 0)), 0, 2)];
        break;
      }
      case T_STONE: {
        const u = wx * 2, v = wy * 2 + (Math.floor(wx * 2) % 2) * 0.5;
        const fu = u - Math.floor(u), fv = v - Math.floor(v);
        const mortar = fu < 0.08 || fv < 0.08;
        c = P.stone[mortar ? 0 : U.clamp(Math.floor(1 + U.hash2(Math.floor(u), Math.floor(v), s) * 1.9), 1, 2)];
        if (mortar) c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
        break;
      }
      case T_WOOD: {
        const v = wy * 4, fv = v - Math.floor(v);
        const seam = fv < 0.12 || ((wx * 1.3 + Math.floor(v) * 0.37) % 1) < 0.03;
        c = P.wood[seam ? 0 : U.clamp(Math.floor(1 + hsh * 1.6), 1, 2)];
        break;
      }
      case T_ROCK: c = P.rock[U.clamp(Math.floor(n * 2.4 + hsh * 0.9), 0, 2)]; if (hsh > 0.97) c = P.rock[0]; break;
      case T_SNOW: c = P.snow[U.clamp(Math.floor(n * 2.2 + hsh * 0.8), 0, 2)]; break;
      case T_WATER: {
        const depth = this.waterDepth ? this.waterDepth[k] : 3;
        const W = P.water;
        let base = depth <= 1 ? W[2] : depth <= 3 ? W[1] : W[0];
        const wave = U.valueNoise(wx * 3, wy * 1.2, s + 11);
        if (depth <= 1 && wave > 0.72) base = W[3];
        else if (wave > 0.8) base = W[Math.max(0, (depth <= 1 ? 2 : depth <= 3 ? 1 : 0) + 1)];
        c = base;
        break;
      }
      default: c = P.grass[1];
    }
    c = [c[0], c[1], c[2]];
    // shoreline: darken land pixels right next to water
    if (t !== T_WATER) {
      const k2 = this.jitterTile(wx + 0.18, wy + 0.18), k3 = this.jitterTile(wx - 0.18, wy - 0.18);
      if (this.tiles[k2] === T_WATER || this.tiles[k3] === T_WATER) { c[0] *= 0.72; c[1] *= 0.72; c[2] *= 0.78; }
    }
    // stains (scorch, craters, rubble, stumps)
    const ti = Math.floor(wx), tj = Math.floor(wy);
    // burnt grass: soft scorch blobs that merge across neighbouring tiles
    if (this.anyBurnt) {
      let best = 9;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ni = ti + di, nj = tj + dj;
        if (!this.inBounds(ni, nj) || !this.burnt[this.idx(ni, nj)]) continue;
        best = Math.min(best, U.dist(wx, wy, ni + 0.5, nj + 0.5) / 0.78);
      }
      if (best < 1.2) {
        const e = best + (U.valueNoise(wx * 3.5, wy * 3.5, 7) - 0.5) * 0.45;
        if (e < 1) applyStain(c, 'scorch', e + 0.35, hsh, wx, wy, t);
      }
    }
    const list = this.stainTiles[this.idx(ti, tj)];
    if (list) {
      for (const si of list) {
        const st = this.stains[si];
        const dd = U.dist(wx, wy, st.x, st.y) / st.r;
        if (dd >= 1.15) continue;
        const edge = dd + (U.valueNoise(wx * 4, wy * 4, si) - 0.5) * 0.35;
        if (edge > 1) continue;
        applyStain(c, st.type, edge, hsh, wx, wy, t);
      }
    }
    return c;
  }

  addStain(x, y, r, type) {
    if (this.stains.length > 1400) return;
    const si = this.stains.length;
    this.stains.push({ x, y, r, type });
    const R = r * 1.2;
    for (let j = Math.floor(y - R); j <= Math.floor(y + R); j++)
      for (let i = Math.floor(x - R); i <= Math.floor(x + R); i++) {
        if (!this.inBounds(i, j)) continue;
        const k = this.idx(i, j);
        (this.stainTiles[k] || (this.stainTiles[k] = [])).push(si);
      }
    this.redrawWorldCircle(x, y, R);
  }

  redrawWorldCircle(x, y, r) {
    const sx = ISO.sx(x, y) + this.originX, sy = ISO.sy(x, y);
    const rx = r * ISO_RX + 4, ry = r * ISO_RY + 4;
    this.renderGroundRect(sx - rx, sy - ry, rx * 2, ry * 2);
  }

  // ---- terrain dynamics ----------------------------------------------------------
  ignite(i, j, t = 3.5) {
    if (!this.inBounds(i, j)) return false;
    const k = this.idx(i, j);
    const tt = this.tiles[k];
    const b = this.blocks[k];
    if (tt === T_WATER || this.wet[k] > 0) return false;
    const burnableGround = (tt === T_GRASS) && !this.burnt[k];
    const burnableBlock = b && b.def.burn;
    if (!burnableGround && !burnableBlock) return false;
    if (this.burningList.size > 90) return false;
    if (this.fire[k] <= 0) this.burningList.add(k);
    this.fire[k] = Math.max(this.fire[k], t);
    if (burnableBlock) b.burning = Math.max(b.burning, t + 2);
    return true;
  }
  igniteRadius(x, y, r, chance = 0.7) {
    for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++)
      for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++)
        if (U.dist(i + 0.5, j + 0.5, x, y) <= r && Math.random() < chance) this.ignite(i, j, U.rand(2.5, 4.5));
  }
  extinguishRadius(x, y, r) {
    for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++)
      for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) {
        if (!this.inBounds(i, j) || U.dist(i + 0.5, j + 0.5, x, y) > r) continue;
        const k = this.idx(i, j);
        if (this.fire[k] > 0) { this.fire[k] = 0; this.burningList.delete(k); FX.smoke(i + 0.5, j + 0.5, 3); }
        const b = this.blocks[k];
        if (b) b.burning = 0;
      }
  }
  wetRadius(x, y, r, t = 8) {
    this.extinguishRadius(x, y, r);
    for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++)
      for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) {
        if (!this.inBounds(i, j) || U.dist(i + 0.5, j + 0.5, x, y) > r) continue;
        const k = this.idx(i, j);
        if (this.tiles[k] === T_WATER) continue;
        this.wet[k] = Math.max(this.wet[k], t * U.rand(0.8, 1.2));
        this.wetList.add(k);
      }
  }
  // Fan fire outward (wind jutsu over flames).
  fanFlames(x, y, r) {
    for (let j = Math.floor(y - r); j <= Math.floor(y + r); j++)
      for (let i = Math.floor(x - r); i <= Math.floor(x + r); i++) {
        if (!this.inBounds(i, j)) continue;
        if (this.fire[this.idx(i, j)] > 0) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) this.ignite(i + dx, j + dy, 3);
        }
      }
  }

  update(dt, world) {
    // fire
    this.fireTick += dt;
    const spread = this.fireTick >= 0.4;
    if (spread) this.fireTick = 0;
    for (const k of [...this.burningList]) {
      this.fire[k] -= dt;
      const i = k % this.w, j = (k / this.w) | 0;
      if (Math.random() < dt * 7) FX.flame(i + U.rand(0.1, 0.9), j + U.rand(0.1, 0.9));
      const b = this.blocks[k];
      if (b && b.def.burn) {
        this.damageBlock(i, j, 14 * dt, 'fire', null, true);
      }
      if (spread) {
        // Grass fires fizzle out on their own (R0 < 1); burning trees and
        // houses throw sparks much further.
        const p = b && b.def.burn ? 0.075 : 0.022;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (Math.random() < p) this.ignite(i + dx, j + dy, U.rand(2.2, 3.6));
        }
      }
      if (this.fire[k] <= 0) {
        this.fire[k] = 0;
        this.burningList.delete(k);
        if (this.tiles[k] === T_GRASS && !this.burnt[k]) {
          this.burnt[k] = 1;
          this.anyBurnt = true;
          this.redrawWorldCircle(i + 0.5, j + 0.5, 1.1);
        }
        FX.smoke(i + 0.5, j + 0.5, 2);
      }
    }
    // puddles dry
    for (const k of [...this.wetList]) {
      this.wet[k] -= dt;
      if (this.wet[k] <= 0) { this.wet[k] = 0; this.wetList.delete(k); }
    }
    // temporary blocks (earth walls) crumble
    for (let n = this.tempBlocks.length - 1; n >= 0; n--) {
      const b = this.tempBlocks[n];
      if (this.blocks[this.idx(b.i, b.j)] !== b) { this.tempBlocks.splice(n, 1); continue; }
      b.life -= dt;
      if (b.life <= 0) { this.destroyBlock(b, null, true); this.tempBlocks.splice(n, 1); }
    }
    // flash/shake decay on blocks happens lazily in render (time-based)
  }

  addTempBlock(i, j, type, life) {
    if (!this.inBounds(i, j) || this.isSolid(i, j)) return null;
    if (Math.min(i, j, this.w - 1 - i, this.h - 1 - j) < 2) return null;
    const b = this.setBlock(i, j, type);
    b.life = life;
    b.rise = 0.25;
    this.tempBlocks.push(b);
    return b;
  }

  // ---- destruction -------------------------------------------------------------
  damageBlock(i, j, dmg, element, src, quiet) {
    const b = this.block(i, j);
    if (!b || b.def.hp === Infinity) return false;
    let m = 1;
    if (element === 'fire' && b.def.burn) m = 1.6;
    if (element === 'lightning' && b.def.mat === 'earth') m = 2;
    if (element === 'earth' && b.def.mat === 'stone') m = 1.3;
    if (element === 'wind' && (b.def.mat === 'leaf' || b.def.mat === 'wood')) m = 1.3;
    b.hp -= dmg * m;
    if (!quiet) {
      b.flash = 0.12; b.shake = 0.18;
      if (dmg > 6) {
        FX.debris(i + 0.5, j + 0.5, b.def.h * 0.5, MATERIALS[b.def.mat].colors, Math.min(8, 2 + dmg / 12));
        SFX.playAt(MATERIALS[b.def.mat].sfx, i + 0.5, j + 0.5, 0.35);
      }
    }
    if (element === 'fire' && b.def.burn && !quiet) this.ignite(i, j, 3.5);
    if (b.hp <= 0) { this.destroyBlock(b, src); return true; }
    return false;
  }

  destroyBlock(b, src, quiet) {
    const { i, j } = b;
    if (this.blocks[this.idx(i, j)] !== b) return;
    this.clearBlock(i, j);
    const mat = MATERIALS[b.def.mat];
    const x = i + 0.5, y = j + 0.5;
    FX.debris(x, y, b.def.h * 0.6, mat.colors, quiet ? 8 : 18, 1.4);
    FX.dust(x, y, quiet ? 4 : 10);
    if (!quiet) SFX.playAt(mat.sfx === 'wood' ? 'crumble' : mat.sfx, x, y, 0.7);
    if (b.type === 'tree' || b.type === 'pine' || b.type === 'palm') this.addStain(x, y, 0.28, 'stump');
    else if (mat.rubble === 'rubble' && b.type !== 'earthwall') this.addStain(x, y, 0.55, 'rubble');
    else if (mat.rubble === 'wood') this.addStain(x, y, 0.5, 'wood');
    else if (b.type === 'earthwall') this.addStain(x, y, 0.45, 'rubble');
    const k = this.idx(i, j);
    if (this.fire[k] > 0 && this.tiles[k] !== T_GRASS) { this.fire[k] = 0; this.burningList.delete(k); }
    if (b.def.explosive && typeof Combat !== 'undefined' && W) {
      Combat.explosion(src, x, y, 1.8, 45, 'fire', { launch: 180, knock: 7 });
    }
    if (W && W.onBlockDestroyed) W.onBlockDestroyed(b, src);
  }

  damageRadius(x, y, r, dmg, element, src) {
    for (let j = Math.floor(y - r - 0.5); j <= Math.floor(y + r + 0.5); j++)
      for (let i = Math.floor(x - r - 0.5); i <= Math.floor(x + r + 0.5); i++) {
        const b = this.block(i, j);
        if (!b) continue;
        const d = U.dist(i + 0.5, j + 0.5, x, y);
        if (d <= r + 0.4) this.damageBlock(i, j, dmg * (1 - 0.5 * d / (r + 0.4)), element, src);
      }
  }

  // ---- collision -------------------------------------------------------------------
  // Push a circle out of solid blocks. Returns first block hit (for wall-splats).
  resolveCircle(ent, r) {
    let hit = null;
    const i0 = Math.floor(ent.x - r - 0.5), i1 = Math.floor(ent.x + r + 0.5);
    const j0 = Math.floor(ent.y - r - 0.5), j1 = Math.floor(ent.y + r + 0.5);
    for (let pass = 0; pass < 2; pass++) {
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (!this.inBounds(i, j)) continue;
        const b = this.blocks[this.idx(i, j)];
        if (!b || b.def.soft) continue;
        if (ent.z > b.def.h + 2) continue; // flying over low props
        if (b.def.round) {
          const cx = i + 0.5, cy = j + 0.5, rr = b.def.round + r;
          const dx = ent.x - cx, dy = ent.y - cy, d = Math.hypot(dx, dy);
          if (d < rr) {
            const nx = d > 1e-4 ? dx / d : 1, ny = d > 1e-4 ? dy / d : 0;
            ent.x = cx + nx * rr; ent.y = cy + ny * rr;
            hit = hit || { b, nx, ny };
          }
        } else {
          const px = U.clamp(ent.x, i, i + 1), py = U.clamp(ent.y, j, j + 1);
          const dx = ent.x - px, dy = ent.y - py, d = Math.hypot(dx, dy);
          if (d < r) {
            if (d > 1e-4) {
              ent.x = px + (dx / d) * r; ent.y = py + (dy / d) * r;
              hit = hit || { b, nx: dx / d, ny: dy / d };
            } else {
              // centre inside the box: push out along the shallowest axis
              const l = ent.x - i, rgt = i + 1 - ent.x, t = ent.y - j, btm = j + 1 - ent.y;
              const m = Math.min(l, rgt, t, btm);
              if (m === l) { ent.x = i - r; hit = hit || { b, nx: -1, ny: 0 }; }
              else if (m === rgt) { ent.x = i + 1 + r; hit = hit || { b, nx: 1, ny: 0 }; }
              else if (m === t) { ent.y = j - r; hit = hit || { b, nx: 0, ny: -1 }; }
              else { ent.y = j + 1 + r; hit = hit || { b, nx: 0, ny: 1 }; }
            }
          }
        }
      }
    }
    ent.x = U.clamp(ent.x, 0.5, this.w - 0.5);
    ent.y = U.clamp(ent.y, 0.5, this.h - 0.5);
    return hit;
  }

  // Does a point at height z sit inside a solid block?
  pointBlocked(x, y, z) {
    const i = Math.floor(x), j = Math.floor(y);
    if (!this.inBounds(i, j)) return { b: null };
    const b = this.blocks[this.idx(i, j)];
    if (!b || b.def.soft || z > b.def.h) return null;
    if (b.def.round && U.dist(x, y, i + 0.5, j + 0.5) > b.def.round + 0.05) return null;
    return { b };
  }

  // Grid ray march; returns true if line of sight is clear at height z.
  lineClear(x0, y0, x1, y1, z = 12) {
    const d = U.dist(x0, y0, x1, y1);
    const steps = Math.ceil(d / 0.25);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const i = Math.floor(x), j = Math.floor(y);
      if (!this.inBounds(i, j)) return false;
      const b = this.blocks[this.idx(i, j)];
      if (b && !b.def.soft && b.def.h >= z) {
        if (!b.def.round || U.dist(x, y, i + 0.5, j + 0.5) < b.def.round) return false;
      }
    }
    return true;
  }
  // Walkable straight line for a circle of radius r (used for path smoothing).
  walkClear(x0, y0, x1, y1, r = 0.3) {
    const d = U.dist(x0, y0, x1, y1);
    const steps = Math.ceil(d / 0.2);
    const nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const o of [-r, 0, r]) {
        const i = Math.floor(x + nx * o), j = Math.floor(y + ny * o);
        if (this.isSolid(i, j)) return false;
      }
    }
    return true;
  }

  // ---- pathfinding (A*, 8-dir, no corner cutting) -----------------------------------
  findPath(sx, sy, tx, ty, maxIter = 2500) {
    const w = this.w, h = this.h;
    const si = U.clamp(Math.floor(sx), 0, w - 1), sj = U.clamp(Math.floor(sy), 0, h - 1);
    let ti = U.clamp(Math.floor(tx), 0, w - 1), tj = U.clamp(Math.floor(ty), 0, h - 1);
    if (this.isSolid(ti, tj)) {
      const p = this.nearestOpen(tx, ty, 3);
      if (!p) return null;
      ti = Math.floor(p.x); tj = Math.floor(p.y);
    }
    const n = w * h;
    if (!this._g || this._g.length !== n) {
      this._g = new Float32Array(n); this._from = new Int32Array(n); this._stamp = new Uint32Array(n); this._closed = new Uint32Array(n); this._run = 0;
    }
    const g = this._g, from = this._from, stamp = this._stamp, closed = this._closed;
    const run = ++this._run;
    const start = sj * w + si, goal = tj * w + ti;
    const heap = new MinHeap();
    const hfn = (i, j) => { const dx = Math.abs(i - ti), dy = Math.abs(j - tj); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    g[start] = 0; stamp[start] = run; from[start] = -1;
    heap.push(start, hfn(si, sj));
    let iter = 0, best = start, bestH = hfn(si, sj);
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    while (heap.size && iter++ < maxIter) {
      const cur = heap.pop();
      if (closed[cur] === run) continue;
      closed[cur] = run;
      if (cur === goal) { best = cur; break; }
      const ci = cur % w, cj = (cur / w) | 0;
      const hh = hfn(ci, cj);
      if (hh < bestH) { bestH = hh; best = cur; }
      for (const [dx, dy, cost] of DIRS) {
        const ni = ci + dx, nj = cj + dy;
        if (ni < 0 || nj < 0 || ni >= w || nj >= h) continue;
        if (this.isSolid(ni, nj)) continue;
        if (dx && dy && (this.isSolid(ci + dx, cj) || this.isSolid(ci, cj + dy))) continue;
        const nk = nj * w + ni;
        if (closed[nk] === run) continue;
        const ng = g[cur] + cost + (this.fire[nk] > 0 ? 3 : 0);
        if (stamp[nk] !== run || ng < g[nk]) {
          stamp[nk] = run; g[nk] = ng; from[nk] = cur;
          heap.push(nk, ng + hfn(ni, nj));
        }
      }
    }
    const path = [];
    let c = best;
    let guard = 0;
    while (c !== -1 && c !== start && guard++ < 5000) { path.push({ x: (c % w) + 0.5, y: ((c / w) | 0) + 0.5 }); c = from[c]; }
    path.reverse();
    return path;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(key, pri) {
    const k = this.k, p = this.p;
    k.push(key); p.push(pri);
    let i = k.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (p[par] <= p[i]) break;
      [k[par], k[i]] = [k[i], k[par]]; [p[par], p[i]] = [p[i], p[par]];
      i = par;
    }
  }
  pop() {
    const k = this.k, p = this.p;
    const top = k[0];
    const lk = k.pop(), lp = p.pop();
    if (k.length) {
      k[0] = lk; p[0] = lp;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < k.length && p[l] < p[m]) m = l;
        if (r < k.length && p[r] < p[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]]; [p[m], p[i]] = [p[i], p[m]];
        i = m;
      }
    }
    return top;
  }
}

function applyStain(c, type, e, hsh, wx, wy, tileType) {
  switch (type) {
    case 'scorch': {
      if (hsh < 0.12 && e > 0.6) return;
      const k = e < 0.5 ? 0.38 : 0.55;
      c[0] = c[0] * k + 8; c[1] = c[1] * k + 6; c[2] = c[2] * k + 6;
      if (hsh > 0.985) { c[0] = 255; c[1] = 140; c[2] = 40; } // embers
      break;
    }
    case 'crater': {
      if (e < 0.72) { const k = 0.45 + e * 0.35; c[0] = c[0] * k * 0.9 + 20; c[1] = c[1] * k * 0.85 + 14; c[2] = c[2] * k * 0.8 + 10; }
      else if (e < 0.9) { c[0] = c[0] * 1.15 + 12; c[1] = c[1] * 1.1 + 10; c[2] = c[2] * 1.05 + 8; }
      else { c[0] *= 0.8; c[1] *= 0.8; c[2] *= 0.8; }
      if (hsh > 0.93 && e < 0.8) { c[0] = 110; c[1] = 104; c[2] = 98; }
      break;
    }
    case 'rubble': {
      if (hsh > 0.55) { const v = 100 + hsh * 70; c[0] = v; c[1] = v * 0.97; c[2] = v * 0.94; }
      else if (hsh > 0.35) { c[0] *= 0.75; c[1] *= 0.75; c[2] *= 0.75; }
      break;
    }
    case 'wood': {
      if (hsh > 0.6) { c[0] = 130 + hsh * 30; c[1] = 88 + hsh * 20; c[2] = 48; }
      else if (hsh > 0.45) { c[0] *= 0.7; c[1] *= 0.7; c[2] *= 0.7; }
      break;
    }
    case 'stump': {
      if (e < 0.55) { c[0] = 176; c[1] = 132; c[2] = 82; if (e > 0.25 && e < 0.35) { c[0] = 140; c[1] = 100; c[2] = 60; } }
      else if (e < 0.85) { c[0] = 96; c[1] = 62; c[2] = 36; }
      break;
    }
    case 'frost': {
      c[0] = c[0] * 0.5 + 110; c[1] = c[1] * 0.5 + 120; c[2] = c[2] * 0.5 + 128;
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Theme generators
// ---------------------------------------------------------------------------
const GEN = {
  // helpers
  _fill(A, t) { A.tiles.fill(t); },
  _noisePatch(A, t, scale, thr, seed, onlyOn) {
    for (let j = 0; j < A.h; j++) for (let i = 0; i < A.w; i++) {
      const k = A.idx(i, j);
      if (onlyOn !== undefined && A.tiles[k] !== onlyOn) continue;
      if (U.fbm(i * scale, j * scale, seed, 3) > thr) A.tiles[k] = t;
    }
  },
  _disc(A, cx, cy, r, t, noise = 0, seed = 1) {
    for (let j = Math.floor(cy - r - 2); j <= cy + r + 2; j++) for (let i = Math.floor(cx - r - 2); i <= cx + r + 2; i++) {
      if (!A.inBounds(i, j)) continue;
      const rr = r + (noise ? (U.valueNoise(i * 0.3, j * 0.3, seed) - 0.5) * noise : 0);
      if (U.dist(i + 0.5, j + 0.5, cx, cy) <= rr) A.tiles[A.idx(i, j)] = t;
    }
  },
  _rect(A, x0, y0, x1, y1, t) {
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (A.inBounds(i, j)) A.tiles[A.idx(i, j)] = t;
  },
  _path(A, pts, width, t) {
    for (let n = 0; n < pts.length - 1; n++) {
      const [ax, ay] = pts[n], [bx, by] = pts[n + 1];
      const d = U.dist(ax, ay, bx, by);
      for (let s = 0; s <= d * 3; s++) {
        const x = U.lerp(ax, bx, s / (d * 3)), y = U.lerp(ay, by, s / (d * 3));
        GEN._disc(A, x, y, width / 2, t);
      }
    }
  },
  _free(A, i, j, rad = 0) {
    for (let y = j - rad; y <= j + rad; y++) for (let x = i - rad; x <= i + rad; x++) {
      if (!A.inBounds(x, y) || A.blocks[A.idx(x, y)]) return false;
    }
    return Math.min(i, j, A.w - 1 - i, A.h - 1 - j) >= 3;
  },
  _scatter(A, r, type, count, opts = {}) {
    let placed = 0, tries = 0;
    while (placed < count && tries++ < count * 30) {
      const i = r.int(3, A.w - 4), j = r.int(3, A.h - 4);
      const k = A.idx(i, j);
      if (opts.on && !opts.on.includes(A.tiles[k])) continue;
      if (opts.avoid && opts.avoid(i, j)) continue;
      if (!GEN._free(A, i, j, opts.space || 0)) continue;
      if (opts.cluster && r.chance(0.6)) {
        // grow a small grove around the point
        for (let c = 0; c < opts.cluster; c++) {
          const ci = i + r.int(-2, 2), cj = j + r.int(-2, 2);
          if (A.inBounds(ci, cj) && GEN._free(A, ci, cj, 0) && (!opts.on || opts.on.includes(A.tiles[A.idx(ci, cj)])) && !(opts.avoid && opts.avoid(ci, cj))) {
            A.setBlock(ci, cj, typeof type === 'function' ? type(r) : type, r.int(0, 20));
          }
        }
      }
      A.setBlock(i, j, typeof type === 'function' ? type(r) : type, r.int(0, 20));
      placed++;
    }
  },
  _house(A, x0, y0, w, h, r) {
    const v = r.int(0, 40);
    for (let j = y0; j < y0 + h; j++) for (let i = x0; i < x0 + w; i++) {
      if (!A.inBounds(i, j)) continue;
      A.tiles[A.idx(i, j)] = T_WOOD;
      A.setBlock(i, j, 'house', v - (v % 7) + ((i * 3 + j) % 7));
    }
  },

  forest(A, r) {
    const W = A.w, c = W / 2;
    GEN._fill(A, T_GRASS);
    GEN._noisePatch(A, T_DIRT, 0.09, 0.64, A.seed + 1);
    // central plaza
    GEN._disc(A, c, c, 6.5, T_STONE);
    GEN._disc(A, c, c, 2.5, T_DIRT);
    // river on the east with bridges
    const riverX = (j) => W * 0.74 + Math.sin(j * 0.11 + A.seed) * 4 + Math.sin(j * 0.27) * 1.5;
    for (let j = 0; j < W; j++) {
      const rx = riverX(j);
      for (let i = Math.floor(rx - 2); i <= Math.ceil(rx + 2); i++) if (A.inBounds(i, j) && Math.abs(i + 0.5 - rx) <= 1.9) A.tiles[A.idx(i, j)] = T_WATER;
    }
    // pond feeding the river
    GEN._disc(A, W * 0.8, W * 0.72, 5, T_WATER, 3, A.seed);
    // roads from plaza
    GEN._path(A, [[c, c], [c, 6]], 2.2, T_STONE);
    GEN._path(A, [[c, c], [6, c]], 2.2, T_STONE);
    GEN._path(A, [[c, c], [W - 6, c]], 2.2, T_STONE);
    GEN._path(A, [[c, c], [c, W - 6]], 2.2, T_STONE);
    for (const bj of [c - 1, c, c + 1, 14, 15, 46, 47]) {
      const rx = riverX(bj);
      for (let i = Math.floor(rx - 3); i <= Math.ceil(rx + 3); i++) if (A.inBounds(i, bj) && A.tiles[A.idx(i, bj)] === T_WATER) A.tiles[A.idx(i, bj)] = T_WOOD;
    }
    // village (north-west quadrant)
    for (let hy = 6; hy < c - 8; hy += 7) {
      for (let hx = 6; hx < c - 8; hx += 7) {
        if (r.chance(0.12)) continue;
        const w = r.int(3, 5), h = r.int(3, 5);
        GEN._rect(A, hx - 1, hy - 1, hx + w, hy + h, T_STONE);
        GEN._house(A, hx, hy, w, h, r);
        if (r.chance(0.5)) A.setBlock(hx + w + 1, hy + r.int(0, h - 1), r.chance(0.5) ? 'crate' : 'barrel');
        if (r.chance(0.4)) A.setBlock(hx - 1, hy + h, 'lantern');
      }
    }
    // a few houses south-west too
    for (let n = 0; n < 4; n++) {
      const hx = r.int(7, c - 12), hy = r.int(c + 8, W - 12);
      if (GEN._free(A, hx - 1, hy - 1, 5)) { GEN._rect(A, hx - 1, hy - 1, hx + 4, hy + 4, T_DIRT); GEN._house(A, hx, hy, 4, r.int(3, 4), r); }
    }
    // training ground (south-west): dirt field with logs and a fence line
    GEN._disc(A, c - 14, c + 13, 5, T_DIRT, 2, A.seed + 7);
    for (let n = 0; n < 5; n++) A.setBlock(Math.floor(c - 16 + n * 1.5), c + 11 + (n % 2) * 3, 'log');
    for (let n = -4; n <= 4; n++) if (n % 3) A.setBlock(c - 20 + n, c + 19, 'fence', 1);
    // plaza decorations
    for (const [dx, dy] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) A.setBlock(Math.floor(c + dx), Math.floor(c + dy), 'lantern');
    // forest in north-east & scattered trees
    const avoidRoads = (i, j) => { const t = A.tiles[A.idx(i, j)]; return t === T_STONE || t === T_WATER || t === T_WOOD || U.dist(i, j, c, c) < 9; };
    GEN._scatter(A, r, (q) => q.pick(['tree', 'tree', 'pine']), 70, { on: [T_GRASS, T_DIRT], avoid: (i, j) => avoidRoads(i, j) || !(i > c + 2 && j < c - 2) , cluster: 3 });
    GEN._scatter(A, r, (q) => q.pick(['tree', 'tree', 'pine', 'bush']), 55, { on: [T_GRASS], avoid: avoidRoads, cluster: 2 });
    GEN._scatter(A, r, (q) => q.pick(['rock', 'rock', 'boulder']), 26, { on: [T_GRASS, T_DIRT], avoid: avoidRoads });
    GEN._scatter(A, r, 'bush', 30, { on: [T_GRASS], avoid: avoidRoads });
    GEN._scatter(A, r, (q) => q.pick(['crate', 'barrel']), 10, { on: [T_GRASS, T_DIRT], avoid: avoidRoads });
    // rocks along the river bank
    GEN._scatter(A, r, 'rock', 10, { on: [T_GRASS], avoid: (i, j) => Math.abs(i - riverX(j)) > 4 || avoidRoads(i, j) });
  },

  valley(A, r) {
    const W = A.w, c = W / 2;
    GEN._fill(A, T_ROCK);
    GEN._noisePatch(A, T_GRASS, 0.08, 0.56, A.seed + 2);
    GEN._noisePatch(A, T_DIRT, 0.12, 0.66, A.seed + 3, T_ROCK);
    // great river down the middle, widening into a lake in the south
    const rx = (j) => c + Math.sin(j * 0.08 + 1) * 3;
    for (let j = 0; j < W; j++) {
      const width = 2.2 + Math.max(0, (j - W * 0.62)) * 0.25;
      const x = rx(j);
      for (let i = Math.floor(x - width - 1); i <= Math.ceil(x + width + 1); i++) if (A.inBounds(i, j) && Math.abs(i + 0.5 - x) <= width) A.tiles[A.idx(i, j)] = T_WATER;
    }
    GEN._disc(A, c, W * 0.8, 7.5, T_WATER, 4, A.seed + 4);
    // stepping stones across the river
    for (const j of [16, 30, 38]) {
      const x = Math.floor(rx(j));
      for (let i = x - 4; i <= x + 4; i++) if (A.inBounds(i, j) && A.tiles[A.idx(i, j)] === T_WATER && (i % 2 === 0)) A.tiles[A.idx(i, j)] = T_STONE;
    }
    // twin statues guarding the falls (north)
    const sj = 8;
    for (const sx of [Math.floor(c - 8), Math.floor(c + 7)]) {
      GEN._rect(A, sx - 2, sj - 2, sx + 2, sj + 2, T_STONE);
      A.setBlock(sx, sj, 'statue', sx);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [1, 1], [1, -1], [-1, -1]]) A.setBlock(sx + dx, sj + dy, 'stonepile');
    }
    // cliff outcrops and rock formations
    for (let n = 0; n < 9; n++) {
      const ox = r.int(6, W - 8), oy = r.int(6, W - 8);
      if (U.dist(ox, oy, c, c) < 10 || Math.abs(ox - rx(oy)) < 5) continue;
      const w = r.int(2, 4), h = r.int(2, 3);
      for (let j = oy; j < oy + h; j++) for (let i = ox; i < ox + w; i++) if (GEN._free(A, i, j, 0) && A.tiles[A.idx(i, j)] !== T_WATER) A.setBlock(i, j, 'cliff', r.int(0, 20));
    }
    const avoid = (i, j) => A.tiles[A.idx(i, j)] === T_WATER || U.dist(i, j, c, c) < 7;
    GEN._scatter(A, r, (q) => q.pick(['rock', 'boulder', 'boulder']), 45, { on: [T_ROCK, T_DIRT, T_GRASS], avoid });
    GEN._scatter(A, r, (q) => q.pick(['tree', 'pine']), 34, { on: [T_GRASS], avoid, cluster: 2 });
    GEN._scatter(A, r, 'bush', 20, { on: [T_GRASS], avoid });
    GEN._scatter(A, r, 'pillar', 6, { on: [T_ROCK], avoid });
  },

  desert(A, r) {
    const W = A.w, c = W / 2;
    GEN._fill(A, T_SAND);
    GEN._noisePatch(A, T_DIRT, 0.1, 0.66, A.seed + 5);
    // oasis
    const ox = c + 13, oy = c - 12;
    GEN._disc(A, ox, oy, 8, T_GRASS, 3, A.seed + 1);
    GEN._disc(A, ox, oy, 5, T_WATER, 3, A.seed + 2);
    // ruined temple complex (west)
    const tx = c - 16, ty = c - 4;
    GEN._rect(A, tx - 7, ty - 8, tx + 7, ty + 8, T_STONE);
    for (let i = tx - 7; i <= tx + 7; i++) for (const j of [ty - 8, ty + 8]) if (r.chance(0.72)) A.setBlock(i, j, 'ruin', r.int(0, 20));
    for (let j = ty - 8; j <= ty + 8; j++) for (const i of [tx - 7, tx + 7]) if (r.chance(0.72) && Math.abs(j - ty) > 1) A.setBlock(i, j, 'ruin', r.int(0, 20));
    for (let j = ty - 5; j <= ty + 5; j += 3) { A.setBlock(tx - 3, j, 'pillar'); A.setBlock(tx + 3, j, 'pillar'); }
    // colonnade road through the middle
    GEN._path(A, [[6, c], [W - 6, c]], 3, T_STONE);
    for (let i = 8; i < W - 8; i += 4) { if (Math.abs(i - c) < 5) continue; A.setBlock(i, c - 3, 'pillar'); A.setBlock(i, c + 3, 'pillar'); }
    // plaza
    GEN._disc(A, c, c, 5, T_STONE);
    // scattered ruin fragments (south-east)
    for (let n = 0; n < 8; n++) {
      const rx = r.int(c + 4, W - 8), ry = r.int(c + 6, W - 8);
      const len = r.int(3, 6), horiz = r.chance(0.5);
      for (let k = 0; k < len; k++) { const i = horiz ? rx + k : rx, j = horiz ? ry : ry + k; if (GEN._free(A, i, j, 0)) A.setBlock(i, j, 'ruin', r.int(0, 20)); }
    }
    const avoid = (i, j) => { const t = A.tiles[A.idx(i, j)]; return t === T_WATER || t === T_STONE || U.dist(i, j, c, c) < 7; };
    GEN._scatter(A, r, 'palm', 14, { on: [T_GRASS], avoid });
    GEN._scatter(A, r, 'cactus', 34, { on: [T_SAND, T_DIRT], avoid });
    GEN._scatter(A, r, (q) => q.pick(['rock', 'boulder']), 30, { on: [T_SAND, T_DIRT], avoid });
    GEN._scatter(A, r, (q) => q.pick(['crate', 'barrel', 'barrel']), 12, { on: [T_SAND, T_STONE], avoid: (i, j) => U.dist(i, j, c, c) < 7 });
  },

  snow(A, r) {
    const W = A.w, c = W / 2;
    GEN._fill(A, T_SNOW);
    GEN._noisePatch(A, T_ROCK, 0.1, 0.63, A.seed + 1);
    // frozen lake
    GEN._disc(A, c + 6, c + 8, 7, T_WATER, 4, A.seed + 3);
    GEN._path(A, [[c, 6], [c, W - 6]], 2.4, T_STONE);
    GEN._disc(A, c, c, 5, T_STONE);
    // mountain shrine north
    GEN._rect(A, c - 5, 6, c + 5, 12, T_WOOD);
    GEN._house(A, c - 3, 7, 6, 3, r);
    for (let i = c - 5; i <= c + 5; i += 2) A.setBlock(i, 13, 'lantern');
    const avoid = (i, j) => { const t = A.tiles[A.idx(i, j)]; return t === T_WATER || t === T_STONE || t === T_WOOD || U.dist(i, j, c, c) < 7; };
    GEN._scatter(A, r, 'pine', 90, { on: [T_SNOW, T_ROCK], avoid, cluster: 3 });
    GEN._scatter(A, r, (q) => q.pick(['rock', 'boulder']), 30, { on: [T_SNOW, T_ROCK], avoid });
    GEN._scatter(A, r, 'ice', 18, { on: [T_SNOW], avoid });
    for (let n = 0; n < 6; n++) {
      const ox = r.int(6, W - 9), oy = r.int(6, W - 9);
      if (U.dist(ox, oy, c, c) < 10) continue;
      for (let j = oy; j < oy + 2; j++) for (let i = ox; i < ox + 3; i++) if (GEN._free(A, i, j, 0) && !avoid(i, j)) A.setBlock(i, j, 'cliff', r.int(0, 20));
    }
  },
};
