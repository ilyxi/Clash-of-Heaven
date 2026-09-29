'use strict';
// ---------------------------------------------------------------------------
// World = one match: arena, fighters, projectiles, hazards, rules & camera.
// ---------------------------------------------------------------------------

const TEAM_COLORS = ['#4aa8ff', '#ff5a4a', '#5ad06a', '#ffc83a', '#c07aff'];
const TEAM_NAMES = ['Leaf', 'Sand', 'Mist', 'Cloud', 'Stone'];
const FFA_COLORS = ['#4aa8ff', '#ff5a4a', '#5ad06a', '#ffc83a', '#c07aff', '#ff8ad0', '#4ae0d0', '#ff9a3a', '#d0e060', '#b0b0c0'];

class PlayerController {
  constructor(f) {
    this.f = f;
    this.out = { mx: 0, my: 0, ax: null, ay: null, light: false, heavy: false, heavyPressed: false, dash: false, block: false, kunai: false, charge: false, j: [false, false, false, false], awaken: false, ult: false };
  }
  input(f) {
    const o = this.out;
    const mv = Input.moveVector();
    const mag = Math.min(1, Math.hypot(mv.x, mv.y));
    const [wx, wy] = ISO.screenDirToWorld(mv.x, mv.y);
    o.mx = wx * mag; o.my = wy * mag;
    const pad = Input.pad;
    if (pad.active && (pad.rx || pad.ry) && !Input.usingMouse()) {
      const [ax, ay] = ISO.screenDirToWorld(pad.rx, pad.ry);
      o.ax = f.x + ax * 4.5; o.ay = f.y + ay * 4.5;
    } else if (Input.usingMouse()) {
      const m = Input.mouseView();
      const w = W.screenToWorld(m.x, m.y);
      o.ax = w.x; o.ay = w.y;
    } else {
      // keyboard / pad without right stick: auto-aim the nearest enemy
      let best = null, bd = 9;
      for (const e of W.fighters) {
        if (!e.alive || !Combat.enemies(f, e) || e.st.stealth > 0) continue;
        const d = U.dist(f.x, f.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) { o.ax = best.x; o.ay = best.y; }
      else if (mag > 0.1) { o.ax = f.x + wx * 3; o.ay = f.y + wy * 3; }
      else { o.ax = f.x + Math.cos(f.facing) * 3; o.ay = f.y + Math.sin(f.facing) * 3; }
    }
    o.light = Input.wasPressed('light');
    o.heavyPressed = Input.wasPressed('heavy');
    o.heavy = Input.isDown('heavy');
    o.dash = Input.wasPressed('dash');
    o.block = Input.isDown('block');
    o.kunai = Input.wasPressed('kunai');
    o.charge = Input.isDown('charge');
    o.j[0] = Input.wasPressed('j1'); o.j[1] = Input.wasPressed('j2'); o.j[2] = Input.wasPressed('j3'); o.j[3] = Input.wasPressed('j4');
    o.awaken = Input.wasPressed('awaken');
    o.ult = Input.wasPressed('ultimate');
    return o;
  }
}

class World {
  // cfg: { map, seed, mode:'ffa'|'teams', teamCount, winType:'kills'|'stock', killLimit, stock, timeLimit,
  //        entries:[{char, team, isPlayer, diff}], demo }
  constructor(cfg) {
    W = this;
    this.cfg = cfg;
    this.demo = !!cfg.demo;
    this.time = 0;
    this.realTime = 0;
    this.arena = new Arena(cfg.map, cfg.seed || (Math.random() * 1e9) | 0);
    this.fighters = [];
    this.projectiles = [];
    this.hazards = [];
    this.slowFields = [];
    this.killfeed = [];
    this.notices = [];
    this.cam = { x: 0, y: 0, w: 640, h: 360, shake: 0, sx: 0, sy: 0 };
    this.slowT = 0; this.slowK = 1;
    this.flashT = 0; this.flashDur = 0; this.flashCol = '#fff';
    this.cutin = null;
    this.moonFx = null;
    this.over = false; this.overT = 0; this.winner = null;
    this.showNumbers = Settings.data ? Settings.data.numbers : true;
    this.teamScore = {};
    this.player = null;
    this.spectateIdx = 0; this.spectateT = 0;
    this.startT = 0;
    FX.clear();

    const spawns = this.arena.spawnPoints.slice();
    const entries = cfg.entries;
    // group team spawns together around the ring
    let order;
    if (cfg.mode === 'teams') {
      const T = cfg.teamCount || 2;
      const per = Math.ceil(10 / T);
      const used = {};
      order = entries.map((e) => { const k = used[e.team] = (used[e.team] || 0) + 1; return (e.team * per + k - 1) % spawns.length; });
    } else {
      order = U.shuffle(spawns.map((_, i) => i));
    }
    entries.forEach((e, n) => {
      const team = cfg.mode === 'teams' ? e.team : n;
      const color = cfg.mode === 'teams' ? TEAM_COLORS[e.team % TEAM_COLORS.length] : FFA_COLORS[n % FFA_COLORS.length];
      const f = new Fighter(e.char, team, { isPlayer: !!e.isPlayer, teamColor: color, lives: cfg.winType === 'stock' ? cfg.stock : 0 });
      const sp = spawns[order[n] % spawns.length];
      f.x = sp.x + U.rand(-0.2, 0.2); f.y = sp.y + U.rand(-0.2, 0.2);
      f.facing = Math.atan2(this.arena.h / 2 - f.y, this.arena.w / 2 - f.x);
      f.ctrl = e.isPlayer ? new PlayerController(f) : e.diff === 'dummy' ? null : new AIController(f, e.diff || 'normal');
      f.spawnProt = 2;
      f.diff = e.diff;
      this.fighters.push(f);
      this.teamScore[team] = 0;
      if (e.isPlayer) this.player = f;
    });
    if (cfg.training && this.player) {
      // gather the practice partners around the player
      this.fighters.filter((f) => f !== this.player).forEach((f, i) => this.placeNear(f, this.player, 3 + i * 0.8));
    }
    this.camTarget = this.player || this.fighters[0];
    this.snapCamera();
    this.timeLeft = cfg.timeLimit || 0;
  }

