'use strict';
// ---------------------------------------------------------------------------
// Preset shinobi + persistent roster/settings (localStorage).
// ---------------------------------------------------------------------------

const PRESETS = [
  { id: 'p_renji', name: 'Renji Akabane', affinity: 'fire',
    look: { skin: '#ffe0bd', hair: '#d8352a', hairStyle: 'spiky', eyes: '#2a2a38', outfit: '#2a2a36', pants: '#1e1e26', cloth: '#b8322a', headband: 'forehead', extra: 'scarf' },
    jutsu: ['fireball', 'blazerush', 'flamepillar', 'firebomb'], awakening: 'crimson', ultimate: 'inferno' },
  { id: 'p_suiren', name: 'Suiren Kawano', affinity: 'water',
    look: { skin: '#f3d2c1', hair: '#6ec6ff', hairStyle: 'long', eyes: '#2e6bd6', outfit: '#1f7a7a', pants: '#1f3a6a', cloth: '#2a4fd6', headband: 'forehead', extra: 'none' },
    jutsu: ['waterdragon', 'aquawhip', 'watershark', 'waterprison'], awakening: 'sage', ultimate: 'tsunami' },
  { id: 'p_gando', name: 'Gando Iwaki', affinity: 'earth',
    look: { skin: '#c98b5a', hair: '#5a3a22', hairStyle: 'short', eyes: '#8a4b1f', outfit: '#8a6a3a', pants: '#4a3a2a', cloth: '#3f6b3a', headband: 'forehead', extra: 'none' },
    jutsu: ['rockspikes', 'rockshot', 'boulder', 'earthwall'], awakening: 'spirit', ultimate: 'meteor' },
  { id: 'p_fuuka', name: 'Fuuka Kazehana', affinity: 'wind',
    look: { skin: '#ffe0bd', hair: '#4f9e4a', hairStyle: 'pony', eyes: '#3aa55d', outfit: '#d8d0c0', pants: '#2d4a3a', cloth: '#3f6b3a', headband: 'neck', extra: 'none' },
    jutsu: ['windblade', 'windrang', 'cyclone', 'windstep'], awakening: 'beast', ultimate: 'shuriken' },
  { id: 'p_raiden', name: 'Raiden Kaminari', affinity: 'lightning',
    look: { skin: '#f3d2c1', hair: '#e8e8f0', hairStyle: 'wild', eyes: '#2a2a38', outfit: '#2d4a7a', pants: '#1f3a6a', cloth: '#2a2a36', headband: 'forehead', extra: 'mask' },
    jutsu: ['lance', 'railbolt', 'hound', 'thunderbolt'], awakening: 'curse', ultimate: 'kirin' },
  { id: 'p_kage', name: 'Kage Kurosawa', affinity: 'shinobi',
    look: { skin: '#ffe0bd', hair: '#2b2b3a', hairStyle: 'hood', eyes: '#b58cff', outfit: '#5b5b66', pants: '#1e1e26', cloth: '#2a2a36', headband: 'none', extra: 'none' },
    jutsu: ['shadowbind', 'shurikenstorm', 'tagkunai', 'flashstep'], awakening: 'curse', ultimate: 'moon' },
  { id: 'p_tsubaki', name: 'Tsubaki Hanamura', affinity: 'fire',
    look: { skin: '#ffe0bd', hair: '#e86fb4', hairStyle: 'buns', eyes: '#3aa55d', outfit: '#b8322a', pants: '#3a3a44', cloth: '#b8322a', headband: 'forehead', extra: 'none' },
    jutsu: ['spiral', 'rotation', 'phoenix', 'flashstep'], awakening: 'gates', ultimate: 'cannon' },
  { id: 'p_haru', name: 'Haru Kazemaki', affinity: 'wind',
    look: { skin: '#ffe0bd', hair: '#ffd23f', hairStyle: 'spiky', eyes: '#2e6bd6', outfit: '#ff7a1a', pants: '#2d3550', cloth: '#2a4fd6', headband: 'forehead', extra: 'marks' },
    jutsu: ['clones', 'spiral', 'windrang', 'summonhawk'], awakening: 'beast', ultimate: 'thousand' },
  { id: 'p_yuki', name: 'Yuki Shirogane', affinity: 'water',
    look: { skin: '#f3d2c1', hair: '#b0b8c8', hairStyle: 'short', eyes: '#6ec6ff', outfit: '#3a5fd6', pants: '#d8d0c0', cloth: '#d8d0c0', headband: 'arm', extra: 'none' },
    jutsu: ['waterbullets', 'tidalwave', 'summontoad', 'mist'], awakening: 'sage', ultimate: 'tsunami' },
  { id: 'p_daichi', name: 'Daichi Morikawa', affinity: 'earth',
    look: { skin: '#e8b07f', hair: '#5a3a22', hairStyle: 'wild', eyes: '#2a2a38', outfit: '#3f6b3a', pants: '#2d4a3a', cloth: '#8a6a3a', headband: 'forehead', extra: 'cloak' },
    jutsu: ['tectonic', 'mudswamp', 'summonsnake', 'rockspikes'], awakening: 'gates', ultimate: 'meteor' },
  { id: 'p_akane', name: 'Akane Hoshino', affinity: 'lightning',
    look: { skin: '#ffe0bd', hair: '#7a4fd6', hairStyle: 'pony', eyes: '#e0a020', outfit: '#6a2d8a', pants: '#1e1e26', cloth: '#6a2d8a', headband: 'forehead', extra: 'none' },
    jutsu: ['larmor', 'discharge', 'lance', 'chain'], awakening: 'spirit', ultimate: 'kirin' },
  { id: 'p_sora', name: 'Sora Tenma', affinity: 'fire',
    look: { skin: '#f7c99b', hair: '#141414', hairStyle: 'long', eyes: '#c23b3b', outfit: '#2a2a36', pants: '#1e1e26', cloth: '#b8322a', headband: 'forehead', extra: 'cloak' },
    jutsu: ['fireball', 'phoenix', 'summonsnake', 'shadowbind'], awakening: 'crimson', ultimate: 'moon' },
];

