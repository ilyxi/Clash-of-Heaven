'use strict';
// ---------------------------------------------------------------------------
// Jutsu catalog. Each technique: { id, name, element, cost, cd, cast, recover,
// icon, desc, mastery, ai: {min, max, kind}, use(f, L, aim) }.
// L = mastery level 1..5 (levels up in-match). Lv5 unlocks a mastery perk.
// ---------------------------------------------------------------------------

const JUTSU = {};
const D = (L) => 1 + 0.12 * (L - 1);                   // damage scale
const SZ = (f, L) => (1 + 0.07 * (L - 1)) * f.mod.jutsuSize; // size scale

function defJutsu(o) { JUTSU[o.id] = o; }

function shoot(f, ang, speed, o) {
  return Combat.projectile(Object.assign({
    src: f, x: f.x + Math.cos(ang) * 0.45, y: f.y + Math.sin(ang) * 0.45, z: 12,
    vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
  }, o));
}

const TRAIL = {
  fire(p, dt) { if (Math.random() < dt * 45) FX.flame(p.x, p.y, p.z - 3, p.size / 5); },
  water(p, dt) { if (Math.random() < dt * 30) FX.add({ x: p.x, y: p.y, z: p.z, vz: U.rand(-10, 30), g: 300, vx: U.rand(-0.4, 0.4), vy: U.rand(-0.4, 0.4), life: 0.45, color: U.pick(['#b8e4ff', '#3fa0ff', '#e8f6ff']), size: 2 }); },
  wind(p, dt) { if (Math.random() < dt * 30) FX.wind(p.x, p.y, p.z, 1); },
  lightning(p, dt) { if (Math.random() < dt * 40) FX.electric(p.x, p.y, p.z, 1); },
  earth(p, dt) { if (Math.random() < dt * 20) FX.add({ x: p.x, y: p.y, z: p.z, vz: 0, g: 400, life: 0.5, color: '#9a6a3a', size: 2 }); },
  shadow(p, dt) { if (Math.random() < dt * 20) FX.add({ x: p.x, y: p.y, z: 1, life: 0.4, color: '#1a1030', size: 2, layer: 0 }); },
  hist(p) { (p.hist || (p.hist = [])).push([p.x, p.y, p.z]); if (p.hist.length > (p.histLen || 10)) p.hist.shift(); },
};

// ============================== FIRE =======================================
defJutsu({
  id: 'fireball', name: 'Great Fireball', element: 'fire', cost: 22, cd: 5, cast: 0.28, icon: 'ball',
  desc: 'Exhale a massive fireball that explodes on impact and sets foes ablaze.',
  mastery: 'Lv5: Breathe three fireballs in a fan.', ai: { min: 2, max: 9, kind: 'proj' },
  use(f, L, aim) {
    const s = SZ(f, L), n = L >= 5 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const a = aim.ang + (i - (n - 1) / 2) * 0.28;
      shoot(f, a, 9, {
        kind: 'fireball', element: 'fire', size: Math.round(6 * s), radius: 0.45 * s, life: 1.2, dmg: 28 * D(L), knock: 3, stun: 0.4,
        status: { burn: { t: 3, dps: 14 } }, ability: 'fireball', clash: 2, blockDmg: 40, trail: TRAIL.fire,
        explode: { r: 1.5 * s, dmg: 58 * D(L), knock: 6, launch: 120, status: { burn: { t: 3, dps: 14 } } },
      });
    }
    SFX.playAt('fire', f.x, f.y);
  },
});

defJutsu({
  id: 'phoenix', name: 'Phoenix Flowers', element: 'fire', cost: 18, cd: 6, cast: 0.2, icon: 'spread',
  desc: 'Spit a volley of small homing flames. Great for pressuring groups.',
  mastery: 'Lv5: Eight flowers with sharper homing.', ai: { min: 2, max: 8, kind: 'proj' },
  use(f, L, aim) {
    const n = L >= 5 ? 8 : 5;
    for (let i = 0; i < n; i++) {
      const a = aim.ang + (i - (n - 1) / 2) * 0.2;
      shoot(f, a, 11 + U.rand(-1, 1), {
        kind: 'flower', element: 'fire', size: 3, radius: 0.3, life: 1.0, dmg: 17 * D(L), knock: 1.5, stun: 0.25,
        homing: L >= 5 ? 3 : 1.6, status: { burn: { t: 2, dps: 10 } }, ability: 'phoenix', clash: 0.6, blockDmg: 12, trail: TRAIL.fire,
      });
    }
    SFX.playAt('fire', f.x, f.y, 0.8);
  },
});

defJutsu({
  id: 'flamestream', name: 'Dragon Flame Stream', element: 'fire', cost: 26, cd: 8, cast: 0.2, icon: 'stream', pose: 'release',
  desc: 'Channel a roaring stream of fire. Hold your aim to sweep it across foes.',
  mastery: 'Lv5: Longer, wider stream.', ai: { min: 0.5, max: 4, kind: 'melee' },
  use(f, L) {
    const range = (3.6 + (L >= 5 ? 1.2 : 0)) * SZ(f, L), arc = L >= 5 ? 0.5 : 0.38;
    SFX.playAt('fireBig', f.x, f.y, 0.8);
    f.startChannel({
      dur: 1.3, move: 0.35, turn: 2.6, pose: 'release', acc: 0, dashCancel: true,
      tick(f, dt, c) {
        for (let k = 0; k < 3; k++) {
          const a = f.facing + U.rand(-arc, arc) * 0.8, sp = U.rand(6, 11);
          FX.add({ x: f.x + Math.cos(f.facing) * 0.4, y: f.y + Math.sin(f.facing) * 0.4, z: 13, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: U.rand(-10, 20), drag: 2.2, life: range / 9, color: FX.ELEM_COLORS.fire, size: U.rand(2, 4), grow: 5, kind: 'glow', add: true });
        }
        c.acc += dt;
        if (c.acc >= 0.14) {
          c.acc = 0;
          Combat.cone(f, f.x, f.y, f.facing, range, arc, { kind: 'beam', dmg: 10 * D(L), element: 'fire', knock: 1.4, stun: 0.25, status: { burn: { t: 2.5, dps: 12 } }, ability: 'flamestream', hitstop: 0.015, sfx: false });
          Combat.coneBlocks(f.x, f.y, f.facing, range, arc, 12, 'fire', f);
          const d = U.rand(1, range);
          W.arena.igniteRadius(f.x + Math.cos(f.facing) * d, f.y + Math.sin(f.facing) * d, 0.8, 0.5);
          SFX.playAt('burn', f.x, f.y, 0.5);
        }
      },
    });
  },
});

defJutsu({
  id: 'blazerush', name: 'Blazing Comet', element: 'fire', cost: 16, cd: 6, cast: 0.08, icon: 'dash', pose: 'dash',
  desc: 'Rocket forward wrapped in flame, blasting through anyone in your path.',
  mastery: 'Lv5: Explode on arrival.', ai: { min: 1.5, max: 5, kind: 'dash' },
  use(f, L, aim) {
    SFX.playAt('fire', f.x, f.y);
    f.startJdash({
      dx: Math.cos(aim.ang), dy: Math.sin(aim.ang), speed: 14, dur: 0.32, radius: 0.7, pose: 'dash', iframes: 0.1, blockDmg: 25,
      hit: { dmg: 42 * D(L), element: 'fire', knock: 6, launch: 150, stun: 0.55, status: { burn: { t: 3, dps: 12 } }, ability: 'blazerush' },
      trail(f, dt) {
        for (let k = 0; k < 3; k++) FX.flame(f.x + U.rand(-0.2, 0.2), f.y + U.rand(-0.2, 0.2), U.rand(4, 20), 1.2);
        if (Math.random() < dt * 20) W.arena.ignite(Math.floor(f.x), Math.floor(f.y), 2.5);
      },
      onEnd(f) { if (L >= 5) Combat.explosion(f, f.x, f.y, 1.5 * SZ(f, L), 45 * D(L), 'fire', { ability: 'blazerush', knock: 6, launch: 140 }); },
    });
  },
});

