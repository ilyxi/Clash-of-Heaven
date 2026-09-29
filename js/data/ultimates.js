'use strict';
// ---------------------------------------------------------------------------
// Ultimate techniques: fueled by the ultimate meter; each has a cinematic
// wind-up (invulnerable) then a devastating, terrain-wrecking effect.
// ---------------------------------------------------------------------------

const ULTIMATES = {};
function defUlt(o) { ULTIMATES[o.id] = o; }
const UD = (L) => 1 + 0.1 * (L - 1);

defUlt({
  id: 'meteor', name: 'Heavenly Meteor', element: 'earth', windup: 0.8, pose: 'raise', colors: ['#ffe0a0', '#ff8a2a', '#8a4a1a'],
  desc: 'Call down a blazing meteor that obliterates a huge area and everything built on it.',
  ai: { min: 2, max: 9, kind: 'aoe', r: 3.8 },
  use(f, L, aim) {
    const p = f.aimPoint(9, 0);
    const R = 3.8 * (1 + 0.05 * (L - 1));
    const fall = 1.35;
    SFX.playAt('fireBig', p.x, p.y, 0.8);
    Combat.hazard({
      x: p.x, y: p.y, layer: 1,
      update(dt) {
        const k = this.t / fall;
        if (k < 1) {
          const h = (1 - k) * 340;
          for (let i = 0; i < 3; i++) FX.add({ x: this.x - (1 - k) * 4 + U.rand(-0.3, 0.3), y: this.y - (1 - k) * 4 + U.rand(-0.3, 0.3), z: h + U.rand(-6, 6), vz: 40, life: 0.5, color: FX.ELEM_COLORS.fire, size: U.rand(3, 5), grow: -4, kind: 'glow', add: true });
          return;
        }
        if (!this.boom) {
          this.boom = true;
          Combat.explosion(f, this.x, this.y, R, 300 * UD(L), 'fire', { ability: 'meteor', launch: 330, knock: 11, stun: 1, blockDmg: 700, unblockable: true, sfx: 'explosion' });
          W.arena.addStain(this.x, this.y, R * 0.75, 'crater');
          W.arena.addStain(this.x, this.y, R, 'scorch');
          W.arena.igniteRadius(this.x, this.y, R * 1.2, 0.5);
          FX.debris(this.x, this.y, 10, MATERIALS.earth.colors, 50, 2.5);
          FX.ring(this.x, this.y, 1, '#ffd35c', 0.6, 12, 3);
          W.shakeAt(this.x, this.y, 16);
          W.flash('#ffe0b0', 0.25);
        }
        if (this.t > fall + 0.2) this.dead = true;
      },
      drawGround(ctx, cam) {
        const k = Math.min(1, this.t / fall);
        if (k >= 1) return;
        const [sx, sy] = DF.sp(this.x, this.y, 0, cam);
        ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.35 * k})`;
        PX.ellipse(ctx, sx, sy, R * ISO_RX * (0.3 + 0.7 * k), R * ISO_RY * (0.3 + 0.7 * k));
        ctx.fillStyle = '#ff6a2a';
        PX.ellipseRing(ctx, sx, sy, R * ISO_RX, R * ISO_RY, 1);
      },
      draw(ctx, cam) {
        const k = this.t / fall;
        if (k >= 1) return;
        const h = (1 - k) * 340;
        const [sx, sy] = DF.sp(this.x - (1 - k) * 4, this.y - (1 - k) * 4, h, cam);
        const r = 14 + k * 6;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,140,40,0.4)'; PX.circle(ctx, sx, sy, r + 6);
        ctx.globalCompositeOperation = 'source-over';
        DF.orb(ctx, sx, sy, r, ['#ffe0a0', '#c08a4a', '#8a4a1a', '#3a1a0a'], this.t);
        ctx.fillStyle = '#ffd35c'; PX.ellipseRing(ctx, sx, sy, r + 2, r + 2, 1);
      },
    });
  },
});

defUlt({
  id: 'cannon', name: 'Chakra Cannon', element: 'shinobi', windup: 0.9, pose: 'release', colors: ['#ffffff', '#c9b6ff', '#5a3f9e'],
  desc: 'Compress raw chakra into a colossal beam that tears straight through terrain.',
  ai: { min: 1, max: 14, kind: 'line' },
  use(f, L) {
    SFX.playAt('beam', f.x, f.y, 1);
    const beam = Combat.beam({
      src: f, follow: f, channel: true, x: f.x, y: f.y, ang: f.facing, len: 15, width: 0.95, dur: 1.4, tickEvery: 0.08,
      dmg: 24 * UD(L), element: 'shinobi', knock: 3.5, stun: 0.35, ability: 'cannon', pierceTerrain: true, blockDmg: 120, layer: 1,
      hit: { unblockable: true, noParry: true },
      onTick(b, x1, y1) { W.shakeAt(f.x, f.y, 4); FX.debris(x1, y1, 4, MATERIALS.stone.colors, 3, 1); },
      draw(ctx, cam) {
        const len = this.curLen || this.len;
        const [ax, ay] = DF.sp(this.x, this.y, 13, cam);
        const [bx, by] = DF.sp(this.x + Math.cos(this.ang) * len, this.y + Math.sin(this.ang) * len, 13, cam);
        const w = 7 + Math.sin(this.t * 40) * 2;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(140,100,255,0.55)'; PX.line(ctx, ax, ay, bx, by, Math.round(w * 2.2));
        ctx.fillStyle = 'rgba(200,180,255,0.8)'; PX.line(ctx, ax, ay, bx, by, Math.round(w * 1.3));
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffffff'; PX.line(ctx, ax, ay, bx, by, Math.max(2, Math.round(w * 0.6)));
        PX.circle(ctx, ax, ay, w + 2);
      },
    });
    f.startChannel({ dur: 1.4, move: 0, turn: 0.9, pose: 'release', tick() {}, end() { beam.dead = true; }, cancel() { beam.dead = true; } });
  },
});

defUlt({
  id: 'kirin', name: 'Thunder Kirin', element: 'lightning', windup: 0.9, pose: 'raise', colors: ['#ffffff', '#8fc8ff', '#3548c9'],
  desc: 'Summon a storm, then drop a dragon of pure lightning onto the target area.',
  ai: { min: 2, max: 10, kind: 'aoe', r: 3.2 },
  use(f, L) {
    const p = f.aimPoint(10, 0);
    const R = 3.2;
    SFX.playAt('thunder', p.x, p.y, 0.5);
    Combat.aoe({
      src: f, x: p.x, y: p.y, r: R, delay: 1.25, dmg: 260 * UD(L), element: 'lightning', fx: false,
      hit: { status: { para: 0.9 }, launch: 200, knock: 4, stun: 0.9, ability: 'kirin', unblockable: true, crater: false, blockDmg: 200 },
      onFire(h) {
        SFX.playAt('thunder', h.x, h.y, 1);
        W.flash('#ffffff', 0.3);
        W.shakeAt(h.x, h.y, 14);
        W.arena.addStain(h.x, h.y, R * 0.8, 'scorch');
        W.arena.addStain(h.x, h.y, 1.4, 'crater');
        electrify(f, h.x, h.y, 5, 40 * UD(L), 'kirin');
        FX.electric(h.x, h.y, 4, 40);
        FX.ring(h.x, h.y, 0.5, '#e0f0ff', 0.5, 10, 2);
        FX.custom({
          life: 0.5, layer: 1,
          draw(ctx, cam, k) {
            const [sx, sy] = DF.sp(h.x, h.y, 0, cam);
            for (let n = 0; n < 4; n++) DF.bolt(ctx, sx + U.rand(-60, 60) * (1 - k), sy - 300, sx + U.rand(-8, 8), sy, '#3548c9', '#ffffff', 22, 14, 4 - n);
            ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#e0f0ff'; PX.ellipse(ctx, sx, sy, R * ISO_RX, R * ISO_RY); ctx.globalAlpha = 1;
          },
        });
      },
      drawGround(ctx, cam) {
        if (this.fired) return;
        const k = this.t / this.delay;
        const [sx, sy] = DF.sp(this.x, this.y, 0, cam);
        ctx.fillStyle = `rgba(10,10,30,${0.2 + 0.3 * k})`; PX.ellipse(ctx, sx, sy, R * ISO_RX, R * ISO_RY);
        ctx.fillStyle = '#8fc8ff'; PX.ellipseRing(ctx, sx, sy, R * ISO_RX, R * ISO_RY, 1);
        if (Math.random() < 0.3) FX.electric(this.x + U.rand(-R, R) * 0.6, this.y + U.rand(-R, R) * 0.6, U.rand(40, 120), 2);
      },
    });
  },
});

defUlt({
  id: 'tsunami', name: 'Great Tsunami', element: 'water', windup: 0.8, pose: 'raise', colors: ['#e8f6ff', '#3fa0ff', '#174f9c'],
  desc: 'Raise a colossal wave that sweeps across the battlefield, carrying enemies with it.',
  ai: { min: 1, max: 12, kind: 'line' },
  use(f, L, aim) {
    spawnWave(f, aim.ang, 9, 14, 1.7, { dmg: 170 * UD(L), knock: 14, stun: 0.9, ability: 'tsunami', launch: 120, unblockable: true });
    SFX.playAt('water', f.x, f.y, 1);
    SFX.playAt('splash', f.x, f.y, 1);
    W.shakeAt(f.x, f.y, 8);
  },
});

defUlt({
  id: 'shuriken', name: 'Tempest Shuriken', element: 'wind', windup: 0.9, pose: 'raise', colors: ['#ffffff', '#9af0c8', '#2f8a6a'],
  desc: 'Hurl a giant shuriken of wind that bursts into a shredding sphere on impact.',
  ai: { min: 2, max: 11, kind: 'proj' },
  use(f, L, aim) {
    const burst = (x, y) => {
      const R = 3.2;
      SFX.playAt('wind', x, y, 1);
      SFX.playAt('explosion', x, y, 0.8);
      W.shakeAt(x, y, 10);
      Combat.hazard({
        x, y, acc: 0, layer: 1,
        update(dt) {
          this.acc += dt;
          if (this.acc >= 0.1) {
            this.acc = 0;
            for (const e of Combat.enemiesInRadius(f, x, y, R)) {
              const [nx, ny] = U.norm(x - e.x, y - e.y);
              Combat.hit(e, { src: f, dmg: 22 * UD(L), element: 'wind', kind: 'aoe', knock: 1, stun: 0.3, dirX: nx, dirY: ny, ability: 'shuriken', hitstop: 0.01, sfx: false, unblockable: true });
            }
            W.arena.damageRadius(x, y, R, 60, 'wind', f);
          }
          for (let k = 0; k < 5; k++) { const a = U.rand(0, TAU), d = U.rand(0, R); FX.add({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, z: U.rand(0, 40), vx: -Math.sin(a) * 8, vy: Math.cos(a) * 8, life: 0.2, color: FX.ELEM_COLORS.wind, kind: 'spark', len: 6, add: true }); }
          if (this.t >= 1.3) { this.dead = true; W.arena.addStain(x, y, R * 0.6, 'crater'); }
        },
        draw(ctx, cam) {
          const [sx, sy] = DF.sp(x, y, 16, cam);
          const k = Math.min(1, this.t / 0.15);
          const rx = R * ISO_RX * k, ry = R * ISO_RY * 1.6 * k;
          ctx.globalAlpha = 0.35; ctx.fillStyle = '#d8fff0'; PX.ellipse(ctx, sx, sy, rx, ry);
          ctx.globalAlpha = 0.8; ctx.fillStyle = '#ffffff'; PX.ellipseRing(ctx, sx, sy, rx, ry, 2);
          ctx.fillStyle = '#9af0c8';
          for (let n = 0; n < 10; n++) { const a = this.t * 12 + n * 0.63; PX.line(ctx, sx, sy, sx + Math.cos(a) * rx, sy + Math.sin(a) * ry, 1); }
          ctx.globalAlpha = 1;
        },
      });
    };
    shoot(f, aim.ang, 9.5, {
      kind: 'shuriken', element: 'wind', size: 12, radius: 0.8, life: 1.3, dmg: 40 * UD(L), knock: 0, stun: 0.5, ability: 'shuriken', clash: 99, reflectable: false,
      blockDmg: 200, unblockable: true, trail: TRAIL.wind, explodeOnExpire: true,
      onImpact(p) { burst(p.x, p.y); },
    });
    SFX.playAt('wind', f.x, f.y, 1);
  },
});

defUlt({
  id: 'thousand', name: 'Thousand Clones', element: 'shinobi', windup: 0.6, pose: 'seal', colors: ['#ffffff', '#e8e8f0', '#9a9aa8'],
  desc: 'Flood the battlefield with an army of shadow clones that swarm your enemies.',
  ai: { min: 0, max: 9, kind: 'self', r: 8 },
  use(f, L) {
    const n = 7 + Math.min(3, L - 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      W.spawnClone(f, f.x + Math.cos(a) * 1.4, f.y + Math.sin(a) * 1.4, 11, { hp: 3, aggressive: true });
    }
    f.addBuff({ id: 'thousand', t: 6, mods: { speed: 1.2, dmg: 1.15 } });
    FX.poof(f.x, f.y, 40);
    SFX.playAt('poof', f.x, f.y, 1);
  },
});

defUlt({
  id: 'inferno', name: 'Inferno Dragon', element: 'fire', windup: 0.85, pose: 'release', colors: ['#fffbe0', '#ff8a1f', '#a3200d'],
  desc: 'Unleash a titanic dragon of flame that coils through the battlefield, incinerating everything.',
  ai: { min: 1, max: 12, kind: 'line' },
  use(f, L, aim) {
    const base = aim.ang;
    shoot(f, base, 10, {
      kind: 'dragon', cols: ['#fffbe0', '#ffd35c', '#ff6a1f', '#a3200d'], element: 'fire', size: 11, radius: 1.3, life: 1.5, z: 16,
      dmg: 130 * UD(L), knock: 9, launch: 180, stun: 0.8, pierce: 99, status: { burn: { t: 5, dps: 20 } }, ability: 'inferno', clash: 99,
      reflectable: false, unblockable: true, blockDmg: 400, pierceBlocks: true, histLen: 16,
      explode: { r: 3, dmg: 140 * UD(L), knock: 9, launch: 220, blockDmg: 300 },
      onUpdate(p, dt) {
        const a = base + Math.sin(p.t * 7) * 0.45;
        const sp = p.speed; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        if (Math.random() < dt * 18) W.arena.igniteRadius(p.x, p.y, 1.2, 0.5);
        if (Math.random() < dt * 10) W.arena.addStain(p.x, p.y, 0.9, 'scorch');
      },
      trail(p, dt) { TRAIL.hist(p); for (let k = 0; k < 3; k++) FX.flame(p.x + U.rand(-0.6, 0.6), p.y + U.rand(-0.6, 0.6), p.z + U.rand(-8, 8), 2); },
    });
    SFX.playAt('fireBig', f.x, f.y, 1);
    W.shakeAt(f.x, f.y, 6);
  },
});

defUlt({
  id: 'moon', name: 'Crimson Moon', element: 'shinobi', windup: 0.7, pose: 'seal', colors: ['#ffd0d0', '#d02020', '#1a0000'],
  desc: 'Trap every nearby enemy in a nightmare genjutsu: they freeze, then suffer crushing damage.',
  ai: { min: 0, max: 7, kind: 'self', r: 7.5 },
  use(f, L) {
    const R = 7.5;
    const victims = Combat.enemiesInRadius(f, f.x, f.y, R).filter((e) => e.st.stealth <= 0 || U.dist(f.x, f.y, e.x, e.y) < 2);
    const dur = 2.6;
    for (const e of victims) {
      e.applyStatus({ genjutsu: dur }, f);
      e.cancelAction();
      FX.text(e.x, e.y, 44, 'GENJUTSU', '#ff6060', { life: 1 });
    }
    SFX.playAt('awaken', f.x, f.y, 0.8);
    W.moonFx = { t: 0, dur, caster: f, victims };
    Combat.hazard({
      update() {
        if (this.t >= dur) {
          for (const e of victims) if (e.alive) Combat.hit(e, { src: f, dmg: 165 * UD(L), element: 'shinobi', kind: 'aoe', knock: 3, stun: 0.6, launch: 120, unblockable: true, noParry: true, ability: 'moon' });
          W.moonFx = null;
          this.dead = true;
        }
      },
    });
  },
});