  get alivePlayers() { return this.fighters.filter((f) => !f.isClone); }

  placeNear(f, anchor, dist) {
    for (let k = 0; k < 24; k++) {
      const a = U.rand(0, TAU);
      const x = anchor.x + Math.cos(a) * dist, y = anchor.y + Math.sin(a) * dist;
      if (!this.arena.isSolid(Math.floor(x), Math.floor(y)) && Math.min(x, y, this.arena.w - x, this.arena.h - y) > 3) {
        f.x = x; f.y = y;
        f.facing = Math.atan2(anchor.y - y, anchor.x - x);
        return true;
      }
    }
    return false;
  }

  isWatched(f) { return !!f && f === this.camTarget; }

  screenToWorld(vx, vy) { return ISO.toWorld(vx + this.cam.x, vy + this.cam.y); }

  // ---- camera ---------------------------------------------------------------------
  camCenterFor(f) {
    let x = ISO.sx(f.x, f.y), y = ISO.sy(f.x, f.y, f.z * 0.5) - 14;
    if (f === this.player && Input.usingMouse() && !this.over) {
      const m = Input.mouseView();
      if (m) { x += U.clamp((m.x - this.cam.w / 2) * 0.18, -50, 50); y += U.clamp((m.y - this.cam.h / 2) * 0.18, -34, 34); }
    }
    return { x: x - this.cam.w / 2, y: y - this.cam.h / 2 };
  }
  snapCamera() {
    if (!this.camTarget) return;
    const c = this.camCenterFor(this.camTarget);
    this.cam.x = c.x; this.cam.y = c.y;
  }
  updateCamera(dt) {
    const cam = this.cam;
    if (this.demo || !this.player) this.updateSpectate(dt);
    else if (this.player.dead && this.player.lastAttackerFighter() && this.player.deadT > 1.2 && this.player.deadT < 4) this.camTarget = this.player.lastAttackerFighter();
    else this.camTarget = this.player;
    const t = this.camTarget;
    if (t) {
      const c = this.camCenterFor(t);
      const k = 1 - Math.exp(-7 * dt);
      cam.x += (c.x - cam.x) * k; cam.y += (c.y - cam.y) * k;
    }
    const A = this.arena;
    cam.x = U.clamp(cam.x, -A.h * HALF_W - 40, A.w * HALF_W - cam.w + 40);
    cam.y = U.clamp(cam.y, -60, (A.w + A.h) * HALF_H - cam.h + 40);
    cam.shake *= Math.exp(-9 * dt);
    const s = cam.shake * (Settings.data ? Settings.data.shake : 1);
    cam.sx = s > 0.3 ? U.rand(-s, s) : 0; cam.sy = s > 0.3 ? U.rand(-s, s) : 0;
    SFX.listener.x = ISO.toWorld(cam.x + cam.w / 2, cam.y + cam.h / 2).x;
    SFX.listener.y = ISO.toWorld(cam.x + cam.w / 2, cam.y + cam.h / 2).y;
  }
  updateSpectate(dt) {
    this.spectateT -= dt;
    const alive = this.fighters.filter((f) => f.alive && !f.isClone);
    if (!alive.length) return;
    if (!this.camTarget || !this.camTarget.alive || this.spectateT <= 0) {
      // follow whoever is in the thick of it
      let best = alive[0], bs = -1;
      for (const f of alive) {
        let s = f.comboShowT * 3 + (f.awakened ? 4 : 0) + (f.state === 'ult' ? 8 : 0) + Math.random() * 2;
        for (const e of alive) if (e !== f && Combat.enemies(f, e) && U.dist(f.x, f.y, e.x, e.y) < 5) s += 1.5;
        if (s > bs) { bs = s; best = f; }
      }
      this.camTarget = best;
      this.spectateT = this.demo ? U.rand(5, 9) : 6;
    }
  }
  spectateNext(dir) {
    const alive = this.fighters.filter((f) => f.alive && !f.isClone);
    if (!alive.length) return;
    const i = alive.indexOf(this.camTarget);
    this.camTarget = alive[(i + dir + alive.length) % alive.length];
    this.spectateT = 30;
  }
  shake(m) { this.cam.shake = Math.max(this.cam.shake, m); }
  shakeAt(x, y, m) {
    const c = this.screenToWorld(this.cam.w / 2, this.cam.h / 2);
    const d = U.dist(x, y, c.x, c.y);
    if (d < 16) this.shake(m * (1 - d / 16));
  }
  slowmo(k, dur) { if (this.demo) return; this.slowK = k; this.slowT = Math.max(this.slowT, dur); }
  flash(col, dur) { this.flashCol = col; this.flashT = dur; this.flashDur = dur; }

