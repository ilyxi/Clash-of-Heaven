'use strict';
// ---------------------------------------------------------------------------
// Pixel drawing helpers for jutsu visuals and default projectile renderers.
// ---------------------------------------------------------------------------

const DF = {
  // world -> screen (camera applied)
  sp(x, y, z, cam) { return [Math.round((x - y) * HALF_W - cam.x), Math.round((x + y) * HALF_H - (z || 0) - cam.y)]; },
  // world direction -> normalized screen direction
  sdir(vx, vy, vz = 0) {
    const sx = (vx - vy) * HALF_W, sy = (vx + vy) * HALF_H - vz;
    const l = Math.hypot(sx, sy) || 1;
    return [sx / l, sy / l];
  },

  groundEllipse(ctx, x, y, r, cam, fill = true) {
    const [sx, sy] = DF.sp(x, y, 0, cam);
    if (fill) PX.ellipse(ctx, sx, sy, r * ISO_RX, r * ISO_RY);
    else PX.ellipseRing(ctx, sx, sy, r * ISO_RX, r * ISO_RY, 1);
  },

  orb(ctx, sx, sy, r, cols, t = 0) {
    const f = Math.sin(t * 30) > 0 ? 1 : 0;
    ctx.fillStyle = cols[3] || cols[2]; PX.circle(ctx, sx, sy, r + 1 + f);
    ctx.fillStyle = cols[2]; PX.circle(ctx, sx, sy, r);
    ctx.fillStyle = cols[1]; PX.circle(ctx, sx - 1, sy - 1, Math.max(1, r * 0.65));
    ctx.fillStyle = cols[0]; PX.circle(ctx, sx - 1, sy - 1, Math.max(0, r * 0.3));
  },

  // Jagged lightning between two screen points.
  bolt(ctx, x0, y0, x1, y1, outer, inner, jag = 6, segs = 8, width = 2) {
    const pts = [[x0, y0]];
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    for (let i = 1; i < segs; i++) {
      const t = i / segs, o = U.rand(-jag, jag);
      pts.push([x0 + dx * t + nx * o, y0 + dy * t + ny * o]);
    }
    pts.push([x1, y1]);
    ctx.fillStyle = outer;
    for (let i = 0; i < pts.length - 1; i++) PX.line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], width + 1);
    ctx.fillStyle = inner;
    for (let i = 0; i < pts.length - 1; i++) PX.line(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], Math.max(1, width - 1));
    return pts;
  },

  // Column of fire / light rising from the ground.
  column(ctx, sx, sy, w, h, cols, t) {
    for (let y = 0; y < h; y += 2) {
      const k = y / h;
      const ww = Math.max(1, Math.round(w * (1 - k * 0.5) + Math.sin(t * 25 + y * 0.5) * 2));
      ctx.fillStyle = cols[Math.min(cols.length - 1, Math.floor(k * cols.length + Math.random() * 0.8))];
      ctx.fillRect(sx - ww, sy - y - 2, ww * 2, 2);
    }
  },

  crescent(ctx, sx, sy, dx, dy, w, d, col, col2) {
    const nx = -dy, ny = dx;
    for (let i = -10; i <= 10; i++) {
      const t = i / 10;
      const px = sx + nx * t * w - dx * t * t * d, py = sy + ny * t * w - dy * t * t * d;
      ctx.fillStyle = col; ctx.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
      ctx.fillStyle = col2; ctx.fillRect(Math.round(px + dx), Math.round(py + dy), 1, 1);
    }
  },

  shadowUnder(ctx, x, y, cam, r = 0.3, a = 0.3) {
    const [sx, sy] = DF.sp(x, y, 0, cam);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    PX.ellipse(ctx, sx, sy, r * ISO_RX, r * ISO_RY);
  },
};