defJutsu({
  id: 'firering', name: 'Crimson Halo', element: 'fire', cost: 25, cd: 9, cast: 0.3, icon: 'ring', pose: 'raise',
  desc: 'Erupt a ring of flame that expands outward, hurling enemies away.',
  mastery: 'Lv5: A second halo follows the first.', ai: { min: 0, max: 3, kind: 'self' },
  use(f, L) {
    const R = 3.2 * SZ(f, L);
    const ring = (delay) => Combat.hazard({
      src: f, x: f.x, y: f.y, hitSet: new Set(), delay, r: 0.3,
      update(dt) {
        if (this.t < this.delay) return;
        const k = (this.t - this.delay) / 0.45;
        this.r = 0.3 + (R - 0.3) * k;
        for (const e of Combat.enemiesInRadius(f, this.x, this.y, this.r)) {
          if (this.hitSet.has(e) || U.dist(this.x, this.y, e.x, e.y) < this.r - 0.9) continue;
          this.hitSet.add(e);
          Combat.hit(e, { src: f, dmg: 50 * D(L), element: 'fire', kind: 'aoe', knock: 8, launch: 100, stun: 0.5, sx: this.x, sy: this.y, status: { burn: { t: 3, dps: 14 } }, ability: 'firering' });
        }
        if (Math.random() < 0.7) { const a = U.rand(0, TAU); FX.flame(this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, 0, 1.4); }
        if (k >= 1) { W.arena.igniteRadius(this.x, this.y, R, 0.25); W.arena.damageRadius(this.x, this.y, R, 30, 'fire', f); this.dead = true; }
      },
      drawGround(ctx, cam) {
        if (this.t < this.delay) return;
        const [sx, sy] = DF.sp(this.x, this.y, 0, cam);
        ctx.fillStyle = '#ff8a1f'; PX.ellipseRing(ctx, sx, sy, this.r * ISO_RX, this.r * ISO_RY, 3);
        ctx.fillStyle = '#ffd35c'; PX.ellipseRing(ctx, sx, sy, this.r * ISO_RX - 1, this.r * ISO_RY - 1, 1);
      },
    });
    ring(0);
    if (L >= 5) ring(0.4);
    SFX.playAt('fireBig', f.x, f.y);
    W.shakeAt(f.x, f.y, 3);
  },
});

defJutsu({
  id: 'flamepillar', name: 'Hellfire Pillar', element: 'fire', cost: 20, cd: 7, cast: 0.22, icon: 'pillar',
  desc: 'Mark the ground; a pillar of fire erupts and launches enemies skyward.',
  mastery: 'Lv5: Three pillars in a line.', ai: { min: 2, max: 7, kind: 'aoe' },
  use(f, L) {
    const p = f.aimPoint(7, 1.5);
    const pts = L >= 5 ? [-1.4, 0, 1.4].map((o) => ({ x: p.x + Math.cos(p.ang) * o, y: p.y + Math.sin(p.ang) * o })) : [p];
    pts.forEach((q, i) => {
      const r = 1.1 * SZ(f, L);
      Combat.aoe({
        src: f, x: q.x, y: q.y, r, delay: 0.55 + i * 0.12, dmg: 72 * D(L), element: 'fire', fx: false,
        hit: { launch: 300, knock: 1, stun: 0.8, status: { burn: { t: 3, dps: 14 } }, ability: 'flamepillar', blockDmg: 50, crater: false },
        onFire(h) {
          SFX.playAt('fireBig', h.x, h.y, 0.9);
          W.shakeAt(h.x, h.y, 4);
          W.arena.addStain(h.x, h.y, r * 0.8, 'scorch');
          W.arena.igniteRadius(h.x, h.y, r, 0.6);
          Combat.hazard({ x: h.x, y: h.y, life: 0.6, update() { if (this.t > 0.6) this.dead = true; for (let k = 0; k < 3; k++) FX.flame(this.x + U.rand(-r, r) * 0.6, this.y + U.rand(-r, r) * 0.6, U.rand(0, 50), 1.6); }, draw(ctx, cam) { const [sx, sy] = DF.sp(this.x, this.y, 0, cam); const k = this.t / 0.6; ctx.globalCompositeOperation = 'lighter'; DF.column(ctx, sx, sy, r * 14 * (1 - k * 0.6), 80 * (1 - k * 0.3), ['#fffbe0', '#ffd35c', '#ff8a1f', '#e0401a'], this.t); ctx.globalCompositeOperation = 'source-over'; } });
        },
      });
    });
  },
});

// ============================== WATER ======================================
defJutsu({
  id: 'waterdragon', name: 'Water Dragon', element: 'water', cost: 30, cd: 9, cast: 0.42, icon: 'dragon',
  desc: 'Summon a serpent of water that hunts its target and crashes through several foes.',
  mastery: 'Lv5: Pierces everything and grows larger.', ai: { min: 2, max: 10, kind: 'proj' },
  use(f, L, aim) {
    const s = SZ(f, L) * (L >= 5 ? 1.25 : 1);
    shoot(f, aim.ang, 8.5, {
      kind: 'dragon', cols: ['#ffffff', '#b8e4ff', '#3fa0ff', '#174f9c'], element: 'water', size: Math.round(6 * s), radius: 0.6 * s, life: 1.6,
      dmg: 85 * D(L), knock: 8, launch: 150, stun: 0.6, homing: 1.8, pierce: L >= 5 ? 99 : 2, status: { wet: 6 }, ability: 'waterdragon',
      clash: 3, blockDmg: 60, histLen: 12,
      trail(p, dt) { TRAIL.hist(p); TRAIL.water(p, dt); if (Math.random() < dt * 10) W.arena.wetRadius(p.x, p.y, 0.7, 5); },
      onImpact(p) { FX.splash(p.x, p.y, 16, 1.4); W.arena.wetRadius(p.x, p.y, 1.5, 7); SFX.playAt('splash', p.x, p.y); },
    });
    SFX.playAt('water', f.x, f.y);
  },
});

defJutsu({
  id: 'waterbullets', name: 'Water Bullet Barrage', element: 'water', cost: 15, cd: 4.5, cast: 0.12, icon: 'bullets', pose: 'release',
  desc: 'Fire a rapid burst of pressurized water bullets that soak the target.',
  mastery: 'Lv5: Six bullets per burst.', ai: { min: 1.5, max: 8, kind: 'proj' },
  use(f, L) {
    const n = L >= 5 ? 6 : 4;
    f.startChannel({
      dur: n * 0.11 + 0.05, move: 0.45, turn: 5, pose: 'release', acc: 0.11, shots: 0,
      tick(f, dt, c) {
        c.acc += dt;
        if (c.acc >= 0.11 && c.shots < n) {
          c.acc = 0; c.shots++;
          shoot(f, f.facing + U.rand(-0.05, 0.05), 14, { kind: 'waterball', element: 'water', size: 2, radius: 0.28, life: 0.65, dmg: 18 * D(L), knock: 1.6, stun: 0.28, status: { wet: 4 }, ability: 'waterbullets', clash: 0.7, blockDmg: 10, trail: TRAIL.water, onImpact(p) { FX.splash(p.x, p.y, 4, 0.6); } });
          SFX.playAt('splash', f.x, f.y, 0.5);
        }
      },
    });
  },
});

defJutsu({
  id: 'waterprison', name: 'Water Prison', element: 'water', cost: 25, cd: 13, cast: 0.3, icon: 'prison',
  desc: 'Launch a bubble that traps the first enemy hit inside a crushing water sphere.',
  mastery: 'Lv5: Prison lasts much longer.', ai: { min: 1.5, max: 7, kind: 'proj' },
  use(f, L, aim) {
    const dur = L >= 5 ? 2.3 : 1.5;
    shoot(f, aim.ang, 9, {
      kind: 'bubble', element: 'water', size: 5, radius: 0.45, life: 0.9, dmg: 10, knock: 0, stun: 0.2, ability: 'waterprison', clash: 1, blockDmg: 5, trail: TRAIL.water,
      onHit(p, t) {
        t.applyStatus({ genjutsu: dur, wet: 6 }, f);
        t.vx = t.vy = 0;
        SFX.playAt('water', t.x, t.y);
        Combat.hazard({
          x: t.x, y: t.y, target: t, acc: 0,
          update(dt) {
            if (t.dead || this.t >= dur) { this.dead = true; FX.splash(t.x, t.y, 14, 1.2); return; }
            t.vx *= 0.5; t.vy *= 0.5;
            this.acc += dt;
            if (this.acc >= 0.3) { this.acc = 0; Combat.hit(t, { src: f, dmg: 12 * D(L), element: 'water', kind: 'dot', ability: 'waterprison' }); }
          },
          draw(ctx, cam) {
            const [sx, sy] = DF.sp(t.x, t.y, t.z + 14, cam);
            ctx.fillStyle = 'rgba(70,160,255,0.42)'; PX.circle(ctx, sx, sy, 15);
            ctx.fillStyle = '#b8e4ff'; PX.ellipseRing(ctx, sx, sy, 15, 15, 1);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 8, sy - 9, 3, 2);
            if (Math.random() < 0.3) FX.add({ x: t.x + U.rand(-0.3, 0.3), y: t.y + U.rand(-0.3, 0.3), z: t.z + U.rand(4, 24), vz: 30, life: 0.4, color: '#e8f6ff', size: 1 });
          },
        });
      },
    });
    SFX.playAt('water', f.x, f.y, 0.7);
  },
});

