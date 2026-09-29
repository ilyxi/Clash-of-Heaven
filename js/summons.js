'use strict';
// ---------------------------------------------------------------------------
// Summoning jutsu: the Storm Hawk you ride (see Fighter.mountUp), the Great
// Toad turret and the Giant Serpent charge. Pixel art is procedural and
// cached, upscaled with EPX like the ninja sprites.
// ---------------------------------------------------------------------------

const SummonArt = (() => {
  const OUTLINE = '#120a18';

  // crisp polygon fill: a pixel is painted if its centre is inside
  function poly(ctx, pts, col) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    ctx.fillStyle = col;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) ctx.fillRect(x, y, 1, 1);
    }
  }
  function ell(ctx, cx, cy, rx, ry, col) { ctx.fillStyle = col; PX.ellipse(ctx, cx, cy, rx, ry); }

  function outline(c) {
    const x = c.getContext('2d'), w = c.width, h = c.height;
    const img = x.getImageData(0, 0, w, h), d = img.data;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    const [r, g, b] = U.hexToRgb(OUTLINE);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = y * w + xx;
      if (solid[i]) continue;
      if ((xx > 0 && solid[i - 1]) || (xx < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
  }

  const cache = new Map();
  function cached(key, w, h, draw) {
    let c = cache.get(key);
    if (c) return c;
    const base = U.makeCanvas(w, h);
    draw(base.getContext('2d'));
    outline(base);
    c = epx2(base);
    cache.set(key, c);
    return c;
  }

  // ---- Storm Hawk (64x44, facing right; anchor = back at 32,20) ------------------
  const HK = { dark: '#2c4450', mid: '#3f6a7a', light: '#6fa8b8', pale: '#d8f0f0', belly: '#e8e4d8', beak: '#ffc83a', beakD: '#c88a1a', eye: '#ff4a3a' };
  const FAR = [
    [[28, 21], [38, 21], [26, 3], [18, 1], [13, 5]],
    [[28, 21], [38, 21], [22, 11], [10, 11], [5, 15]],
    [[28, 22], [38, 22], [25, 29], [14, 33], [10, 30]],
    [[27, 20], [37, 20], [12, 16], [8, 19], [15, 22]],
  ];
  const NEAR = [
    [[25, 21], [36, 21], [30, 6], [21, 2], [16, 6]],
    [[25, 22], [36, 22], [27, 33], [13, 38], [8, 35]],
    [[25, 22], [36, 22], [31, 38], [23, 43], [18, 40]],
    [[25, 22], [38, 22], [10, 25], [7, 28], [16, 28]],
  ];
  // Scaled "pen": art is authored on a small grid and drawn S times larger
  // (crisp shapes, single-pixel details stay fine) before the EPX pass.
  function pen(x, S) {
    const r = Math.round;
    return {
      S,
      poly(pts, col) { poly(x, pts.map(([a, b]) => [a * S, b * S]), col); },
      ell(cx, cy, rx, ry, col) { x.fillStyle = col; PX.ellipse(x, cx * S, cy * S, rx * S, ry * S); },
      rect(a, b, w, h, col) { x.fillStyle = col; x.fillRect(r(a * S), r(b * S), Math.max(1, r(w * S)), Math.max(1, r(h * S))); },
      line(a, b, c, d, col, w = 1) { x.fillStyle = col; PX.line(x, a * S, b * S, c * S, d * S, w); },
      dot(a, b, col, n = 1) { x.fillStyle = col; x.fillRect(r(a * S), r(b * S), n, n); },
    };
  }
  function featherLines(g, w, col, colD) {
    // primaries: streaks from the wing root toward the tip region
    const [a, b, t1, t2, t3] = w;
    const root = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const tips = [t1, [(t1[0] + t2[0]) / 2, (t1[1] + t2[1]) / 2], t2, [(t2[0] + t3[0]) / 2, (t2[1] + t3[1]) / 2], t3];
    tips.forEach((tip, k) => {
      g.line(U.lerp(root[0], tip[0], 0.3), U.lerp(root[1], tip[1], 0.3), U.lerp(root[0], tip[0], 0.95), U.lerp(root[1], tip[1], 0.95), k % 2 ? colD : col);
    });
  }
  const HAWK_S = 1.6, TOAD_S = 1.9;
  function hawk(frame) {
    const S = HAWK_S;
    return cached('hawk' + frame, Math.ceil(64 * S), Math.ceil(46 * S), (x) => {
      const g = pen(x, S);
      // far wing
      g.poly(FAR[frame], HK.dark);
      featherLines(g, FAR[frame], HK.mid, '#1e3038');
      // tail fan with bands
      g.poly([[21, 19], [21, 25], [6, 29], [3, 24], [6, 18]], HK.dark);
      g.line(5, 21, 18, 21.5, HK.pale); g.line(5, 24, 18, 23.5, HK.mid); g.line(6, 27, 18, 25, HK.pale);
      // body + belly
      g.ell(30, 22, 12, 6, HK.mid);
      g.ell(29, 20, 9, 3, HK.light);
      g.ell(31, 25, 9, 3, HK.belly);
      for (let k = 0; k < 6; k++) g.dot(25 + k * 2.2, 25.5 + (k % 2), '#b8b0a0', 2);
      // saddle cloth for the rider
      g.poly([[25, 17], [34, 17], [35, 21], [24, 21]], '#b8322a');
      g.line(24, 21, 35, 21, '#e8c890');
      // head
      g.ell(44, 18, 5, 5, HK.mid);
      g.ell(44, 16, 4, 2, HK.light);
      g.rect(41, 14, 6, 1.5, HK.pale); g.rect(45, 20, 3, 2, HK.pale);
      g.rect(39.5, 18, 2, 3, HK.dark);
      g.poly([[48, 16], [55, 19], [52, 21.5], [48, 21]], HK.beak);
      g.line(49, 20, 54, 19.5, HK.beakD); g.rect(54, 19, 1, 2, HK.beakD);
      g.rect(45, 16.6, 2, 1.2, HK.eye); g.dot(45, 16.4, '#ffffff', 2);
      g.line(43, 15.5, 47.5, 16.2, '#1e3038');
      // talons
      g.rect(28.5, 28, 2, 2, HK.beak); g.rect(33, 28, 2, 2, HK.beak);
      // near wing
      g.poly(NEAR[frame], HK.light);
      featherLines(g, NEAR[frame], HK.pale, HK.mid);
      const n = NEAR[frame];
      g.line(n[0][0], n[0][1], n[1][0], n[1][1], HK.pale, 2);
    });
  }

  // ---- Great Toad (56x48 grid, facing right; anchor = feet at 28,46) ------------------
  const TD = { dark: '#44602a', mid: '#6a8a3a', light: '#9ab85a', belly: '#ecdca4', vest: '#c83a2a', vestD: '#8a2418' };
  function toad(frame) {
    const S = TOAD_S;
    return cached('toad' + frame, Math.ceil(56 * S), Math.ceil(48 * S), (x) => {
      const g = pen(x, S);
      // back legs
      g.ell(12, 40, 7, 5, TD.dark);
      // body
      g.ell(27, 31, 21, 13, TD.mid);
      g.ell(24, 26, 15, 7, TD.light);
      // red vest over the back
      g.poly([[8, 25], [26, 20], [30, 36], [10, 40]], TD.vest);
      g.rect(10, 38, 18, 2, TD.vestD); g.line(26, 21, 29, 35, TD.vestD, 2);
      g.ell(18, 30, 3.2, 3.2, '#ffe9a0'); g.rect(17, 28, 2, 4, TD.vestD); g.rect(16, 29.5, 4, 1, TD.vestD);
      // belly & throat
      g.ell(38, 37, 11, 7, TD.belly);
      for (let k = 0; k < 4; k++) g.line(31 + k * 3, 39, 33 + k * 3, 42, '#d8c488');
      if (frame === 1) { g.ell(42, 36, 7, 6, '#f6ecc4'); g.rect(38, 40, 8, 1, '#e0cc90'); }
      // warts
      for (const [wx, wy] of [[33, 22], [38, 25], [29, 18], [42, 28], [35, 29], [24, 34], [16, 22], [44, 24]]) { g.ell(wx, wy, 1.2, 1.2, TD.dark); g.dot(wx - 0.4, wy - 0.6, TD.light, 2); }
      // eyes
      for (const [ex, ey] of [[26, 15], [37, 14]]) {
        g.ell(ex, ey, 5, 5, TD.mid);
        g.ell(ex + 1, ey - 1, 3.2, 3.2, '#ffd84a');
        g.rect(ex + 0.6, ey - 3.5, 1, 5, OUTLINE);
        g.dot(ex - 0.6, ey - 2.6, '#ffffff', 2);
      }
      // mouth
      if (frame === 2) { g.ell(46, 31, 5, 4, '#6a1414'); g.ell(46, 33, 3, 2, '#e05a6a'); }
      else { g.line(30, 32, 48, 30, '#5a1a1a', 2); g.line(48, 30, 50, 28, '#5a1a1a', 2); }
      // front legs
      g.rect(38, 40, 5, 6, TD.mid); g.rect(28, 41, 5, 5, TD.mid);
      g.rect(37, 45, 8, 2, TD.light); g.rect(27, 45, 8, 2, TD.light);
      g.rect(40, 45, 1, 2, TD.dark); g.rect(30, 45, 1, 2, TD.dark);
    });
  }

  // flip when moving/looking toward the left of the screen
  function flipFor(ang) { return Math.cos(ang) - Math.sin(ang) < 0; }
  function blit(ctx, c, sx, sy, ax, ay, flip) {
    const w = c.lw, h = c.lh;
    sx = Math.round(sx); sy = Math.round(sy);
    if (!flip) { ctx.drawImage(c, sx - ax, sy - ay, w, h); return; }
    ctx.save(); ctx.translate(sx, 0); ctx.scale(-1, 1); ctx.drawImage(c, -ax, sy - ay, w, h); ctx.restore();
  }

  return { hawk, toad, flipFor, blit, HAWK_S, TOAD_S };
})();

