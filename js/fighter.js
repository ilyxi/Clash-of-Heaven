'use strict';
// ---------------------------------------------------------------------------
// Fighter: movement, the combat state machine, meters, statuses, leveling.
// Both the player and AI drive a fighter through the same input struct.
// ---------------------------------------------------------------------------

const GRAVITY = 900;
const BASE_HP = 900;
const BASE_SPEED = 4.3;
const MASTERY_XP = [0, 150, 380, 700, 1100]; // cumulative xp to reach Lv 2..5
const MAX_LEVEL = 10;

// Basic taijutsu chain. `lvl` = taijutsu level needed for the step to appear.
const COMBO = [
  { pose: 'jab', wind: 0.07, act: 0.06, rec: 0.17, dmg: 20, range: 1.1, arc: 1.0, lunge: 2.6, knock: 1.4, stun: 0.36, sfx: 'swing' },
  { pose: 'cross', wind: 0.07, act: 0.06, rec: 0.17, dmg: 20, range: 1.1, arc: 1.0, lunge: 2.6, knock: 1.4, stun: 0.36 },
  { pose: 'kick', wind: 0.09, act: 0.07, rec: 0.2, dmg: 26, range: 1.25, arc: 1.2, lunge: 2.8, knock: 2.2, stun: 0.4 },
  { pose: 'sweep', wind: 0.1, act: 0.08, rec: 0.2, dmg: 24, range: 1.3, arc: 1.6, lunge: 1.8, knock: 1.6, stun: 0.44, lvl: 3 },
  { pose: 'uppercut', wind: 0.12, act: 0.08, rec: 0.34, dmg: 40, range: 1.15, arc: 1.1, lunge: 3.2, knock: 5.0, launch: 260, stun: 0.7, finisher: true },
];
const DASH_ATTACK = { pose: 'kick', wind: 0.05, act: 0.12, rec: 0.26, dmg: 24, range: 1.2, arc: 1.2, lunge: 8, knock: 3, launch: 220, stun: 0.6, dashAttack: true };
const CHASE_SLAM = { pose: 'slam', wind: 0.05, act: 0.08, rec: 0.3, dmg: 42, range: 1.3, arc: 1.6, lunge: 0, knock: 2, spike: true, stun: 0.7 };
// Directional lights (Brawlhalla-style): moving toward your target lunges in,
// moving away throws a retreating spin kick. Both flow into the normal chain.
const SIDE_LIGHT = { pose: 'lunge', wind: 0.07, act: 0.09, rec: 0.2, dmg: 22, range: 1.35, arc: 0.9, lunge: 8.5, knock: 2.4, stun: 0.42, side: true };
const BACK_LIGHT = { pose: 'spin', wind: 0.06, act: 0.12, rec: 0.22, dmg: 20, range: 1.3, arc: Math.PI, lunge: -4.5, knock: 4.2, stun: 0.4, back: true };
// Air string: punch, kick, then a spiking finisher.
const AIR_COMBO = [
  { pose: 'airpunch', wind: 0.05, act: 0.07, rec: 0.14, dmg: 18, range: 1.2, arc: 1.1, lunge: 3, knock: 1.2, stun: 0.4, air: true },
  { pose: 'airkick', wind: 0.06, act: 0.07, rec: 0.16, dmg: 20, range: 1.3, arc: 1.2, lunge: 3, knock: 1.4, stun: 0.42, air: true },
  { pose: 'dive', wind: 0.08, act: 0.08, rec: 0.26, dmg: 30, range: 1.3, arc: 1.3, lunge: 3.5, knock: 5, spike: true, stun: 0.65, air: true, finisher: true },
];

const EMPTY_INPUT = Object.freeze({
  mx: 0, my: 0, ax: null, ay: null, light: false, heavy: false, heavyPressed: false, jump: false,
  dash: false, block: false, kunai: false, kunaiHeld: false, charge: false, j: [false, false, false, false], awaken: false, ult: false,
});
const JUMP_V = 300, DOUBLE_JUMP_V = 265;

class Fighter {
  constructor(char, team, opts = {}) {
    this.id = U.uid();
    this.char = char;
    this.name = char.name;
    this.look = char.look;
    this.affinity = char.affinity;
    this.team = team;
    this.teamColor = opts.teamColor || '#ffffff';
    this.isPlayer = !!opts.isPlayer;
    this.isClone = !!opts.isClone;
    this.owner = opts.owner || null;
    this.ctrl = null;
    this.radius = 0.3;
    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.mvx = 0; this.mvy = 0;
    this.facing = Math.PI / 4;
    this.aimX = 0; this.aimY = 0;

    this.level = 1; this.xp = 0;
    this.maxHp = opts.hp || BASE_HP; this.hp = this.maxHp;
    this.maxChakra = 100; this.chakra = 100;
    this.guard = 100; this.guardRegenDelay = 0;
    this.sub = 100; // substitution gauge (50 per use)
    this.kunai = 4; this.kunaiRegen = 0;
    this.awak = 0; this.ult = 0;

    this.jutsu = (char.jutsu || []).map((id) => (JUTSU[id] ? { id, def: JUTSU[id], cd: 0 } : null));
    this.awakening = AWAKENINGS[char.awakening] || null;
    this.ultimate = ULTIMATES[char.ultimate] || null;
    this.mastery = { taijutsu: { lvl: 1, xp: 0 } };
    for (const s of this.jutsu) if (s) this.mastery[s.id] = { lvl: 1, xp: 0 };
    if (this.ultimate) this.mastery[this.ultimate.id] = { lvl: 1, xp: 0 };

    this.state = 'idle'; this.stateT = 0; this.time = 0; this.animT = 0;
    this.freeze = 0; this.flash = 0; this.iframes = 0; this.dodgeWindow = 0; this.invuln = 0; this.spawnProt = 0;
    this.dashCD = 0; this.buf = null;
    this.st = { burn: 0, burnDps: 0, burnSrc: null, burnTick: 0, wet: 0, para: 0, paraResist: 0, slow: 0, slowAmt: 0, root: 0, stealth: 0, genjutsu: 0 };
    this.buffs = [];
    this.awakened = null;
    this.mod = null;
    this.comboHits = 0; this.lastHitTime = -9; this.juggle = 0;
    this.comboShow = 0; this.comboShowT = 0; this.bestCombo = 0;
    this.lastAttackers = new Map();
    this.counterBonus = 0;
    this.blockStart = -9; this.lastBlockPress = -9; this.blockGap = 9;
    this.dead = false; this.removed = false; this.deadT = 0;
    this.kills = 0; this.deaths = 0; this.assists = 0; this.dmgDealt = 0; this.dmgTaken = 0; this.parries = 0;
    this.lives = opts.lives || 0;
    this.respawnT = 0;
    this.hurtFrame = 0;
    this.afterT = 0;
    this.cantDie = false;
    this.computeMods();
  }

  // ---- helpers -------------------------------------------------------------
  get alive() { return !this.dead && !this.removed; }
  setState(s) { this.state = s; this.stateT = 0; }
  isNeutral() { return this.state === 'idle' || this.state === 'move'; }
  canAct() { return this.isNeutral(); }
  lvlOf(id) { const m = this.mastery[id]; return m ? m.lvl : 1; }
  taiLvl() { return this.mastery.taijutsu.lvl; }

  comboSeq() {
    return this.taiLvl() >= 3 ? [0, 1, 2, 3, 4] : [0, 1, 2, 4];
  }

  aim() {
    const ax = this.aimX, ay = this.aimY;
    const ang = Math.atan2(ay - this.y, ax - this.x);
    return { x: ax, y: ay, ang, dist: U.dist(this.x, this.y, ax, ay) };
  }
  // Clamp aim distance to a jutsu range, returning a world point.
  aimPoint(maxR, minR = 0) {
    const a = this.aim();
    const d = U.clamp(a.dist, minR, maxR);
    return { x: this.x + Math.cos(a.ang) * d, y: this.y + Math.sin(a.ang) * d, ang: a.ang, dist: d };
  }

  // ---- stats / modifiers -----------------------------------------------------
  computeMods() {
    const m = {
      dmg: 1 + 0.04 * (this.level - 1), def: 1, speed: 1, armor: false, cdr: 1, costMult: 1, reach: 1, arcMult: 1,
      lifesteal: 0, regen: 0, chakraRegen: 1, crit: 0.05, atkSpeed: 1, meleeElement: null, meleeStatus: null,
      parryWindow: 0.16, knockTaken: 1, castSpeed: 1, dashCD: 1, meleeDmg: 1, jutsuSize: 1, hpDrain: 0, projSlow: 0,
    };
    const apply = (mods) => {
      if (!mods) return;
      for (const k in mods) {
        const v = mods[k];
        if (typeof v === 'boolean' || typeof v === 'string' || (typeof v === 'object' && v !== null)) m[k] = v;
        else if (['lifesteal', 'regen', 'crit', 'hpDrain', 'projSlow'].includes(k)) m[k] += v;
        else if (k === 'parryWindow') m[k] = Math.max(m[k], v);
        else m[k] *= v;
      }
    };
    for (const b of this.buffs) apply(b.mods);
    if (this.awakened) apply(this.awakened.def.mods);
    if (this.st.slow > 0) m.speed *= 1 - this.st.slowAmt;
    if (this.st.wet > 0) m.speed *= 0.92;
    this.mod = m;
  }
  // Standing in or beside water (river, lake, or a soaked tile)?
  waterNearby() {
    const A = W.arena;
    if (!this._wnT || this.time - this._wnT > 0.25) {
      this._wnT = this.time;
      this._wn = false;
      for (let dj = -1; dj <= 1 && !this._wn; dj++) for (let di = -1; di <= 1; di++) {
        if (A.isWetW(this.x + di * 1.1, this.y + dj * 1.1)) { this._wn = true; break; }
      }
    }
    return this._wn;
  }
  // Water jutsu cast near water swell in size (read by the jutsu size scale).
  get envBoost() { return this.waterBoostT > 0 && this.lastCastWater ? 1.35 : 1; }
  dmgMult(element, h) {
    let k = this.mod.dmg;
    if (element && element === this.affinity) k *= 1.15;
    if (element === 'water' && this.waterBoostT > 0) k *= 1.3;
    if (h && h.kind === 'melee') k *= this.mod.meleeDmg;
    if (this.isClone) k *= 0.6;
    return k;
  }
  defMult() { return this.mod.def; }
  critChance() { return this.mod.crit; }
  hasArmor() { return this.mod.armor || this.state === 'awaken' || !!this.mount; }
  knockTaken() { return this.mod.knockTaken; }
  parryWindow() { return this.blockGap < 0.35 ? 0 : this.mod.parryWindow; }
  moveSpeed() { return BASE_SPEED * this.mod.speed; }
  cooldownFor(slot) {
    const L = this.lvlOf(slot.id);
    return slot.def.cd * (1 - 0.06 * (L - 1)) * this.mod.cdr;
  }
  costFor(slot) { return Math.round(slot.def.cost * this.mod.costMult); }