defJutsu({
  id: 'aquawhip', name: 'Aqua Whip', element: 'water', cost: 16, cd: 7, cast: 0.15, icon: 'whip', pose: 'release',
  desc: 'Lash out with a water whip that yanks the first enemy toward you — perfect combo starter.',
  mastery: 'Lv5: Drags every enemy along the whip.', ai: { min: 2, max: 5, kind: 'proj' },
  use(f, L, aim) {
    const len = 4.6 * SZ(f, L);
    const ang = aim.ang;
    const x1 = f.x + Math.cos(ang) * len, y1 = f.y + Math.sin(ang) * len;
    // find victims along the line, nearest first
    const victims = W.fighters.filter((e) => e.alive && Combat.enemies(f, e) && U.pointSegDist(e.x, e.y, f.x, f.y, x1, y1).d < 0.45 + e.radius)
      .sort((a, b) => U.dist(f.x, f.y, a.x, a.y) - U.dist(f.x, f.y, b.x, b.y));
    const pulled = L >= 5 ? victims : victims.slice(0, 1);
    let endX = x1, endY = y1;
    for (const e of pulled) {
      const d = U.dist(f.x, f.y, e.x, e.y);
      const res = Combat.hit(e, { src: f, dmg: 30 * D(L), element: 'water', kind: 'proj', knock: 0, stun: 0.65, status: { wet: 5 }, ability: 'aquawhip', sx: f.x, sy: f.y });
      if (res === 'hit') { const [nx, ny] = U.norm(f.x - e.x, f.y - e.y); e.vx = nx * Math.max(0, d - 0.9) * 5.2; e.vy = ny * Math.max(0, d - 0.9) * 5.2; }
      if (e === pulled[0]) { endX = e.x; endY = e.y; }
    }
    SFX.playAt('whip', f.x, f.y);
    const ox = f.x, oy = f.y;
    FX.custom({
      life: 0.25, layer: 1,
      draw(ctx, cam, k) {
        const [ax, ay] = DF.sp(ox + Math.cos(ang) * 0.4, oy + Math.sin(ang) * 0.4, 14, cam);
        const [bx, by] = DF.sp(endX, endY, 14, cam);
        const mx = (ax + bx) / 2 + Math.sin(k * 20) * 6, my = (ay + by) / 2 - 10 * (1 - k);
        for (let t = 0; t <= 1; t += 0.04) {
          const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx, y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by;
          ctx.fillStyle = '#3fa0ff'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
          ctx.fillStyle = '#e8f6ff'; ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 1);
        }
      },
    });
    FX.splash(endX, endY, 6, 0.8);
  },
});

defJutsu({
  id: 'tidalwave', name: 'Crashing Wave', element: 'water', cost: 26, cd: 10, cast: 0.35, icon: 'wave',
  desc: 'Send a wide wave rolling forward that sweeps enemies away and douses flames.',
  mastery: 'Lv5: A much wider, heavier wave.', ai: { min: 1, max: 6, kind: 'proj' },
  use(f, L, aim) {
    const width = (L >= 5 ? 4.5 : 3.2) * SZ(f, L);
    spawnWave(f, aim.ang, width, 7, 0.8, { dmg: 45 * D(L), knock: 9, stun: 0.55, ability: 'tidalwave' });
    SFX.playAt('water', f.x, f.y, 1);
  },
});

function spawnWave(f, ang, width, dist, dur, hit) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
  return Combat.hazard({
    src: f, x: f.x + dx * 0.8, y: f.y + dy * 0.8, hitSet: new Set(), layer: 1,
    update(dt) {
      const k = Math.min(1, this.t / dur);
      const cx = f.x + dx * (0.8 + dist * k), cy = f.y + dy * (0.8 + dist * k);
      this.cx = cx; this.cy = cy;
      for (const e of W.fighters) {
        if (!e.alive || !Combat.enemies(f, e)) continue;
        const rx = e.x - cx, ry = e.y - cy;
        const along = rx * dx + ry * dy, side = rx * nx + ry * ny;
        if (Math.abs(side) > width / 2 || along > 0.6 || along < -0.9) continue;
        if (!this.hitSet.has(e)) {
          this.hitSet.add(e);
          Combat.hit(e, Object.assign({ src: f, element: 'water', kind: 'aoe', dirX: dx, dirY: dy, status: { wet: 6 }, sx: cx - dx, sy: cy - dy, noParry: true }, hit));
        }
        if (e.state === 'hitstun' || e.state === 'air') { e.vx = dx * 9; e.vy = dy * 9; }
      }
      if (Math.random() < 0.5) W.arena.wetRadius(cx, cy, width / 2, 6);
      W.arena.damageRadius(cx, cy, width / 2, 25 * dt * 4, 'water', f);
      for (let i = 0; i < 4; i++) {
        const o = U.rand(-width / 2, width / 2);
        FX.add({ x: cx + nx * o, y: cy + ny * o, z: U.rand(0, 16), vx: dx * 6, vy: dy * 6, vz: U.rand(40, 120), g: 400, life: 0.45, color: U.pick(['#e8f6ff', '#9ad4ff', '#3fa0ff']), size: 2 });
      }
      if (this.t >= dur) this.dead = true;
    },
    draw(ctx, cam) {
      if (this.cx === undefined) return;
      const h = 18 + Math.sin(this.t * 20) * 2;
      for (let o = -width / 2; o <= width / 2; o += 0.15) {
        const px = this.cx + nx * o, py = this.cy + ny * o;
        const [sx, sy] = DF.sp(px, py, 0, cam);
        const hh = h * (1 - Math.pow(Math.abs(o) / (width / 2), 3) * 0.7);
        ctx.fillStyle = '#1f6ad0'; ctx.fillRect(sx - 2, sy - hh, 4, hh);
        ctx.fillStyle = '#3fa0ff'; ctx.fillRect(sx - 2, sy - hh, 4, hh * 0.6);
        ctx.fillStyle = '#e8f6ff'; ctx.fillRect(sx - 2, sy - hh - 1, 4, 2);
      }
    },
  });
}

defJutsu({
  id: 'mist', name: 'Hidden Mist', element: 'water', cost: 18, cd: 15, cast: 0.3, icon: 'mist', pose: 'seal',
  desc: 'Blanket the area in thick mist. You and allies inside vanish from enemy sight.',
  mastery: 'Lv5: The mist also mends allies.', ai: { min: 0, max: 4, kind: 'escape' },
  use(f, L) {
    const r = 3.6 * SZ(f, L);
    Combat.zone({
      src: f, x: f.x, y: f.y, r, dur: 6.5, tickEvery: 0.2, allies: true,
      onTick(e) { e.st.stealth = Math.max(e.st.stealth, 0.4); if (L >= 5) e.heal(e.maxHp * 0.004); },
      onUpdate(dt, z) {
        for (let i = 0; i < 2; i++) { const a = U.rand(0, TAU), d = Math.sqrt(Math.random()) * z.r; FX.add({ x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d, z: U.rand(0, 18), vx: U.rand(-0.2, 0.2), vy: U.rand(-0.2, 0.2), life: U.rand(1, 2), color: ['#e8eef4', '#d0dae4', '#b8c4d0'], size: U.rand(3, 6), grow: 2, kind: 'smoke', alpha: 0.35 }); }
      },
      drawGround(ctx, cam) {
        ctx.globalAlpha = 0.18 * Math.min(1, (this.dur - this.t) * 2);
        ctx.fillStyle = '#e8eef4'; DF.groundEllipse(ctx, this.x, this.y, this.r, cam);
        ctx.globalAlpha = 1;
      },
    });
    SFX.playAt('wind', f.x, f.y, 0.6);
  },
});

// ============================== EARTH ======================================
defJutsu({
  id: 'earthwall', name: 'Earth Rampart', element: 'earth', cost: 14, cd: 7, cast: 0.2, icon: 'wall', pose: 'slam',
  desc: 'Raise a wall of stone that blocks jutsu and bodies. Enemies caught on top are launched.',
  mastery: 'Lv5: Longer wall that lasts longer.', ai: { min: 0, max: 6, kind: 'wall' },
  use(f, L, aim) {
    const n = L >= 5 ? 7 : 5, life = L >= 5 ? 12 : 8;
    const d = U.clamp(aim.dist, 1.6, 3.5);
    const cx = f.x + Math.cos(aim.ang) * d, cy = f.y + Math.sin(aim.ang) * d;
    const px = -Math.sin(aim.ang), py = Math.cos(aim.ang);
    const seen = new Set();
    for (let k = 0; k < n * 2; k++) {
      const o = (k / (n * 2 - 1) - 0.5) * n;
      const i = Math.floor(cx + px * o), j = Math.floor(cy + py * o);
      const key = i + ',' + j;
      if (seen.has(key)) continue;
      seen.add(key);
      // launch anyone standing there
      for (const e of W.fighters) {
        if (!e.alive || Math.floor(e.x) !== i || Math.floor(e.y) !== j) continue;
        if (Combat.enemies(f, e)) Combat.hit(e, { src: f, dmg: 25 * D(L), element: 'earth', kind: 'aoe', launch: 260, knock: 2, stun: 0.6, ability: 'earthwall', sx: i + 0.5, sy: j + 0.5 });
        e.x += Math.cos(aim.ang) * (Combat.enemies(f, e) ? 0.9 : -0.9); e.y += Math.sin(aim.ang) * (Combat.enemies(f, e) ? 0.9 : -0.9);
      }
      if (W.fighters.some((e) => e.alive && Math.floor(e.x) === i && Math.floor(e.y) === j)) continue;
      const b = W.arena.addTempBlock(i, j, 'earthwall', life + U.rand(0, 0.5));
      if (b) FX.debris(i + 0.5, j + 0.5, 4, MATERIALS.earth.colors, 5, 0.8);
    }
    SFX.playAt('earth', cx, cy);
    W.shakeAt(cx, cy, 3);
  },
});