// Default projectile renderers by kind.
const PROJ_DRAW = {
  kunai(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    const [dx, dy] = DF.sdir(p.vx, p.vy);
    ctx.fillStyle = '#3a3a44'; PX.line(ctx, sx - dx * 5, sy - dy * 5, sx, sy, 1);
    ctx.fillStyle = '#d8dce6'; PX.line(ctx, sx, sy, sx + dx * 3, sy + dy * 3, 2);
    ctx.fillStyle = '#b8322a'; ctx.fillRect(Math.round(sx - dx * 6), Math.round(sy - dy * 6), 2, 2);
    if (p.tag) { ctx.fillStyle = (Math.floor(p.t * 12) % 2) ? '#fff2b0' : '#e8d8a0'; ctx.fillRect(Math.round(sx - dx * 4) - 1, Math.round(sy - dy * 4), 3, 4); }
  },
  fireball(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,120,30,0.35)'; PX.circle(ctx, sx, sy, p.size + 4);
    ctx.globalCompositeOperation = 'source-over';
    DF.orb(ctx, sx, sy, p.size, ['#fffbe0', '#ffd35c', '#ff8a1f', '#c8300f'], p.t);
  },
  flower(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    DF.orb(ctx, sx, sy, p.size, ['#fffbe0', '#ffd35c', '#ff6a1f', '#a3200d'], p.t);
  },
  waterball(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    DF.orb(ctx, sx, sy, p.size, ['#ffffff', '#b8e4ff', '#3fa0ff', '#174f9c'], 0);
  },
  bubble(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    ctx.fillStyle = 'rgba(80,170,255,0.45)'; PX.circle(ctx, sx, sy, p.size);
    ctx.fillStyle = '#b8e4ff'; PX.ellipseRing(ctx, sx, sy, p.size, p.size, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - 2, sy - 3, 2, 2);
  },
  airball(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#d8fff0'; PX.ellipseRing(ctx, sx, sy, p.size, p.size, 1);
    ctx.fillStyle = 'rgba(200,255,235,0.35)'; PX.circle(ctx, sx, sy, p.size - 1);
    ctx.globalAlpha = 1;
  },
  blade(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    const [dx, dy] = DF.sdir(p.vx, p.vy);
    DF.crescent(ctx, sx, sy, dx, dy, p.size, p.size * 0.6, 'rgba(160,255,210,0.75)', '#ffffff');
  },
  rock(ctx, p, cam) {
    DF.shadowUnder(ctx, p.x, p.y, cam, 0.5 * p.size / 8, 0.35);
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    const r = p.size;
    ctx.fillStyle = '#5e3b1a'; PX.circle(ctx, sx, sy, r + 1);
    ctx.fillStyle = '#9a6a3a'; PX.circle(ctx, sx, sy, r);
    ctx.fillStyle = '#c08a4a'; PX.circle(ctx, sx - 2, sy - 2, r * 0.55);
    ctx.fillStyle = '#6a4424'; ctx.fillRect(sx + 1, sy, 3, 1); ctx.fillRect(sx - 3, sy + 3, 2, 1);
  },
  hound(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    const [dx, dy] = DF.sdir(p.vx, p.vy);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(120,170,255,0.4)'; PX.circle(ctx, sx, sy, 7);
    ctx.globalCompositeOperation = 'source-over';
    const bx = sx - dx * 4, by = sy - dy * 4;
    ctx.fillStyle = '#8fc8ff'; PX.ellipse(ctx, bx, by, 5, 3);
    ctx.fillStyle = '#e0f0ff'; PX.circle(ctx, sx + dx * 3, sy + dy * 3 - 2, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(sx + dx * 4), Math.round(sy + dy * 4 - 3), 1, 1);
    ctx.fillStyle = '#5f7aff';
    for (let i = 0; i < 3; i++) PX.line(ctx, bx, by, bx - dx * 6 + U.rand(-3, 3), by - dy * 6 + U.rand(-3, 3));
  },
  orb(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    const cols = p.cols || FX.ELEM_COLORS[p.element] || FX.ELEM_COLORS.shinobi;
    DF.orb(ctx, sx, sy, p.size, cols, p.t);
  },
  shadow(ctx, p, cam) {
    const [hx, hy] = DF.sp(p.x, p.y, 0, cam);
    const [ox, oy] = DF.sp(p.ox, p.oy, 0, cam);
    ctx.fillStyle = 'rgba(10,6,20,0.8)';
    PX.line(ctx, ox, oy, hx, hy, 3);
    PX.ellipse(ctx, hx, hy, 5, 3);
  },
  shuriken(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    const a = p.t * 30, r = p.size;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(160,255,220,0.35)'; PX.circle(ctx, sx, sy, r + 3);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#e8fff6';
    for (let k = 0; k < 4; k++) {
      const aa = a + k * Math.PI / 2;
      PX.line(ctx, sx, sy, sx + Math.cos(aa) * r, sy + Math.sin(aa) * r * 0.6, 2);
      PX.line(ctx, sx + Math.cos(aa) * r, sy + Math.sin(aa) * r * 0.6, sx + Math.cos(aa + 0.5) * r * 0.7, sy + Math.sin(aa + 0.5) * r * 0.42, 1);
    }
    ctx.fillStyle = '#7fe0b0'; PX.circle(ctx, sx, sy, 2);
  },
  dragon(ctx, p, cam) {
    const h = p.hist || [];
    const cols = p.cols;
    for (let i = 0; i < h.length; i++) {
      const q = h[i];
      const k = i / h.length;
      const [sx, sy] = DF.sp(q[0], q[1], q[2], cam);
      const r = Math.max(1, Math.round(p.size * (0.35 + 0.65 * k)));
      ctx.fillStyle = cols[3]; PX.circle(ctx, sx, sy, r + 1);
      ctx.fillStyle = i % 2 ? cols[2] : cols[1]; PX.circle(ctx, sx, sy, r);
    }
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    const [dx, dy] = DF.sdir(p.vx, p.vy);
    ctx.fillStyle = cols[3]; PX.circle(ctx, sx, sy, p.size + 2);
    ctx.fillStyle = cols[1]; PX.circle(ctx, sx, sy, p.size + 1);
    ctx.fillStyle = cols[0]; PX.circle(ctx, sx + dx * 2, sy + dy * 2, p.size * 0.5);
    // eyes & horns
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(sx + dx * 3 - dy * 3), Math.round(sy + dy * 3 + dx * 3) - 2, 2, 2);
    ctx.fillRect(Math.round(sx + dx * 3 + dy * 3), Math.round(sy + dy * 3 - dx * 3) - 2, 2, 2);
    ctx.fillStyle = cols[2];
    PX.line(ctx, sx - dy * 4, sy + dx * 4 - 3, sx - dx * 6 - dy * 7, sy - dy * 6 + dx * 7 - 6, 1);
    PX.line(ctx, sx + dy * 4, sy - dx * 4 - 3, sx - dx * 6 + dy * 7, sy - dy * 6 - dx * 7 - 6, 1);
  },
  spiral(ctx, p, cam) {
    const [sx, sy] = DF.sp(p.x, p.y, p.z, cam);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(120,180,255,0.4)'; PX.circle(ctx, sx, sy, p.size + 3);
    ctx.globalCompositeOperation = 'source-over';
    DF.orb(ctx, sx, sy, p.size, ['#ffffff', '#cfe8ff', '#5aa0ff', '#2a4fd6'], p.t);
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 3; k++) { const a = p.t * 25 + k * 2.1; ctx.fillRect(Math.round(sx + Math.cos(a) * p.size * 0.7), Math.round(sy + Math.sin(a) * p.size * 0.7), 1, 1); }
  },
};