// Storm Hawk at screen (sx, sy) = where the rider kneels.
function drawHawk(ctx, sx, sy, ang, flap, dive) {
  const seq = [0, 1, 2, 1];
  const frame = dive ? 3 : seq[Math.floor(flap) % 4];
  const S = SummonArt.HAWK_S;
  SummonArt.blit(ctx, SummonArt.hawk(frame), sx, sy + 8, Math.round(30 * S), Math.round(20 * S), SummonArt.flipFor(ang));
}

// ---- Great Toad -------------------------------------------------------------------
function spawnToad(f, L, x, y) {
  const dur = L >= 5 ? 9 : 7, R = 2.1;
  return Combat.hazard({
    src: f, x, y, r: R, dur, fall: 0.42, landed: false, shotT: 0.7, mouthT: 0, facing: f.facing, sorted: true,
    update(dt) {
      if (!this.landed && this.t >= this.fall) {
        this.landed = true;
        Combat.explosion(f, x, y, R, 60 * D(L), 'water', { ability: 'summontoad', knock: 7, launch: 220, stun: 0.6, blockDmg: 90 });
        FX.splash(x, y, 30, 2);
        FX.dust(x, y, 14);
        FX.ring(x, y, 0.5, '#9ad4ff', 0.45, 9, 2);
        W.arena.wetRadius(x, y, 3.2, 8);
        W.shakeAt(x, y, 8);
        SFX.playAt('hitHeavy', x, y, 1);
      }
      if (!this.landed) return;
      this.mouthT = Math.max(0, this.mouthT - dt);
      this.shotT -= dt;
      if (this.shotT <= 0) {
        let best = null, bd = 8.5;
        for (const e of W.fighters) {
          if (!e.alive || !Combat.enemies(f, e) || e.st.stealth > 0) continue;
          const d = U.dist(x, y, e.x, e.y);
          if (d < bd && W.arena.lineClear(x, y, e.x, e.y, 16)) { bd = d; best = e; }
        }
        this.shotT = best ? 0.95 : 0.3;
        if (best) {
          const lead = bd / 12;
          const a = Math.atan2(best.y + (best.vy + best.mvy) * lead - y, best.x + (best.vx + best.mvx) * lead - x);
          this.facing = a; this.mouthT = 0.25;
          Combat.projectile({
            src: f, x: x + Math.cos(a) * 1.4, y: y + Math.sin(a) * 1.4, z: 24, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12,
            kind: 'waterball', element: 'water', size: 5, radius: 0.42, life: 0.85, dmg: 24 * D(L), knock: 3.5, stun: 0.35,
            status: { wet: 5 }, ability: 'summontoad', clash: 1.4, blockDmg: 25, trail: TRAIL.water,
            onImpact(p) { FX.splash(p.x, p.y, 8, 1); W.arena.wetRadius(p.x, p.y, 0.9, 5); },
          });
          SFX.playAt('water', x, y, 0.6);
        }
      }
      if (Math.random() < dt * 2) FX.add({ x: x + U.rand(-0.8, 0.8), y: y + U.rand(-0.8, 0.8), z: U.rand(10, 30), vz: -20, g: 200, life: 0.5, color: '#8fcfff', size: 1 });
      if (this.t >= this.fall + dur) {
        this.dead = true;
        FX.poof(x, y, 30);
        SFX.playAt('poof', x, y, 0.9);
      }
    },
    drawGround(ctx, cam) {
      const [sx, sy] = DF.sp(x, y, 0, cam);
      const k = this.landed ? 1 : this.t / this.fall;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      PX.ellipse(ctx, sx, sy, 38 * (0.4 + 0.6 * k), 17 * (0.4 + 0.6 * k));
      if (!this.landed) { ctx.fillStyle = '#9ad4ff'; ctx.globalAlpha = 0.6; PX.ellipseRing(ctx, sx, sy, R * ISO_RX, R * ISO_RY, 1); ctx.globalAlpha = 1; }
    },
    depth() { return x + y + 0.3; },
    drawSorted(ctx, cam) {
      const z = this.landed ? 0 : (1 - this.t / this.fall) * 170;
      const [sx, sy] = DF.sp(x, y, z, cam);
      const squash = this.landed && this.t - this.fall < 0.15 ? 2 : 0;
      const frame = this.mouthT > 0 ? 2 : Math.floor(this.t * 1.5) % 4 === 0 ? 1 : 0;
      const end = this.fall + dur - this.t;
      if (end < 0.6 && Math.floor(this.t * 12) % 2) ctx.globalAlpha = 0.5;
      const S = SummonArt.TOAD_S;
      SummonArt.blit(ctx, SummonArt.toad(frame), sx, sy + squash + 2, Math.round(28 * S), Math.round(46 * S), SummonArt.flipFor(this.facing));
      ctx.globalAlpha = 1;
    },
  });
}