defJutsu({
  id: 'rockspikes', name: 'Stone Spear Line', element: 'earth', cost: 20, cd: 6, cast: 0.2, icon: 'spikes', pose: 'slam',
  desc: 'Spears of rock burst from the ground in a line, launching enemies into the air.',
  mastery: 'Lv5: Three lines in a fan.', ai: { min: 1, max: 6.5, kind: 'proj' },
  use(f, L, aim) {
    const lines = L >= 5 ? [-0.35, 0, 0.35] : [0];
    const hitSet = new Set();
    for (const off of lines) {
      const ang = aim.ang + off;
      for (let k = 0; k < 8; k++) {
        const d = 0.9 + k * 0.72;
        const x = f.x + Math.cos(ang) * d, y = f.y + Math.sin(ang) * d;
        Combat.hazard({
          src: f, x, y, delay: k * 0.055, fired: false, layer: 1,
          update() {
            if (!this.fired && this.t >= this.delay) {
              this.fired = true;
              if (W.arena.isSolid(Math.floor(x), Math.floor(y))) { W.arena.damageBlock(Math.floor(x), Math.floor(y), 40, 'earth', f); }
              for (const e of Combat.enemiesInRadius(f, x, y, 0.65)) {
                if (hitSet.has(e)) continue;
                hitSet.add(e);
                Combat.hit(e, { src: f, dmg: 38 * D(L), element: 'earth', kind: 'aoe', launch: 270, knock: 2, stun: 0.7, dirX: Math.cos(ang), dirY: Math.sin(ang), ability: 'rockspikes', sx: x, sy: y });
              }
              FX.debris(x, y, 2, MATERIALS.earth.colors, 3, 0.7);
              SFX.playAt('earth', x, y, 0.35);
            }
            if (this.t > this.delay + 0.7) this.dead = true;
          },
          draw(ctx, cam) {
            if (!this.fired) return;
            const k = (this.t - this.delay) / 0.7;
            const h = k < 0.15 ? k / 0.15 * 22 : k > 0.75 ? (1 - k) / 0.25 * 22 : 22;
            const [sx, sy] = DF.sp(x, y, 0, cam);
            for (let yy = 0; yy < h; yy++) {
              const w = Math.max(1, Math.round((1 - yy / 22) * 5));
              ctx.fillStyle = yy % 5 === 0 ? '#6a4424' : '#9a6a3a'; ctx.fillRect(sx - w, sy - yy, w, 1);
              ctx.fillStyle = '#c08a4a'; ctx.fillRect(sx, sy - yy, w, 1);
            }
          },
        });
      }
    }
    W.shakeAt(f.x, f.y, 2);
  },
});

defJutsu({
  id: 'boulder', name: 'Boulder Crush', element: 'earth', cost: 24, cd: 8, cast: 0.45, icon: 'boulder', pose: 'raise',
  desc: 'Tear a boulder from the earth and hurl it in an arc. Crushes terrain where it lands.',
  mastery: 'Lv5: The boulder shatters into three more.', ai: { min: 3, max: 8.5, kind: 'aoe' },
  use(f, L) {
    const p = f.aimPoint(8.5, 2);
    const s = SZ(f, L);
    const T = 0.7 + p.dist * 0.04;
    const vx = (p.x - f.x) / T, vy = (p.y - f.y) / T;
    const vz = (0 - 30) / T + 0.5 * 700 * T;
    Combat.projectile({
      src: f, x: f.x, y: f.y, z: 30, vx, vy, vz, gravity: 700, kind: 'rock', size: Math.round(7 * s), radius: 0.7 * s, life: 3,
      dmg: 40 * D(L), knock: 5, stun: 0.5, element: 'earth', ability: 'boulder', clash: 3, blockDmg: 120, pierceBlocks: true, reflectable: false, trail: TRAIL.earth,
      explode: { r: 1.8 * s, dmg: 80 * D(L), knock: 6, launch: 200, blockDmg: 160 },
      onImpact(pr) {
        FX.debris(pr.x, pr.y, 4, MATERIALS.earth.colors, 16, 1.5);
        if (L >= 5) {
          for (let k = 0; k < 3; k++) {
            const a = U.rand(0, TAU);
            Combat.projectile({ src: f, x: pr.x, y: pr.y, z: 8, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, vz: 220, gravity: 700, kind: 'rock', size: 4, radius: 0.4, life: 2, dmg: 20 * D(L), element: 'earth', ability: 'boulder', reflectable: false, explode: { r: 1, dmg: 35 * D(L), knock: 4, launch: 140 } });
          }
        }
      },
    });
    SFX.playAt('earth', f.x, f.y, 0.7);
  },
});

defJutsu({
  id: 'mudswamp', name: 'Swamp of the Underworld', element: 'earth', cost: 22, cd: 12, cast: 0.3, icon: 'swamp', pose: 'slam',
  desc: 'Turn the ground into a sucking swamp that drags enemies down to a crawl.',
  mastery: 'Lv5: Enemies entering are briefly rooted.', ai: { min: 1.5, max: 7, kind: 'aoe' },
  use(f, L) {
    const p = f.aimPoint(7, 0);
    const r = 2.5 * SZ(f, L);
    const rooted = new Set();
    Combat.zone({
      src: f, x: p.x, y: p.y, r, dur: 5, tickEvery: 0.25, acc2: 0,
      onTick(e, z) {
        e.applyStatus({ slow: { t: 0.4, amt: 0.55 } }, f);
        z.acc2 += 0.25;
        if (Math.random() < 0.5) Combat.hit(e, { src: f, dmg: 6 * D(L), element: 'earth', kind: 'dot', ability: 'mudswamp' });
        if (L >= 5 && !rooted.has(e)) { rooted.add(e); e.applyStatus({ root: 0.8 }, f); }
      },
      onUpdate(dt, z) { if (Math.random() < dt * 8) { const a = U.rand(0, TAU), d = Math.sqrt(Math.random()) * z.r; FX.add({ x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d, z: 0, vz: 20, g: 100, life: 0.5, color: '#4a3018', size: 2, layer: 0 }); } },
      drawGround(ctx, cam) {
        const a = Math.min(1, this.t * 4, (this.dur - this.t) * 2);
        ctx.globalAlpha = 0.75 * a;
        ctx.fillStyle = '#3a2614'; DF.groundEllipse(ctx, this.x, this.y, this.r, cam);
        ctx.fillStyle = '#5a3a1c'; DF.groundEllipse(ctx, this.x - 0.2, this.y - 0.2, this.r * 0.7, cam);
        ctx.fillStyle = '#6a4a24';
        for (let k = 0; k < 6; k++) { const aa = k * 1.1 + this.t, d = this.r * 0.5; DF.groundEllipse(ctx, this.x + Math.cos(aa) * d, this.y + Math.sin(aa) * d, 0.2, cam); }
        ctx.globalAlpha = 1;
      },
    });
    W.arena.extinguishRadius(p.x, p.y, r);
    SFX.playAt('earth', p.x, p.y, 0.6);
  },
});

defJutsu({
  id: 'stoneskin', name: 'Stone Skin', element: 'earth', cost: 20, cd: 15, cast: 0.2, icon: 'armor', pose: 'charge',
  desc: 'Harden your body into rock: take far less damage and ignore flinching.',
  mastery: 'Lv5: Lasts longer and your strikes hit harder.', ai: { min: 0, max: 3, kind: 'buff' },
  use(f, L) {
    f.addBuff({ id: 'stoneskin', t: L >= 5 ? 7 : 5, mods: { def: 0.6, armor: true, speed: 0.85, knockTaken: 0.3, meleeDmg: L >= 5 ? 1.25 : 1 }, tint: '#9a8a7a', fx: 'stone' });
    FX.debris(f.x, f.y, 10, MATERIALS.stone.colors, 8, 0.6);
    SFX.playAt('earth', f.x, f.y, 0.6);
  },
});

defJutsu({
  id: 'tectonic', name: 'Heaven Stomp', element: 'earth', cost: 24, cd: 9, cast: 0.15, icon: 'slam', pose: 'air',
  desc: 'Leap high and crash down on the target spot, cratering the ground.',
  mastery: 'Lv5: An aftershock ripples outward.', ai: { min: 2, max: 5.5, kind: 'dash' },
  use(f, L) {
    const p = f.aimPoint(5.5, 1);
    const dur = 0.5;
    f.vz = 0.5 * GRAVITY * dur; f.z = 0.1;
    f.startJdash({
      dx: Math.cos(p.ang), dy: Math.sin(p.ang), speed: p.dist / dur, dur, radius: 0, pose: 'air', iframes: 0.3, afterimage: false,
      onEnd(f) {
        f.z = 0; f.vz = 0;
        const r = 2.2 * SZ(f, L);
        Combat.explosion(f, f.x, f.y, r, 70 * D(L), 'earth', { ability: 'tectonic', launch: 230, knock: 5, blockDmg: 110 });
        FX.debris(f.x, f.y, 2, MATERIALS.earth.colors, 20, 1.6);
        FX.ring(f.x, f.y, 0.5, '#c08a4a', 0.4, 8, 2);
        if (L >= 5) Combat.aoe({ src: f, x: f.x, y: f.y, r: r * 1.5, delay: 0.35, dmg: 40 * D(L), element: 'earth', hit: { launch: 160, knock: 4, ability: 'tectonic' }, noTelegraph: true });
      },
    });
  },
});

