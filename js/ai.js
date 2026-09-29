'use strict';
// ---------------------------------------------------------------------------
// AI controllers. They produce the exact same input struct the player does,
// so bots obey every rule (cooldowns, chakra, recovery frames...).
// ---------------------------------------------------------------------------

const AI_DIFF = {
  easy:   { name: 'Genin',   react: 0.45, aimErr: 0.35, block: 0.12, parry: 0.02, sub: 0.15, dodge: 0.12, jutsu: 0.55, combo: 0.3, aggro: 0.55, think: 0.34, lead: 0.3, ult: 0.5 },
  normal: { name: 'Chunin',  react: 0.28, aimErr: 0.18, block: 0.3, parry: 0.08, sub: 0.35, dodge: 0.3, jutsu: 0.8, combo: 0.6, aggro: 0.7, think: 0.22, lead: 0.7, ult: 0.8 },
  hard:   { name: 'Jonin',   react: 0.18, aimErr: 0.08, block: 0.5, parry: 0.2, sub: 0.6, dodge: 0.5, jutsu: 1.0, combo: 0.85, aggro: 0.85, think: 0.15, lead: 0.9, ult: 1 },
  master: { name: 'Kage',    react: 0.1, aimErr: 0.03, block: 0.65, parry: 0.4, sub: 0.8, dodge: 0.7, jutsu: 1.2, combo: 1.0, aggro: 0.95, think: 0.1, lead: 1.0, ult: 1 },
};

class AIController {
  constructor(f, diff = 'normal') {
    this.f = f;
    this.d = AI_DIFF[diff] || AI_DIFF.normal;
    this.target = null;
    this.retargetT = 0;
    this.thinkT = U.rand(0, 0.3);
    this.time = 0;
    this.queue = [];
    this.blockT = 0; this.heavyT = 0; this.chargeT = 0; this.fleeT = 0;
    this.path = null; this.pathIdx = 0; this.pathT = 0;
    this.strafe = U.chance(0.5) ? 1 : -1; this.strafeT = 0;
    this.stuckT = 0; this.lastPos = { x: f.x, y: f.y }; this.unstickT = 0; this.unstickDir = [0, 0];
    this.seen = new Set();
    this.subDecided = false;
    this.wanderPt = null;
    this.out = { mx: 0, my: 0, ax: null, ay: null, light: false, heavy: false, heavyPressed: false, dash: false, block: false, kunai: false, charge: false, j: [false, false, false, false], awaken: false, ult: false };
    // preferred fighting range from the loadout
    let ranged = 0;
    for (const s of f.jutsu) if (s && ['proj', 'aoe'].includes(s.def.ai.kind)) ranged++;
    this.prefRange = ranged >= 3 ? 4.2 : ranged === 2 ? 2.6 : 1.1;
  }

  valid(t) {
    const f = this.f;
    return t && t.alive && Combat.enemies(f, t) && (t.st.stealth <= 0 || U.dist(f.x, f.y, t.x, t.y) < 1.4);
  }

  pickTarget() {
    const f = this.f;
    let best = null, bs = Infinity;
    for (const e of W.fighters) {
      if (!this.valid(e)) continue;
      const d = U.dist(f.x, f.y, e.x, e.y);
      let s = d;
      s += (e.hp / e.maxHp) * 3;
      const hitMe = f.lastAttackers.get(e.owner || e);
      if (hitMe && W.time - hitMe < 3) s -= 5;
      if (e.isClone) s += 3;
      if (e === this.target) s -= 2; // stickiness
      s += U.rand(0, 2.5);
      if (s < bs) { bs = s; best = e; }
    }
    this.target = best;
    this.retargetT = U.rand(1.2, 2.4);
  }

  aimAt(o, t, speed = 11) {
    const f = this.f, d = this.d;
    const dist = U.dist(f.x, f.y, t.x, t.y);
    const lead = (dist / speed) * d.lead;
    const tvx = t.vx + t.mvx, tvy = t.vy + t.mvy;
    const err = d.aimErr * Math.min(dist, 8);
    o.ax = t.x + tvx * lead + U.rand(-err, err);
    o.ay = t.y + tvy * lead + U.rand(-err, err);
  }