// ---- Giant Serpent ------------------------------------------------------------------
function spawnSerpent(f, L, ang) {
  const len = 7.5 * SZ(f, L), speed = 15, dx = Math.cos(ang), dy = Math.sin(ang);
  const A = W.arena;
  return Combat.hazard({
    src: f, x: f.x + dx * 0.6, y: f.y + dy * 0.6, hx: f.x + dx * 0.6, hy: f.y + dy * 0.6, dist: 0, hist: [], hitSet: new Set(),
    phase: 'go', endT: 0, blockAcc: 0, sorted: true,
    update(dt) {
      if (this.phase === 'go') {
        const step = speed * dt;
        this.dist += step;
        this.hx = U.clamp(this.hx + dx * step, 2.6, A.w - 2.6); this.hy = U.clamp(this.hy + dy * step, 2.6, A.h - 2.6);
        this.x = this.hx; this.y = this.hy;
        this.hist.push([this.hx, this.hy]);
        if (this.hist.length > 30) this.hist.shift();
        for (const e of W.fighters) {
          if (!e.alive || this.hitSet.has(e) || !Combat.enemies(f, e) || e.z > 50) continue;
          if (U.dist(this.hx, this.hy, e.x, e.y) > 0.85 + e.radius) continue;
          this.hitSet.add(e);
          Combat.hit(e, { src: f, dmg: 55 * D(L), element: 'earth', kind: 'aoe', knock: 5, launch: 260, stun: 0.7, dirX: dx, dirY: dy, ability: 'summonsnake', sx: this.hx - dx, sy: this.hy - dy, noParry: true });
        }
        this.blockAcc += dt;
        if (this.blockAcc > 0.06) { this.blockAcc = 0; A.damageRadius(this.hx, this.hy, 0.9, 45, 'earth', f); }
        if (Math.random() < 0.8) FX.debris(this.hx, this.hy, 2, ['#8a5a2c', '#c08a4a', '#5e3b1a'], 2, 0.6);
        if (Math.random() < 0.4) A.addStain(this.hx, this.hy, 0.35, 'crater');
        if (this.dist >= len) {
          this.phase = 'bite'; this.endT = this.t;
          Combat.explosion(f, this.hx + dx * 0.6, this.hy + dy * 0.6, 1.7, 40 * D(L), 'earth', { ability: 'summonsnake', knock: 6, launch: 180, stun: 0.5 });
          SFX.playAt('hitHeavy', this.hx, this.hy, 1);
        }
      } else if (this.t - this.endT > 0.7) {
        this.dead = true;
        FX.dust(this.hx, this.hy, 12);
      }
    },
    depth() { return this.hx + this.hy + 0.2; },
    drawSorted(ctx, cam) {
      const H = this.hist;
      if (H.length < 2) return;
      const sink = this.phase === 'bite' ? Math.min(1, (this.t - this.endT) / 0.7) : 0;
      const n = H.length;
      // body: tail (oldest) to head
      for (let i = 0; i < n; i += 1) {
        const u = i / (n - 1);
        // slither: the body weaves side to side around its path
        const wv = Math.sin(i * 0.45 - this.t * 14) * 0.45 * (1 - u * 0.6);
        const px = H[i][0] - dy * wv, py = H[i][1] + dx * wv;
        const z = (4 + u * 14 + Math.sin(i * 0.7 + this.t * 16) * 3) * (1 - sink) - sink * 10;
        const r = 2.5 + u * 7.5;
        const [sx, sy] = DF.sp(px, py, z, cam);
        ctx.fillStyle = OUTLINE_COL; PX.circle(ctx, sx, sy, r + 1);
        ctx.fillStyle = i % 3 === 0 ? '#3a2458' : '#6a3a8a'; PX.circle(ctx, sx, sy, r);
        ctx.fillStyle = '#9a6ab8'; PX.circle(ctx, sx - 1, sy - Math.round(r * 0.4), Math.max(1, r - 3));
        ctx.fillStyle = '#e0d0a0'; ctx.fillRect(Math.round(sx - r * 0.5), Math.round(sy + r * 0.4), Math.max(1, Math.round(r)), 1);
      }
      // head
      const [hx, hy] = H[n - 1];
      const hz = 26 * (1 - sink) - sink * 14;
      const [sx, sy] = DF.sp(hx + dx * 0.25, hy + dy * 0.25, hz, cam);
      const sdx = (dx - dy), sdy = (dx + dy) * 0.5;
      const l = Math.hypot(sdx, sdy) || 1, ux = sdx / l, uy = sdy / l;
      const open = this.phase === 'bite' ? Math.max(0, 1 - (this.t - this.endT) * 4) * 5 + 1 : 2 + Math.sin(this.t * 20);
      ctx.fillStyle = OUTLINE_COL; PX.ellipse(ctx, sx, sy, 15, 10);
      ctx.fillStyle = '#6a3a8a'; PX.ellipse(ctx, sx, sy, 14, 9);
      ctx.fillStyle = '#9a6ab8'; PX.ellipse(ctx, sx - 1, sy - 3, 9, 4);
      ctx.fillStyle = '#3a2458'; for (let k = -1; k <= 1; k++) ctx.fillRect(Math.round(sx - ux * 6 + k * 4), Math.round(sy - uy * 6 - 1), 2, 2);
      // jaws
      const jx = sx + ux * 13, jy = sy + uy * 13 + 1, op = open * 1.5;
      ctx.fillStyle = OUTLINE_COL; PX.ellipse(ctx, jx, jy, 7, Math.max(2, op + 1));
      ctx.fillStyle = '#b02a3a'; PX.ellipse(ctx, jx, jy, 6, Math.max(1, op));
      ctx.fillStyle = '#e05a6a'; PX.ellipse(ctx, jx, jy + 1, 3, Math.max(1, op * 0.5));
      ctx.fillStyle = '#ffffff';
      for (const fx of [-4, 3]) { ctx.fillRect(Math.round(jx + fx), Math.round(jy - op), 2, 3); ctx.fillRect(Math.round(jx + fx), Math.round(jy + op - 2), 2, 3); }
      // eyes
      for (const s of [-1, 1]) {
        const ex = Math.round(sx + ux * 5 + s * uy * 5), ey = Math.round(sy + uy * 5 - s * ux * 3 - 4);
        ctx.fillStyle = OUTLINE_COL; ctx.fillRect(ex - 1, ey - 1, 5, 4);
        ctx.fillStyle = '#ffe14a'; ctx.fillRect(ex, ey, 3, 2);
        ctx.fillStyle = OUTLINE_COL; ctx.fillRect(ex + 1, ey, 1, 2);
      }
    },
  });
}
const OUTLINE_COL = '#120a18';