// ============================== WIND =======================================
defJutsu({
  id: 'windblade', name: 'Vacuum Blade', element: 'wind', cost: 14, cd: 4, cast: 0.12, icon: 'blade', pose: 'release',
  desc: 'A razor crescent of wind that pierces every enemy and slices through trees.',
  mastery: 'Lv5: Three blades in a fan.', ai: { min: 1.5, max: 9, kind: 'proj' },
  use(f, L, aim) {
    const n = L >= 5 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const a = aim.ang + (i - (n - 1) / 2) * 0.22;
      shoot(f, a, 16, { kind: 'blade', element: 'wind', size: Math.round(8 * SZ(f, L)), radius: 0.5 * SZ(f, L), life: 0.7, dmg: 38 * D(L), knock: 3, stun: 0.35, pierce: 99, ability: 'windblade', clash: 1.5, blockDmg: 70, pierceBlocks: true, trail: TRAIL.wind, explodeOnExpire: false });
    }
    SFX.playAt('wind', f.x, f.y, 0.8);
  },
});

defJutsu({
  id: 'gale', name: 'Great Breakthrough', element: 'wind', cost: 20, cd: 7, cast: 0.3, icon: 'cone', pose: 'release',
  desc: 'Unleash a hurricane gust that blasts enemies far away and scatters their jutsu.',
  mastery: 'Lv5: The gust also launches.', ai: { min: 0.5, max: 4, kind: 'melee' },
  use(f, L, aim) {
    const range = 4.2 * SZ(f, L), arc = 0.6;
    Combat.cone(f, f.x, f.y, aim.ang, range, arc, { kind: 'aoe', dmg: 32 * D(L), element: 'wind', knock: 13, launch: L >= 5 ? 160 : 0, stun: 0.55, ability: 'gale', dirX: Math.cos(aim.ang), dirY: Math.sin(aim.ang) });
    // scatter enemy projectiles in the cone
    for (const p of W.projectiles) {
      if (p.dead || !Combat.enemies(f, p.src)) continue;
      const d = U.dist(f.x, f.y, p.x, p.y);
      if (d < range && Math.abs(U.angDiff(aim.ang, Math.atan2(p.y - f.y, p.x - f.x))) < arc + 0.2) {
        if (p.element === 'fire') { p.src = f; p.team = f.team; p.vx = Math.cos(aim.ang) * p.speed * 1.2; p.vy = Math.sin(aim.ang) * p.speed * 1.2; p.size = Math.round(p.size * 1.5); p.dmg *= 1.4; p.hitSet = new Set(); }
        else { p.dead = true; FX.wind(p.x, p.y, p.z, 4); }
      }
    }
    Combat.coneBlocks(f.x, f.y, aim.ang, range, arc, 30, 'wind', f);
    W.arena.fanFlames(f.x + Math.cos(aim.ang) * 2, f.y + Math.sin(aim.ang) * 2, 2);
    for (let k = 0; k < 40; k++) {
      const a = aim.ang + U.rand(-arc, arc), sp = U.rand(8, 16);
      FX.add({ x: f.x, y: f.y, z: U.rand(4, 20), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2, life: range / 12, color: FX.ELEM_COLORS.wind, kind: 'spark', len: 6, add: true });
    }
    SFX.playAt('wind', f.x, f.y);
    W.shakeAt(f.x, f.y, 3);
  },
});

defJutsu({
  id: 'vacuumshots', name: 'Vacuum Sphere Volley', element: 'wind', cost: 20, cd: 6, cast: 0.2, icon: 'bullets', pose: 'release',
  desc: 'Machine-gun compressed air spheres that pop on impact.',
  mastery: 'Lv5: Eight spheres per volley.', ai: { min: 2, max: 8, kind: 'proj' },
  use(f, L) {
    const n = L >= 5 ? 8 : 5;
    f.startChannel({
      dur: n * 0.1 + 0.05, move: 0.3, turn: 5, pose: 'release', acc: 0.1, shots: 0,
      tick(f, dt, c) {
        c.acc += dt;
        if (c.acc >= 0.1 && c.shots < n) {
          c.acc = 0; c.shots++;
          shoot(f, f.facing + U.rand(-0.08, 0.08), 15, { kind: 'airball', element: 'wind', size: 3, radius: 0.3, life: 0.6, dmg: 17 * D(L), knock: 2.5, stun: 0.3, ability: 'vacuumshots', clash: 0.8, blockDmg: 25, trail: TRAIL.wind, explode: { r: 0.6, dmg: 6 * D(L), knock: 2 } });
          SFX.playAt('dash', f.x, f.y, 0.4);
        }
      },
    });
  },
});

defJutsu({
  id: 'cyclone', name: 'Cyclone Prison', element: 'wind', cost: 28, cd: 11, cast: 0.35, icon: 'tornado',
  desc: 'Conjure a drifting tornado that sucks enemies in and juggles them.',
  mastery: 'Lv5: Bigger and lasts longer.', ai: { min: 1.5, max: 7, kind: 'proj' },
  use(f, L, aim) {
    const dur = L >= 5 ? 4.5 : 3, R = 2.3 * SZ(f, L) * (L >= 5 ? 1.2 : 1);
    const dx = Math.cos(aim.ang), dy = Math.sin(aim.ang);
    Combat.hazard({
      src: f, x: f.x + dx * 1.5, y: f.y + dy * 1.5, acc: 0, layer: 1,
      update(dt) {
        this.x += dx * 2.4 * dt; this.y += dy * 2.4 * dt;
        if (W.arena.isSolid(Math.floor(this.x), Math.floor(this.y))) W.arena.damageBlock(Math.floor(this.x), Math.floor(this.y), 40 * dt, 'wind', f, true);
        this.acc += dt;
        for (const e of Combat.enemiesInRadius(f, this.x, this.y, R)) {
          const d = U.dist(this.x, this.y, e.x, e.y);
          const [nx, ny] = U.norm(this.x - e.x, this.y - e.y);
          if (!e.hasArmor()) { e.vx += nx * 18 * dt * (1 + d); e.vy += ny * 18 * dt * (1 + d); }
          if (d < 0.9 && this.acc >= 0.2) Combat.hit(e, { src: f, dmg: 9 * D(L), element: 'wind', kind: 'aoe', launch: 140, knock: 0.5, stun: 0.35, ability: 'cyclone', sx: this.x, sy: this.y, hitstop: 0.01, sfx: false, noParry: true });
        }
        if (this.acc >= 0.2) this.acc = 0;
        for (let k = 0; k < 3; k++) {
          const a = U.rand(0, TAU), h = U.rand(0, 50), rr = 0.2 + h / 60;
          FX.add({ x: this.x + Math.cos(a) * rr, y: this.y + Math.sin(a) * rr, z: h, vx: -Math.sin(a) * 4, vy: Math.cos(a) * 4, vz: 30, life: 0.3, color: FX.ELEM_COLORS.wind, kind: 'spark', len: 3, add: true });
        }
        if (Math.random() < dt * 6) FX.dust(this.x, this.y, 2);
        if (this.t >= dur) this.dead = true;
      },
      draw(ctx, cam) {
        const [sx, sy] = DF.sp(this.x, this.y, 0, cam);
        ctx.globalAlpha = 0.55;
        for (let h = 0; h < 56; h += 3) {
          const w = 3 + h * 0.28, o = Math.sin(this.t * 14 + h * 0.2) * 3;
          ctx.fillStyle = h % 6 ? '#bff5dc' : '#ffffff';
          ctx.fillRect(Math.round(sx - w + o), sy - h, 2, 2); ctx.fillRect(Math.round(sx + w + o), sy - h, 2, 2);
          ctx.fillStyle = 'rgba(160,240,200,0.4)'; ctx.fillRect(Math.round(sx - w + o), sy - h, Math.round(w * 2), 1);
        }
        ctx.globalAlpha = 1;
      },
    });
    SFX.playAt('wind', f.x, f.y);
  },
});