const Store = {
  get(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage unavailable */ }
  },
};

const Roster = {
  KEY: 'coh_roster_v1',
  custom() { return Store.get(this.KEY, []).filter((c) => Roster.valid(c)); },
  all() { return [...Roster.custom(), ...PRESETS]; },
  byId(id) { return Roster.all().find((c) => c.id === id) || null; },
  valid(c) {
    return c && c.name && c.look && Array.isArray(c.jutsu) && c.jutsu.length === 4 && c.jutsu.every((j) => JUTSU[j]) && AWAKENINGS[c.awakening] && ULTIMATES[c.ultimate];
  },
  save(c) {
    const list = Store.get(this.KEY, []);
    const i = list.findIndex((x) => x.id === c.id);
    if (i >= 0) list[i] = c; else list.unshift(c);
    Store.set(this.KEY, list);
  },
  remove(id) { Store.set(this.KEY, Store.get(this.KEY, []).filter((c) => c.id !== id)); },
  newId() { return 'c_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); },
  randomCharacter(name) {
    const r = U.pick;
    const el = r(NATURE_ELEMENTS);
    const pool = Object.values(JUTSU);
    const own = U.shuffle(pool.filter((j) => j.element === el)).slice(0, 2);
    const rest = U.shuffle(pool.filter((j) => !own.includes(j))).slice(0, 2);
    return {
      id: Roster.newId(), name: name || 'Rogue Ninja', affinity: el,
      look: { skin: r(LOOKS.skin), hair: r(LOOKS.hairColor), hairStyle: r(LOOKS.hairStyles).id, eyes: r(LOOKS.eyeColor), outfit: r(LOOKS.outfit), pants: r(LOOKS.pants), cloth: r(LOOKS.cloth), headband: r(LOOKS.headbands).id, extra: r(LOOKS.extras).id },
      jutsu: [...own, ...rest].map((j) => j.id),
      awakening: r(Object.keys(AWAKENINGS)), ultimate: r(Object.keys(ULTIMATES)),
    };
  },
};

const Settings = {
  KEY: 'coh_settings_v1',
  data: null,
  load() {
    this.data = Object.assign({ sfx: 0.7, music: 0.45, shake: 1, numbers: true, zoom: 'normal', muted: false }, Store.get(this.KEY, {}));
    SFX.settings.sfx = this.data.sfx; SFX.settings.music = this.data.music; SFX.settings.muted = this.data.muted;
    return this.data;
  },
  save() { Store.set(this.KEY, this.data); SFX.settings.sfx = this.data.sfx; SFX.settings.music = this.data.music; SFX.settings.muted = this.data.muted; SFX.applyVolumes(); },
};
