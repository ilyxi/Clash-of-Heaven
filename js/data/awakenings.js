'use strict';
// ---------------------------------------------------------------------------
// Awakenings: temporary transformations fueled by the awakening meter.
// ---------------------------------------------------------------------------

const AWAKENINGS = {
  crimson: {
    id: 'crimson', name: 'Crimson Eye', dur: 14, colors: ['#ffd0d0', '#ff4040', '#a01010'],
    desc: 'Eyes that read every movement. Much larger parry window, slowed enemy projectiles near you, more crits.',
    mods: { parryWindow: 0.34, crit: 0.2, dmg: 1.1, projSlow: 0.55 },
    tick(f, dt) { if (Math.random() < dt * 10) FX.add({ x: f.x, y: f.y, z: f.z + 26, vx: U.rand(-0.5, 0.5), vy: U.rand(-0.5, 0.5), vz: 10, life: 0.4, color: ['#ff4040', '#a01010'], size: 1, add: true }); },
  },
  sage: {
    id: 'sage', name: 'Sage Mode', dur: 16, colors: ['#fff0b0', '#ffb040', '#c06010'],
    desc: 'Borrow nature energy: +25% damage, bigger jutsu, longer reach and triple chakra regeneration.',
    mods: { dmg: 1.25, jutsuSize: 1.25, chakraRegen: 3, reach: 1.25, def: 0.9 },
    tick(f, dt) { if (Math.random() < dt * 6) FX.aura(f.x, f.y, ['#fff0b0', '#ffd070', '#80c040'], 1, 28, 0.3); },
  },
  beast: {
    id: 'beast', name: 'Beast Cloak', dur: 14, colors: ['#ffd0a0', '#ff7a20', '#c02010'],
    desc: 'A roaring chakra cloak: much faster, claws extend your reach, strikes steal life and you regenerate.',
    mods: { speed: 1.35, lifesteal: 0.18, regen: 0.01, reach: 1.45, meleeDmg: 1.2, dashCD: 0.6 },
    tick(f, dt) { if (Math.random() < dt * 22) FX.aura(f.x, f.y, ['#ffe0a0', '#ff8a2a', '#e0401a'], 1, 30, 0.4); },
  },
  gates: {
    id: 'gates', name: 'Eight Gates', dur: 12, colors: ['#e0ffd0', '#60ff80', '#ff4040'],
    desc: 'Force open the chakra gates: huge damage and speed with super armor — but your life drains away.',
    mods: { dmg: 1.55, speed: 1.4, atkSpeed: 1.3, armor: true, hpDrain: 0.018, knockTaken: 0.5 },
    tick(f, dt) { if (Math.random() < dt * 18) FX.add({ x: f.x + U.rand(-0.25, 0.25), y: f.y + U.rand(-0.25, 0.25), z: f.z + U.rand(0, 20), vz: U.rand(30, 60), life: 0.6, color: ['#c8ffd0', '#60ff80', '#30a050'], size: U.rand(2, 3), grow: 2, kind: 'smoke', alpha: 0.6 }); },
  },
  spirit: {
    id: 'spirit', name: 'Spirit Armor', dur: 14, colors: ['#e0c0ff', '#a060ff', '#5020a0'],
    desc: 'A towering spectral warrior shields you: much less damage taken, super armor and giant sweeping strikes.',
    mods: { def: 0.62, armor: true, reach: 1.7, arcMult: 1.4, meleeDmg: 1.22, speed: 0.88, knockTaken: 0.25 },
    tick(f, dt) { if (Math.random() < dt * 8) FX.aura(f.x, f.y, ['#e0c0ff', '#a060ff', '#5020a0'], 1, 40, 0.5); },
  },
  curse: {
    id: 'curse', name: 'Cursed Seal', dur: 14, colors: ['#d0b0ff', '#6a2a8a', '#1a0a2a'],
    desc: 'Dark marks spread across your body: jutsu cost far less, recharge nearly twice as fast and cast quicker.',
    mods: { cdr: 0.55, costMult: 0.4, dmg: 1.15, castSpeed: 0.7 },
    start(f) { for (const s of f.jutsu) if (s) s.cd *= 0.5; },
    tick(f, dt) { if (Math.random() < dt * 12) FX.add({ x: f.x + U.rand(-0.2, 0.2), y: f.y + U.rand(-0.2, 0.2), z: f.z + U.rand(4, 26), vz: 25, life: 0.5, color: ['#6a2a8a', '#2a0a3a', '#100418'], size: 2, kind: 'glow' }); },
  },
};