defJutsu({
  id: 'windstep', name: 'Gale Step', element: 'wind', cost: 10, cd: 5, cast: 0, recover: 0.08, icon: 'blink', pose: 'dash',
  desc: 'Blink forward on the wind, slicing anyone you pass. Your next hit is empowered.',
  mastery: 'Lv5: Deeper cuts and a longer blink.', ai: { min: 3, max: 6, kind: 'dash' },
  use(f, L, aim) {
    const maxD = L >= 5 ? 6 : 5;
    const d0 = U.clamp(aim.dist, 2, maxD);
    let tx = f.x, ty = f.y;
    for (let s = 0.25; s <= d0; s += 0.25) {
      const x = f.x + Math.cos(aim.ang) * s, y = f.y + Math.sin(aim.ang) * s;
      if (W.arena.isSolid(Math.floor(x), Math.floor(y))) break;
      tx = x; ty = y;
    }
    for (let k = 0; k <= 5; k++) FX.afterimage(f.spriteCanvas(), U.lerp(f.x, tx, k / 5), U.lerp(f.y, ty, k / 5), 0, f.flip, 0.3, 0.35);
    Combat.line(f, f.x, f.y, tx, ty, 0.5, { kind: 'aoe', dmg: (L >= 5 ? 32 : 22) * D(L), element: 'wind', knock: 2, stun: 0.4, ability: 'windstep' }, new Set());
    for (let k = 0; k < 16; k++) { const t = Math.random(); FX.wind(U.lerp(f.x, tx, t), U.lerp(f.y, ty, t), 12, 1); }
    f.x = tx; f.y = ty;
    W.arena.resolveCircle(f, f.radius);
    f.counterBonus = 1.5;
    f.iframes = Math.max(f.iframes, 0.15);
    SFX.playAt('dash', f.x, f.y);
  },
});

defJutsu({
  id: 'bladedance', name: 'Thousand Wind Cuts', element: 'wind', cost: 22, cd: 8, cast: 0.15, icon: 'spin', pose: 'raise',
  desc: 'Surround yourself in a storm of blades, shredding anyone nearby as you move.',
  mastery: 'Lv5: The storm widens.', ai: { min: 0, max: 2, kind: 'self' },
  use(f, L) {
    const R = (L >= 5 ? 2.3 : 1.8) * SZ(f, L);
    SFX.playAt('wind', f.x, f.y);
    f.startChannel({
      dur: 0.9, move: 0.65, turn: 99, pose: 'raise', acc: 0,
      tick(f, dt, c) {
        c.acc += dt;
        if (c.acc >= 0.1) {
          c.acc = 0;
          for (const e of Combat.enemiesInRadius(f, f.x, f.y, R)) {
            const [nx, ny] = U.norm(f.x - e.x, f.y - e.y);
            Combat.hit(e, { src: f, dmg: 9 * D(L), element: 'wind', kind: 'aoe', knock: 0.5, stun: 0.25, ability: 'bladedance', dirX: nx * 0.3, dirY: ny * 0.3, hitstop: 0.01, sfx: false });
          }
          W.arena.damageRadius(f.x, f.y, R, 6, 'wind', f);
          SFX.playAt('swing', f.x, f.y, 0.4);
        }
        for (let k = 0; k < 3; k++) { const a = U.rand(0, TAU), d = U.rand(0.4, R); FX.add({ x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, z: U.rand(4, 24), vx: -Math.sin(a) * 6, vy: Math.cos(a) * 6, life: 0.15, color: FX.ELEM_COLORS.wind, kind: 'spark', len: 5, add: true }); }
      },
    });
  },
});

// ============================ LIGHTNING ====================================
defJutsu({
  id: 'lance', name: 'Thunder Lance', element: 'lightning', cost: 30, cd: 9, cast: 0.45, icon: 'lance', pose: 'heavyWind',
  desc: 'Gather lightning in your hand, then pierce forward at blinding speed. Devastating single hit.',
  mastery: 'Lv5: Pierces through every foe on the path.', ai: { min: 1, max: 5, kind: 'dash' },
  use(f, L, aim) {
    SFX.playAt('lightning', f.x, f.y);
    f.startJdash({
      dx: Math.cos(aim.ang), dy: Math.sin(aim.ang), speed: 17, dur: 0.33, radius: 0.6, pose: 'palm', stopOnHit: L < 5, blockDmg: 60, iframes: 0.08,
      hit: { dmg: 105 * D(L), element: 'lightning', knock: 7, launch: 110, stun: 0.7, status: { para: 0.5 }, ability: 'lance', guardDmg: 90 },
      trail(f) { FX.electric(f.x + Math.cos(f.facing) * 0.4, f.y + Math.sin(f.facing) * 0.4, 14, 3); FX.add({ x: f.x, y: f.y, z: 2, life: 0.3, color: '#8fc8ff', size: 2, layer: 0 }); },
      onHit(f, e, res) { if (res === 'hit') { FX.glow(e.x, e.y, 16, 10, '#e0f0ff', 0.15); W.shakeAt(e.x, e.y, 6); SFX.playAt('thunder', e.x, e.y, 0.6); } },
    });
  },
});

defJutsu({
  id: 'chain', name: 'Chain Lightning', element: 'lightning', cost: 20, cd: 7, cast: 0.2, icon: 'chain', pose: 'release',
  desc: 'A bolt that leaps between nearby enemies, paralyzing each one.',
  mastery: 'Lv5: Jumps to more targets.', ai: { min: 1, max: 6.5, kind: 'proj' },
  use(f, L, aim) {
    const jumps = L >= 5 ? 5 : 3;
    let from = { x: f.x + Math.cos(aim.ang) * 0.4, y: f.y + Math.sin(aim.ang) * 0.4, z: 14 };
    let cand = W.fighters.filter((e) => e.alive && Combat.enemies(f, e) && e.st.stealth <= 0 && U.dist(f.x, f.y, e.x, e.y) < 6.5 && Math.abs(U.angDiff(aim.ang, Math.atan2(e.y - f.y, e.x - f.x))) < 0.7);
    cand.sort((a, b) => U.dist(f.x, f.y, a.x, a.y) - U.dist(f.x, f.y, b.x, b.y));
    let cur = cand[0];
    const segs = [];
    const hit = new Set();
    let dmg = 45 * D(L);
    if (!cur) {
      const p = f.aimPoint(6, 1);
      segs.push([from, { x: p.x, y: p.y, z: 0 }]);
      Combat.explosion(f, p.x, p.y, 0.8, 25 * D(L), 'lightning', { status: { para: 0.3 }, ability: 'chain', fx: false });
      electrify(f, p.x, p.y, 3, 20 * D(L), 'chain');
    }
    for (let n = 0; cur && n <= jumps; n++) {
      hit.add(cur);
      segs.push([from, { x: cur.x, y: cur.y, z: cur.z + 14 }]);
      Combat.hit(cur, { src: f, dmg, element: 'lightning', kind: 'proj', knock: 1.5, stun: 0.4, status: { para: 0.4 }, ability: 'chain', sx: from.x, sy: from.y });
      from = { x: cur.x, y: cur.y, z: cur.z + 14 };
      dmg *= 0.82;
      const next = W.fighters.filter((e) => e.alive && Combat.enemies(f, e) && !hit.has(e) && U.dist(cur.x, cur.y, e.x, e.y) < 3.8)
        .sort((a, b) => U.dist(cur.x, cur.y, a.x, a.y) - U.dist(cur.x, cur.y, b.x, b.y))[0];
      cur = next;
    }
    FX.custom({ life: 0.28, layer: 1, draw(ctx, cam) { for (const [a, b] of segs) { const [x0, y0] = DF.sp(a.x, a.y, a.z, cam), [x1, y1] = DF.sp(b.x, b.y, b.z, cam); DF.bolt(ctx, x0, y0, x1, y1, '#5f7aff', '#ffffff', 5, 7, 2); } } });
    for (const [, b] of segs) FX.electric(b.x, b.y, b.z, 8);
    SFX.playAt('lightning', f.x, f.y);
  },
});

// Shock everyone standing in water/puddles near a point.
function electrify(f, x, y, r, dmg, ability) {
  const A = W.arena;
  let any = false;
  for (const e of W.fighters) {
    if (!e.alive || !Combat.enemies(f, e) || e.z > 3) continue;
    if (U.dist(x, y, e.x, e.y) > r) continue;
    if (!A.isWetW(e.x, e.y)) continue;
    Combat.hit(e, { src: f, dmg, element: 'lightning', kind: 'aoe', knock: 0.5, stun: 0.4, status: { para: 0.6 }, ability, sx: x, sy: y, noParry: true, unblockable: true });
    any = true;
  }
  if (A.isWetW(x, y) || any) {
    for (let k = 0; k < 18; k++) {
      const a = U.rand(0, TAU), d = U.rand(0, r);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (A.isWetW(px, py)) FX.electric(px, py, 1, 2);
    }
  }
}

defJutsu({
  id: 'hound', name: 'Lightning Hounds', element: 'lightning', cost: 20, cd: 7, cast: 0.25, icon: 'hound',
  desc: 'Release hounds of lightning that chase down the nearest enemies.',
  mastery: 'Lv5: Three hounds.', ai: { min: 2, max: 9, kind: 'proj' },
  use(f, L, aim) {
    const n = L >= 5 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      shoot(f, aim.ang + (i - (n - 1) / 2) * 0.5, 10, { kind: 'hound', element: 'lightning', size: 4, radius: 0.4, life: 1.7, z: 8, dmg: 36 * D(L), knock: 2.5, stun: 0.45, homing: 3.6, status: { para: 0.45 }, ability: 'hound', clash: 1.2, blockDmg: 20, trail: TRAIL.lightning });
    }
    SFX.playAt('lightning', f.x, f.y, 0.8);
  },
});