  schedule(a, delay, hold) {
    const q = { a, at: this.time + Math.max(0, delay), hold };
    this.queue.push(q);
    return q;
  }

  input(f, dt) {
    const o = this.out, d = this.d;
    this.time += dt;
    o.light = o.heavyPressed = o.dash = o.kunai = o.awaken = o.ult = false;
    o.j[0] = o.j[1] = o.j[2] = o.j[3] = false;
    o.block = o.heavy = o.charge = false;
    o.mx = 0; o.my = 0;

    // queued actions (reaction delay)
    for (let n = this.queue.length - 1; n >= 0; n--) {
      const q = this.queue[n];
      if (q.at > this.time) continue;
      this.queue.splice(n, 1);
      if (q.a === 'block') this.blockT = Math.max(this.blockT, q.hold || 0.35);
      else if (q.a === 'dash') { o.dash = true; if (q.dir) { o.mx = q.dir[0]; o.my = q.dir[1]; this.dashDir = q.dir; this.dashDirT = 0.05; } }
      else if (q.a === 'light') o.light = true;
    }
    if (this.blockT > 0) { this.blockT -= dt; o.block = true; }
    if (this.heavyT > 0) { this.heavyT -= dt; o.heavy = true; }
    if (this.chargeT > 0) { this.chargeT -= dt; o.charge = true; }
    this.fleeT = Math.max(0, this.fleeT - dt);

    this.retargetT -= dt;
    if (!this.valid(this.target) || this.retargetT <= 0) this.pickTarget();
    const t = this.target;
    if (t) this.aimAt(o, t, 30);
    else { o.ax = f.x + Math.cos(f.facing) * 2; o.ay = f.y + Math.sin(f.facing) * 2; }

    this.defend(f, dt, o);
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.thinkT = d.think * U.rand(0.7, 1.3);
      this.decide(f, o);
    }
    this.steer(f, dt, o);
    if (this.dashDirT > 0) { this.dashDirT -= dt; o.mx = this.dashDir[0]; o.my = this.dashDir[1]; }
    return o;
  }

  // ---- defence: blocks, parries, dodges, substitution --------------------------
  defend(f, dt, o) {
    const d = this.d;
    if (f.isNeutral() || f.state === 'attack') this.subDecided = false;
    // substitution out of combos
    if ((f.state === 'hitstun' || f.state === 'air') && f.canSubstitute() && !this.subDecided && f.comboHits >= 2) {
      const threshold = 3 + Math.floor(Math.random() * 3);
      if (f.comboHits >= threshold || f.hp < f.maxHp * 0.3) {
        this.subDecided = true;
        if (Math.random() < d.sub) this.schedule('dash', d.react * 0.6);
      }
    }
    if (f.state === 'down' && f.stateT < 0.05 && Math.random() < d.sub) this.schedule('dash', 0.2);
    if (!(f.isNeutral() || f.state === 'block' || f.state === 'charge')) return;

    // melee threats
    for (const e of W.fighters) {
      if (!e.alive || !Combat.enemies(f, e)) continue;
      const dist = U.dist(f.x, f.y, e.x, e.y);
      if (dist > 2.4) continue;
      const facingMe = Math.abs(U.angDiff(e.facing, Math.atan2(f.y - e.y, f.x - e.x))) < 1.0;
      if (e.state === 'attack' && facingMe && e.stateT < 0.06) {
        const key = 'a' + e.id + ':' + e.comboStep + ':' + Math.floor(e.time * 5);
        if (this.seen.has(key)) continue;
        this.seen.add(key);
        const r = Math.random();
        if (r < d.parry) this.schedule('block', 0, 0.22);
        else if (r < d.parry + d.block * 0.7) this.schedule('block', d.react * 0.4, 0.45);
        else if (r < d.parry + d.block * 0.7 + d.dodge * 0.25) {
          const [nx, ny] = U.norm(f.x - e.x, f.y - e.y);
          this.schedule('dash', d.react * 0.5).dir = [-ny * this.strafe + nx * 0.5, nx * this.strafe + ny * 0.5];
        }
      }
      if (e.state === 'heavy' && !e.heavyReleased && facingMe && dist < 2) {
        const key = 'h' + e.id + ':' + Math.floor(e.time);
        if (this.seen.has(key)) continue;
        this.seen.add(key);
        if (Math.random() < d.combo * 0.6 && dist < 1.4) this.schedule('light', d.react);
        else if (Math.random() < d.dodge) { const [nx, ny] = U.norm(f.x - e.x, f.y - e.y); this.queue.push({ a: 'dash', at: this.time + d.react, dir: [nx, ny] }); }
      }
    }
    // projectile threats
    for (const p of W.projectiles) {
      if (p.dead || !Combat.enemies(p.src, f) || this.seen.has(p.id)) continue;
      const rx = f.x - p.x, ry = f.y - p.y;
      if (rx * rx + ry * ry > 49) continue;
      const sp2 = p.vx * p.vx + p.vy * p.vy;
      if (sp2 < 1) continue;
      const tca = (rx * p.vx + ry * p.vy) / sp2;
      if (tca < 0 || tca > 0.8) continue;
      const cx = p.x + p.vx * tca - f.x, cy = p.y + p.vy * tca - f.y;
      if (Math.hypot(cx, cy) > p.radius + f.radius + 0.35) continue;
      this.seen.add(p.id);
      this.projThreat = 0.6;
      const r = Math.random();
      const sp = Math.sqrt(sp2);
      const px = -p.vy / sp, py = p.vx / sp;
      const side = (cx * px + cy * py) > 0 ? -1 : 1;
      if (r < d.dodge && tca > d.react * 0.5) this.queue.push({ a: 'dash', at: this.time + d.react * 0.5, dir: [px * side, py * side] });
      else if (r < d.dodge + d.parry && p.reflectable) this.schedule('block', Math.max(0, tca - 0.1), 0.25);
      else if (r < d.dodge + d.parry + d.block * 0.6) this.schedule('block', d.react * 0.5, Math.max(0.3, tca + 0.1));
    }
    if (this.projThreat > 0) this.projThreat -= dt;
    if (this.seen.size > 400) this.seen.clear();
  }

  // ---- offence & planning ------------------------------------------------------------
  decide(f, o) {
    const d = this.d;
    const t = this.target;
    if (!t) return;
    const busy = !(f.isNeutral() || f.state === 'attack' || f.state === 'recover' || f.state === 'block' || f.state === 'charge');
    if (busy) return;
    const dist = U.dist(f.x, f.y, t.x, t.y);
    const los = W.arena.lineClear(f.x, f.y, t.x, t.y, 12);
    this.dist = dist; this.los = los;

    // stop charging if threatened
    if (f.state === 'charge' && dist < 4.5) this.chargeT = 0;

    if (f.awakening && !f.awakened && f.awak >= 100 && dist < 6 && Math.random() < 0.6) { o.awaken = true; return; }
    if (f.ultimate && f.ult >= 100 && Math.random() < d.ult && this.ultReady(f, t, dist, los)) {
      this.aimAt(o, t, 12);
      o.ult = true;
      return;
    }

    // retreat when badly hurt (less likely for aggressive bots)
    if (f.hp < f.maxHp * 0.22 && !f.awakened && this.fleeT <= 0 && Math.random() < (1 - d.aggro) * 0.8) this.fleeT = U.rand(1.5, 3);
    if (this.fleeT > 0 && f.chakra < 60 && dist > 7) { this.chargeT = 0.5; return; }

    if (f.chakra < 22 && dist > 6.5 && this.nearestEnemyDist(f) > 6) { this.chargeT = U.rand(0.6, 1.2); return; }

    // jutsu
    if (Math.random() < 0.5 * d.jutsu || (t.state === 'hitstun' || t.state === 'air') && Math.random() < d.combo) {
      const j = this.pickJutsu(f, t, dist, los);
      if (j >= 0) {
        const def = f.jutsu[j].def;
        this.aimAt(o, t, def.ai.kind === 'aoe' ? 30 : def.ai.kind === 'dash' ? 16 : 11);
        o.j[j] = true;
        if (def.ai.kind === 'escape') this.fleeT = 2;
        return;
      }
    }

    // melee
    if (dist < 1.55) {
      if (t.state === 'block' && Math.random() < 0.55 * d.combo) { o.heavyPressed = true; this.heavyT = U.rand(0.45, 0.85); return; }
      if (t.state === 'down' || t.state === 'getup') return; // wait for them
      if (Math.random() < 0.88) { o.light = true; return; }
      if (Math.random() < 0.3) { o.heavyPressed = true; this.heavyT = U.rand(0.15, 0.4); return; }
    }
    // juggle chase after launcher
    if (f.state === 'attack' && f.atk && f.atk.finisher && f.atkConnected && Math.random() < d.combo) o.light = true;

    if (dist > 2.8 && dist < 8 && los && f.kunai > 0 && Math.random() < 0.16) { o.kunai = true; return; }
    if (dist > 2.5 && dist < 5.5 && this.prefRange < 2 && los && Math.random() < 0.12 * d.aggro && f.dashCD <= 0) {
      const [nx, ny] = U.norm(t.x - f.x, t.y - f.y);
      o.dash = true; this.dashDir = [nx, ny]; this.dashDirT = 0.05;
    }
  }

  nearestEnemyDist(f) {
    let m = Infinity;
    for (const e of W.fighters) if (e.alive && Combat.enemies(f, e)) m = Math.min(m, U.dist(f.x, f.y, e.x, e.y));
    return m;
  }

  countEnemiesNear(f, x, y, r) {
    let n = 0;
    for (const e of W.fighters) if (e.alive && Combat.enemies(f, e) && !e.isClone && U.dist(x, y, e.x, e.y) <= r) n++;
    return n;
  }

  ultReady(f, t, dist, los) {
    const u = f.ultimate.ai;
    switch (u.kind) {
      case 'aoe': return dist >= u.min && dist <= u.max;
      case 'line': return dist <= u.max && (los || f.ultimate.id === 'cannon');
      case 'proj': return dist >= u.min && dist <= u.max && los;
      case 'self': return this.countEnemiesNear(f, f.x, f.y, u.r || u.max) >= 1 && dist <= (u.r || u.max) * 0.8;
      default: return dist < 6;
    }
  }

  pickJutsu(f, t, dist, los) {
    let best = -1, bs = 0;
    const tStunned = t.state === 'hitstun' || t.state === 'air' || t.state === 'stun' || t.st.slow > 0 || t.st.root > 0;
    for (let i = 0; i < 4; i++) {
      const s = f.jutsu[i];
      if (!s || s.cd > 0 || f.chakra < f.costFor(s)) continue;
      const ai = s.def.ai;
      let sc = 0;
      switch (ai.kind) {
        case 'proj': if (dist >= ai.min && dist <= ai.max && los) sc = 1; break;
        case 'aoe': if (dist >= ai.min && dist <= ai.max) sc = 1.05 + (tStunned ? 0.5 : 0); break;
        case 'melee': if (dist <= ai.max && los) sc = 1.1; break;
        case 'self': { const n = this.countEnemiesNear(f, f.x, f.y, ai.max + 0.3); if (n) sc = 0.85 + 0.35 * n; break; }
        case 'dash': if (dist >= ai.min && dist <= ai.max && los) sc = 0.9; break;
        case 'buff': if (dist < 5 && !f.buffs.length) sc = 0.85; break;
        case 'escape': if (f.hp < f.maxHp * 0.35 && dist < 5) sc = 1.4; break;
        case 'defend': if (this.countEnemiesNear(f, f.x, f.y, 2) >= 1 || this.projThreat > 0) sc = 1.1; break;
        case 'wall': if (this.projThreat > 0 || (f.hp < f.maxHp * 0.4 && dist > 3)) sc = 0.95; break;
        case 'summon': if (dist < 8) sc = 0.9; break;
      }
      if (sc > 0 && tStunned && ['proj', 'aoe', 'dash', 'melee'].includes(ai.kind)) sc += 0.4 * this.d.combo;
      sc *= U.rand(0.7, 1.3);
      if (sc > bs) { bs = sc; best = i; }
    }
    return bs > 0.8 ? best : -1;
  }

  // ---- movement ------------------------------------------------------------------------
  steer(f, dt, o) {
    const t = this.target;
    let gx = 0, gy = 0;
    // anti-stuck
    this.stuckT += dt;
    if (this.stuckT > 0.6) {
      const moved = U.dist(f.x, f.y, this.lastPos.x, this.lastPos.y);
      if (moved < 0.25 && this.wantMove && f.isNeutral()) {
        this.unstickT = 0.5;
        const a = U.rand(0, TAU);
        this.unstickDir = [Math.cos(a), Math.sin(a)];
        this.path = null;
      }
      this.stuckT = 0; this.lastPos = { x: f.x, y: f.y };
    }
    if (this.unstickT > 0) { this.unstickT -= dt; o.mx = this.unstickDir[0]; o.my = this.unstickDir[1]; this.wantMove = true; return; }

    if (!t) {
      // wander toward the arena centre / random points
      if (!this.wanderPt || U.dist(f.x, f.y, this.wanderPt.x, this.wanderPt.y) < 1.5) this.wanderPt = W.arena.randomOpenPoint(6);
      [gx, gy] = this.seek(f, this.wanderPt.x, this.wanderPt.y, dt);
    } else if (this.fleeT > 0) {
      let ax = 0, ay = 0;
      for (const e of W.fighters) {
        if (!e.alive || !Combat.enemies(f, e)) continue;
        const d = U.dist(f.x, f.y, e.x, e.y);
        if (d < 9) { ax += (f.x - e.x) / (d * d + 0.1); ay += (f.y - e.y) / (d * d + 0.1); }
      }
      [gx, gy] = U.norm(ax, ay);
      // don't hug the arena wall
      const cx = W.arena.w / 2, cy = W.arena.h / 2;
      if (U.dist(f.x, f.y, cx, cy) > W.arena.w * 0.36) { const [nx, ny] = U.norm(cx - f.x, cy - f.y); gx += nx * 0.8; gy += ny * 0.8; }
    } else {
      const dist = U.dist(f.x, f.y, t.x, t.y);
      const want = t.state === 'down' ? 1.6 : this.prefRange;
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = U.rand(0.8, 2.2); if (Math.random() < 0.5) this.strafe *= -1; }
      if (dist > want + 0.7) {
        [gx, gy] = this.seek(f, t.x, t.y, dt);
      } else {
        const [nx, ny] = U.norm(t.x - f.x, t.y - f.y);
        let radial = dist < want - 0.6 ? -0.8 : dist > want + 0.2 ? 0.5 : 0;
        if (want < 2 && dist > 0.9) radial = 0.9;
        const tang = want < 2 ? 0.25 : 0.75;
        gx = nx * radial + -ny * this.strafe * tang;
        gy = ny * radial + nx * this.strafe * tang;
      }
    }
    // hazards: telegraphed AoEs, burning ground, enemy zones
    for (const h of W.hazards) {
      if (h.dead || !h.src || !Combat.enemies(f, h.src)) continue;
      if ((h.type === 'aoe' && !h.fired) || h.type === 'zone') {
        const d = U.dist(f.x, f.y, h.x, h.y);
        if (d < (h.r || 1) + 0.6) {
          const key = 'z' + (h.id || (h.id = U.uid()));
          if (!this.seen.has(key)) { this.seen.add(key); h['aw' + f.id] = Math.random() < 0.35 + this.d.dodge; }
          if (h['aw' + f.id]) { const [nx, ny] = U.norm(f.x - h.x, f.y - h.y); gx += nx * 2.2; gy += ny * 2.2; }
        }
      }
    }
    if (W.arena.isBurningW(f.x, f.y)) { gx += U.rand(-1, 1); gy += U.rand(-1, 1); }
    // separate from allies
    for (const e of W.fighters) {
      if (e === f || !e.alive || Combat.enemies(f, e)) continue;
      const d = U.dist(f.x, f.y, e.x, e.y);
      if (d < 1.2 && d > 0.01) { gx += (f.x - e.x) / d * 0.5; gy += (f.y - e.y) / d * 0.5; }
    }
    const l = Math.hypot(gx, gy);
    this.wantMove = l > 0.2;
    if (l > 1) { gx /= l; gy /= l; }
    o.mx = gx; o.my = gy;
  }

  seek(f, tx, ty, dt) {
    const A = W.arena;
    if (A.walkClear(f.x, f.y, tx, ty, 0.3)) { this.path = null; return U.norm(tx - f.x, ty - f.y); }
    this.pathT -= dt;
    if (!this.path || this.pathT <= 0 || this.pathVer !== A.version && this.pathT < 0.3) {
      this.path = A.findPath(f.x, f.y, tx, ty);
      this.pathIdx = 0; this.pathT = U.rand(0.6, 1.0); this.pathVer = A.version;
    }
    const p = this.path;
    if (!p || !p.length) return U.norm(tx - f.x, ty - f.y);
    // skip reached / directly visible waypoints
    while (this.pathIdx < p.length - 1 && (U.dist(f.x, f.y, p[this.pathIdx].x, p[this.pathIdx].y) < 0.45 || (this.pathIdx + 1 < p.length && A.walkClear(f.x, f.y, p[this.pathIdx + 1].x, p[this.pathIdx + 1].y, 0.3) && U.dist(f.x, f.y, p[this.pathIdx + 1].x, p[this.pathIdx + 1].y) < 6))) this.pathIdx++;
    const w = p[Math.min(this.pathIdx, p.length - 1)];
    return U.norm(w.x - f.x, w.y - f.y);
  }
}

