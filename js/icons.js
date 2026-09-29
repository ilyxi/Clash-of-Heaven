'use strict';
// ---------------------------------------------------------------------------
// Procedural 24x24 pixel icons for jutsu, awakenings and ultimates.
// ---------------------------------------------------------------------------

const Icons = (() => {
  const S = 24;
  const cache = new Map();

  const G = {
    ball(x, c) { x.fillStyle = c.dark; PX.circle(x, 12, 12, 7); x.fillStyle = c.main; PX.circle(x, 12, 12, 6); x.fillStyle = c.light; PX.circle(x, 10, 10, 3); x.fillStyle = '#fff'; x.fillRect(9, 9, 2, 2); },
    spread(x, c) { for (let k = 0; k < 5; k++) { const a = -0.9 + k * 0.45; x.fillStyle = c.main; PX.circle(x, 5 + Math.cos(a) * 14, 12 + Math.sin(a) * 10, 2); x.fillStyle = c.light; x.fillRect(Math.round(4 + Math.cos(a) * 14), Math.round(11 + Math.sin(a) * 10), 1, 1); } x.fillStyle = c.light; PX.circle(x, 5, 12, 2); },
    stream(x, c) { for (let k = 0; k < 16; k++) { const w = Math.round(k * 0.45); x.fillStyle = k > 11 ? c.light : k > 5 ? c.main : c.dark; x.fillRect(4 + k, 12 - w, 1, w * 2 + 1); } },
    dash(x, c) { x.fillStyle = c.main; for (let k = 0; k < 3; k++) x.fillRect(3 + k * 2, 7 + k * 4, 8, 1); x.fillStyle = c.light; PX.circle(x, 16, 12, 4); x.fillStyle = '#fff'; PX.circle(x, 17, 11, 1); },
    ring(x, c) { x.fillStyle = c.main; PX.ellipseRing(x, 12, 13, 9, 6, 2); x.fillStyle = c.light; PX.ellipseRing(x, 12, 13, 5, 3, 1); x.fillStyle = c.dark; x.fillRect(11, 12, 3, 3); },
    pillar(x, c) { for (let y = 3; y < 21; y++) { const w = 2 + Math.round((y - 3) * 0.25); x.fillStyle = y < 8 ? c.light : y < 14 ? c.main : c.dark; x.fillRect(12 - w, y, w * 2, 1); } x.fillStyle = c.dark; PX.ellipse(x, 12, 20, 7, 2); },
    dragon(x, c) { x.fillStyle = c.main; for (let t = 0; t < 1; t += 0.04) { const px = 3 + t * 16, py = 12 + Math.sin(t * 9) * 5; PX.circle(x, px, py, 1 + t * 2); } x.fillStyle = c.light; PX.circle(x, 19, 12 + Math.sin(9) * 5, 3); x.fillStyle = '#fff'; x.fillRect(20, 10, 1, 1); },
    bullets(x, c) { for (let k = 0; k < 4; k++) { x.fillStyle = c.main; PX.circle(x, 5 + k * 5, 12 + (k % 2 ? -2 : 2), 2); x.fillStyle = c.light; x.fillRect(4 + k * 5, 11 + (k % 2 ? -2 : 2), 1, 1); } },
    prison(x, c) { x.fillStyle = c.dark; PX.circle(x, 12, 12, 8); x.fillStyle = c.main; PX.ellipseRing(x, 12, 12, 8, 8, 1); x.fillStyle = '#20202a'; x.fillRect(11, 8, 3, 3); x.fillRect(10, 11, 5, 5); x.fillStyle = '#fff'; x.fillRect(8, 7, 2, 1); },
    whip(x, c) { x.fillStyle = c.main; for (let t = 0; t < 1; t += 0.03) { const px = 4 + t * 16, py = 18 - Math.sin(t * 3.14) * 10 + t * 2; x.fillRect(Math.round(px), Math.round(py), 2, 2); } x.fillStyle = c.light; PX.circle(x, 20, 18, 2); },
    wave(x, c) { x.fillStyle = c.dark; x.fillRect(2, 15, 20, 6); x.fillStyle = c.main; for (let px = 2; px < 22; px++) { const h = Math.round(6 + Math.sin(px * 0.5) * 3 + (px > 12 ? (px - 12) * 0.5 : 0)); x.fillRect(px, 17 - h, 1, h); } x.fillStyle = c.light; for (let px = 2; px < 22; px += 2) x.fillRect(px, 17 - Math.round(6 + Math.sin(px * 0.5) * 3 + (px > 12 ? (px - 12) * 0.5 : 0)), 2, 1); },
    mist(x, c) { x.fillStyle = c.light; PX.circle(x, 8, 13, 4); PX.circle(x, 14, 11, 5); PX.circle(x, 17, 15, 3); x.fillStyle = '#ffffff'; PX.circle(x, 13, 10, 2); },
    wall(x, c) { x.fillStyle = c.dark; x.fillRect(3, 8, 18, 12); x.fillStyle = c.main; for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) x.fillRect(4 + k * 6 + (r % 2) * 3 - (r % 2 && k === 2 ? 3 : 0), 9 + r * 4, 5, 3); x.fillStyle = c.light; x.fillRect(3, 8, 18, 1); },
    spikes(x, c) { for (let k = 0; k < 3; k++) { const bx = 5 + k * 7, h = 8 + k * 3; for (let y = 0; y < h; y++) { const w = Math.round(y / h * 3); x.fillStyle = y < 2 ? c.light : c.main; x.fillRect(bx - w, 20 - h + y, w * 2 + 1, 1); } } x.fillStyle = c.dark; x.fillRect(2, 20, 20, 2); },
    boulder(x, c) { x.fillStyle = c.dark; PX.circle(x, 12, 13, 8); x.fillStyle = c.main; PX.circle(x, 11, 12, 7); x.fillStyle = c.light; PX.circle(x, 9, 9, 3); x.fillStyle = c.dark; PX.line(x, 12, 9, 14, 14); PX.line(x, 14, 14, 11, 17); },
    swamp(x, c) { x.fillStyle = c.dark; PX.ellipse(x, 12, 15, 10, 5); x.fillStyle = c.main; PX.ellipse(x, 11, 14, 6, 3); x.fillStyle = c.light; PX.circle(x, 8, 8, 2); PX.circle(x, 15, 6, 1); x.fillRect(13, 10, 1, 1); },
    armor(x, c) { x.fillStyle = c.dark; for (let y = 0; y < 16; y++) { const w = y < 10 ? 8 : 8 - (y - 10) * 1.3; x.fillRect(12 - w, 4 + y, w * 2, 1); } x.fillStyle = c.main; for (let y = 1; y < 14; y++) { const w = y < 9 ? 6 : 6 - (y - 9) * 1.2; x.fillRect(12 - w, 4 + y, w * 2, 1); } x.fillStyle = c.light; x.fillRect(8, 6, 3, 6); },
    slam(x, c) { x.fillStyle = c.main; x.fillRect(11, 3, 3, 9); for (let k = 0; k < 5; k++) x.fillRect(8 + k, 11 + k, 9 - k * 2, 1); x.fillStyle = c.dark; x.fillRect(3, 19, 18, 2); x.fillStyle = c.light; PX.line(x, 6, 18, 3, 15); PX.line(x, 18, 18, 21, 15); },
    blade(x, c) { for (let k = -8; k <= 8; k++) { const t = k / 8; x.fillStyle = c.main; x.fillRect(Math.round(14 - t * t * 8), 12 + k, 3, 1); x.fillStyle = '#fff'; x.fillRect(Math.round(16 - t * t * 8), 12 + k, 1, 1); } },
    cone(x, c) { for (let k = 0; k < 18; k++) { const w = Math.round(k * 0.5); for (let y = -w; y <= w; y += 2) { x.fillStyle = (k + y) % 4 ? c.main : c.light; x.fillRect(3 + k, 12 + y, 1, 1); } } },
    tornado(x, c) { for (let y = 3; y < 21; y++) { const w = Math.round(2 + (21 - y) * 0.45), o = Math.round(Math.sin(y * 0.6) * 2); x.fillStyle = y % 3 ? c.main : c.light; x.fillRect(12 - w + o, y, w * 2, 1); } },
    blink(x, c) { x.fillStyle = c.dark; PX.circle(x, 6, 12, 3); x.fillStyle = c.main; PX.circle(x, 11, 12, 3); x.fillStyle = c.light; PX.circle(x, 17, 12, 4); x.fillStyle = '#fff'; x.fillRect(16, 10, 2, 2); },
    spin(x, c) { x.fillStyle = c.main; for (let a = 0; a < 5.5; a += 0.15) x.fillRect(Math.round(12 + Math.cos(a) * 8), Math.round(12 + Math.sin(a) * 8), 2, 2); x.fillStyle = c.light; for (let a = 1; a < 6; a += 0.2) x.fillRect(Math.round(12 + Math.cos(a) * 4), Math.round(12 + Math.sin(a) * 4), 1, 1); x.fillRect(19, 8, 2, 4); },
    lance(x, c) { x.fillStyle = c.main; PX.circle(x, 9, 14, 4); x.fillStyle = '#fff'; PX.line(x, 12, 12, 21, 4, 2); x.fillStyle = c.light; PX.line(x, 5, 18, 8, 10); PX.line(x, 13, 17, 17, 21); PX.line(x, 6, 12, 2, 9); },
    chain(x, c) { const pts = [[3, 6], [9, 16], [14, 7], [21, 17]]; x.fillStyle = c.light; for (let k = 0; k < 3; k++) PX.line(x, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], 2); x.fillStyle = '#fff'; for (const p of pts) x.fillRect(p[0] - 1, p[1] - 1, 3, 3); },
    hound(x, c) { x.fillStyle = c.main; PX.ellipse(x, 10, 14, 6, 3); PX.circle(x, 16, 10, 4); x.fillRect(18, 4, 2, 4); x.fillRect(14, 4, 2, 4); x.fillStyle = '#fff'; x.fillRect(17, 9, 1, 1); x.fillStyle = c.light; PX.line(x, 4, 14, 1, 11); x.fillRect(6, 17, 1, 4); x.fillRect(12, 17, 1, 4); },
    field(x, c) { x.fillStyle = c.main; PX.ellipseRing(x, 12, 12, 9, 9, 1); x.fillStyle = c.light; for (let k = 0; k < 6; k++) { const a = k * 1.05; PX.line(x, 12, 12, 12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9); } x.fillStyle = '#fff'; PX.circle(x, 12, 12, 2); },
    bolt(x, c) { x.fillStyle = c.light; const p = [[14, 2], [8, 12], [13, 12], [9, 22]]; for (let k = 0; k < 3; k++) PX.line(x, p[k][0], p[k][1], p[k + 1][0], p[k + 1][1], 2); x.fillStyle = '#fff'; PX.line(x, 14, 2, 8, 12); },
    clone(x, c) { for (const [ox, col] of [[7, c.dark], [12, c.main], [17, c.light]]) { x.fillStyle = col; PX.circle(x, ox, 8, 3); x.fillRect(ox - 3, 12, 6, 8); } },
    bind(x, c) { x.fillStyle = '#140a20'; PX.line(x, 3, 19, 17, 13, 3); PX.ellipse(x, 17, 13, 4, 2); x.fillStyle = c.light; x.fillRect(15, 5, 4, 6); PX.circle(x, 17, 4, 2); },
    tag(x, c) { x.fillStyle = '#e8d8a0'; x.fillRect(8, 5, 8, 14); x.fillStyle = '#b8322a'; x.fillRect(10, 8, 4, 1); x.fillRect(11, 10, 2, 5); x.fillRect(10, 16, 4, 1); x.fillStyle = '#c0c4cc'; x.fillRect(11, 1, 2, 4); x.fillRect(11, 19, 2, 4); },
    smoke(x, c) { x.fillStyle = '#9898a4'; PX.circle(x, 8, 14, 5); PX.circle(x, 15, 12, 6); x.fillStyle = '#c8c8d4'; PX.circle(x, 12, 9, 4); x.fillStyle = '#e8e8f0'; PX.circle(x, 11, 8, 2); },
    orb(x, c) { x.fillStyle = c.dark; PX.circle(x, 12, 12, 8); x.fillStyle = c.main; PX.circle(x, 12, 12, 6); x.fillStyle = '#fff'; for (let a = 0; a < 6; a += 0.3) x.fillRect(Math.round(12 + Math.cos(a) * a), Math.round(12 + Math.sin(a) * a), 1, 1); },
    star(x, c) { x.fillStyle = c.light; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; PX.line(x, 12, 12, 12 + Math.cos(a) * (k % 2 ? 5 : 10), 12 + Math.sin(a) * (k % 2 ? 5 : 10), 2); } x.fillStyle = '#fff'; PX.circle(x, 12, 12, 2); },
    eye(x, c) { x.fillStyle = '#fff'; PX.ellipse(x, 12, 12, 9, 5); x.fillStyle = c.main; PX.circle(x, 12, 12, 4); x.fillStyle = c.dark; PX.circle(x, 12, 12, 2); x.fillStyle = c.light; x.fillRect(10, 10, 1, 1); },
  };

  function colorsFor(el, override) {
    const E = ELEMENTS[el] || ELEMENTS.shinobi;
    return override || { main: E.color, light: E.light, dark: E.dark };
  }

  function make(glyph, el, override) {
    const key = glyph + ':' + el + ':' + (override ? override.main : '');
    let c = cache.get(key);
    if (c) return c;
    const C = colorsFor(el, override);
    c = U.makeCanvas(S, S);
    const x = c.getContext('2d');
    x.fillStyle = '#140c1c'; x.fillRect(0, 0, S, S);
    x.fillStyle = U.shade(C.dark, -0.55); x.fillRect(1, 1, S - 2, S - 2);
    (G[glyph] || G.star)(x, C);
    // crisp: kill antialiased alpha
    const img = x.getImageData(0, 0, S, S);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
    x.putImageData(img, 0, 0);
    x.fillStyle = C.main; x.fillRect(0, 0, S, 1); x.fillRect(0, S - 1, S, 1); x.fillRect(0, 0, 1, S); x.fillRect(S - 1, 0, 1, S);
    cache.set(key, c);
    return c;
  }

  function jutsu(def) { return make(def.icon, def.element); }
  function awakening(def) { return make('eye', 'shinobi', { main: def.colors[1], light: def.colors[0], dark: def.colors[2] }); }
  function ultimate(def) { return make('star', def.element); }
  function url(canvas) { return canvas.toDataURL(); }

  return { jutsu, awakening, ultimate, url, make };
})();