defJutsu({
  id: 'discharge', name: 'Static Discharge', element: 'lightning', cost: 24, cd: 10, cast: 0.25, icon: 'field', pose: 'raise',
  desc: 'Explode with stored electricity, paralyzing everyone around you. Water conducts it far.',
  mastery: 'Lv5: Pulses a second time.', ai: { min: 0, max: 2.3, kind: 'self' },
  use(f, L) {
    const R = 2.3 * SZ(f, L);
    const pulse = () => {
      Combat.explosion(f, f.x, f.y, R, 45 * D(L), 'lightning', { ability: 'discharge', status: { para: 0.8 }, knock: 4, stun: 0.5, blockDmg: 30, crater: false, sfx: 'thunder' });
      electrify(f, f.x, f.y, R + 3, 25 * D(L), 'discharge');
      FX.custom({ life: 0.2, layer: 1, draw(ctx, cam) { const [sx, sy] = DF.sp(f.x, f.y, 14, cam); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + Math.random(); DF.bolt(ctx, sx, sy, sx + Math.cos(a) * R * ISO_RX, sy + Math.sin(a) * R * ISO_RY, '#5f7aff', '#ffffff', 4, 5, 1); } } });
    };
    pulse();
    if (L >= 5) Combat.hazard({ update() { if (this.t >= 0.45) { if (f.alive) pulse(); this.dead = true; } } });
  },
});

defJutsu({
  id: 'larmor', name: 'Lightning Armor', element: 'lightning', cost: 25, cd: 16, cast: 0.2, icon: 'armor', pose: 'charge',
  desc: 'Coat yourself in lightning: move and strike faster, and your blows paralyze.',
  mastery: 'Lv5: Lasts longer; dashing leaves shocking trails.', ai: { min: 0, max: 4, kind: 'buff' },
  use(f, L) {
    f.addBuff({
      id: 'larmor', t: L >= 5 ? 8 : 6, mods: { speed: 1.3, atkSpeed: 1.3, castSpeed: 0.8, meleeElement: 'lightning', meleeStatus: { para: 0.15 }, dashCD: 0.7 }, fx: 'lightning',
      tick(f, dt) {
        if (Math.random() < dt * 20) FX.electric(f.x, f.y, f.z + U.rand(4, 26), 1);
        if (L >= 5 && f.state === 'dash' && Math.random() < dt * 30) {
          Combat.zone({ src: f, x: f.x, y: f.y, r: 0.6, dur: 1.2, tickEvery: 0.3, onTick(e) { Combat.hit(e, { src: f, dmg: 10, element: 'lightning', kind: 'aoe', stun: 0.2, status: { para: 0.2 }, ability: 'larmor', sfx: false }); }, onUpdate(dt, z) { if (Math.random() < dt * 10) FX.electric(z.x, z.y, 2, 1); } });
        }
      },
    });
    FX.electric(f.x, f.y, 14, 16);
    SFX.playAt('lightning', f.x, f.y);
  },
});

defJutsu({
  id: 'thunderbolt', name: "Heaven's Thunderbolt", element: 'lightning', cost: 20, cd: 6, cast: 0.25, icon: 'bolt', pose: 'raise',
  desc: 'Call a bolt from the sky onto the target area. Anyone standing in water is shocked too.',
  mastery: 'Lv5: Three bolts strike around the target.', ai: { min: 2, max: 8, kind: 'aoe' },
  use(f, L) {
    const p = f.aimPoint(8, 0);
    const pts = [p];
    if (L >= 5) for (let k = 0; k < 2; k++) { const a = U.rand(0, TAU); pts.push({ x: p.x + Math.cos(a) * 1.6, y: p.y + Math.sin(a) * 1.6 }); }
    pts.forEach((q, i) => {
      Combat.aoe({
        src: f, x: q.x, y: q.y, r: 1.2 * SZ(f, L), delay: 0.5 + i * 0.15, dmg: 70 * D(L), element: 'lightning', fx: false,
        hit: { status: { para: 0.6 }, knock: 2, stun: 0.5, ability: 'thunderbolt', crater: false, blockDmg: 60 },
        onFire(h) {
          SFX.playAt('thunder', h.x, h.y, 0.9);
          W.shakeAt(h.x, h.y, 5);
          W.flash('#e0f0ff', 0.08);
          electrify(f, h.x, h.y, 5, 35 * D(L), 'thunderbolt');
          FX.electric(h.x, h.y, 2, 16);
          W.arena.addStain(h.x, h.y, 0.6, 'scorch');
          FX.custom({ life: 0.25, layer: 1, draw(ctx, cam) { const [sx, sy] = DF.sp(h.x, h.y, 0, cam); DF.bolt(ctx, sx + U.rand(-20, 20), sy - 260, sx, sy, '#5f7aff', '#ffffff', 10, 10, 3); ctx.fillStyle = 'rgba(220,235,255,0.5)'; PX.ellipse(ctx, sx, sy, 20, 10); } });
        },
      });
    });
  },
});

// ============================ SHINOBI ======================================
defJutsu({
  id: 'clones', name: 'Shadow Clones', element: 'shinobi', cost: 28, cd: 16, cast: 0.3, icon: 'clone',
  desc: 'Create solid clones that fight alongside you. They vanish in a single hit.',
  mastery: 'Lv5: Summon three clones.', ai: { min: 0, max: 7, kind: 'summon' },
  use(f, L) {
    const n = L >= 5 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = f.facing + (i - (n - 1) / 2) * 1.4 + Math.PI / 2;
      W.spawnClone(f, f.x + Math.cos(a) * 0.9, f.y + Math.sin(a) * 0.9, 9);
    }
    SFX.playAt('poof', f.x, f.y);
  },
});

defJutsu({
  id: 'shadowbind', name: 'Shadow Bind', element: 'shinobi', cost: 20, cd: 12, cast: 0.2, icon: 'bind', pose: 'seal',
  desc: 'Your shadow stretches along the ground. Anyone it touches is frozen in place.',
  mastery: 'Lv5: The bind holds far longer.', ai: { min: 1.5, max: 7, kind: 'proj' },
  use(f, L, aim) {
    const dur = L >= 5 ? 2.0 : 1.3;
    shoot(f, aim.ang, 9, {
      kind: 'shadow', ox: f.x, oy: f.y, z: 0, element: 'shinobi', size: 3, radius: 0.35, life: 0.85, dmg: 8, knock: 0, stun: 0.1, unblockable: true, reflectable: false,
      clash: 0, hitTerrain: false, ability: 'shadowbind', trail: TRAIL.shadow, explodeOnExpire: false,
      onHit(p, t) {
        t.applyStatus({ genjutsu: dur }, f);
        const ox = p.ox, oy = p.oy;
        FX.custom({ life: dur, layer: 0, draw(ctx, cam) { const [ax, ay] = DF.sp(ox, oy, 0, cam), [bx, by] = DF.sp(t.x, t.y, 0, cam); ctx.fillStyle = 'rgba(10,6,20,0.75)'; PX.line(ctx, ax, ay, bx, by, 3); PX.ellipse(ctx, bx, by, 9, 5); } });
        FX.text(t.x, t.y, 40, 'BOUND', '#c9b6ff', { life: 0.8 });
      },
    });
    SFX.playAt('whip', f.x, f.y, 0.6);
  },
});

defJutsu({
  id: 'flashstep', name: 'Body Flicker', element: 'shinobi', cost: 12, cd: 6, cast: 0, recover: 0.05, icon: 'blink', pose: 'dash',
  desc: 'Vanish and reappear at the target spot. Your next strike is empowered.',
  mastery: 'Lv5: Leaves an explosive tag where you stood.', ai: { min: 3, max: 6, kind: 'dash' },
  use(f, L) {
    const p = f.aimPoint(6, 1);
    let tx = p.x, ty = p.y;
    if (W.arena.isSolid(Math.floor(tx), Math.floor(ty))) { const q = W.arena.nearestOpen(tx, ty, 2); if (q) { tx = q.x; ty = q.y; } else return; }
    FX.poof(f.x, f.y, 8);
    if (L >= 5) dropTag(f, f.x, f.y, 0.8, 55 * D(L), 'flashstep');
    FX.afterimage(f.spriteCanvas(), f.x, f.y, 0, f.flip, 0.35, 0.6);
    f.x = tx; f.y = ty;
    W.arena.resolveCircle(f, f.radius);
    FX.poof(f.x, f.y, 8);
    f.counterBonus = 1.5;
    f.iframes = Math.max(f.iframes, 0.12);
    SFX.playAt('sub', f.x, f.y, 0.6);
  },
});