// Simple, aggressive brain for shadow clones.
class CloneAI {
  constructor(f) { this.f = f; this.t = 0; this.target = null; this.out = { mx: 0, my: 0, ax: null, ay: null, light: false, heavy: false, heavyPressed: false, dash: false, block: false, kunai: false, charge: false, j: [false, false, false, false], awaken: false, ult: false }; this.path = null; this.pathT = 0; }
  input(f, dt) {
    const o = this.out;
    this.t -= dt;
    o.light = o.dash = o.kunai = o.heavyPressed = false;
    if (!this.target || !this.target.alive || this.t <= 0) {
      this.t = 1;
      let best = null, bd = 18;
      const anchor = f.owner && f.owner.alive ? f.owner : f;
      for (const e of W.fighters) {
        if (!e.alive || !Combat.enemies(f, e) || e.st.stealth > 0) continue;
        const d = U.dist(anchor.x, anchor.y, e.x, e.y) + U.rand(0, 2);
        if (d < bd) { bd = d; best = e; }
      }
      this.target = best;
    }
    const t = this.target;
    if (!t) {
      const a = f.owner && f.owner.alive ? f.owner : null;
      if (a && U.dist(f.x, f.y, a.x, a.y) > 2) { [o.mx, o.my] = U.norm(a.x - f.x, a.y - f.y); } else { o.mx = o.my = 0; }
      o.ax = f.x + Math.cos(f.facing); o.ay = f.y + Math.sin(f.facing);
      return o;
    }
    o.ax = t.x; o.ay = t.y;
    const d = U.dist(f.x, f.y, t.x, t.y);
    if (d > 1.1) {
      if (W.arena.walkClear(f.x, f.y, t.x, t.y, 0.3)) [o.mx, o.my] = U.norm(t.x - f.x, t.y - f.y);
      else {
        this.pathT -= dt;
        if (!this.path || this.pathT <= 0) { this.path = W.arena.findPath(f.x, f.y, t.x, t.y, 800); this.pathT = 0.8; }
        const w = this.path && this.path.find((p) => U.dist(f.x, f.y, p.x, p.y) > 0.5);
        [o.mx, o.my] = w ? U.norm(w.x - f.x, w.y - f.y) : U.norm(t.x - f.x, t.y - f.y);
      }
      if (d < 4 && d > 2 && Math.random() < dt * 1.2) o.dash = true;
    } else { o.mx = o.my = 0; }
    if (d < 1.5 && Math.random() < dt * 7) o.light = true;
    if (d > 3 && d < 7 && f.kunai > 0 && Math.random() < dt * 0.5) o.kunai = true;
    return o;
  }
}
