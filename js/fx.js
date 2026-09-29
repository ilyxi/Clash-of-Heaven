'use strict';
// ---------------------------------------------------------------------------
// Particles, floating text and short-lived custom visual effects.
// World coords (x, y in tiles; z in pixels). Layer 0 = on the ground (drawn
// under fighters), layer 1 = in the air (drawn over the scene).
// ---------------------------------------------------------------------------

// Draw a character-sized sprite so its feet anchor lands on (sx, sy).
function blitSprite(ctx, canvas, sx, sy, flip) {
  sx = Math.round(sx); sy = Math.round(sy);
  const w = canvas.lw || canvas.width, h = canvas.lh || canvas.height;
  if (!flip) { ctx.drawImage(canvas, sx - SPR_OX, sy - SPR_OY, w, h); return; }
  ctx.save();
  ctx.translate(sx, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(canvas, -SPR_OX, sy - SPR_OY, w, h);
  ctx.restore();
}

const FX = (() => {
  const MAX = 2600;
  let parts = [];
  let texts = [];
  let customs = [];
  let enabled = true;

  function add(p) {
    if (!enabled) return null;
    if (parts.length >= MAX) parts.splice(0, 200);
    p.t = 0;
    p.vx = p.vx || 0; p.vy = p.vy || 0; p.vz = p.vz || 0; p.z = p.z || 0;
    p.g = p.g === undefined ? 0 : p.g;
    p.drag = p.drag || 0;
    p.size = p.size || 1;
    p.layer = p.layer === undefined ? 1 : p.layer;
    parts.push(p);
    return p;
  }

  function update(dt) {
    let w = 0;
    for (let n = 0; n < parts.length; n++) {
      const p = parts[n];
      p.t += dt;
      if (p.t >= p.life) continue;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vz -= p.g * dt; p.z += p.vz * dt;
      if (p.z < 0 && p.g > 0) {
        p.z = 0;
        if (p.bounce) { p.vz = -p.vz * p.bounce; p.vx *= 0.6; p.vy *= 0.6; if (Math.abs(p.vz) < 20) p.bounce = 0; }
        else { p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; }
      }
      if (p.grow) p.size += p.grow * dt;
      parts[w++] = p;
    }
    parts.length = w;
    let tw = 0;
    for (const t of texts) {
      t.t += dt;
      if (t.t < t.life) { t.z += t.vz * dt; t.vz *= Math.exp(-3 * dt); texts[tw++] = t; }
    }
    texts.length = tw;
    let cw = 0;
    for (const c of customs) {
      c.t += dt;
      if (c.update) c.update(dt);
      if (c.t < c.life) customs[cw++] = c;
    }
    customs.length = cw;
  }

  function colorAt(p) {
    if (typeof p.color === 'string') return p.color;
    const k = Math.min(p.color.length - 1, Math.floor((p.t / p.life) * p.color.length));
    return p.color[k];
  }

  function draw(ctx, cam, layer) {
    // custom effects first (under particles)
    for (const c of customs) if ((c.layer || 0) === layer && c.draw) c.draw(ctx, cam, c.t / c.life, c);
    let additive = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const p of parts) {
        if (p.layer !== layer) continue;
        if (!!p.add !== (pass === 1)) continue;
        if (pass === 1 && !additive) { ctx.globalCompositeOperation = 'lighter'; additive = true; }
        const sx = Math.round((p.x - p.y) * HALF_W - cam.x);
        const sy = Math.round((p.x + p.y) * HALF_H - p.z - cam.y);
        if (sx < -40 || sy < -40 || sx > cam.w + 40 || sy > cam.h + 40) continue;
        const k = p.t / p.life;
        const alpha = p.fade === false ? 1 : k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
        ctx.globalAlpha = alpha * (p.alpha || 1);
        ctx.fillStyle = colorAt(p);
        const s = Math.max(1, Math.round(p.size));
        switch (p.kind) {
          case 'smoke':
          case 'glow':
            PX.circle(ctx, sx, sy, s);
            break;
          case 'spark': {
            const len = p.len || 3;
            const vx = (p.vx - p.vy) * HALF_W, vy = (p.vx + p.vy) * HALF_H - p.vz;
            const l = Math.hypot(vx, vy) || 1;
            PX.line(ctx, sx, sy, sx - (vx / l) * len, sy - (vy / l) * len, s);
            break;
          }
          case 'ring': {
            const r = p.size;
            PX.ellipseRing(ctx, sx, sy, r * ISO_RX, r * ISO_RY, p.thick || 1);
            break;
          }
          default:
            ctx.fillRect(sx - (s >> 1), sy - (s >> 1), s, s);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Floating numbers are drawn in canvas pixels (HIRES finer than the world).
  function drawTexts(ctx, cam) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const t of texts) {
      const sx = ((t.x - t.y) * HALF_W - cam.x) * HIRES;
      const sy = ((t.x + t.y) * HALF_H - t.z - cam.y) * HIRES;
      const k = t.t / t.life;
      if (k > 0.75) ctx.globalAlpha = 1 - (k - 0.75) / 0.25;
      const pop = t.t < 0.1 ? 1 + (0.1 - t.t) * 8 : 1;
      Font.draw(ctx, t.s, Math.round(sx), Math.round(sy), t.color, { align: 'center', outline: '#120a18', scale: Math.max(1, Math.round((t.scale || 1) * pop * 1.34)) });
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(HIRES, 0, 0, HIRES, 0, 0);
  }

  // ---- presets ------------------------------------------------------------------
  const R = U.rand;
  function burst(x, y, z, n, o) {
    for (let i = 0; i < n; i++) {
      const a = R(0, TAU), sp = R(o.min || 1, o.max || 4);
      add({
        x, y, z: z + R(-2, 2), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R(o.vzMin || 20, o.vzMax || 120),
        g: o.g === undefined ? 300 : o.g, drag: o.drag || 2, life: R(o.lifeMin || 0.25, o.lifeMax || 0.6),
        color: Array.isArray(o.colors) && typeof o.colors[0] !== 'string' ? o.colors : U.pick(o.colors), size: o.size || 1, kind: o.kind, add: o.add, bounce: o.bounce,
        len: o.len,
      });
    }
  }

  const ELEM_COLORS = {
    fire: ['#fff6b0', '#ffd35c', '#ff8a1f', '#e0401a'],
    water: ['#e8f6ff', '#9ad4ff', '#3fa0ff', '#1f6ad0'],
    earth: ['#ecc98f', '#c08a4a', '#8a5a2c', '#5e3b1a'],
    wind: ['#ffffff', '#d8fff0', '#9af0c8', '#5fd0a0'],
    lightning: ['#ffffff', '#e0f0ff', '#8fc8ff', '#5f7aff'],
    shinobi: ['#ffffff', '#e8dcff', '#b89aff', '#7a5ad0'],
    phys: ['#ffffff', '#fff2c0', '#ffd080'],
  };

  const api = {
    add, update, draw, drawTexts, ELEM_COLORS,
    clear() { parts = []; texts = []; customs = []; },
    get count() { return parts.length; },
    set enabled(v) { enabled = v; },

    custom(o) { o.t = 0; o.life = o.life || 0.5; customs.push(o); return o; },

    text(x, y, z, s, color = '#fff', o = {}) {
      texts.push({ x: x + R(-0.15, 0.15), y: y + R(-0.15, 0.15), z, s, color, t: 0, life: o.life || 0.9, vz: o.vz || 50, scale: o.scale || 1 });
      if (texts.length > 80) texts.shift();
    },

    hit(x, y, z, element, power = 1) {
      const cols = ELEM_COLORS[element] || ELEM_COLORS.phys;
      burst(x, y, z, Math.round(5 + power * 5), { colors: cols, kind: 'spark', min: 2, max: 6 + power * 2, g: 100, drag: 5, lifeMin: 0.12, lifeMax: 0.3, add: true, len: 3 + power * 2 });
      add({ x, y, z, life: 0.1, color: '#ffffff', size: 3 + power * 2, kind: 'glow', add: true, alpha: 0.8 });
    },
    spark(x, y, z, colors, n = 6, speed = 4) {
      burst(x, y, z, n, { colors, kind: 'spark', min: speed * 0.4, max: speed, g: 120, drag: 4, lifeMin: 0.1, lifeMax: 0.3, add: true });
    },
    debris(x, y, z, colors, n = 8, power = 1) {
      burst(x, y, z, Math.round(n), { colors, min: 0.5 * power, max: 3 * power, vzMin: 60, vzMax: 200 * power, g: 520, drag: 0.8, lifeMin: 0.6, lifeMax: 1.2, size: 2, bounce: 0.35 });
    },
    dust(x, y, n = 6, color) {
      for (let i = 0; i < n; i++) {
        const a = R(0, TAU), sp = R(0.3, 1.5);
        add({ x: x + R(-0.2, 0.2), y: y + R(-0.2, 0.2), z: R(0, 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R(5, 25), drag: 3, life: R(0.4, 0.8), color: color || U.pick(['#c8b89a', '#a8987a', '#d8ccb4']), size: R(1.5, 3), grow: 3, kind: 'smoke', alpha: 0.7 });
      }
    },
    smoke(x, y, n = 4, dark) {
      for (let i = 0; i < n; i++) {
        add({ x: x + R(-0.3, 0.3), y: y + R(-0.3, 0.3), z: R(2, 10), vx: R(-0.3, 0.3), vy: R(-0.3, 0.3), vz: R(15, 35), drag: 1, life: R(0.8, 1.6), color: dark ? ['#5a5a60', '#48484e', '#38383c'] : ['#d8d8dc', '#b8b8c0', '#98989f'], size: R(2, 3.5), grow: 3, kind: 'smoke', alpha: 0.6 });
      }
    },
    poof(x, y, n = 14) {
      for (let i = 0; i < n; i++) {
        const a = R(0, TAU), sp = R(1, 3.5);
        add({ x, y, z: R(4, 20), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: R(-20, 40), drag: 4, life: R(0.4, 0.8), color: ['#ffffff', '#e8e8f0', '#c8c8d4'], size: R(2.5, 4.5), grow: 4, kind: 'smoke', alpha: 0.9 });
      }
    },
    flame(x, y, z = 0, big = 1) {
      add({ x: x + R(-0.1, 0.1), y: y + R(-0.1, 0.1), z: z + R(0, 3), vx: R(-0.2, 0.2), vy: R(-0.2, 0.2), vz: R(25, 55) * big, drag: 1.5, life: R(0.35, 0.7), color: ELEM_COLORS.fire, size: R(1.5, 3) * big, grow: -3, kind: 'glow', add: true });
    },
    splash(x, y, n = 10, power = 1) {
      burst(x, y, 2, n, { colors: ['#e8f6ff', '#9ad4ff', '#3fa0ff'], min: 0.5, max: 2.5 * power, vzMin: 60, vzMax: 170 * power, g: 500, drag: 1, lifeMin: 0.35, lifeMax: 0.7, size: 2 });
    },
    leaves(x, y, z, n = 6) {
      burst(x, y, z, n, { colors: ['#3f8a36', '#62b04a', '#a8e070'], min: 0.3, max: 2, vzMin: 20, vzMax: 90, g: 60, drag: 2, lifeMin: 0.8, lifeMax: 1.6, size: 2 });
    },
    electric(x, y, z, n = 6) {
      burst(x, y, z, n, { colors: ELEM_COLORS.lightning, kind: 'spark', min: 1, max: 5, g: 0, drag: 6, lifeMin: 0.06, lifeMax: 0.2, add: true, len: 4 });
    },
    wind(x, y, z, n = 4) {
      burst(x, y, z, n, { colors: ELEM_COLORS.wind, kind: 'spark', min: 2, max: 6, g: 0, drag: 3, lifeMin: 0.15, lifeMax: 0.35, add: true, len: 5 });
    },
    aura(x, y, colors, n = 2, h = 26, spread = 0.35) {
      for (let i = 0; i < n; i++) {
        add({ x: x + R(-spread, spread), y: y + R(-spread, spread), z: R(0, h * 0.6), vz: R(30, 70), drag: 1, life: R(0.3, 0.6), color: colors, size: R(1, 2.5), grow: -2, kind: 'glow', add: true });
      }
    },
    ring(x, y, r, color, life = 0.35, grow = 8, thick = 1) {
      add({ x, y, z: 0, life, color, size: r, grow, kind: 'ring', layer: 0, thick });
    },
    glow(x, y, z, r, color, life = 0.15) {
      add({ x, y, z, life, color, size: r, kind: 'glow', add: true, grow: -r / life * 0.5 });
    },
    chakra(x, y, n, colors) {
      burst(x, y, 12, n, { colors: colors || ELEM_COLORS.shinobi, kind: 'glow', min: 0.5, max: 2, g: -60, drag: 3, lifeMin: 0.2, lifeMax: 0.5, add: true, size: 1.5 });
    },
    // Motion smear that follows a fighter's strike: 'arc' = swept crescent
    // (kicks, sweeps, uppercuts), 'thrust' = speed streaks along the punch line.
    smear(f, o = {}) {
      const ang0 = f.facing, reach = o.reach || 1, arc = o.arc || 1.4, z0 = o.z !== undefined ? o.z : 16;
      const col = o.color || '#ffffff', edge = o.edge || '#bfe0ff', rise = o.rise || 0, dir = o.dir || 1;
      const kind = o.kind || 'arc';
      api.custom({
        life: o.life || 0.13, layer: 1,
        draw(ctx, cam, k) {
          ctx.globalAlpha = (1 - k) * 0.9;
          if (kind === 'thrust') {
            const ca = Math.cos(ang0), sa = Math.sin(ang0), px = -sa, py = ca;
            for (let n = -1; n <= 1; n++) {
              const off = n * 0.09, len = reach * (n === 0 ? 1 : 0.7), st = 0.25 + k * 0.35;
              const [ax, ay] = DF.sp(f.x + ca * st + px * off, f.y + sa * st + py * off, f.z + z0 + n * 2, cam);
              const [bx, by] = DF.sp(f.x + ca * (st + len) + px * off, f.y + sa * (st + len) + py * off, f.z + z0 + n * 2, cam);
              ctx.fillStyle = n === 0 ? col : edge;
              PX.line(ctx, ax, ay, bx, by, n === 0 && k < 0.4 ? 2 : 1);
            }
            ctx.globalAlpha = 1;
            return;
          }
          const sweep = Math.min(1, k * 3.2), N = 16;
          for (let i = 0; i <= N; i++) {
            const u = i / N;
            if (u > sweep) break;
            const a = ang0 + dir * (-arc / 2 + arc * u);
            const r = reach * (0.7 + 0.3 * Math.sin(u * Math.PI));
            const [sx, sy] = DF.sp(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, f.z + z0 + rise * (0.5 - u), cam);
            const th = Math.max(1, Math.round(Math.sin(u * Math.PI) * 3 * (1 - k) + 0.4));
            ctx.fillStyle = edge; ctx.fillRect(Math.round(sx - th / 2) - 1, Math.round(sy - th / 2), th + 2, th);
            ctx.fillStyle = col; ctx.fillRect(Math.round(sx - th / 2), Math.round(sy - th / 2), th, Math.max(1, th - 1));
          }
          ctx.globalAlpha = 1;
        },
      });
    },
    // Comic-style starburst where a blow lands.
    impact(x, y, z, power = 1, color) {
      const rot = R(0, TAU), rays = power > 1.5 ? 10 : 8;
      api.custom({
        life: 0.12 + power * 0.03, layer: 1,
        draw(ctx, cam, k) {
          const [sx, sy] = DF.sp(x, y, z, cam);
          const Rr = (5 + power * 5) * (0.55 + k * 0.8);
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = color || '#fff2b0';
          for (let i = 0; i < rays; i++) {
            const a = rot + i * TAU / rays, len = Rr * (i % 2 ? 0.6 : 1);
            PX.line(ctx, sx + Math.cos(a) * Rr * 0.3, sy + Math.sin(a) * Rr * 0.25, sx + Math.cos(a) * len, sy + Math.sin(a) * len * 0.8, i % 2 ? 1 : 2);
          }
          ctx.fillStyle = '#ffffff';
          PX.circle(ctx, sx, sy, Math.max(1, Math.round((1 - k) * (2 + power * 1.8))));
          if (power > 1) PX.ellipseRing(ctx, sx, sy, Math.round(Rr * 1.1), Math.round(Rr * 0.8), 1);
          ctx.globalAlpha = 1;
        },
      });
    },
    // Ghost image of a sprite that fades (dash trails, flash step).
    afterimage(canvas, x, y, z, flip, life = 0.25, alpha = 0.55) {
      api.custom({
        life, layer: 1,
        draw(ctx, cam, k) {
          ctx.globalAlpha = (1 - k) * alpha;
          blitSprite(ctx, canvas, (x - y) * HALF_W - cam.x, (x + y) * HALF_H - z - cam.y, flip);
          ctx.globalAlpha = 1;
        },
      });
    },
  };
  return api;
})();