  addBuff(b) {
    this.buffs = this.buffs.filter((x) => x.id !== b.id);
    this.buffs.push(b);
    this.computeMods();
  }
  removeBuff(id) {
    const b = this.buffs.find((x) => x.id === id);
    if (b && b.end) b.end(this);
    this.buffs = this.buffs.filter((x) => x.id !== id);
    this.computeMods();
  }
  hasBuff(id) { return this.buffs.some((b) => b.id === id); }

  heal(n) {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  gainMeters(amount, why) {
    if (this.isClone) return;
    if (why === 'deal') {
      if (!this.awakened) this.awak = Math.min(100, this.awak + amount * 0.032);
      this.ult = Math.min(100, this.ult + amount * 0.028);
    } else if (why === 'take') {
      if (!this.awakened) this.awak = Math.min(100, this.awak + amount * 0.045);
      this.ult = Math.min(100, this.ult + amount * 0.018);
    }
  }

  xpNext() { return 90 + this.level * 60; }
  gainXP(n) {
    if (this.isClone) { if (this.owner) this.owner.gainXP(n * 0.5); return; }
    if (this.level >= MAX_LEVEL) return;
    this.xp += n;
    while (this.level < MAX_LEVEL && this.xp >= this.xpNext()) {
      this.xp -= this.xpNext();
      this.level++;
      const add = Math.round(this.maxHp * 0.06);
      this.maxHp += add;
      this.hp = Math.min(this.maxHp, this.hp + add + this.maxHp * 0.08);
      this.maxChakra += 4;
      this.computeMods();
      FX.ring(this.x, this.y, 0.3, '#ffe14a', 0.5, 4);
      FX.aura(this.x, this.y, ['#fff6b0', '#ffe14a', '#ffb020'], 14, 30, 0.4);
      if (W.isWatched(this)) {
        FX.text(this.x, this.y, this.z + 44, 'LEVEL ' + this.level + '!', '#ffe14a', { scale: 1, life: 1.3, vz: 30 });
        SFX.play('levelup', 0.9);
      }
      if (W.onLevelUp) W.onLevelUp(this);
    }
  }

  masteryXP(id, n) {
    if (this.isClone) { if (this.owner) this.owner.masteryXP(id, n * 0.5); return; }
    const m = this.mastery[id];
    if (!m || m.lvl >= 5) return;
    m.xp += n;
    while (m.lvl < 5 && m.xp >= MASTERY_XP[m.lvl]) {
      m.lvl++;
      const name = id === 'taijutsu' ? 'TAIJUTSU' : (JUTSU[id] || ULTIMATES[id] || { name: id }).name.toUpperCase();
      const txt = m.lvl >= 5 ? name + ' MASTERED!' : name + ' LV' + m.lvl;
      if (W.isWatched(this)) {
        FX.text(this.x, this.y, this.z + 52, txt, m.lvl >= 5 ? '#ff9af0' : '#8ff0ff', { life: 1.6, vz: 25 });
        SFX.play(m.lvl >= 5 ? 'mastery' : 'levelup', 0.8);
      }
      if (W.onMastery) W.onMastery(this, id, m.lvl);
    }
  }

  // ---- update ------------------------------------------------------------------
  update(dt) {
    if (this.removed) return;
    this.flash = Math.max(0, this.flash - dt);
    if (this.freeze > 0) { this.freeze -= dt; return; }
    this.time += dt;
    this.stateT += dt;
    this.tickTimers(dt);
    if (this.dead) {
      this.deadT += dt;
      this.mvx = this.mvy = 0;
      this.physics(dt);
      return;
    }
    const inp = this.ctrl ? this.ctrl.input(this, dt) : EMPTY_INPUT;
    this.inp = inp;
    if (inp.ax !== null && inp.ax !== undefined) { this.aimX = inp.ax; this.aimY = inp.ay; }
    this.bufferInput(inp);
    // paralysis / genjutsu override the state machine
    if ((this.st.para > 0 || this.st.genjutsu > 0) && !['dead', 'awaken', 'ult', 'down', 'getup', 'air'].includes(this.state)) {
      if (this.state !== 'stun') { this.cancelAction(); this.setState('stun'); this.stunT = Math.max(this.st.para, this.st.genjutsu); }
      this.stunT = Math.max(this.stunT, this.st.para, this.st.genjutsu);
    }
    this.think(dt, inp);
    this.physics(dt);
    this.envEffects(dt);
  }

  tickTimers(dt) {
    this.iframes = Math.max(0, this.iframes - dt);
    this.dodgeWindow = Math.max(0, this.dodgeWindow - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.spawnProt = Math.max(0, this.spawnProt - dt);
    this.dashCD = Math.max(0, this.dashCD - dt);
    this.counterBonus = Math.max(0, this.counterBonus - dt);
    this.comboShowT = Math.max(0, this.comboShowT - dt);
    for (const s of this.jutsu) if (s && s.cd > 0) s.cd = Math.max(0, s.cd - dt);
    if (this.dead) return;
    if (this.mount && this.state !== 'mount') this.dismount('knocked');
    // resources
    const m = this.mod;
    this.waterBoostT = Math.max(0, (this.waterBoostT || 0) - dt);
    // water users draw chakra from nearby water
    const waterRegen = this.affinity === 'water' && this.z < 20 && this.waterNearby() ? 1.6 : 1;
    this.chakra = Math.min(this.maxChakra, this.chakra + 3.2 * m.chakraRegen * waterRegen * dt);
    if (this.state !== 'block') {
      this.guardRegenDelay -= dt;
      if (this.guardRegenDelay <= 0) this.guard = Math.min(100, this.guard + 30 * dt);
    }
    this.sub = Math.min(100, this.sub + 7 * dt);
    if (this.kunai < 4) { this.kunaiRegen += dt; if (this.kunaiRegen >= 1.3) { this.kunaiRegen = 0; this.kunai++; } }
    if (!this.isClone) this.ult = Math.min(100, this.ult + 0.3 * dt);
    if (m.regen) this.heal(m.regen * this.maxHp * dt);
    if (m.hpDrain && this.hp > 1) this.hp = Math.max(1, this.hp - m.hpDrain * this.maxHp * dt);
    // combo counter decay
    if (this.comboHits && W.time - this.lastHitTime > 0.9 && !['hitstun', 'air', 'down'].includes(this.state)) { this.comboHits = 0; this.juggle = 0; }
    // statuses
    const st = this.st;
    if (st.burn > 0) {
      st.burn -= dt; st.burnTick += dt;
      if (Math.random() < dt * 14) FX.flame(this.x + U.rand(-0.2, 0.2), this.y + U.rand(-0.2, 0.2), this.z + U.rand(4, 20), 0.8);
      if (st.burnTick >= 0.5) {
        st.burnTick = 0;
        Combat.applyDamage(this, Math.max(1, Math.round(st.burnDps * 0.5)), st.burnSrc, { kind: 'dot', element: 'fire' });
      }
      if (st.burn <= 0) { st.burnDps = 0; st.burnSrc = null; }
    }
    if (st.wet > 0) { st.wet -= dt; if (Math.random() < dt * 5) FX.add({ x: this.x + U.rand(-0.2, 0.2), y: this.y + U.rand(-0.2, 0.2), z: this.z + U.rand(6, 22), vz: -20, g: 300, life: 0.5, color: '#8fcfff', size: 1 }); }
    if (st.para > 0) { st.para -= dt; if (Math.random() < dt * 20) FX.electric(this.x, this.y, this.z + U.rand(4, 24), 2); }
    st.paraResist = Math.max(0, st.paraResist - dt * 0.15);
    if (st.slow > 0) st.slow -= dt;
    if (st.root > 0) st.root -= dt;
    if (st.stealth > 0) st.stealth -= dt;
    if (st.genjutsu > 0) st.genjutsu -= dt;
    // buffs
    let changed = false;
    for (let n = this.buffs.length - 1; n >= 0; n--) {
      const b = this.buffs[n];
      b.t -= dt;
      if (b.tick) b.tick(this, dt, b);
      if (b.t <= 0) { if (b.end) b.end(this, b); this.buffs.splice(n, 1); changed = true; }
    }
    if (this.awakened) {
      const a = this.awakened;
      a.t -= dt;
      if (a.def.tick) a.def.tick(this, dt, a);
      if (a.t <= 0) { this.endAwakening(); changed = true; }
    }
    if (changed || Math.random() < dt * 4 || st.slow > 0 || st.wet > 0) this.computeMods();
    // clones expire
    if (this.isClone) { this.life -= dt; if (this.life <= 0) this.poof(); }
  }

  bufferInput(inp) {
    const order = [['ult', inp.ult], ['awaken', inp.awaken], ['dash', inp.dash], ['jump', inp.jump], ['j0', inp.j[0]], ['j1', inp.j[1]], ['j2', inp.j[2]], ['j3', inp.j[3]], ['heavy', inp.heavyPressed], ['light', inp.light], ['kunai', inp.kunai]];
    for (const [a, p] of order) if (p) { this.buf = { a, t: this.time }; break; }
    if (inp.block && !this.prevBlock) { this.blockGap = this.time - this.lastBlockPress; this.lastBlockPress = this.time; }
    this.prevBlock = inp.block;
  }
  peekBuf(a, win = 0.22) { return this.buf && this.buf.a === a && this.time - this.buf.t <= win; }
  takeBuf(a, win = 0.22) { if (this.peekBuf(a, win)) { this.buf = null; return true; } return false; }

  // ---- state machine -------------------------------------------------------------
  think(dt, inp) {
    switch (this.state) {
      case 'idle': case 'move': this.stNeutral(dt, inp); break;
      case 'attack': this.stAttack(dt, inp); break;
      case 'heavy': this.stHeavy(dt, inp); break;
      case 'dive': this.stDive(dt, inp); break;
      case 'dash': this.stDash(dt, inp); break;
      case 'block': this.stBlock(dt, inp); break;
      case 'cast': this.stCast(dt, inp); break;
      case 'channel': this.stChannel(dt, inp); break;
      case 'jdash': this.stJdash(dt, inp); break;
      case 'recover': this.stRecover(dt, inp); break;
      case 'throw': this.stThrow(dt, inp); break;
      case 'hitstun': this.stHitstun(dt, inp); break;
      case 'air': this.stAir(dt, inp); break;
      case 'down': this.stDown(dt, inp); break;
      case 'getup': if (this.stateT >= 0.28) this.setState('idle'); this.mvx = this.mvy = 0; break;
      case 'stun': this.stStun(dt, inp); break;
      case 'charge': this.stCharge(dt, inp); break;
      case 'awaken': this.stAwaken(dt, inp); break;
      case 'ult': this.stUlt(dt, inp); break;
      case 'victory': this.mvx = this.mvy = 0; break;
      case 'mount': this.stMount(dt, inp); break;
      default: this.setState('idle');
    }
  }

  // ---- summons: riding the Storm Hawk ---------------------------------------------
  // The rider hovers over everything; attack drops bombs on the aim point,
  // heavy dive-bombs and dismounts. The hawk's shield soaks incoming damage.
  mountUp(o) {
    this.cancelAction();
    this.mount = Object.assign({ type: 'hawk', t: 10, shield: 150, maxShield: 150, lift: 0, fireCD: 0.3, flap: 0, dmg: 26, bombR: 1.3 }, o);
    this.z = 0; this.vz = 0; this.vx = this.vy = 0;
    this.jumps = 0;
    this.setState('mount');
    FX.poof(this.x, this.y, 18);
    FX.ring(this.x, this.y, 0.4, '#9af0c8', 0.4, 8, 2);
    SFX.playAt('poof', this.x, this.y, 0.9);
    SFX.playAt('wind', this.x, this.y, 0.8);
  }

  visZ() { return this.mount ? this.z + this.mount.lift + Math.sin(this.time * 4) * 1.5 : this.z; }

  stMount(dt, inp) {
    const m = this.mount;
    if (!m) { this.setState('idle'); return; }
    m.t -= dt; m.fireCD -= dt; m.flap += dt * (Math.hypot(this.mvx, this.mvy) > 1 ? 9 : 6);
    m.lift = Math.min(34, m.lift + dt * 110);
    this.walk(inp, 1.55, 18);
    const moving = Math.hypot(inp.mx, inp.my) > 0.1;
    if (inp.ax !== null && inp.ax !== undefined) this.faceAim(this.isPlayer ? 0 : 10 * dt);
    else if (moving) this.facing = Math.atan2(inp.my, inp.mx);
    // wind wash under the wings
    if (Math.random() < dt * 10) FX.add({ x: this.x + U.rand(-0.8, 0.8), y: this.y + U.rand(-0.8, 0.8), z: 1, vx: U.rand(-1.5, 1.5), vy: U.rand(-1.5, 1.5), drag: 2, life: 0.5, color: ['#e8fff4', '#bfe8d8'], size: 1, layer: 0 });
    if (m.lift > 20 && (inp.light || inp.lightHeld) && m.fireCD <= 0) this.hawkBomb();
    if (this.tryUlt(inp)) return;
    if (inp.heavyPressed || this.takeBuf('heavy') || inp.jump) { this.dismount(inp.jump ? 'hop' : 'dive'); return; }
    if (m.t <= 0) this.dismount('expire');
  }

  hawkBomb() {
    const m = this.mount;
    m.fireCD = 0.3;
    const a = this.aimPoint(6.5, 0);
    const tx = a.x + U.rand(-0.2, 0.2), ty = a.y + U.rand(-0.2, 0.2);
    const ox = this.x, oy = this.y, oz = this.visZ() + 6, L = this.lvlOf('summonhawk'), me = this;
    SFX.playAt('kunai', this.x, this.y, 0.5);
    Combat.aoe({
      src: this, x: tx, y: ty, r: m.bombR, delay: 0.32, dmg: m.dmg * D(L), element: 'wind', noTelegraph: false,
      hit: { ability: 'summonhawk', knock: 3.5, stun: 0.4, launch: 90, blockDmg: 35 },
      draw(ctx, cam) {
        if (this.fired) return;
        const k = Math.min(1, this.t / this.delay);
        const x = U.lerp(ox, tx, k), y = U.lerp(oy, ty, k), z = oz * (1 - k * k);
        const [sx, sy] = DF.sp(x, y, z, cam);
        ctx.fillStyle = '#120a18'; PX.circle(ctx, sx, sy, 4);
        ctx.fillStyle = '#5fd0a0'; PX.circle(ctx, sx, sy, 3);
        ctx.fillStyle = '#e8fff4'; ctx.fillRect(sx - 1, sy - 2, 2, 2);
        // feather fins
        ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 1, sy - 6, 2, 3);
      },
      onFire() { FX.wind(tx, ty, 6, 10); FX.leaves(tx, ty, 8, 4); void me; },
    });
  }

  dismount(how) {
    const m = this.mount;
    if (!m) return;
    this.mount = null;
    const hz = Math.max(0, m.lift);
    FX.poof(this.x, this.y, 14);
    FX.leaves(this.x, this.y, hz + 10, 8);
    SFX.playAt('poof', this.x, this.y, 0.7);
    if (this.dead) return;
    if (how === 'dive') {
      // the hawk dive-bombs the aim point while you drop off
      const a = this.aimPoint(5, 0), L = this.lvlOf('summonhawk'), src = this;
      Combat.aoe({
        src, x: a.x, y: a.y, r: 2.2, delay: 0.3, dmg: 70 * D(L), element: 'wind',
        hit: { ability: 'summonhawk', knock: 7, launch: 200, stun: 0.6, blockDmg: 80 },
        draw(ctx, cam) {
          if (this.fired) return;
          const k = Math.min(1, this.t / this.delay);
          const [sx, sy] = DF.sp(U.lerp(src.x, a.x, k), U.lerp(src.y, a.y, k), 40 * (1 - k), cam);
          drawHawk(ctx, sx, sy, Math.atan2(a.y - src.y, a.x - src.x), 0.5, true);
        },
      });
    }
    this.z = hz; this.vz = how === 'hop' ? 160 : 40; this.jumps = 1;
    this.iframes = Math.max(this.iframes, 0.2);
    if (this.state === 'mount') this.setState('idle');
  }

  faceAim(rate) {
    const a = Math.atan2(this.aimY - this.y, this.aimX - this.x);
    if (Math.abs(this.aimX - this.x) + Math.abs(this.aimY - this.y) < 0.05) return;
    this.facing = rate ? U.turnToward(this.facing, a, rate) : a;
  }

  walk(inp, mult = 1, accel = 30) {
    let tx = inp.mx * this.moveSpeed() * mult, ty = inp.my * this.moveSpeed() * mult;
    if (this.st.root > 0) tx = ty = 0;
    const k = 1 - Math.exp(-accel * (1 / 60));
    this.mvx += (tx - this.mvx) * k * 2; this.mvy += (ty - this.mvy) * k * 2;
    if (Math.abs(this.mvx) < 0.01) this.mvx = 0;
    if (Math.abs(this.mvy) < 0.01) this.mvy = 0;
  }

  get airborne() { return this.z > 1 || this.vz > 0; }

  // Direction of the stick/keys relative to where we face (lock target / aim).
  inputDir(inp) {
    const m = Math.hypot(inp.mx, inp.my);
    if (m < 0.3) return 'neutral';
    const dot = (inp.mx * Math.cos(this.facing) + inp.my * Math.sin(this.facing)) / m;
    return dot > 0.45 ? 'forward' : dot < -0.45 ? 'back' : 'neutral';
  }

  tryJump(inp) {
    if (!(inp.jump || this.peekBuf('jump', 0.12))) return false;
    if (this.st.root > 0) return false;
    const grounded = this.z <= 0.5 && this.vz <= 0;
    if (grounded) { this.jumps = 1; this.vz = JUMP_V; this.z = Math.max(this.z, 0.6); FX.dust(this.x, this.y, 4); }
    else if ((this.jumps || 1) < 2) {
      this.jumps = 2; this.vz = DOUBLE_JUMP_V;
      FX.ring(this.x, this.y, 0.2, '#ffffff', 0.25, 3);
      FX.poof(this.x, this.y, 3);
    } else return false;
    this.takeBuf('jump', 0.12);
    SFX.playAt('dash', this.x, this.y, 0.4);
    return true;
  }

  stNeutral(dt, inp) {
    const air = this.airborne;
    if (this.tryUlt(inp) || this.tryAwaken(inp) || this.tryDash(inp) || this.tryJutsu(inp)) return;
    this.tryJump(inp);
    if (this.takeBuf('heavy') || inp.heavyPressed) { if (this.airborne) this.startDive(); else this.startHeavy(); return; }
    if (this.takeBuf('light')) {
      if (this.airborne) { this.startAttack(0, AIR_COMBO[0]); this.airStep = 0; return; }
      const seq = this.comboSeq();
      const resuming = this.time - (this.comboResumeT || -9) < 0.4 && this.comboResume < seq.length;
      const dir = this.inputDir(inp);
      if (!resuming && dir === 'forward') this.startAttack(0, SIDE_LIGHT);
      else if (!resuming && dir === 'back') this.startAttack(0, BACK_LIGHT);
      else this.startAttack(resuming ? this.comboResume : 0);
      return;
    }
    if (this.takeBuf('kunai')) { this.startThrow(); return; }
    if (!air && inp.block) { this.startBlock(); return; }
    if (!air && inp.charge && this.chakra < this.maxChakra) { this.setState('charge'); return; }
    this.walk(inp, air ? 0.9 : 1);
    const moving = Math.hypot(inp.mx, inp.my) > 0.1;
    if (inp.ax !== null && inp.ax !== undefined) this.faceAim(this.isPlayer ? 0 : 14 * dt);
    else if (moving) this.facing = Math.atan2(inp.my, inp.mx);
    const sp = Math.hypot(this.mvx, this.mvy);
    this.animT += dt * (0.4 + sp / 4.3) * 1.25;
    const st = sp > 0.4 ? 'move' : 'idle';
    // footfalls: a puff of dust (or a splash) each time a foot plants
    const rf = Math.floor(this.animT * 7) % 8;
    if (st === 'move' && !air && rf !== this.runFrame && (rf === 0 || rf === 4)) {
      const bx = this.x - Math.cos(this.facing) * 0.15, by = this.y - Math.sin(this.facing) * 0.15;
      if (W.arena.isWaterW(this.x, this.y)) FX.splash(bx, by, 3, 0.5);
      else if (sp > 3) FX.dust(bx, by, 2);
    }
    this.runFrame = rf;
    if (st !== this.state) { this.state = st; }
  }

  // Soft lock-on: turn toward a nearby enemy roughly in front.
  softLock(range = 2.4, arc = 1.25) {
    const L = this.lock;
    if (L && L.alive && U.dist(this.x, this.y, L.x, L.y) < range * 1.5) { this.facing = Math.atan2(L.y - this.y, L.x - this.x); return L; }
    let best = null, bd = range;
    for (const f of W.fighters) {
      if (!f.alive || !Combat.enemies(this, f) || f.st.stealth > 0) continue;
      const d = U.dist(this.x, this.y, f.x, f.y);
      if (d > bd) continue;
      const a = Math.atan2(f.y - this.y, f.x - this.x);
      if (Math.abs(U.angDiff(this.facing, a)) > arc) continue;
      bd = d; best = f;
    }
    if (best) this.facing = Math.atan2(best.y - this.y, best.x - this.x);
    return best;
  }

  startAttack(step, special) {
    const seq = this.comboSeq();
    this.comboStep = step;
    this.atk = special || COMBO[seq[step]];
    this.atkHit = new Set();
    this.atkQueued = false;
    this.atkConnected = false;
    this.atkBlocks = false;
    this.smeared = false;
    if (this.inp && this.inp.ax !== null) this.faceAim();
    this.lockTarget = this.softLock(this.atk.dashAttack ? 3 : 2.4);
    this.setState('attack');
    this.atkSpeed = this.mod.atkSpeed;
    SFX.playAt('swing', this.x, this.y, 0.5);
  }

  stAttack(dt, inp) {
    const a = this.atk;
    const t = this.stateT * this.atkSpeed;
    if (inp.light || this.peekBuf('light', 0.3)) this.atkQueued = true;
    // lunge (stop short of the target so we don't pass through)
    if (t < a.wind + a.act) {
      let lunge = a.lunge;
      if (lunge > 0 && this.lockTarget && U.dist(this.x, this.y, this.lockTarget.x, this.lockTarget.y) < 0.75) lunge *= 0.1;
      this.mvx = Math.cos(this.facing) * lunge; this.mvy = Math.sin(this.facing) * lunge;
      if (a.air) this.vz = Math.max(this.vz, a.spike ? -80 : 40); // hang in the air while striking
      else if (Math.random() < 0.5) FX.dust(this.x, this.y, 1);
    } else { this.mvx *= 0.6; this.mvy *= 0.6; }
    if (t >= a.wind && !this.smeared) { this.smeared = true; this.strikeSmear(a.pose, a.range); }
    if (t >= a.wind && t < a.wind + a.act + 0.02) this.meleeCheck(a);
    const endAct = a.wind + a.act;
    if (t >= endAct) {
      if (this.tryDash(inp)) return;
      // jump-cancel a connected hit into an air string
      if ((this.atkConnected || t > endAct + 0.1) && this.tryJump(inp)) { this.setState('idle'); return; }
      if (a.air && !a.finisher && this.atkQueued && t >= endAct + 0.02 && this.airborne) {
        this.takeBuf('light', 0.3);
        this.airStep = (this.airStep || 0) + 1;
        this.startAttack(0, AIR_COMBO[Math.min(this.airStep, AIR_COMBO.length - 1)]);
        return;
      }
      if (a.air && (inp.heavyPressed || this.peekBuf('heavy')) && this.airborne) { this.takeBuf('heavy'); this.startDive(); return; }
      if ((a.side || a.back) && this.atkQueued && t >= endAct + 0.03) { this.takeBuf('light', 0.3); this.startAttack(1); return; }
      if (this.atkConnected || t > endAct + 0.08) { if (this.tryJutsu(inp)) return; if (this.tryUlt(inp)) return; }
      const seq = this.comboSeq();
      // air chase: after the launcher, press attack again to leap after them (Taijutsu Lv4+)
      if (a.finisher && this.taiLvl() >= 4 && this.atkConnected && this.atkQueued && t >= endAct + 0.08) {
        const tgt = this.lastComboTarget;
        if (tgt && tgt.alive && tgt.z > 6 && U.dist(this.x, this.y, tgt.x, tgt.y) < 3.5) { this.startChase(tgt); return; }
      }
      if (this.atkQueued && !a.finisher && !a.chase && t >= endAct + 0.03) {
        if (a.dashAttack) { this.takeBuf('light', 0.3); this.startAttack(0); return; }
        if (this.comboStep < seq.length - 1) { this.takeBuf('light', 0.3); this.startAttack(this.comboStep + 1); return; }
      }
      if (inp.heavyPressed && !a.air) { this.startHeavy(); return; }
    }
    if (t >= endAct + a.rec) {
      this.comboResumeT = this.time;
      this.comboResume = a.finisher || a.chase || a.air ? 99 : a.dashAttack ? 0 : (a.side || a.back) ? 1 : this.comboStep + 1;
      this.setState('idle');
    }
  }

  // Motion smear matching the strike's shape.
  strikeSmear(pose, range = 1.2) {
    const el = this.mod.meleeElement && ELEMENTS[this.mod.meleeElement];
    const o = { reach: range * 0.95, color: el ? el.light : '#ffffff', edge: el ? el.color : '#a8c8ff' };
    switch (pose) {
      case 'jab': case 'cross': case 'airpunch': case 'palm': Object.assign(o, { kind: 'thrust', z: 18, reach: range * 0.8 }); break;
      case 'lunge': Object.assign(o, { kind: 'thrust', z: 17, reach: range * 1.2, life: 0.16 }); break;
      case 'kick': case 'airkick': Object.assign(o, { arc: 1.5, z: 20, rise: 10 }); break;
      case 'sweep': Object.assign(o, { arc: 2.6, z: 3, reach: range * 1.05, life: 0.16 }); break;
      case 'uppercut': Object.assign(o, { arc: 0.7, z: 14, rise: -26, reach: range * 0.7 }); break;
      case 'slam': case 'dive': Object.assign(o, { arc: 1.2, z: 22, rise: 24, reach: range * 0.8 }); break;
      case 'spin': Object.assign(o, { arc: TAU * 0.9, z: 16, life: 0.2, dir: this.flip ? -1 : 1 }); break;
      default: Object.assign(o, { arc: 1.4 });
    }
    FX.smear(this, o);
  }

  // Air heavy: plunge down at an angle, spiking anyone in the way, then
  // shock-wave on landing.
  startDive() {
    this.cancelAction();
    this.setState('dive');
    this.diveHit = new Set();
    if (this.inp && this.inp.ax !== null) this.faceAim();
    this.softLock(4);
    this.vz = Math.min(this.vz, 60);
    SFX.playAt('swing', this.x, this.y, 0.9);
  }

  stDive(dt) {
    if (this.stateT > 0.08) this.vz = Math.min(this.vz, -560);
    this.mvx = Math.cos(this.facing) * 6.5; this.mvy = Math.sin(this.facing) * 6.5;
    FX.add({ x: this.x, y: this.y, z: this.z + 10, life: 0.2, color: ['#ffffff', '#fff2c0'], size: 2, kind: 'glow', add: true });
    for (const f of W.fighters) {
      if (!f.alive || this.diveHit.has(f) || !Combat.enemies(this, f)) continue;
      if (U.dist(this.x, this.y, f.x, f.y) > 0.9 + f.radius || Math.abs(f.z - this.z) > 34) continue;
      this.diveHit.add(f);
      Combat.hit(f, { src: this, kind: 'melee', dmg: 26 * (1 + 0.08 * (this.taiLvl() - 1)), knock: 2, spike: true, stun: 0.6, ability: 'taijutsu', guardDmg: 45, element: this.mod.meleeElement });
    }
    if (this.stateT > 1.2) this.setState('idle');
  }

  landDive() {
    const r = 1.5;
    FX.ring(this.x, this.y, 0.3, '#ffe9b0', 0.35, 6, 2);
    FX.dust(this.x, this.y, 12);
    W.arena.addStain(this.x, this.y, 0.55, 'crater');
    W.shakeAt(this.x, this.y, 5);
    SFX.playAt('hitHeavy', this.x, this.y, 0.8);
    for (const f of Combat.enemiesInRadius(this, this.x, this.y, r)) {
      if (f.z > 20) continue;
      const [nx, ny] = U.norm(f.x - this.x, f.y - this.y);
      Combat.hit(f, { src: this, kind: 'aoe', dmg: 30, knock: 5, launch: 190, stun: 0.6, dirX: nx, dirY: ny, ability: 'taijutsu', sx: this.x, sy: this.y });
    }
    W.arena.damageRadius(this.x, this.y, r, 35, null, this);
    this.recoverT = 0.28; this.recoverPose = 'slam';
    this.setState('recover');
  }

  meleeCheck(a) {
    const reach = a.range * this.mod.reach;
    const arc = a.arc * this.mod.arcMult;
    for (const f of W.fighters) {
      if (!f.alive || this.atkHit.has(f) || !Combat.enemies(this, f)) continue;
      const d = U.dist(this.x, this.y, f.x, f.y);
      if (d > reach + f.radius) continue;
      const ang = Math.atan2(f.y - this.y, f.x - this.x);
      if (d > 0.35 && Math.abs(U.angDiff(this.facing, ang)) > arc) continue;
      const dz = f.z - this.z;
      if (dz > 46 || dz < (a.air ? -72 : -46)) continue;
      this.atkHit.add(f);
      const taiL = this.taiLvl();
      const res = Combat.hit(f, {
        src: this, dmg: a.dmg * (1 + 0.08 * (taiL - 1)), kind: 'melee', element: this.mod.meleeElement,
        knock: a.knock, launch: a.launch, spike: a.spike, stun: a.stun, ability: 'taijutsu',
        guardDmg: a.dmg * 1.2, status: this.mod.meleeStatus,
      });
      if (res === 'hit') {
        this.atkConnected = true;
        this.chakra = Math.min(this.maxChakra, this.chakra + 2.5);
        if (this.mod.meleeFx) this.mod.meleeFx(this, f);
      }
      if (res === 'parry') return;
    }
    if (!this.atkBlocks) {
      this.atkBlocks = true;
      Combat.coneBlocks(this.x, this.y, this.facing, reach * 0.9, arc, a.dmg * 0.7 * this.mod.meleeDmg, this.mod.meleeElement, this);
    }
  }

  startChase(tgt) {
    // leap to the airborne target and slam them into the ground
    FX.afterimage(this.spriteCanvas(), this.x, this.y, this.z, this.flip, 0.25);
    const a = Math.atan2(tgt.y - this.y, tgt.x - this.x);
    this.x = tgt.x - Math.cos(a) * 0.5; this.y = tgt.y - Math.sin(a) * 0.5;
    W.arena.resolveCircle(this, this.radius);
    this.z = Math.max(0, tgt.z - 4); this.vz = 60;
    this.facing = a;
    SFX.playAt('dash', this.x, this.y);
    this.startAttack(0, Object.assign({}, CHASE_SLAM, { chase: true }));
  }

  startHeavy() {
    this.setState('heavy');
    this.heavyCharge = 0; this.heavyReleased = false; this.heavyDone = false; this.heavyT = 0;
    this.mvx *= 0.3; this.mvy *= 0.3;
  }

  stHeavy(dt, inp) {
    if (!this.heavyReleased) {
      this.faceAim(this.isPlayer ? 0 : 10 * dt);
      this.walk(inp, 0.25);
      const prev = this.heavyCharge;
      this.heavyCharge = U.clamp((this.stateT - 0.12) / 0.65, 0, 1);
      if (this.heavyCharge >= 1 && prev < 1) { FX.glow(this.x, this.y, 16, 6, '#ffffff', 0.12); SFX.playAt('charge', this.x, this.y, 0.5); }
      if (Math.random() < dt * 20 * this.heavyCharge) FX.chakra(this.x, this.y, 1, ['#ffffff', '#fff2c0', '#ffd080']);
      if (this.tryDash(inp)) return;
      if ((!inp.heavy && this.stateT >= 0.16) || this.stateT >= 1.1) {
        this.heavyReleased = true;
        this.heavyT = 0;
        this.heavyKind = this.inputDir(inp); // signature depends on direction held at release
        this.softLock(this.heavyKind === 'forward' ? 4.5 : 2.4);
        this.heavyHit = new Set();
        SFX.playAt('swing', this.x, this.y, 0.9);
        if (this.heavyKind === 'back') { this.strikeSmear('spin', 1.5); FX.smear(this, { arc: TAU * 0.9, z: 8, reach: 1.4, life: 0.35, dir: -1, color: '#e8f0ff' }); }
        else this.strikeSmear(this.heavyKind === 'forward' ? 'lunge' : 'uppercut', 1.4);
      }
      return;
    }
    this.heavyT += dt;
    const c = this.heavyCharge;
    const taiL = this.taiLvl();
    const tk = 1 + 0.08 * (taiL - 1);
    if (this.heavyKind === 'forward') {
      // Signature: rocket punch that carries through everyone in its path
      if (this.heavyT < 0.24) {
        const sp = 11 + c * 4;
        this.mvx = Math.cos(this.facing) * sp; this.mvy = Math.sin(this.facing) * sp;
        FX.afterimage(this.spriteCanvas(), this.x, this.y, this.z, this.flip, 0.18, 0.35);
        for (const f of W.fighters) {
          if (!f.alive || this.heavyHit.has(f) || !Combat.enemies(this, f) || Math.abs(f.z - this.z) > 40) continue;
          if (U.dist(this.x, this.y, f.x, f.y) > 0.8 + f.radius) continue;
          this.heavyHit.add(f);
          Combat.hit(f, { src: this, kind: 'melee', dmg: (30 + 45 * c) * tk, knock: 8 + 6 * c, stun: 0.6 + 0.2 * c, guardDmg: 50 + 70 * c, guardBreak: c >= 0.99, ability: 'taijutsu', element: this.mod.meleeElement, dirX: Math.cos(this.facing), dirY: Math.sin(this.facing) });
        }
        const pb = W.arena.pointBlocked(this.x + Math.cos(this.facing) * 0.6, this.y + Math.sin(this.facing) * 0.6, 10);
        if (pb && pb.b) W.arena.damageBlock(pb.b.i, pb.b.j, 40 + 60 * c, this.mod.meleeElement, this);
      } else { this.mvx *= 0.6; this.mvy *= 0.6; }
      if (this.heavyT > 0.24 + 0.3) this.setState('idle');
      return;
    }
    if (this.heavyKind === 'back') {
      // Signature: two-hit cyclone kick all around you
      this.mvx *= 0.8; this.mvy *= 0.8;
      for (const hitAt of [0.05, 0.2]) {
        if (this.heavyT >= hitAt && this.heavyT - dt < hitAt) {
          for (const f of Combat.enemiesInRadius(this, this.x, this.y, 1.55 * this.mod.reach)) {
            if (Math.abs(f.z - this.z) > 44) continue;
            const [nx, ny] = U.norm(f.x - this.x, f.y - this.y);
            Combat.hit(f, { src: this, kind: 'melee', dmg: (18 + 26 * c) * tk, knock: hitAt > 0.1 ? 6 + 5 * c : 1, launch: hitAt > 0.1 ? 140 : 0, stun: 0.5, dirX: nx, dirY: ny, guardDmg: 40 + 40 * c, ability: 'taijutsu', element: this.mod.meleeElement });
          }
          FX.ring(this.x, this.y, 0.3, '#ffffff', 0.25, 5);
          FX.wind(this.x, this.y, 12, 6);
          Combat.coneBlocks(this.x, this.y, this.facing, 1.5, Math.PI, 20 + 40 * c, null, this);
        }
      }
      if (this.heavyT > 0.55) this.setState('idle');
      return;
    }
    if (this.heavyT < 0.1) { this.mvx = Math.cos(this.facing) * (4 + c * 3); this.mvy = Math.sin(this.facing) * (4 + c * 3); }
    else { this.mvx *= 0.7; this.mvy *= 0.7; }
    if (this.heavyT >= 0.05 && !this.heavyDone) {
      this.heavyDone = true;
      const taiL = this.taiLvl();
      const reach = 1.35 * this.mod.reach, arc = 1.1 * this.mod.arcMult;
      Combat.cone(this, this.x, this.y, this.facing, reach, arc, {
        kind: 'melee', dmg: (32 + 48 * c) * tk, knock: 3 + 4 * c, launch: 230 + 130 * c,
        stun: 0.5 + 0.3 * c, guardDmg: 45 + 80 * c, guardBreak: c >= 0.99, unblockable: taiL >= 5 && c >= 0.99,
        ability: 'taijutsu', element: this.mod.meleeElement, status: this.mod.meleeStatus,
      }, (f) => f.z - this.z < 46);
      Combat.coneBlocks(this.x, this.y, this.facing, reach, arc, 30 + 70 * c, this.mod.meleeElement, this);
      FX.ring(this.x + Math.cos(this.facing) * 0.8, this.y + Math.sin(this.facing) * 0.8, 0.2, '#ffffff', 0.2, 5);
      if (c > 0.8) W.shakeAt(this.x, this.y, 3);
    }
    if (this.heavyT > 0.1 + 0.32) this.setState('idle');
  }

  tryDash(inp) {
    if (!(inp.dash || this.peekBuf('dash', 0.15))) return false;
    if (this.dashCD > 0 || this.st.root > 0) return false;
    this.takeBuf('dash', 0.15);
    let dx = inp.mx, dy = inp.my;
    if (Math.hypot(dx, dy) < 0.1) { dx = Math.cos(this.facing); dy = Math.sin(this.facing); }
    [dx, dy] = U.norm(dx, dy);
    this.cancelAction();
    this.dashDir = [dx, dy];
    this.iframes = 0.2; this.dodgeWindow = 0.2;
    this.dashCD = 0.48 * this.mod.dashCD;
    this.setState('dash');
    this.afterT = 0;
    SFX.playAt('dash', this.x, this.y, 0.6);
    FX.dust(this.x, this.y, 4);
    if (this.mod.dashFx) this.mod.dashFx(this);
    return true;
  }

  stDash(dt, inp) {
    const k = this.stateT / 0.22;
    const sp = 13 * (1 - k * 0.45) * (this.mod.dashSpeed || 1);
    this.mvx = this.dashDir[0] * sp; this.mvy = this.dashDir[1] * sp;
    this.afterT += dt;
    if (this.afterT > 0.035) { this.afterT = 0; FX.afterimage(this.spriteCanvas(), this.x, this.y, this.z, this.flip, 0.2, 0.4); }
    if (this.mod.dashHit) this.mod.dashHit(this, dt);
    if ((inp.light || this.peekBuf('light')) && this.stateT > 0.05) {
      this.takeBuf('light');
      this.facing = Math.atan2(this.dashDir[1], this.dashDir[0]);
      if (this.inp.ax !== null) this.faceAim();
      this.startAttack(0, DASH_ATTACK);
      return;
    }
    if (this.stateT >= 0.22) {
      this.mvx *= 0.45; this.mvy *= 0.45;
      this.setState('idle');
    }
  }

  startBlock() {
    this.setState('block');
    this.blockStart = W.time;
    this.mvx *= 0.3; this.mvy *= 0.3;
  }

  stBlock(dt, inp) {
    if (!inp.block) { this.setState('idle'); return; }
    this.faceAim(this.isPlayer ? 0 : 12 * dt);
    this.walk(inp, 0.3);
    this.guard = Math.max(0, this.guard - 3 * dt);
    this.guardRegenDelay = 0.6;
    if (this.tryDash(inp)) return;
    if (this.tryUlt(inp)) return;
  }

  onParry(src, h) {
    this.parries++;
    SFX.playAt('parry', this.x, this.y, 1);
    FX.spark(this.x + Math.cos(this.facing) * 0.35, this.y + Math.sin(this.facing) * 0.35, 16, ['#ffffff', '#ffe14a', '#ffb020'], 14, 7);
    FX.glow(this.x, this.y, 16, 7, '#fff6b0', 0.15);
    FX.text(this.x, this.y, this.z + 40, 'PARRY!', '#ffe14a', { scale: 1, life: 0.8 });
    if (!this.awakened) this.awak = Math.min(100, this.awak + 10);
    this.ult = Math.min(100, this.ult + 4);
    this.chakra = Math.min(this.maxChakra, this.chakra + 10);
    this.guard = Math.min(100, this.guard + 20);
    this.gainXP(20);
    this.freeze = Math.max(this.freeze, 0.08);
    this.counterBonus = 1.2;
    if (src && h.kind === 'melee') {
      src.cancelAction();
      src.setState('stun'); src.stunT = 0.85; src.freeze = Math.max(src.freeze, 0.08);
      src.mvx = src.mvy = 0;
    }
    if (W.isWatched(this) || W.isWatched(src)) W.slowmo(0.35, 0.25);
  }

  guardBreak() {
    this.cancelAction();
    this.setState('stun');
    this.stunT = 1.1;
    this.guard = 45;
    this.guardRegenDelay = 1.5;
    FX.text(this.x, this.y, this.z + 40, 'GUARD BREAK', '#ff6a6a', { life: 1 });
    FX.spark(this.x, this.y, 16, ['#ffffff', '#ff8a8a', '#ff4a4a'], 12, 6);
    SFX.playAt('guardBreak', this.x, this.y);
  }

  perfectDodge(src) {
    this.dodgeWindow = 0;
    this.counterBonus = 1.2;
    this.chakra = Math.min(this.maxChakra, this.chakra + 12);
    if (!this.awakened) this.awak = Math.min(100, this.awak + 6);
    this.gainXP(10);
    FX.text(this.x, this.y, this.z + 40, 'PERFECT DODGE', '#9af0ff', { life: 0.8 });
    FX.afterimage(this.spriteCanvas(), this.x, this.y, this.z, this.flip, 0.5, 0.8);
    if (W.isWatched(this)) W.slowmo(0.4, 0.2);
  }

  // ---- jutsu -------------------------------------------------------------------------
  tryJutsu(inp) {
    for (let i = 0; i < 4; i++) {
      if (!(inp.j[i] || this.peekBuf('j' + i))) continue;
      const s = this.jutsu[i];
      if (!s) continue;
      if (s.cd > 0) { if (inp.j[i] && this.isPlayer) SFX.play('tick', 0.6); this.takeBuf('j' + i); continue; }
      const cost = this.costFor(s);
      if (this.chakra < cost) {
        if (inp.j[i] && this.isPlayer) { FX.text(this.x, this.y, this.z + 38, 'LOW CHAKRA', '#8fb8ff', { life: 0.6 }); SFX.play('tick', 0.6); }
        this.takeBuf('j' + i);
        continue;
      }
      this.takeBuf('j' + i);
      this.startCast(i);
      return true;
    }
    return false;
  }

  startCast(i) {
    this.cancelAction();
    this.castSlot = i;
    this.castDone = false;
    const def = this.jutsu[i].def;
    this.castTime = (def.cast !== undefined ? def.cast : 0.25) * this.mod.castSpeed;
    this.setState('cast');
    this.mvx *= 0.2; this.mvy *= 0.2;
    SFX.playAt('seal', this.x, this.y, 0.6);
    FX.chakra(this.x, this.y, 4, FX.ELEM_COLORS[def.element]);
  }

  stCast(dt, inp) {
    this.faceAim(this.isPlayer ? 0 : 16 * dt);
    this.mvx *= 0.8; this.mvy *= 0.8;
    if (Math.random() < dt * 25) FX.chakra(this.x, this.y, 1, FX.ELEM_COLORS[this.jutsu[this.castSlot].def.element]);
    if (this.stateT >= this.castTime && !this.castDone) {
      this.castDone = true;
      const s = this.jutsu[this.castSlot];
      this.chakra -= this.costFor(s);
      s.cd = this.cooldownFor(s);
      this.masteryXP(s.id, 8);
      this.recoverT = s.def.recover !== undefined ? s.def.recover : 0.22;
      this.recoverPose = s.def.pose || 'release';
      this.lastJutsu = s.id;
      this.jutsuUses = (this.jutsuUses || 0) + 1;
      // anime-style callout of the technique name
      const cam = W.camTarget;
      if (!this.isClone && (W.isWatched(this) || (cam && U.dist(cam.x, cam.y, this.x, this.y) < 8))) {
        FX.text(this.x, this.y, this.z + 58, s.def.name.toUpperCase() + '!', (ELEMENTS[s.def.element] || ELEMENTS.shinobi).light, { life: 0.75, vz: 12 });
      }
      this.lastCastWater = s.def.element === 'water';
      if (this.lastCastWater && this.waterNearby()) {
        this.waterBoostT = 2.2;
        FX.text(this.x, this.y, this.z + 46, 'WATER BOOST', '#9ad4ff', { life: 0.8, vz: 20 });
        FX.splash(this.x, this.y, 18, 1.4);
        FX.ring(this.x, this.y, 0.4, '#9ad4ff', 0.4, 7, 2);
        for (let k = 0; k < 10; k++) {
          const a = U.rand(0, TAU);
          FX.add({ x: this.x + Math.cos(a) * 1.2, y: this.y + Math.sin(a) * 1.2, z: 0, vx: -Math.cos(a) * 2.4, vy: -Math.sin(a) * 2.4, vz: U.rand(60, 120), g: 260, life: 0.5, color: ['#e8f6ff', '#9ad4ff', '#3fa0ff'], size: 2 });
        }
      }
      s.def.use(this, this.lvlOf(s.id), this.aim());
      if (this.state === 'cast') this.setState('recover');
    }
  }

  stRecover(dt, inp) {
    this.mvx *= 0.75; this.mvy *= 0.75;
    if (this.stateT > 0.08 && this.tryDash(inp)) return;
    if (this.stateT >= (this.recoverT || 0.2)) this.setState('idle');
  }

  startChannel(o) {
    this.channel = o;
    this.setState('channel');
  }

  stChannel(dt, inp) {
    const c = this.channel;
    if (!c) { this.setState('idle'); return; }
    this.faceAim(c.turn !== undefined ? c.turn * dt : 0);
    this.walk(inp, c.move || 0);
    if (c.tick) c.tick(this, dt, c);
    if (this.state !== 'channel') return;
    if (c.dashCancel && this.stateT > 0.15 && this.tryDash(inp)) return;
    if (this.stateT >= c.dur) {
      this.channel = null;
      if (c.end) c.end(this, c);
      if (this.state === 'channel') { this.recoverT = c.recover || 0.2; this.setState('recover'); }
    }
  }

  startJdash(o) {
    this.jd = Object.assign({ speed: 10, dur: 0.3, radius: 0.6, hitSet: new Set(), stopOnHit: false }, o);
    [this.jd.dx, this.jd.dy] = U.norm(o.dx !== undefined ? o.dx : Math.cos(this.facing), o.dy !== undefined ? o.dy : Math.sin(this.facing));
    this.facing = Math.atan2(this.jd.dy, this.jd.dx);
    if (o.iframes) this.iframes = Math.max(this.iframes, o.iframes);
    this.setState('jdash');
  }

  stJdash(dt) {
    const j = this.jd;
    this.mvx = j.dx * j.speed; this.mvy = j.dy * j.speed;
    if (j.trail) j.trail(this, dt, j);
    this.afterT += dt;
    if (this.afterT > 0.04 && j.afterimage !== false) { this.afterT = 0; FX.afterimage(this.spriteCanvas(), this.x, this.y, this.z, this.flip, 0.18, 0.35); }
    for (const f of W.fighters) {
      if (!f.alive || j.hitSet.has(f) || !Combat.enemies(this, f)) continue;
      if (U.dist(this.x, this.y, f.x, f.y) > j.radius + f.radius) continue;
      j.hitSet.add(f);
      const res = j.hit ? Combat.hit(f, Object.assign({ src: this, kind: 'melee', dirX: j.dx, dirY: j.dy }, j.hit)) : 'hit';
      if (res === 'parry') { this.jd = null; return; }
      if (j.onHit) j.onHit(this, f, res, j);
      if (this.state !== 'jdash') return;
      if (j.stopOnHit && res !== 'dodge') { this.endJdash(true); return; }
    }
    if (j.blockDmg) {
      const bx = this.x + j.dx * 0.6, by = this.y + j.dy * 0.6;
      const pb = W.arena.pointBlocked(bx, by, 10);
      if (pb && pb.b) W.arena.damageBlock(pb.b.i, pb.b.j, j.blockDmg * dt * 10, j.hit && j.hit.element, this);
    }
    if (this.stateT >= j.dur || this._wallHit) this.endJdash(false);
  }

  endJdash(hit) {
    const j = this.jd;
    this.jd = null;
    this.mvx *= 0.2; this.mvy *= 0.2;
    if (j && j.onEnd) j.onEnd(this, hit, j);
    if (this.state === 'jdash') { this.recoverT = j && j.recover !== undefined ? j.recover : 0.18; this.setState('recover'); }
  }

  // ---- kunai --------------------------------------------------------------------------
  startThrow() {
    if (this.kunai < 1) { if (this.isPlayer) SFX.play('tick', 0.5); return; }
    this.setState('throw');
    this.thrown = false;
    if (this.inp && this.inp.ax !== null) this.faceAim();
  }
  // Tap = kunai. Hold = charge a big piercing shuriken (costs 2 ammo).
  stThrow(dt, inp) {
    this.walk(inp, this.airborne ? 0.9 : 0.5);
    if (!this.thrown) {
      this.faceAim(this.isPlayer ? 0 : 12 * dt);
      const charging = inp.kunaiHeld && this.stateT < 0.7 && this.kunai >= 2;
      if (charging) {
        if (this.stateT > 0.28 && Math.random() < 0.5) FX.spark(this.x + Math.cos(this.facing) * 0.3, this.y + Math.sin(this.facing) * 0.3, this.z + 18, ['#ffffff', '#cfd6e2'], 1, 2);
        return;
      }
      this.thrown = true;
      this.throwAt = this.stateT;
      const big = this.stateT >= 0.28 && this.kunai >= 2;
      this.kunai -= big ? 2 : 1;
      const a = this.facing;
      const z = 14 + this.z;
      const t = this.lock && this.lock.alive ? this.lock : null;
      const dist = t ? Math.max(1.5, U.dist(this.x, this.y, t.x, t.y)) : 5;
      const sp = big ? 15 : 17;
      const o = {
        src: this, x: this.x + Math.cos(a) * 0.3, y: this.y + Math.sin(a) * 0.3, z,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, explodeOnExpire: false, ability: 'kunai',
      };
      if (this.z > 4) { o.gravity = 1; o.vz = -(this.z - (t ? t.z : 0)) * sp / dist; } // aim down from the air
      if (big) Object.assign(o, { kind: 'shuriken', size: 6, radius: 0.42, life: 0.8, dmg: 30, knock: 5.5, stun: 0.5, pierce: 2, clash: 1.5, blockDmg: 40, sfx: 'hitHeavy' });
      else Object.assign(o, { kind: 'kunai', size: 2, radius: 0.22, life: 0.62, dmg: 12, knock: 1.2, stun: 0.24, clash: 0.5, blockDmg: 4, sfx: 'hit' });
      Combat.projectile(o);
      SFX.playAt(big ? 'wind' : 'kunai', this.x, this.y, 0.6);
      return;
    }
    if (this.stateT - this.throwAt > 0.05 && this.tryDash(inp)) return;
    if (this.stateT - this.throwAt >= 0.14) this.setState('idle');
  }

  // ---- charging chakra ------------------------------------------------------------------
  stCharge(dt, inp) {
    this.mvx *= 0.7; this.mvy *= 0.7;
    if (!inp.charge || this.chakra >= this.maxChakra) { this.setState('idle'); return; }
    this.chakra = Math.min(this.maxChakra, this.chakra + 30 * dt);
    FX.aura(this.x, this.y, FX.ELEM_COLORS[this.affinity] || FX.ELEM_COLORS.shinobi, 2, 30, 0.35);
    if (Math.random() < dt * 4) FX.ring(this.x, this.y, 0.2, (ELEMENTS[this.affinity] || ELEMENTS.shinobi).color, 0.4, 3);
    this.chargeSfx = (this.chargeSfx || 0) + dt;
    if (this.chargeSfx > 0.35) { this.chargeSfx = 0; SFX.playAt('charge', this.x, this.y, 0.5); }
    if (this.tryDash(inp)) return;
  }

  // ---- awakening & ultimate ------------------------------------------------------------
  tryAwaken(inp) {
    if (!(inp.awaken || this.peekBuf('awaken'))) return false;
    if (!this.awakening || this.awakened || this.awak < 100) { if (inp.awaken && this.isPlayer) SFX.play('tick', 0.5); this.takeBuf('awaken'); return false; }
    this.takeBuf('awaken');
    this.cancelAction();
    this.setState('awaken');
    this.invuln = 0.9;
    SFX.playAt('awaken', this.x, this.y, 1);
    const col = this.awakening.colors;
    FX.ring(this.x, this.y, 0.3, col[1], 0.5, 7, 2);
    FX.glow(this.x, this.y, 16, 14, col[0], 0.3);
    for (const f of Combat.enemiesInRadius(this, this.x, this.y, 2.6)) {
      const [nx, ny] = U.norm(f.x - this.x, f.y - this.y);
      Combat.hit(f, { src: this, dmg: 25, kind: 'aoe', knock: 8, launch: 120, stun: 0.5, dirX: nx, dirY: ny, unblockable: true });
    }
    W.shakeAt(this.x, this.y, 6);
    if (W.onAwaken) W.onAwaken(this);
    return true;
  }

  stAwaken(dt) {
    this.mvx = this.mvy = 0;
    const col = this.awakening.colors;
    FX.aura(this.x, this.y, col, 5, 40, 0.5);
    if (this.stateT >= 0.8) {
      this.awak = 0;
      this.awakened = { def: this.awakening, t: this.awakening.dur };
      if (this.awakening.start) this.awakening.start(this);
      this.computeMods();
      this.setState('idle');
    }
  }

  endAwakening() {
    if (!this.awakened) return;
    const d = this.awakened.def;
    this.awakened = null;
    if (d.end) d.end(this);
    this.computeMods();
    FX.poof(this.x, this.y, 6);
  }

  tryUlt(inp) {
    if (!(inp.ult || this.peekBuf('ult'))) return false;
    if (!this.ultimate || this.ult < 100) { if (inp.ult && this.isPlayer) SFX.play('tick', 0.5); this.takeBuf('ult'); return false; }
    this.takeBuf('ult');
    this.cancelAction();
    this.ult = 0;
    this.faceAim();
    this.ultAim = this.aim();
    this.ultDone = false;
    this.setState('ult');
    this.invuln = this.ultimate.windup + 0.1;
    this.mvx = this.mvy = 0;
    SFX.playAt('ult', this.x, this.y, 1);
    if (W.onUltimate) W.onUltimate(this);
    return true;
  }

  stUlt(dt, inp) {
    this.faceAim(this.isPlayer ? 0 : 8 * dt);
    this.mvx = this.mvy = 0;
    const u = this.ultimate;
    FX.aura(this.x, this.y, u.colors, 3, 36, 0.4);
    if (this.stateT >= u.windup && !this.ultDone) {
      this.ultDone = true;
      this.recoverT = u.recover !== undefined ? u.recover : 0.4;
      this.lastJutsu = u.id;
      u.use(this, this.lvlOf(u.id), this.aim());
      this.masteryXP(u.id, 60);
      if (this.state === 'ult') this.setState('recover');
    }
  }

  // ---- getting hit -----------------------------------------------------------------------
  cancelAction() {
    if (this.state === 'channel' && this.channel) {
      const c = this.channel;
      this.channel = null;
      if (c.cancel) c.cancel(this, c); else if (c.end) c.end(this, c);
    }
    if (this.state === 'jdash' && this.jd) {
      const j = this.jd; this.jd = null;
      if (j.onEnd) j.onEnd(this, false, j);
    }
  }

  enterHitstun(t) {
    if (this.dead) return;
    this.cancelAction();
    this.stunT = t;
    this.hurtFrame ^= 1;
    this.mvx = this.mvy = 0;
    if (this.z > 0.5 || this.vz > 0) { this.setState('air'); this.maxAirZ = this.z; }
    else this.setState('hitstun');
  }

  canSubstitute() { return this.sub >= 50 && !this.isClone; }

  stHitstun(dt, inp) {
    this.mvx = this.mvy = 0;
    if ((inp.dash || this.peekBuf('dash', 0.1)) && this.canSubstitute() && this.stateT > 0.05) { this.takeBuf('dash'); this.substitute(); return; }
    if (this.stateT >= this.stunT) this.setState('idle');
  }

  stAir(dt, inp) {
    this.mvx = this.mvy = 0;
    this.maxAirZ = Math.max(this.maxAirZ || 0, this.z);
    if ((inp.dash || this.peekBuf('dash', 0.1)) && this.canSubstitute() && this.stateT > 0.05) { this.takeBuf('dash'); this.substitute(); return; }
  }

  stDown(dt, inp) {
    this.mvx = this.mvy = 0;
    if ((inp.dash || this.peekBuf('dash', 0.15)) && this.stateT > 0.15) {
      // tech roll
      this.takeBuf('dash');
      let dx = inp.mx, dy = inp.my;
      if (Math.hypot(dx, dy) < 0.1) { dx = -Math.cos(this.facing); dy = -Math.sin(this.facing); }
      [dx, dy] = U.norm(dx, dy);
      this.vx = dx * 9; this.vy = dy * 9;
      this.iframes = 0.35;
      this.setState('getup');
      FX.dust(this.x, this.y, 5);
      return;
    }
    if (this.stateT >= 0.7) { this.iframes = 0.3; this.setState('getup'); }
  }

  stStun(dt, inp) {
    this.mvx = this.mvy = 0;
    if (Math.random() < dt * 6) FX.add({ x: this.x + U.rand(-0.2, 0.2), y: this.y + U.rand(-0.2, 0.2), z: this.z + 34, vz: 10, life: 0.4, color: '#ffe14a', size: 1 });
    if (this.stateT >= this.stunT && this.st.para <= 0 && this.st.genjutsu <= 0) this.setState('idle');
  }

  substitute() {
    this.sub -= 50;
    const src = [...this.lastAttackers.entries()].sort((a, b) => b[1] - a[1])[0];
    const atk = src && W.time - src[1] < 2 ? src[0] : null;
    FX.poof(this.x, this.y, 16);
    W.spawnLog(this.x, this.y, this.z);
    let placed = false;
    const tries = [];
    if (atk && atk.alive) {
      const a = Math.atan2(atk.y - this.y, atk.x - this.x);
      tries.push([atk.x + Math.cos(a) * 1.1, atk.y + Math.sin(a) * 1.1]);
      tries.push([this.x - Math.cos(a) * 3, this.y - Math.sin(a) * 3]);
    }
    for (let k = 0; k < 8; k++) { const a = U.rand(0, TAU); tries.push([this.x + Math.cos(a) * 3, this.y + Math.sin(a) * 3]); }
    for (const [tx, ty] of tries) {
      if (!W.arena.isSolid(Math.floor(tx), Math.floor(ty)) && tx > 2.5 && ty > 2.5 && tx < W.arena.w - 2.5 && ty < W.arena.h - 2.5) {
        this.x = tx; this.y = ty; placed = true; break;
      }
    }
    if (!placed) { this.x += 0; }
    W.arena.resolveCircle(this, this.radius);
    this.vx = this.vy = this.vz = 0; this.z = 0;
    this.iframes = 0.45; this.juggle = 0; this.comboHits = 0;
    this.st.para = 0;
    if (atk) this.facing = Math.atan2(atk.y - this.y, atk.x - this.x);
    this.setState('idle');
    FX.poof(this.x, this.y, 8);
    FX.text(this.x, this.y, 40, 'SUBSTITUTION', '#c9b6ff', { life: 0.8 });
    SFX.playAt('sub', this.x, this.y, 0.9);
  }

  applyStatus(s, src) {
    const st = this.st;
    const armor = this.hasArmor() ? 0.5 : 1;
    if (s.wet) {
      st.wet = Math.max(st.wet, s.wet);
      if (st.burn > 0) { st.burn = 0; FX.smoke(this.x, this.y, 3); }
    }
    if (s.burn) {
      if (st.wet > 0) { st.wet = Math.max(0, st.wet - 2); FX.smoke(this.x, this.y, 2); }
      else { st.burn = Math.max(st.burn, s.burn.t || 3); st.burnDps = Math.max(st.burnDps, s.burn.dps || 12); st.burnSrc = src; }
    }
    if (s.para) {
      // strong diminishing returns so lightning can't chain-stun forever
      const t = s.para * (st.wet > 0 ? 1.3 : 1) * (1 - st.paraResist) * armor;
      if (t > 0.05) { st.para = Math.max(st.para, t); st.paraResist = Math.min(0.85, st.paraResist + 0.5); }
    }
    if (s.slow) { st.slow = Math.max(st.slow, s.slow.t); st.slowAmt = Math.max(st.slow > 0 ? st.slowAmt : 0, s.slow.amt); this.computeMods(); }
    if (s.root) st.root = Math.max(st.root, s.root * armor);
    if (s.genjutsu) { st.genjutsu = Math.max(st.genjutsu, s.genjutsu); }
  }

  die(src, h) {
    if (this.dead) return;
    this.cancelAction();
    this.dead = true;
    if (this.mount) this.dismount('death');
    this.deadT = 0;
    this.setState('dead');
    this.awakened = null;
    this.buffs = [];
    this.computeMods();
    this.st.burn = 0; this.st.para = 0; this.st.genjutsu = 0;
    this.lastStreak = this.streak || 0;
    this.streak = 0;
    if (this.isClone) { this.poof(); return; }
    const sx = src ? src.x : this.x - Math.cos(this.facing), sy = src ? src.y : this.y - Math.sin(this.facing);
    const [nx, ny] = U.norm(this.x - sx, this.y - sy);
    this.vx = nx * 7; this.vy = ny * 7; this.vz = 240;
    this.deaths++;
    SFX.playAt('ko', this.x, this.y, 1);
    FX.hit(this.x, this.y, 16, h && h.element || 'phys', 3);
    W.onDeath(this, src, h);
  }

  poof() {
    if (this.removed) return;
    this.dead = true;
    this.removed = true;
    FX.poof(this.x, this.y, 12);
    SFX.playAt('poof', this.x, this.y, 0.5);
  }

  // ---- physics ----------------------------------------------------------------------------
  physics(dt) {
    const A = W.arena;
    if (this.mount) {
      // flying: glide over props and water, only the arena edge stops you
      const k = Math.exp(-2.5 * dt);
      this.vx *= k; this.vy *= k;
      this.x = U.clamp(this.x + (this.vx + this.mvx) * dt, 2.6, A.w - 2.6);
      this.y = U.clamp(this.y + (this.vy + this.mvy) * dt, 2.6, A.h - 2.6);
      this.z = 0; this.vz = 0;
      return;
    }
    const air = this.z > 0 || this.vz > 0;
    const fr = air ? 1.2 : (this.state === 'hitstun' || this.dead) ? 5.5 : 9;
    const k = Math.exp(-fr * dt);
    this.vx *= k; this.vy *= k;
    let dx = (this.vx + this.mvx) * dt, dy = (this.vy + this.mvy) * dt;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.18));
    this._wallHit = false;
    // launched fighters leave a smoke trail
    if ((this.state === 'hitstun' || this.state === 'air' || this.dead) && Math.hypot(this.vx, this.vy) > 6.5 && Math.random() < 0.7) {
      FX.add({ x: this.x, y: this.y, z: this.z + 12, life: 0.4, color: ['#ffffff', '#d8d8dc', '#98989f'], size: 2.5, grow: 3, kind: 'smoke', alpha: 0.7 });
    }
    for (let s = 0; s < n; s++) {
      this.x += dx / n; this.y += dy / n;
      const hit = A.resolveCircle(this, this.radius);
      if (hit) { this._wallHit = true; if (this.onWall(hit)) break; }
    }
    if (this.z > 0 || this.vz !== 0) {
      this.vz -= GRAVITY * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        const impact = this.vz;
        this.z = 0; this.vz = 0;
        this.onLand(impact);
      }
    }
  }

  onWall(hit) {
    const sp = Math.hypot(this.vx, this.vy);
    if (sp < 5.5 || !['hitstun', 'air', 'dead'].includes(this.state)) return false;
    const b = hit.b;
    const src = this.lastAttackerFighter();
    const A = W.arena;
    A.damageBlock(b.i, b.j, sp * 8, null, src);
    FX.dust(this.x, this.y, 6);
    if (A.block(b.i, b.j) === b) {
      // bounce off
      const dot = this.vx * hit.nx + this.vy * hit.ny;
      this.vx = (this.vx - 2 * dot * hit.nx) * 0.3; this.vy = (this.vy - 2 * dot * hit.ny) * 0.3;
      if (!this.dead) {
        Combat.applyDamage(this, Math.round(6 + sp * 1.6), src, { kind: 'env' });
        if (this.state === 'hitstun') this.stunT += 0.25;
        FX.text(this.x, this.y, this.z + 36, 'WALL SPLAT', '#ffb070', { life: 0.7 });
        this.flash = 0.1;
      }
      W.shakeAt(this.x, this.y, 4);
      SFX.playAt('hitHeavy', this.x, this.y, 0.7);
      return true;
    }
    // crashed straight through
    this.vx *= 0.7; this.vy *= 0.7;
    W.shakeAt(this.x, this.y, 5);
    return false;
  }

  onLand(vz) {
    this.jumps = 0;
    if (this.dead) { FX.dust(this.x, this.y, 5); return; }
    if (this.state === 'dive') { this.landDive(); return; }
    if (this.state === 'attack' && this.atk && this.atk.air) { FX.dust(this.x, this.y, 3); this.recoverT = 0.1; this.recoverPose = 'charge'; this.setState('recover'); return; }
    if (this.isNeutral() && vz < -150) FX.dust(this.x, this.y, 3);
    if (this.state === 'air') {
      if (vz < -380) {
        // spiked into the ground: bounce once
        this.vz = 150; this.z = 0.5;
        FX.dust(this.x, this.y, 10); FX.ring(this.x, this.y, 0.3, '#d8ccb4', 0.3, 3);
        W.arena.addStain(this.x, this.y, 0.5, 'crater');
        SFX.playAt('hitHeavy', this.x, this.y, 0.8);
        W.shakeAt(this.x, this.y, 5);
        return;
      }
      if ((this.maxAirZ || 0) > 12 || this.juggle > 0) {
        this.setState('down');
        FX.dust(this.x, this.y, 6);
        SFX.playAt('hit', this.x, this.y, 0.3);
      } else {
        this.setState('hitstun');
        this.stunT = 0.15;
      }
      this.juggle = 0;
    }
  }

  envEffects(dt) {
    if (this.z > 2 || this.mount) return;
    const A = W.arena;
    const i = Math.floor(this.x), j = Math.floor(this.y);
    const k = A.idx(i, j);
    if (A.tiles[k] === T_WATER) {
      this.st.wet = Math.max(this.st.wet, 1.5);
      if (this.st.burn > 0) this.st.burn = 0;
      if ((Math.abs(this.mvx) + Math.abs(this.mvy)) > 1 && Math.random() < dt * 8) FX.splash(this.x, this.y, 2, 0.4);
      if (Math.random() < dt * 1.5) FX.ring(this.x, this.y, 0.2, '#bfe0ff', 0.5, 1.5);
    } else if (A.wet[k] > 0) {
      this.st.wet = Math.max(this.st.wet, 1.0);
    }
    if (A.fire[k] > 0 && this.st.wet <= 0 && !this.hasBuff('fireImmune')) this.applyStatus({ burn: { t: 1.5, dps: 14 } }, null);
  }

  lastAttackerFighter() {
    let best = null, bt = -1;
    for (const [f, t] of this.lastAttackers) if (t > bt) { bt = t; best = f; }
    return best && W.time - bt < 5 ? best : null;
  }

  // ---- rendering helpers -------------------------------------------------------------------
  get view() { const f = ISO.facingFromAngle(this.facing); return f >= 2 ? 'B' : 'F'; }
  get flip() { const f = ISO.facingFromAngle(this.facing); return f === 1 || f === 3; }

  poseFrame() {
    const t = this.time;
    switch (this.state) {
      case 'idle': case 'move':
        if (this.z > 1) return [this.vz > 0 ? 'jump' : 'fall', 0];
        return this.state === 'idle' ? ['idle', Math.floor(t * 2.2) % 2] : ['run', Math.floor(this.animT * 7) % 8];
      case 'attack': {
        const a = this.atk, at = this.stateT * this.atkSpeed;
        if (a.back) return ['spin', Math.floor(this.stateT * 14) % 2];
        if (Sprites.frameCount(a.pose) < 3) return [a.pose, 0];
        return [a.pose, at < a.wind ? 0 : at < a.wind + a.act + 0.05 ? 1 : 2];
      }
      case 'heavy':
        if (!this.heavyReleased) return ['heavyWind', 0];
        if (this.heavyKind === 'forward') return ['lunge', this.heavyT < 0.26 ? 1 : 2];
        if (this.heavyKind === 'back') return ['spin', Math.floor(this.heavyT * 12) % 2];
        return ['uppercut', this.heavyT < 0.03 ? 0 : this.heavyT < 0.2 ? 1 : 2];
      case 'dive': return ['dive', this.stateT < 0.08 ? 0 : 1];
      case 'dash': return ['dash', 0];
      case 'block': return ['block', 0];
      case 'cast': return ['seal', Math.floor(this.stateT * 12) % 2];
      case 'channel': { const p = (this.channel && this.channel.pose) || 'release'; return [p, Sprites.frameCount(p) >= 3 ? 1 : 0]; }
      case 'jdash': { const p = (this.jd && this.jd.pose) || 'dash'; return [p, Sprites.frameCount(p) >= 3 ? 1 : 0]; }
      case 'recover': { const p = this.recoverPose || 'release'; return [p, Sprites.frameCount(p) >= 3 ? (this.stateT < 0.08 ? 1 : 2) : 0]; }
      case 'throw': return ['throw', !this.thrown ? 0 : this.stateT - this.throwAt < 0.07 ? 1 : 2];
      case 'hitstun': return ['hurt', this.hurtFrame];
      case 'air': return ['air', 0];
      case 'down': case 'dead': return ['lying', 0];
      case 'getup': return ['charge', 0];
      case 'stun': return ['hurt', 1];
      case 'charge': return ['charge', Math.floor(t * 8) % 2];
      case 'awaken': return ['raise', 0];
      case 'ult': return [(this.ultimate && this.ultimate.pose) || 'raise', 0];
      case 'victory': return ['victory', 0];
      case 'mount': return ['ride', this.mount && this.mount.fireCD > 0.18 ? 1 : 0];
      default: return ['idle', 0];
    }
  }

  spriteCanvas() {
    let [pose, frame] = this.poseFrame();
    if (pose === 'lying') pose = 'hurt';
    return Sprites.get(this.look, pose, frame, this.view);
  }
}