function dropTag(f, x, y, delay, dmg, ability) {
  return Combat.hazard({
    x, y, layer: 1,
    update() { if (this.t >= delay) { Combat.explosion(f, x, y, 1.6, dmg, 'fire', { ability, knock: 7, launch: 170 }); this.dead = true; } },
    draw(ctx, cam) {
      const [sx, sy] = DF.sp(x, y, 2, cam);
      ctx.fillStyle = Math.floor(this.t * 14) % 2 ? '#ff4a2a' : '#fff2b0';
      ctx.fillRect(sx - 2, sy - 3, 4, 5);
      ctx.fillStyle = '#b8322a'; ctx.fillRect(sx - 1, sy - 2, 2, 1);
    },
  });
}

defJutsu({
  id: 'tagkunai', name: 'Explosive Tag Kunai', element: 'shinobi', cost: 14, cd: 5, cast: 0.12, icon: 'tag', pose: 'throw',
  desc: 'Throw a kunai wrapped in a paper bomb. It sticks to whatever it hits, then explodes.',
  mastery: 'Lv5: Throw three at once.', ai: { min: 2, max: 8, kind: 'proj' },
  use(f, L, aim) {
    const n = L >= 5 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      shoot(f, aim.ang + (i - (n - 1) / 2) * 0.22, 15, {
        kind: 'kunai', tag: true, size: 2, radius: 0.24, life: 0.7, z: 14, dmg: 12, knock: 1, stun: 0.3, ability: 'tagkunai', clash: 0.5, blockDmg: 6, explodeOnExpire: true,
        onImpact(p) {
          const stuck = p.hitSet.size ? [...p.hitSet][0] : null;
          const x = p.x, y = p.y;
          Combat.hazard({
            layer: 1, x, y,
            update() {
              if (stuck && stuck.alive) { this.x = stuck.x; this.y = stuck.y; }
              if (this.t >= 0.85) { Combat.explosion(f, this.x, this.y, 1.6 * SZ(f, L), 60 * D(L), 'fire', { ability: 'tagkunai', knock: 7, launch: 160 }); this.dead = true; }
            },
            draw(ctx, cam) {
              const z = stuck && stuck.alive ? stuck.z + 14 : 2;
              const [sx, sy] = DF.sp(this.x, this.y, z, cam);
              ctx.fillStyle = Math.floor(this.t * 16) % 2 ? '#ff4a2a' : '#fff2b0';
              ctx.fillRect(sx - 2, sy - 3, 4, 5);
            },
          });
        },
      });
    }
    SFX.playAt('kunai', f.x, f.y);
  },
});

defJutsu({
  id: 'smokebomb', name: 'Smoke Bomb', element: 'shinobi', cost: 12, cd: 12, cast: 0.08, icon: 'smoke', pose: 'throw',
  desc: 'Burst of smoke: you vanish from sight and enemies inside are slowed and blinded.',
  mastery: 'Lv5: Bigger cloud, longer stealth.', ai: { min: 0, max: 3, kind: 'escape' },
  use(f, L) {
    const r = (L >= 5 ? 3.2 : 2.5);
    f.st.stealth = Math.max(f.st.stealth, L >= 5 ? 3.5 : 2.5);
    Combat.zone({
      src: f, x: f.x, y: f.y, r, dur: 4, tickEvery: 0.25,
      onTick(e) { e.applyStatus({ slow: { t: 0.4, amt: 0.25 } }, f); e.blindT = 0.4; },
      onUpdate(dt, z) { for (let i = 0; i < 2; i++) { const a = U.rand(0, TAU), d = Math.sqrt(Math.random()) * z.r; FX.add({ x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d, z: U.rand(0, 20), vz: 6, life: U.rand(0.8, 1.4), color: ['#b8b8c0', '#98989f', '#78787f'], size: U.rand(3, 6), grow: 2, kind: 'smoke', alpha: 0.6 }); } },
    });
    FX.poof(f.x, f.y, 30);
    SFX.playAt('poof', f.x, f.y);
  },
});

defJutsu({
  id: 'spiral', name: 'Spiraling Sphere', element: 'shinobi', cost: 26, cd: 8, cast: 0.42, icon: 'orb', pose: 'palm',
  desc: 'Form a spinning sphere of chakra in your palm and drive it into an enemy.',
  mastery: 'Lv5: A massive sphere that detonates on impact.', ai: { min: 0.8, max: 4, kind: 'dash' },
  use(f, L, aim) {
    const big = L >= 5;
    f.startJdash({
      dx: Math.cos(aim.ang), dy: Math.sin(aim.ang), speed: 12, dur: 0.32, radius: big ? 0.8 : 0.6, pose: 'palm', stopOnHit: true, blockDmg: 50,
      hit: { dmg: 20 * D(L), element: 'shinobi', knock: 0, stun: 0.6, ability: 'spiral' },
      trail(f) { const [ox, oy] = [f.x + Math.cos(f.facing) * 0.45, f.y + Math.sin(f.facing) * 0.45]; FX.add({ x: ox, y: oy, z: 13, life: 0.12, color: ['#ffffff', '#cfe8ff', '#5aa0ff'], size: big ? 7 : 5, kind: 'glow', add: true }); FX.wind(ox, oy, 13, 1); },
      onHit(f, e, res) {
        if (res !== 'hit') return;
        // grind then blast
        f.startChannel({
          dur: 0.4, move: 0, pose: 'palm', acc: 0, n: 0,
          tick(f, dt, c) {
            c.acc += dt;
            e.vx = e.vy = 0;
            e.x = U.lerp(e.x, f.x + Math.cos(f.facing) * 0.75, 0.3); e.y = U.lerp(e.y, f.y + Math.sin(f.facing) * 0.75, 0.3);
            if (c.acc >= 0.08) { c.acc = 0; Combat.hit(e, { src: f, dmg: 14 * D(L), element: 'shinobi', kind: 'melee', knock: 0, stun: 0.3, ability: 'spiral', hitstop: 0.02, sfx: 'hit', noParry: true, unblockable: true }); }
            FX.add({ x: e.x, y: e.y, z: 14, life: 0.08, color: ['#ffffff', '#cfe8ff', '#5aa0ff'], size: big ? 10 : 7, kind: 'glow', add: true });
            FX.wind(e.x, e.y, 14, 2);
          },
          end(f) {
            if (!e.alive) return;
            Combat.hit(e, { src: f, dmg: 48 * D(L), element: 'shinobi', kind: 'melee', knock: 12, launch: 170, stun: 0.8, ability: 'spiral', dirX: Math.cos(f.facing), dirY: Math.sin(f.facing), noParry: true, unblockable: true, hitstop: 0.1, sfx: 'hitHeavy' });
            if (big) Combat.explosion(f, e.x, e.y, 1.6, 40 * D(L), 'shinobi', { ability: 'spiral', knock: 6 });
            FX.ring(e.x, e.y, 0.4, '#8fc8ff', 0.3, 6, 2);
            W.shakeAt(e.x, e.y, 6);
          },
          cancel() {},
        });
      },
    });
    SFX.playAt('wind', f.x, f.y, 0.7);
  },
});

defJutsu({
  id: 'rotation', name: 'Heavenly Rotation', element: 'shinobi', cost: 24, cd: 12, cast: 0, recover: 0.15, icon: 'spin', pose: 'raise',
  desc: 'Spin a dome of chakra: invulnerable, it repels attackers and bounces jutsu back.',
  mastery: 'Lv5: A much larger dome.', ai: { min: 0, max: 2, kind: 'defend' },
  use(f, L) {
    const R = (L >= 5 ? 2.3 : 1.8) * SZ(f, L);
    f.invuln = Math.max(f.invuln, 0.65);
    const hitSet = new Set();
    f.startChannel({
      dur: 0.6, move: 0, pose: 'raise',
      tick(f) {
        f.facing += 0.6;
        for (const e of Combat.enemiesInRadius(f, f.x, f.y, R)) {
          if (hitSet.has(e)) continue;
          hitSet.add(e);
          Combat.hit(e, { src: f, dmg: 30 * D(L), element: 'shinobi', kind: 'aoe', knock: 10, launch: 90, stun: 0.5, ability: 'rotation', unblockable: true, noParry: true });
        }
        for (const p of W.projectiles) {
          if (p.dead || !Combat.enemies(f, p.src) || U.dist(f.x, f.y, p.x, p.y) > R) continue;
          if (p.reflectable) p.reflect(f); else p.dead = true;
          const a = Math.atan2(p.y - f.y, p.x - f.x); const sp = p.speed;
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        }
        FX.chakra(f.x, f.y, 3, ['#ffffff', '#cfe8ff', '#8fc8ff']);
      },
    });
    FX.custom({ life: 0.6, layer: 1, draw(ctx, cam, k) { const [sx, sy] = DF.sp(f.x, f.y, 12, cam); ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#cfe8ff'; PX.ellipseRing(ctx, sx, sy + 8, R * ISO_RX, R * ISO_RY + 6, 2); ctx.fillStyle = 'rgba(200,230,255,0.25)'; PX.ellipse(ctx, sx, sy, R * ISO_RX * 0.8, R * ISO_RY * 1.4); ctx.globalAlpha = 1; } });
    SFX.playAt('wind', f.x, f.y);
  },
});

const JUTSU_LIST = () => Object.values(JUTSU);
