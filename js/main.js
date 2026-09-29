'use strict';
// ---------------------------------------------------------------------------
// Boot + main loop (fixed 60 Hz simulation, render every animation frame).
// ---------------------------------------------------------------------------

const Game = {
  STEP: 1 / 60,
  world: null,
  screen: 'title',
  paused: false,
  acc: 0,
  last: 0,
  resultsShown: false,
  lastSetup: null,
  lastCfg: null,
  audioReady: false,
  errors: 0,

  boot() {
    Settings.load();
    const cv = document.getElementById('game');
    Input.attach(cv);
    Render.init(cv);
    UI.init();
    const unlock = () => {
      if (this.audioReady) return;
      this.audioReady = true;
      SFX.init();
      SFX.Music.start(this.screen === 'game' ? 'battle' : 'menu');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.startDemo();
    UI.title();
    const boot = document.getElementById('boot');
    if (boot) boot.remove();
    requestAnimationFrame((t) => { this.last = t; this.loop(t); });
  },

  startDemo() {
    const picks = U.shuffle(Roster.all().slice()).slice(0, 6);
    this.world = new World({
      map: U.pick(Object.keys(THEMES)), demo: true, mode: 'ffa', winType: 'kills', killLimit: 999, timeLimit: 0,
      entries: picks.map((c) => ({ char: U.deepCopy(c), isPlayer: false, diff: 'hard' })),
    });
    this.screen = 'title';
    this.paused = false;
  },

  quickBattle() {
    const s = UI.loadSetup();
    const diff = s.diff in AI_DIFF ? s.diff : 'normal';
    const q = Object.assign({}, s, { mode: 'ffa', count: 6, winType: 'kills', killLimit: 10, timeLimit: 300, map: 'random', spectate: false });
    q.slots = [{ char: s.player, team: 0, diff }];
    for (let i = 1; i < 6; i++) q.slots.push({ char: 'random', team: i, diff });
    this.startFromSetup(q);
  },

  training() {
    const s = UI.loadSetup();
    const me = Roster.byId(s.player) || Roster.all()[0];
    const partners = U.shuffle(PRESETS.filter((p) => p.id !== me.id)).slice(0, 3);
    this.lastSetup = null;
    this.start({
      map: 'forest', mode: 'ffa', winType: 'kills', killLimit: 99999, timeLimit: 0, training: true, seed: (Math.random() * 1e9) | 0,
      entries: [{ char: U.deepCopy(me), isPlayer: true }, ...partners.map((c, i) => ({ char: U.deepCopy(c), isPlayer: false, diff: i === 2 ? 'easy' : 'dummy' }))],
    });
  },

  startFromSetup(s) {
    this.lastSetup = U.deepCopy(s);
    this.start(UI.buildConfig(s));
  },

  start(cfg) {
    this.lastCfg = cfg;
    UI.hide();
    this.world = new World(cfg);
    this.screen = 'game';
    this.paused = false;
    this.resultsShown = false;
    this.acc = 0;
    HUD.invalidateMini();
    Input.tick();
    if (this.audioReady) SFX.Music.start('battle');
  },

  rematch() {
    if (this.lastSetup) this.startFromSetup(this.lastSetup);
    else if (this.lastCfg) this.start(Object.assign({}, this.lastCfg, { seed: (Math.random() * 1e9) | 0 }));
  },

  toMenu(silent) {
    this.startDemo();
    if (!silent) UI.title();
    if (this.audioReady) SFX.Music.start('menu');
  },

  pause() {
    if (this.screen !== 'game' || !this.world || this.world.over) return;
    this.paused = true;
    UI.pause();
  },

  resume() {
    this.paused = false;
    UI.hide();
    Input.tick();
  },

  loop(t) {
    const dt = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
    this.last = t;
    try {
      this.frame(dt);
      this.errors = 0;
    } catch (e) {
      this.errors++;
      console.error(e);
      if (this.errors > 30) { this.errors = 0; this.toMenu(); }
    }
    requestAnimationFrame((tt) => this.loop(tt));
  },

  frame(dt) {
    const w = this.world;
    if (Input.consume('mute')) { Settings.data.muted = !Settings.data.muted; Settings.save(); }
    if (this.screen === 'game') {
      if (Input.consume('pause')) { if (this.paused) this.resume(); else this.pause(); }
      if (!w.player && !this.paused) {
        if (Input.consume('left')) w.spectateNext(-1);
        if (Input.consume('right')) w.spectateNext(1);
      }
    }
    if (!this.paused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= this.STEP && n < 5) {
        Input.tick();
        w.update(this.STEP);
        this.acc -= this.STEP;
        n++;
      }
      if (n >= 5) this.acc = 0;
    }
    Render.world(w);
    if (this.screen === 'game' && !this.resultsShown) HUD.draw(Render.ctx, w);
    if (this.screen === 'game' && w.over && w.overT > 3.2 && !this.resultsShown) {
      this.resultsShown = true;
      UI.results(w);
    }
    if (w.demo && w.demoReset) this.startDemo();
  },
};

window.addEventListener('load', () => Game.boot());