  // ---- spawning helpers --------------------------------------------------------------
  spawnClone(owner, x, y, life, opts = {}) {
    const mine = this.fighters.filter((f) => f.isClone && f.owner === owner && f.alive);
    if (mine.length >= 12) mine[0].poof();
    if (this.arena.isSolid(Math.floor(x), Math.floor(y))) { x = owner.x; y = owner.y; }
    const c = new Fighter(owner.char, owner.team, { isClone: true, owner, hp: opts.hp || 1, teamColor: owner.teamColor });
    c.jutsu = []; c.awakening = null; c.ultimate = null;
    c.level = owner.level; c.computeMods();
    c.x = x; c.y = y; c.facing = owner.facing;
    c.life = life;
    c.ctrl = new CloneAI(c);
    this.fighters.push(c);
    FX.poof(x, y, 10);
    return c;
  }

  spawnLog(x, y, z) {
    FX.custom({
      life: 1.1, layer: 1,
      draw(ctx, cam, k) {
        const zz = Math.max(0, z + 20 * (1 - k * 3)) ;
        const [sx, sy] = DF.sp(x, y, zz, cam);
        ctx.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
        ctx.fillStyle = '#5a3a1c'; ctx.fillRect(sx - 8, sy - 6, 16, 7);
        ctx.fillStyle = '#8a5a2c'; ctx.fillRect(sx - 8, sy - 6, 16, 3);
        ctx.fillStyle = '#c89a5e'; ctx.fillRect(sx + 6, sy - 6, 3, 7);
        ctx.fillStyle = '#6a4424'; ctx.fillRect(sx + 7, sy - 4, 1, 3);
        ctx.globalAlpha = 1;
      },
    });
  }

