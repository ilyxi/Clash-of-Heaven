'use strict';
// ---------------------------------------------------------------------------
// Combat core: damage resolution (block / parry / dodge / crits / elements /
// combo scaling), projectiles, delayed AoEs, persistent zones and beams.
// ---------------------------------------------------------------------------

let W = null; // the active World (match)

const Combat = {
  enemies(a, b) {
    if (!a || !b || a === b) return false;
    return a.team !== b.team;
  },

  fightersInRadius(x, y, r, pred) {
    const out = [];
    if (!W) return out;
    for (const f of W.fighters) {
      if (f.dead || f.removed) continue;
      if (U.dist(x, y, f.x, f.y) <= r + f.radius && (!pred || pred(f))) out.push(f);
    }
    return out;
  },

  enemiesInRadius(src, x, y, r) {
    return Combat.fightersInRadius(x, y, r, (f) => Combat.enemies(src, f));
  },

  // Core damage function. Returns 'hit' | 'block' | 'parry' | 'dodge' | 'immune' | 'none'.
  hit(t, h) {
    if (!t || t.dead || t.removed) return 'none';
    const src = h.src || null;
    if (src && !Combat.enemies(src, t)) return 'none';
    if (t.spawnProt > 0 || t.invuln > 0) return 'immune';
    if (t.iframes > 0 && h.kind !== 'dot') {
      if (t.dodgeWindow > 0 && h.kind !== 'env') t.perfectDodge(src);
      return 'dodge';
    }
    // Downed fighters can't be comboed by melee; everything else is softened.
    let downMult = 1;
    if (t.state === 'down' || t.state === 'getup') {
      if (h.kind === 'melee') return 'immune';
      h = Object.assign({}, h, { knock: (h.knock || 0) * 0.3, launch: 0, stun: 0, spike: false });
      downMult = 0.5;
    }
    const now = W.time;
    const sx = h.sx !== undefined ? h.sx : src ? src.x : t.x;
    const sy = h.sy !== undefined ? h.sy : src ? src.y : t.y;

    // ---- blocking & parrying --------------------------------------------------
    if (t.state === 'block' && !h.unblockable && h.kind !== 'dot' && h.kind !== 'env') {
      const angTo = Math.atan2(sy - t.y, sx - t.x);
      const front = Math.abs(U.angDiff(t.facing, angTo)) < 1.95 || (sx === t.x && sy === t.y);
      if (front) {
        if (now - t.blockStart <= t.parryWindow() && !h.noParry) {
          t.onParry(src, h);
          return 'parry';
        }
        const heavyBreak = h.guardBreak;
        const chip = h.kind === 'melee' ? 0 : 0.22;
        const gd = h.guardDmg !== undefined ? h.guardDmg : h.dmg * (h.kind === 'melee' ? 1.0 : 0.7);
        t.guard -= gd;
        t.guardRegenDelay = 1.0;
        if (chip > 0) Combat.applyDamage(t, Math.max(1, Math.round(h.dmg * chip * (src ? src.dmgMult(h.element) : 1))), src, h, true);
        const [kx, ky] = U.norm(t.x - sx, t.y - sy);
        t.vx += kx * Math.min(3, (h.knock || 1) * 0.4 + 1); t.vy += ky * Math.min(3, (h.knock || 1) * 0.4 + 1);
        FX.spark(t.x + Math.cos(angTo) * 0.3, t.y + Math.sin(angTo) * 0.3, 14, ['#ffffff', '#cfe8ff', '#8fc8ff'], 6, 4);
        SFX.playAt('block', t.x, t.y, 0.8);
        if (src && h.kind === 'melee') src.freeze = Math.max(src.freeze, 0.05);
        t.freeze = Math.max(t.freeze, 0.04);
        if (t.guard <= 0 || heavyBreak) t.guardBreak();
        return 'block';
      }
    }

    // ---- damage ---------------------------------------------------------------
    let dmg = h.dmg || 0;
    if (src) dmg *= src.dmgMult(h.element, h);
    dmg *= elementMult(h.element, t.affinity);
    if (t.st.wet > 0) {
      if (h.element === 'lightning') dmg *= 1.35;
      if (h.element === 'fire') dmg *= 0.72;
    }
    if (t.st.burn > 0 && h.element === 'wind') dmg *= 1.2;
    dmg *= t.defMult() * downMult;
    const inCombo = t.comboHits > 0 && now - t.lastHitTime < 0.9;
    if (inCombo && h.kind !== 'dot') dmg *= Math.max(0.35, 1 - 0.06 * Math.max(0, t.comboHits - 3));
    let crit = false;
    if (src && h.kind !== 'dot' && Math.random() < src.critChance(h)) { crit = true; dmg *= 1.5; }
    if (src && src.counterBonus > 0 && h.kind !== 'dot') { dmg *= 1.3; src.counterBonus = 0; }
    dmg = Math.max(1, Math.round(dmg));

    Combat.applyDamage(t, dmg, src, h, false, crit);
    if (t.dead) return 'hit';

    // ---- status effects -------------------------------------------------------
    if (h.status) t.applyStatus(h.status, src, h);

    // ---- reaction: hitstun, knockback, launch ---------------------------------
    if (h.kind !== 'dot') {
      if (inCombo) t.comboHits++; else t.comboHits = 1;
      t.lastHitTime = now;
      if (src) {
        src.lastComboTarget = t; src.comboShow = t.comboHits; src.comboShowT = 1.4;
        const owner = src.owner || src;
        owner.bestCombo = Math.max(owner.bestCombo || 0, t.comboHits);
      }
      const armored = t.hasArmor() && !h.armorBreak;
      let [kx, ky] = h.dirX !== undefined ? [h.dirX, h.dirY] : U.norm(t.x - sx, t.y - sy);
      if (kx === 0 && ky === 0) { kx = Math.cos(t.facing + Math.PI); ky = Math.sin(t.facing + Math.PI); }
      const knock = (h.knock || 0) * (armored ? 0.15 : 1) * t.knockTaken();
      t.vx += kx * knock; t.vy += ky * knock;
      if (!armored) {
        let stun = h.stun !== undefined ? h.stun : 0.3;
        if (t.comboHits > 12) stun *= 0.5;
        if (h.launch && (t.z > 0 || h.launch > 0)) {
          const decay = Math.max(0.2, 1 - 0.14 * t.juggle);
          if (t.z > 1) { t.vz = Math.max(t.vz, h.launch * 0.6 * decay); t.juggle++; }
          else { t.vz = h.launch * decay; t.juggle = t.juggle || 0; }
          t.airborne = true;
        } else if (h.spike && t.z > 2) {
          t.vz = -420;
        } else if (t.z > 2) {
          t.vz = Math.max(t.vz, 60 * Math.max(0.2, 1 - 0.14 * t.juggle)); t.juggle++;
        }
        if (stun > 0) t.enterHitstun(stun, h);
      } else {
        FX.spark(t.x, t.y, 16, ['#ffffff', '#ffe08a'], 4, 3);
      }
      const hs = h.hitstop !== undefined ? h.hitstop : Math.min(0.11, 0.03 + dmg / 1400);
      t.freeze = Math.max(t.freeze, hs);
      if (src && h.kind === 'melee') src.freeze = Math.max(src.freeze, hs * 0.85);
      t.flash = 0.1;
      FX.hit(t.x, t.y, t.z + 14, h.element || 'phys', Math.min(3, dmg / 30));
      if (h.sfx !== false) SFX.playAt(h.sfx || (dmg > 45 ? 'hitHeavy' : 'hit'), t.x, t.y, Math.min(1, 0.5 + dmg / 100));
      if (W.camTarget && (t === W.camTarget || src === W.camTarget)) W.shake(Math.min(7, 1 + dmg / 22));
    }
    return 'hit';
  },

  applyDamage(t, dmg, src, h, chip, crit) {
    if (t.dead) return;
    // Eight-gates style awakening can't kill yourself; clones pop instantly.
    t.hp -= dmg;
    t.dmgTaken += dmg;
    if (src && src !== t) {
      const owner = src.owner || src;
      t.lastAttackers.set(owner, W.time);
      owner.dmgDealt += dmg;
      owner.gainMeters(dmg, 'deal');
      if (!t.isClone) {
        owner.gainXP(dmg * 0.5);
        if (h && h.ability) owner.masteryXP(h.ability, dmg);
      }
      if (h && h.lifesteal) owner.heal(dmg * h.lifesteal);
      const ls = owner.mod ? owner.mod.lifesteal : 0;
      if (ls && h && h.kind === 'melee') owner.heal(dmg * ls);
    }
    t.gainMeters(dmg, 'take');
    if (!chip || dmg >= 3) {
      const col = crit ? '#ffe14a' : chip ? '#b8c0d0' : h && h.element && ELEMENTS[h.element] ? ELEMENTS[h.element].light : '#ffffff';
      if (W.showNumbers) FX.text(t.x, t.y, t.z + 30, String(dmg) + (crit ? '!' : ''), col, { scale: crit || dmg >= 90 ? 2 : 1 });
    }
    if (t.hp <= 0) {
      if (t.cantDie) { t.hp = 1; return; }
      t.hp = 0;
      t.die(src, h);
    }
  },

  // Immediate circular blast with falloff.
  explosion(src, x, y, r, dmg, element, extra = {}) {
    const targets = Combat.fightersInRadius(x, y, r, (f) => !src || Combat.enemies(src, f));
    for (const f of targets) {
      const d = U.dist(x, y, f.x, f.y);
      const k = 1 - 0.4 * U.clamp(d / (r + 0.3), 0, 1);
      const [nx, ny] = d > 0.05 ? [(f.x - x) / d, (f.y - y) / d] : [Math.cos(f.facing + Math.PI), Math.sin(f.facing + Math.PI)];
      Combat.hit(f, Object.assign({ src, dmg: dmg * k, element, kind: 'aoe', knock: 6, stun: 0.5, sx: x, sy: y, dirX: nx, dirY: ny }, extra));
    }
    if (W && W.arena && extra.blockDmg !== 0) W.arena.damageRadius(x, y, r * 0.9, extra.blockDmg || dmg * 1.2, element, src);
    if (extra.fx !== false) {
      const col = FX.ELEM_COLORS[element] || FX.ELEM_COLORS.phys;
      FX.glow(x, y, 8, r * 10, col[0], 0.18);
      FX.ring(x, y, r * 0.4, col[1], 0.3, r * 3, 1);
      for (let i = 0; i < 14 + r * 6; i++) {
        const a = U.rand(0, TAU), sp = U.rand(1, 3 + r * 2);
        FX.add({ x, y, z: U.rand(2, 10), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: U.rand(20, 140), g: 160, drag: 3, life: U.rand(0.3, 0.7), color: col, size: U.rand(2, 4), grow: -3, kind: 'glow', add: true });
      }
      FX.smoke(x, y, Math.round(4 + r * 2), element === 'fire');
      if (extra.crater !== false && r >= 1.5 && W) W.arena.addStain(x, y, r * 0.55, element === 'fire' ? 'scorch' : 'crater');
      else if (element === 'fire' && W) W.arena.addStain(x, y, r * 0.5, 'scorch');
      SFX.playAt(extra.sfx || (element === 'fire' ? 'fireBig' : 'explosion'), x, y, Math.min(1, 0.4 + r * 0.2));
      if (W) W.shakeAt(x, y, Math.min(9, 2 + r * 1.6));
    }
    if (element === 'fire' && W && extra.ignite !== false) W.arena.igniteRadius(x, y, r * 0.8, 0.45);
    if (element === 'water' && W) W.arena.wetRadius(x, y, r, 7);
    return targets;
  },

  // Cone attack in front of an origin; returns list of hit fighters.
  cone(src, x, y, ang, range, halfArc, h, filter) {
    const out = [];
    for (const f of W.fighters) {
      if (f.dead || f.removed || !Combat.enemies(src, f)) continue;
      if (filter && !filter(f)) continue;
      const d = U.dist(x, y, f.x, f.y);
      if (d > range + f.radius) continue;
      const a = Math.atan2(f.y - y, f.x - x);
      if (d > 0.4 && Math.abs(U.angDiff(ang, a)) > halfArc) continue;
      Combat.hit(f, Object.assign({ src, sx: x, sy: y }, h));
      out.push(f);
    }
    return out;
  },

  // Blocks in a cone (for melee hitting trees, walls...).
  coneBlocks(x, y, ang, range, halfArc, dmg, element, src) {
    const A = W.arena;
    for (let j = Math.floor(y - range - 1); j <= Math.floor(y + range + 1); j++)
      for (let i = Math.floor(x - range - 1); i <= Math.floor(x + range + 1); i++) {
        const b = A.block(i, j);
        if (!b) continue;
        const cx = i + 0.5, cy = j + 0.5;
        const d = U.dist(x, y, cx, cy);
        if (d > range + 0.5) continue;
        if (Math.abs(U.angDiff(ang, Math.atan2(cy - y, cx - x))) > halfArc + 0.3) continue;
        A.damageBlock(i, j, dmg, element, src);
      }
  },

  // Thick line segment hit (beams, dashes).
  line(src, x0, y0, x1, y1, width, h, hitSet) {
    const out = [];
    for (const f of W.fighters) {
      if (f.dead || f.removed || !Combat.enemies(src, f)) continue;
      if (hitSet && hitSet.has(f)) continue;
      const r = U.pointSegDist(f.x, f.y, x0, y0, x1, y1);
      if (r.d <= width + f.radius) {
        if (hitSet) hitSet.add(f);
        Combat.hit(f, Object.assign({ src, sx: x0 + (x1 - x0) * r.t * 0.9, sy: y0 + (y1 - y0) * r.t * 0.9 }, h));
        out.push(f);
      }
    }
    return out;
  },

  lineBlocks(x0, y0, x1, y1, width, dmg, element, src) {
    const d = U.dist(x0, y0, x1, y1);
    const seen = new Set();
    for (let s = 0; s <= d; s += 0.4) {
      const x = x0 + (x1 - x0) * (s / (d || 1)), y = y0 + (y1 - y0) * (s / (d || 1));
      for (let j = Math.floor(y - width); j <= Math.floor(y + width); j++)
        for (let i = Math.floor(x - width); i <= Math.floor(x + width); i++) {
          const k = i + ',' + j;
          if (seen.has(k)) continue;
          seen.add(k);
          if (W.arena.block(i, j)) W.arena.damageBlock(i, j, dmg, element, src);
        }
    }
  },

  projectile(o) {
    const p = new Projectile(o);
    W.projectiles.push(p);
    return p;
  },

  hazard(o) {
    o.t = 0;
    o.dead = false;
    W.hazards.push(o);
    return o;
  },

  // Delayed area strike with a ground telegraph.
  aoe(o) {
    return Combat.hazard(Object.assign({
      type: 'aoe',
      drawGround(ctx, cam) {
        if (this.fired || !this.delay || this.noTelegraph) return;
        const k = this.t / this.delay;
        const sx = (this.x - this.y) * HALF_W - cam.x, sy = (this.x + this.y) * HALF_H - cam.y;
        const col = (ELEMENTS[this.element] || ELEMENTS.shinobi).color;
        ctx.globalAlpha = 0.3 + 0.4 * k;
        ctx.fillStyle = col;
        PX.ellipseRing(ctx, sx, sy, this.r * ISO_RX, this.r * ISO_RY, 1);
        ctx.globalAlpha = 0.15 + 0.2 * k;
        PX.ellipse(ctx, sx, sy, this.r * ISO_RX * k, this.r * ISO_RY * k);
        ctx.globalAlpha = 1;
      },
    }, o, {
      update(dt) {
        if (this.t >= (this.delay || 0) && !this.fired) {
          this.fired = true;
          if (this.onFire) this.onFire(this);
          if (this.dmg) {
            const targets = Combat.explosion(this.src, this.x, this.y, this.r, this.dmg, this.element, Object.assign({ fx: this.fx === undefined ? true : this.fx }, this.hit || {}));
            if (this.onHitFighter) targets.forEach((f) => this.onHitFighter(f, this));
          }
          this.dead = true;
        }
      },
    }));
  },

  // Lingering area that ticks.
  zone(o) {
    return Combat.hazard({
      type: 'zone', tickEvery: 0.25, acc: 0, ...o,
      update(dt) {
        if (this.follow) { if (this.follow.dead) { this.dead = true; return; } this.x = this.follow.x; this.y = this.follow.y; }
        this.acc += dt;
        if (this.onUpdate) this.onUpdate(dt, this);
        while (this.acc >= this.tickEvery) {
          this.acc -= this.tickEvery;
          const fs = Combat.fightersInRadius(this.x, this.y, this.r, (f) => (this.allies ? !Combat.enemies(this.src, f) : Combat.enemies(this.src, f)));
          for (const f of fs) this.onTick(f, this);
        }
        if (this.t >= this.dur) { this.dead = true; if (this.onEnd) this.onEnd(this); }
      },
    });
  },

  // Beam from an origin in a direction (optionally attached to a fighter).
  beam(o) {
    return Combat.hazard({
      type: 'beam', tickEvery: 0.1, acc: 0, hitAcc: new Map(), ...o,
      update(dt) {
        if (this.follow) {
          const f = this.follow;
          if (f.dead || (this.channel && f.state !== 'channel')) { this.dead = true; return; }
          this.x = f.x + Math.cos(f.facing) * 0.4; this.y = f.y + Math.sin(f.facing) * 0.4; this.ang = f.facing;
        }
        // stop at solid walls unless piercing terrain
        let len = this.len;
        if (!this.pierceTerrain) {
          for (let s = 0.5; s <= this.len; s += 0.25) {
            const bx = this.x + Math.cos(this.ang) * s, by = this.y + Math.sin(this.ang) * s;
            const pb = W.arena.pointBlocked(bx, by, 10);
            if (pb) { len = s; if (pb.b) W.arena.damageBlock(pb.b.i, pb.b.j, (this.blockDmg || 30) * dt, this.element, this.src, true); break; }
          }
        }
        this.curLen = len;
        this.acc += dt;
        if (this.acc >= this.tickEvery) {
          this.acc -= this.tickEvery;
          const x1 = this.x + Math.cos(this.ang) * len, y1 = this.y + Math.sin(this.ang) * len;
          Combat.line(this.src, this.x, this.y, x1, y1, this.width, Object.assign({ kind: 'beam', dmg: this.dmg, element: this.element, knock: this.knock || 1, stun: this.stun || 0.25, ability: this.ability, dirX: Math.cos(this.ang), dirY: Math.sin(this.ang), hitstop: 0.02, sfx: false }, this.hit || {}));
          if (this.pierceTerrain) Combat.lineBlocks(this.x, this.y, x1, y1, this.width, this.blockDmg || 40, this.element, this.src);
          if (this.onTick) this.onTick(this, x1, y1);
        }
        if (this.t >= this.dur) this.dead = true;
      },
    });
  },
};