// ---- the jutsu -----------------------------------------------------------------------
defJutsu({
  id: 'summonhawk', name: 'Summoning: Storm Hawk', element: 'wind', cost: 32, cd: 24, cast: 0.4, recover: 0, icon: 'bird', pose: 'raise',
  desc: 'Summon a giant hawk and ride it. Fly over everything and bomb the ground below. Heavy dives and drops you off.',
  mastery: 'Lv5: Bigger bombs and a sturdier hawk.', ai: { min: 0, max: 9, kind: 'summon' },
  use(f, L) {
    f.mountUp({ t: 8 + L * 0.5, shield: 110 + 20 * L, maxShield: 110 + 20 * L, dmg: 26, bombR: L >= 5 ? 1.7 : 1.3 });
  },
});

defJutsu({
  id: 'summontoad', name: 'Summoning: Great Toad', element: 'water', cost: 30, cd: 20, cast: 0.45, icon: 'toad', pose: 'slam',
  desc: 'A giant toad drops from the sky, crushing the area, then spits water shots at nearby enemies.',
  mastery: 'Lv5: The toad stays longer.', ai: { min: 1, max: 7, kind: 'aoe' },
  use(f, L) {
    const p = f.aimPoint(6, 1.8);
    spawnToad(f, L, p.x, p.y);
    FX.poof(p.x, p.y, 8);
    SFX.playAt('poof', f.x, f.y, 0.8);
  },
});

defJutsu({
  id: 'summonsnake', name: 'Summoning: Giant Serpent', element: 'earth', cost: 26, cd: 13, cast: 0.3, icon: 'snake', pose: 'slam',
  desc: 'A huge serpent bursts from the ground and tears forward, launching everyone in its path, then bites.',
  mastery: 'Lv5: A longer, heavier serpent.', ai: { min: 1.5, max: 7, kind: 'proj' },
  use(f, L, aim) {
    spawnSerpent(f, L, aim.ang);
    FX.debris(f.x + Math.cos(aim.ang) * 0.6, f.y + Math.sin(aim.ang) * 0.6, 4, ['#8a5a2c', '#c08a4a'], 10, 1);
    SFX.playAt('earth', f.x, f.y, 0.9);
  },
});