  // ---- events ---------------------------------------------------------------------------
  onDeath(f, src, h) {
    const killer = src ? (src.owner || src) : f.lastAttackerFighter();
    const ability = h && h.ability;
    if (killer && killer !== f && Combat.enemies(killer, f)) {
      killer.kills++;
      this.teamScore[killer.team] = (this.teamScore[killer.team] || 0) + 1;
      killer.gainXP(130);
      if (ability) killer.masteryXP(ability, 150);
      if (!killer.awakened) killer.awak = Math.min(100, killer.awak + 20);
      killer.ult = Math.min(100, killer.ult + 20);
      killer.heal(killer.maxHp * 0.12);
      FX.text(killer.x, killer.y, killer.z + 46, 'K.O.!', '#ff6a3a', { scale: 2, life: 1.2 });
      // multi-KOs and streaks
      killer.streak = (killer.streak || 0) + 1;
      killer.multi = this.time - (killer.lastKillT || -99) < 7 ? (killer.multi || 1) + 1 : 1;
      killer.lastKillT = this.time;
      if (killer === this.player) {
        SFX.play('ko', 0.6); this.slowmo(0.3, 0.5);
        this.notice('YOU DEFEATED ' + f.name.toUpperCase(), '#ffd35c');
        const m = killer.multi;
        if (m >= 2) this.notice(m === 2 ? 'DOUBLE K.O.!' : m === 3 ? 'TRIPLE K.O.!' : 'SHINOBI MASSACRE!', '#ff9a3a');
      }
      if (killer.streak === 5 || killer.streak === 10 || killer.streak === 15) {
        this.notice(killer.name.toUpperCase() + (killer.streak >= 10 ? ' IS GODLIKE!' : ' IS UNSTOPPABLE!'), '#ff6af0');
        SFX.play('horn', 0.5);
      }
      if ((f.lastStreak || 0) >= 5) this.notice(killer.name.toUpperCase() + ' ENDED ' + f.name.toUpperCase() + "'S STREAK", '#9af0ff');
    }
    for (const [a, t] of f.lastAttackers) {
      if (a === killer || this.time - t > 8 || !Combat.enemies(a, f) || a.isClone) continue;
      a.assists++;
      a.gainXP(55);
      a.ult = Math.min(100, a.ult + 8);
    }
    const name = ability ? (JUTSU[ability] ? JUTSU[ability].name : ULTIMATES[ability] ? ULTIMATES[ability].name : ability === 'taijutsu' ? 'Taijutsu' : ability === 'kunai' ? 'Kunai' : '') : '';
    this.killfeed.push({ killer, victim: f, name, t: this.realTime });
    if (this.killfeed.length > 6) this.killfeed.shift();
    if (f === this.player) this.notice(killer ? 'DEFEATED BY ' + killer.name.toUpperCase() : 'DEFEATED', '#ff6a6a');

    if (this.cfg.training) {
      f.respawnT = f === this.player ? 2 : 1.5;
    } else if (this.cfg.winType === 'stock' && !this.demo) {
      f.lives--;
      f.respawnT = f.lives > 0 ? 4 : Infinity;
      if (f.lives <= 0) f.eliminated = true;
    } else {
      f.respawnT = 3.5 + Math.min(4, f.deaths * 0.4);
    }
    this.checkWin();
  }

  onUltimate(f) {
    if (this.isWatched(f) || this.onScreen(f)) {
      this.cutin = { f, t: 0, dur: 1.15, name: f.ultimate.name };
      if (f === this.player) this.slowmo(0.4, 0.35);
    }
    const el = ELEMENTS[f.ultimate.element] || ELEMENTS.shinobi;
    FX.ring(f.x, f.y, 0.3, el.color, 0.6, 6, 2);
  }
  onAwaken(f) {
    if (this.isWatched(f)) this.notice('AWAKENING: ' + f.awakening.name.toUpperCase(), f.awakening.colors[1]);
    FX.text(f.x, f.y, 50, f.awakening.name.toUpperCase(), f.awakening.colors[0], { life: 1.4 });
  }
  onLevelUp(f) { if (f === this.player) this.notice('LEVEL UP!  LV ' + f.level, '#ffe14a'); }
  onMastery(f, id, lvl) {
    if (f !== this.player) return;
    const name = id === 'taijutsu' ? 'Taijutsu' : (JUTSU[id] || ULTIMATES[id]).name;
    let extra = '';
    if (id === 'taijutsu' && lvl === 3) extra = ' - 5-HIT COMBO';
    if (id === 'taijutsu' && lvl === 4) extra = ' - AIR CHASE';
    if (id === 'taijutsu' && lvl === 5) extra = ' - UNBLOCKABLE HEAVY';
    this.notice(name.toUpperCase() + (lvl >= 5 ? ' MASTERED!' : ' LV ' + lvl) + extra, lvl >= 5 ? '#ff9af0' : '#8ff0ff');
  }
  onBlockDestroyed(b, src) {
    if (src && src.gainXP) (src.owner || src).gainXP(4);
  }
  notice(text, color) {
    this.notices.push({ text, color, t: 0 });
    if (this.notices.length > 4) this.notices.shift();
  }