// ---------------------------------------------------------------------------
class Projectile {
  constructor(o) {
    Object.assign(this, {
      x: 0, y: 0, z: 12, vx: 0, vy: 0, vz: 0, gravity: 0, radius: 0.3, life: 1.5,
      dmg: 10, element: null, knock: 2, launch: 0, stun: 0.3, status: null,
      pierce: 0, homing: 0, target: null, explode: null, blockDmg: 20,
      clash: 1, reflectable: true, kind: 'orb', size: 4, t: 0, dead: false, spin: 0,
      hitTerrain: true, groundHit: false,
    }, o);
    this.hitSet = new Set();
    this.team = this.src ? this.src.team : -1;
    this.ang = Math.atan2(this.vy, this.vx);
    this.id = U.uid();
  }

  get speed() { return Math.hypot(this.vx, this.vy); }

  update(dt) {
    this.t += dt;
    if (this.onUpdate) this.onUpdate(this, dt);
    if (this.dead) return;
    // homing
    if (this.homing) {
      if (!this.target || this.target.dead || this.target.st.stealth > 0) this.target = this.findTarget();
      if (this.target) {
        const want = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        const sp = this.speed;
        this.ang = U.turnToward(this.ang, want, this.homing * dt);
        this.vx = Math.cos(this.ang) * sp; this.vy = Math.sin(this.ang) * sp;
      }
    }
    // Crimson Eye: enemy projectiles crawl near the awakened fighter.
    let ts = 1;
    for (const f of W.slowFields) {
      if (Combat.enemies(this.src, f) && U.dist2(this.x, this.y, f.x, f.y) < 7.8) ts = Math.min(ts, 1 - f.mod.projSlow);
    }
    this.x += this.vx * dt * ts; this.y += this.vy * dt * ts;
    if (this.gravity) { this.vz -= this.gravity * dt * ts * ts; this.z += this.vz * dt * ts; }
    this.ang = Math.atan2(this.vy, this.vx);
    if (this.trail) this.trail(this, dt);

    // fighters
    for (const f of W.fighters) {
      if (f.dead || f.removed || this.hitSet.has(f) || !Combat.enemies(this.src, f)) continue;
      if (U.dist(this.x, this.y, f.x, f.y) > this.radius + f.radius) continue;
      if (Math.abs(this.z - (f.z + 12)) > 20 + this.size) continue;
      this.hitSet.add(f);
      const res = Combat.hit(f, {
        src: this.src, dmg: this.dmg, element: this.element, kind: 'proj', knock: this.knock, launch: this.launch,
        stun: this.stun, status: this.status, ability: this.ability, sx: this.x - this.vx * 0.05, sy: this.y - this.vy * 0.05,
        dirX: Math.cos(this.ang), dirY: Math.sin(this.ang), guardDmg: this.guardDmg, unblockable: this.unblockable, sfx: this.sfx,
      });
      if (res === 'parry' && this.reflectable) { this.reflect(f); return; }
      if (res === 'dodge') continue;
      if (res === 'hit' && this.onHit) this.onHit(this, f);
      if (res === 'block' && this.onBlock) this.onBlock(this, f);
      if (this.pierce > 0 && res !== 'block') { this.pierce--; continue; }
      this.impact();
      return;
    }
    // terrain
    if (this.hitTerrain) {
      const A = W.arena;
      const pb = A.pointBlocked(this.x, this.y, this.z);
      if (pb) {
        if (pb.b) A.damageBlock(pb.b.i, pb.b.j, this.blockDmg, this.element, this.src);
        if (this.pierceBlocks && pb.b && !A.block(pb.b.i, pb.b.j)) { /* smashed through */ }
        else { this.impact(); return; }
      }
    }
    if (this.gravity && this.z <= 0) { this.z = 0; this.impact(); return; }
    if (this.t >= this.life) { if (this.explodeOnExpire !== false) this.impact(true); else this.dead = true; }
  }

