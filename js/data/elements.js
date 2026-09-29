'use strict';
// ---------------------------------------------------------------------------
// Elemental styles. Advantage cycle: Fire > Wind > Lightning > Earth > Water > Fire
// ---------------------------------------------------------------------------

const ELEMENTS = {
  fire:      { id: 'fire',      name: 'Fire Style',      short: 'FIRE',  color: '#ff6a1f', light: '#ffd35c', dark: '#a3200d', beats: 'wind' },
  wind:      { id: 'wind',      name: 'Wind Style',      short: 'WIND',  color: '#7fe0b0', light: '#e2fff0', dark: '#2f8a6a', beats: 'lightning' },
  lightning: { id: 'lightning', name: 'Lightning Style', short: 'LIGHT', color: '#7fb8ff', light: '#f2f8ff', dark: '#3548c9', beats: 'earth' },
  earth:     { id: 'earth',     name: 'Earth Style',     short: 'EARTH', color: '#c08a4a', light: '#ecc98f', dark: '#5e3b1a', beats: 'water' },
  water:     { id: 'water',     name: 'Water Style',     short: 'WATER', color: '#3fa0ff', light: '#b8e4ff', dark: '#174f9c', beats: 'fire' },
  shinobi:   { id: 'shinobi',   name: 'Shinobi Arts',    short: 'NINJA', color: '#c9b6ff', light: '#f3edff', dark: '#5a3f9e', beats: null },
};
const ELEMENT_ORDER = ['fire', 'water', 'earth', 'wind', 'lightning', 'shinobi'];
const NATURE_ELEMENTS = ['fire', 'water', 'earth', 'wind', 'lightning'];

// Multiplier applied when `atk` element hits a fighter whose affinity is `def`.
function elementMult(atk, def) {
  if (!atk || !def || !ELEMENTS[atk]) return 1;
  if (ELEMENTS[atk].beats === def) return 1.2;
  if (ELEMENTS[def] && ELEMENTS[def].beats === atk) return 0.88;
  return 1;
}

// Projectile clash: returns 1 if a wins, -1 if b wins, 0 if both are destroyed.
function clashResult(a, b) {
  if (a && b && ELEMENTS[a] && ELEMENTS[a].beats === b) return 1;
  if (a && b && ELEMENTS[b] && ELEMENTS[b].beats === a) return -1;
  return 0;
}