  onScreen(f) {
    const sx = ISO.sx(f.x, f.y) - this.cam.x, sy = ISO.sy(f.x, f.y) - this.cam.y;
    return sx > -20 && sy > -40 && sx < this.cam.w + 20 && sy < this.cam.h + 20;
  }

  // ---- rules ------------------------------------------------------------------------------
  teamsAlive() {
    const s = new Set();
    for (const f of this.fighters) if (!f.isClone && !f.eliminated) s.add(f.team);
    return s;
  }

  checkWin() {
    if (this.over || this.demo) return;
    const c = this.cfg;
    if (c.winType === 'kills') {
      for (const team in this.teamScore) {
        if (this.teamScore[team] >= c.killLimit) { this.endMatch(+team); return; }
      }
    } else {
      const alive = this.teamsAlive();
      if (alive.size <= 1) this.endMatch(alive.size ? [...alive][0] : null);
    }
  }

  endMatch(team) {
    if (this.over) return;
    this.over = true;
    this.overT = 0;
    this.winner = team;
    this.slowmo(0.25, 1.2);
    SFX.play('horn', 1);
    const pw = this.player && team !== null && this.player.team === team;
    this.notice(team === null ? 'DRAW' : pw ? 'VICTORY!' : this.player ? 'DEFEAT' : this.teamLabel(team) + ' WINS', pw ? '#ffe14a' : '#ff8a8a');
  }

  teamLabel(team) {
    if (this.cfg.mode === 'teams') return TEAM_NAMES[team] + ' Team';
    const f = this.fighters.find((x) => x.team === team && !x.isClone);
    return f ? f.name : 'Nobody';
  }

  leadingTeam() {
    let best = null, bs = -1, tie = false;
    for (const team in this.teamScore) {
      let s = this.teamScore[team];
      if (this.cfg.winType === 'stock') s = this.fighters.filter((f) => f.team === +team && !f.isClone).reduce((a, f) => a + Math.max(0, f.lives) + (f.alive ? f.hp / f.maxHp : 0), 0);
      if (s > bs) { bs = s; best = +team; tie = false; } else if (s === bs) tie = true;
    }
    return tie ? null : best;
  }

  respawn(f) {
    const A = this.arena;
    let best = A.spawnPoints[0], bs = -1;
    for (const sp of A.spawnPoints) {
      let m = Infinity;
      for (const e of this.fighters) if (e.alive && Combat.enemies(f, e)) m = Math.min(m, U.dist(sp.x, sp.y, e.x, e.y));
      m += U.rand(0, 3);
      if (m > bs) { bs = m; best = sp; }
    }
    f.x = best.x; f.y = best.y;
    if (this.cfg.training && this.player && f !== this.player && this.player.alive) this.placeNear(f, this.player, U.rand(3, 5));
    f.z = 0; f.vx = f.vy = f.vz = 0; f.mvx = f.mvy = 0;
    f.dead = false; f.hp = f.maxHp; f.chakra = f.maxChakra; f.guard = 100;
    f.st = { burn: 0, burnDps: 0, burnSrc: null, burnTick: 0, wet: 0, para: 0, paraResist: 0, slow: 0, slowAmt: 0, root: 0, stealth: 0, genjutsu: 0 };
    f.buffs = []; f.computeMods();
    f.setState('idle'); f.spawnProt = 2.5; f.comboHits = 0; f.juggle = 0;
    f.lastAttackers.clear();
    for (const s of f.jutsu) if (s) s.cd = Math.min(s.cd, 2);
    FX.poof(f.x, f.y, 14);
    if (f === this.player) SFX.play('sub', 0.8);
  }