  findTarget() {
    let best = null, bd = 9;
    for (const f of W.fighters) {
      if (f.dead || f.removed || !Combat.enemies(this.src, f) || f.st.stealth > 0) continue;
      const d = U.dist(this.x, this.y, f.x, f.y);
      const a = Math.atan2(f.y - this.y, f.x - this.x);
      if (d < bd && Math.abs(U.angDiff(this.ang, a)) < 1.3) { bd = d; best = f; }
    }
    return best;
  }

  reflect(by) {
    this.src = by; this.team = by.team;
    const sp = this.speed * 1.2;
    const owner = this.hitSet;
    this.hitSet = new Set([by]);
    let ang = by.facing;
    this.vx = Math.cos(ang) * sp; this.vy = Math.sin(ang) * sp;
    this.t = Math.max(0, this.t - 0.6);
    this.target = null;
    FX.spark(this.x, this.y, this.z, ['#ffffff', '#ffe08a'], 10, 5);
    SFX.playAt('parry', this.x, this.y);
    void owner;
  }

  impact(expired) {
    if (this.dead) return;
    this.dead = true;
    if (this.onImpact) this.onImpact(this, expired);
    const e = this.explode;
    if (e) {
      Combat.explosion(this.src, this.x, this.y, e.r, e.dmg !== undefined ? e.dmg : this.dmg * 0.6, this.element, Object.assign({ ability: this.ability, knock: e.knock || 5, launch: e.launch || 0, stun: e.stun || 0.45, status: e.status || this.status, blockDmg: e.blockDmg, crater: e.crater, ignite: e.ignite }, e.extra || {}));
    } else if (!expired) {
      FX.hit(this.x, this.y, this.z, this.element || 'phys', 0.6);
    }
  }
}