  // ---- main update -----------------------------------------------------------------------
  update(dt) {
    this.realTime += dt;
    if (this.slowT > 0) this.slowT -= dt;
    const sdt = dt * (this.slowT > 0 ? this.slowK : 1);
    this.time += sdt;
    this.startT += dt;

    this.slowFields = this.fighters.filter((f) => f.alive && f.mod && f.mod.projSlow > 0);
    if (this.cfg.training && this.player && this.player.alive) {
      // the dojo keeps your meters topped up so you can practise everything
      const p = this.player;
      if (!p.awakened) p.awak = Math.min(100, p.awak + 9 * sdt);
      p.ult = Math.min(100, p.ult + 9 * sdt);
      p.chakra = Math.min(p.maxChakra, p.chakra + 6 * sdt);
    }
    for (const f of this.fighters) f.update(sdt);

    // soft body separation
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) {
      const a = fs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < fs.length; j++) {
        const b = fs[j];
        if (!b.alive || Math.abs(a.z - b.z) > 20) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, r = a.radius + b.radius;
        if (d2 < r * r && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (r - d) * 0.5;
          a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push;
        }
      }
    }

    for (const p of this.projectiles) if (!p.dead) p.update(sdt);
    this.clashProjectiles();
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    for (const h of this.hazards) { if (!h.dead) { h.t += sdt; h.update(sdt); } }
    this.hazards = this.hazards.filter((h) => !h.dead);

    this.arena.update(sdt, this);
    FX.update(sdt);
    if (this.moonFx) this.moonFx.t += sdt;

    // respawns / cleanup
    for (const f of this.fighters) {
      if (!f.dead || f.isClone || f.eliminated) continue;
      f.respawnT -= sdt;
      if (f.respawnT <= 0 && !this.over) this.respawn(f);
    }
    if (this.fighters.some((f) => f.removed)) this.fighters = this.fighters.filter((f) => !f.removed);
    for (const f of this.fighters) {
      if (f.blindT > 0) f.blindT -= sdt;
    }

    // timers
    if (!this.demo && !this.over && this.cfg.timeLimit) {
      this.timeLeft -= sdt;
      if (this.timeLeft <= 10 && Math.floor(this.timeLeft + sdt) !== Math.floor(this.timeLeft) && this.timeLeft > 0) SFX.play('tick', 1);
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.endMatch(this.leadingTeam()); }
    }
    if (this.over) {
      this.overT += dt;
      if (this.overT > 1.2) for (const f of this.fighters) if (f.alive && f.team === this.winner && f.isNeutral()) f.setState('victory');
    }
    if (this.demo && this.time > 150) this.demoReset = true;

    for (const n of this.notices) n.t += dt;
    this.notices = this.notices.filter((n) => n.t < 3);
    if (this.cutin) { this.cutin.t += dt; if (this.cutin.t > this.cutin.dur) this.cutin = null; }
    if (this.flashT > 0) this.flashT -= dt;
    this.updateCamera(dt);
  }

  clashProjectiles() {
    const ps = this.projectiles;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (a.dead || !a.clash) continue;
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        if (b.dead || !b.clash || a.team === b.team) continue;
        const r = a.radius + b.radius;
        if (Math.abs(a.x - b.x) > r || Math.abs(a.y - b.y) > r) continue;
        if (U.dist2(a.x, a.y, b.x, b.y) > r * r || Math.abs(a.z - b.z) > 16) continue;
        const res = clashResult(a.element, b.element);
        const pa = a.clash * (res === 1 ? 2 : res === -1 ? 0.5 : 1);
        const pb = b.clash * (res === -1 ? 2 : res === 1 ? 0.5 : 1);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2;
        if (a.kind === 'kunai' && b.kind === 'kunai') {
          a.dead = b.dead = true;
          FX.spark(mx, my, mz, ['#ffffff', '#ffe08a'], 8, 5);
          SFX.playAt('clink', mx, my);
          continue;
        }
        FX.glow(mx, my, mz, 8, '#ffffff', 0.15);
        FX.spark(mx, my, mz, ['#ffffff', '#ffe08a', '#ff8a4a'], 12, 6);
        if (pa > pb * 1.2) { b.impact(); a.clash -= pb; a.dmg *= 0.8; }
        else if (pb > pa * 1.2) { a.impact(); b.clash -= pa; b.dmg *= 0.8; }
        else { a.impact(); b.impact(); }
        SFX.playAt('explosion', mx, my, 0.4);
        if (a.dead) break;
      }
    }
  }
}
