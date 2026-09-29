'use strict';
// ---------------------------------------------------------------------------
// World renderer: ground, depth-sorted props/fighters/projectiles, effects,
// overhead bars, and full-screen overlays (cut-ins, flashes, genjutsu).
// ---------------------------------------------------------------------------

const Render = (() => {
  let canvas, ctx, VW = 640, VH = 360, scale = 3;
  let vignette = null;
  let puddle = null, fireTile = null;
  let lastT = performance.now();

  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    puddle = makeDiamond('#5aa0e0', 0.9);
    fireTile = makeDiamond('#ff7a1a', 0.8);
  }

  function makeDiamond(color, density) {
    const c = U.makeCanvas(TILE_W, TILE_H);
    const x = c.getContext('2d');
    x.fillStyle = color;
    for (let py = 0; py < TILE_H; py++) for (let px = 0; px < TILE_W; px++) {
      const e = Math.abs(px + 0.5 - 16) / 16 + Math.abs(py + 0.5 - 8) / 8;
      if (e > 1) continue;
      if (e > 0.7 && U.hash2(px, py, 3) > density * (1 - (e - 0.7) / 0.3)) continue;
      x.fillRect(px, py, 1, 1);
    }
    return c;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const zoom = (Settings.data && Settings.data.zoom) || 'normal';
    const target = zoom === 'near' ? 250 : zoom === 'far' ? 400 : 310;
    scale = Math.max(1, Math.round(h / target));
    VW = Math.ceil(w / scale); VH = Math.ceil(h / scale);
    canvas.width = VW; canvas.height = VH;
    canvas.style.width = VW * scale + 'px'; canvas.style.height = VH * scale + 'px';
    ctx.imageSmoothingEnabled = false;
    vignette = U.makeCanvas(VW, VH);
    const v = vignette.getContext('2d');
    const g = v.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    v.fillStyle = g; v.fillRect(0, 0, VW, VH);
    if (W) { W.cam.w = VW; W.cam.h = VH; }
  }

  // Awakened fighters get tweaked eyes/markings baked into their sprite.
  const lookCache = new Map();
  function lookFor(f) {
    const a = f.awakened ? f.awakened.def.id : null;
    if (!a) return f.look;
    const key = f.id + ':' + a;
    let l = lookCache.get(key);
    if (l) return l;
    l = Object.assign({}, f.look);
    if (a === 'crimson') l.eyes = '#ff2020';
    if (a === 'sage') { l.eyes = '#ffb020'; }
    if (a === 'beast') { l.eyes = '#ff6a10'; l.extra = l.extra === 'mask' ? 'mask' : 'marks'; }
    if (a === 'curse') l.eyes = '#ffe040';
    if (a === 'gates') l.skin = U.mix(f.look.skin, '#ff5a4a', 0.35);
    lookCache.set(key, l);
    return l;
  }

  // ---- fighters -------------------------------------------------------------------
  function drawFighter(ctx, f, cam, viewer) {
    let [pose, frame] = f.poseFrame();
    const look = lookFor(f);
    const lying = pose === 'lying';
    if (lying) pose = 'hurt';
    const view = f.view, flip = f.flip;
    const cv = Sprites.get(look, pose, frame, view);
    let sx = Math.round((f.x - f.y) * HALF_W - cam.x), sy = Math.round((f.x + f.y) * HALF_H - f.z - cam.y);
    if (f.freeze > 0 && (f.state === 'hitstun' || f.state === 'air')) sx += (Math.floor(f.time * 60) % 2) ? 1 : -1;

    let alpha = 1;
    const enemyOfViewer = viewer && Combat.enemies(viewer, f);
    if (f.st.stealth > 0) alpha = enemyOfViewer ? (U.dist(viewer.x, viewer.y, f.x, f.y) < 1.4 ? 0.35 : 0.08) : 0.45;
    if (f.spawnProt > 0 && Math.floor(f.time * 12) % 2) alpha *= 0.4;
    if (f.dead) alpha *= U.clamp(1 - (f.deadT - 2.2) / 1, 0, 1);
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha;

    const aw = f.awakened ? f.awakened.def.id : null;
    const key = Sprites.lookKey(look) + '|' + pose + '|' + frame + '|' + view;
    // pre-sprite awakening layers
    if (!lying && aw === 'spirit') {
      const big = Sprites.getTinted(look, pose, frame, view, '#9a60ff');
      ctx.globalAlpha = alpha * (0.3 + Math.sin(f.time * 6) * 0.05);
      ctx.save(); ctx.translate(sx, sy + 2); ctx.scale(flip ? -2 : 2, 2); ctx.drawImage(big, -SPR_OX, -SPR_OY); ctx.restore();
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#c8a0ff';
      for (let k = 0; k < 4; k++) ctx.fillRect(sx - 9, sy - 46 + k * 5, 18, 1);
      ctx.globalAlpha = alpha;
    }
    if (!lying && aw === 'beast') {
      const sil = Sprites.getTinted(look, pose, frame, view, Math.floor(f.time * 10) % 2 ? '#ff7a20' : '#ff4a10');
      ctx.globalAlpha = alpha * 0.85;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1]]) blitSprite(ctx, sil, sx + ox, sy + oy, flip);
      ctx.fillStyle = '#ff6a10';
      for (let k = 0; k < 3; k++) {
        const bx = sx + (flip ? 5 : -5), by = sy - 12;
        for (let s = 0; s < 10; s++) {
          const a = -1.2 + k * 0.5 + Math.sin(f.time * 5 + k + s * 0.3) * 0.3;
          ctx.fillRect(Math.round(bx + Math.cos(a + Math.PI) * s * (flip ? -1.2 : 1.2)), Math.round(by + Math.sin(a) * s), 2, 2);
        }
      }
      ctx.globalAlpha = alpha;
    }
    if (!lying && (f.hasBuff('larmor') || aw === 'gates') && Math.floor(f.time * 20) % 3 === 0) {
      const sil = Sprites.getTinted(look, pose, frame, view, aw === 'gates' ? '#60ff80' : '#bfe0ff');
      ctx.globalAlpha = alpha * 0.7;
      blitSprite(ctx, sil, sx + U.randi(-1, 1), sy + U.randi(-1, 0), flip);
      ctx.globalAlpha = alpha;
    }

    if (lying) {
      ctx.save();
      ctx.translate(sx + (flip ? 13 : -13), sy - 3);
      ctx.rotate(flip ? -Math.PI / 2 : Math.PI / 2);
      if (flip) ctx.scale(1, 1);
      ctx.drawImage(cv, -SPR_OX, -SPR_OY + 6);
      ctx.restore();
    } else {
      blitSprite(ctx, cv, sx, sy, flip);
    }
    // overlays
    let tint = null, ta = 0;
    if (f.flash > 0) { tint = '#ffffff'; ta = 0.85; }
    else if (f.hasBuff('stoneskin')) { tint = '#8a8078'; ta = 0.45; }
    else if (aw === 'curse') { tint = '#2a0a3a'; ta = 0.3 + Math.sin(f.time * 4) * 0.1; }
    else if (f.st.genjutsu > 0) { tint = '#400010'; ta = 0.4; }
    else if (f.st.para > 0 && Math.floor(f.time * 20) % 2) { tint = '#e0f0ff'; ta = 0.6; }
    if (tint && !lying) {
      ctx.globalAlpha = alpha * ta;
      blitSprite(ctx, Sprites.getTinted(look, pose, frame, view, tint), sx, sy, flip);
    }
    ctx.globalAlpha = 1;
    void key;
  }

  function drawOverhead(ctx, f, cam, viewer) {
    if (!f.alive || f.isClone) return;
    if (f.st.stealth > 0 && viewer && Combat.enemies(viewer, f)) return;
    const sx = Math.round((f.x - f.y) * HALF_W - cam.x), sy = Math.round((f.x + f.y) * HALF_H - f.z - cam.y) - 38;
    if (sx < -30 || sx > cam.w + 30 || sy < -20 || sy > cam.h + 40) return;
    const w = 22;
    ctx.fillStyle = '#120a18'; ctx.fillRect(sx - w / 2 - 1, sy - 1, w + 2, 5);
    ctx.fillStyle = '#3a2a30'; ctx.fillRect(sx - w / 2, sy, w, 3);
    const hp = U.clamp(f.hp / f.maxHp, 0, 1);
    ctx.fillStyle = hp < 0.3 ? '#ff4a4a' : f.teamColor; ctx.fillRect(sx - w / 2, sy, Math.round(w * hp), 3);
    ctx.fillStyle = '#6fa8ff'; ctx.fillRect(sx - w / 2, sy + 3, Math.round(w * f.chakra / f.maxChakra), 1);
    Font.draw(ctx, String(f.level), sx - w / 2 - 3, sy - 2, '#ffe9a0', { align: 'right', outline: '#120a18' });
    if (f === viewer) {
      const b = Math.floor(f.time * 3) % 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - 2, sy - 7 + b, 5, 1); ctx.fillRect(sx - 1, sy - 6 + b, 3, 1); ctx.fillRect(sx, sy - 5 + b, 1, 1);
    } else if (!viewer || U.dist(viewer.x, viewer.y, f.x, f.y) < 11) {
      Font.draw(ctx, f.name.split(' ')[0].toUpperCase(), sx, sy - 10, f.teamColor, { align: 'center', outline: '#120a18' });
    }
    if (f.awakened) {
      const k = f.awakened.t / f.awakened.def.dur;
      ctx.fillStyle = f.awakened.def.colors[1]; ctx.fillRect(sx - w / 2, sy + 5, Math.round(w * k), 1);
    }
    if (f.state === 'stun' || f.st.genjutsu > 0) {
      for (let k = 0; k < 3; k++) {
        const a = f.time * 5 + k * 2.1;
        ctx.fillStyle = f.st.genjutsu > 0 ? '#ff5050' : '#ffe14a';
        ctx.fillRect(Math.round(sx + Math.cos(a) * 7), Math.round(sy + 10 + Math.sin(a) * 2), 2, 2);
      }
    }
  }

  // ---- blocks -----------------------------------------------------------------------
  function drawBlock(ctx, b, A, cam, dt, fadeRect) {
    const spr = Art.get(b.type, b.v, A.theme);
    let sx = Math.round((b.i - b.j) * HALF_W - cam.x), sy = Math.round((b.i + b.j) * HALF_H - cam.y);
    if (b.shake > 0) { b.shake -= dt; sx += (Math.floor(b.shake * 60) % 2) ? 1 : -1; }
    let rise = 0;
    if (b.rise > 0) { b.rise -= dt; rise = Math.round(b.rise / 0.25 * b.def.h); }
    const dx = sx + spr.ox, dy = sy + spr.oy + rise;
    let alpha = 1;
    if (b.life > 0 && b.life < 1.2) alpha = Math.floor(b.life * 10) % 2 ? 0.5 : 1;
    if (fadeRect && dx < fadeRect.x1 && dx + spr.c.width > fadeRect.x0 && dy < fadeRect.y1 && dy + spr.c.height - 8 > fadeRect.y0) alpha = Math.min(alpha, 0.42);
    ctx.globalAlpha = alpha;
    if (rise) {
      ctx.save(); ctx.beginPath(); ctx.rect(dx, dy - rise - 60, spr.c.width, spr.c.height - TILE_H + 60 + 8); ctx.clip();
      ctx.drawImage(spr.c, dx, dy);
      ctx.restore();
    } else ctx.drawImage(spr.c, dx, dy);
    if (b.flash > 0) {
      b.flash -= dt;
      ctx.globalAlpha = alpha * 0.7;
      ctx.drawImage(Sprites_tint(spr.c, '#ffffff'), dx, dy);
    }
    if (b.hp < b.maxHp * 0.6 && b.maxHp !== Infinity) {
      ctx.globalAlpha = alpha;
      Art.crackOverlay(ctx, dx, dy, spr.c.width, spr.c.height - 6, b.i * 31 + b.j, 1 - b.hp / b.maxHp);
    }
    if (b.burning > 0) {
      ctx.globalAlpha = 0.25 + Math.random() * 0.15;
      ctx.drawImage(Sprites_tint(spr.c, '#ff6a1a'), dx, dy);
    }
    ctx.globalAlpha = 1;
  }

  const tintMap = new Map();
  function Sprites_tint(c, col) {
    let m = tintMap.get(c);
    if (!m) { m = {}; tintMap.set(c, m); }
    if (m[col]) return m[col];
    const t = U.makeCanvas(c.width, c.height);
    const x = t.getContext('2d');
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = col; x.fillRect(0, 0, t.width, t.height);
    m[col] = t;
    return t;
  }

  // ---- world ---------------------------------------------------------------------------
  function world(w) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (w.cam.w !== VW || w.cam.h !== VH) { w.cam.w = VW; w.cam.h = VH; }
    const A = w.arena;
    const cam = { x: Math.round(w.cam.x + w.cam.sx), y: Math.round(w.cam.y + w.cam.sy), w: VW, h: VH };
    const viewer = w.camTarget;
    ctx.fillStyle = A.T.outside;
    ctx.fillRect(0, 0, VW, VH);
    // ground
    const gx = cam.x + A.originX, gy = cam.y;
    const sx0 = Math.max(0, gx), sy0 = Math.max(0, gy);
    const sw = Math.min(A.ground.width - sx0, VW - (sx0 - gx)), sh = Math.min(A.ground.height - sy0, VH - (sy0 - gy));
    if (sw > 0 && sh > 0) ctx.drawImage(A.ground, sx0, sy0, sw, sh, sx0 - gx, sy0 - gy, sw, sh);

    // visible tile range
    const c1 = w.screenToWorld(-40, -120), c2 = w.screenToWorld(VW + 40, -120), c3 = w.screenToWorld(-40, VH + 110), c4 = w.screenToWorld(VW + 40, VH + 110);
    const i0 = Math.max(0, Math.floor(Math.min(c1.x, c2.x, c3.x, c4.x))), i1 = Math.min(A.w - 1, Math.ceil(Math.max(c1.x, c2.x, c3.x, c4.x)));
    const j0 = Math.max(0, Math.floor(Math.min(c1.y, c2.y, c3.y, c4.y))), j1 = Math.min(A.h - 1, Math.ceil(Math.max(c1.y, c2.y, c3.y, c4.y)));

    // ground overlays: water sparkle, puddles, burning tiles
    const tk = Math.floor(w.realTime * 3);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = A.idx(i, j);
      const tsx = (i - j) * HALF_W - cam.x, tsy = (i + j) * HALF_H - cam.y;
      if (tsx < -20 || tsx > VW + 20 || tsy < -20 || tsy > VH + 10) continue;
      if (A.tiles[k] === T_WATER) {
        const h = U.hash2(i, j, tk);
        if (h > 0.55) { ctx.fillStyle = h > 0.85 ? '#ffffff' : '#bfe0ff'; ctx.fillRect(Math.round(tsx - 8 + h * 16), Math.round(tsy + 4 + U.hash2(j, i, tk) * 8), 2, 1); }
      } else if (A.wet[k] > 0) {
        ctx.globalAlpha = Math.min(0.55, A.wet[k] * 0.2);
        ctx.drawImage(puddle, Math.round(tsx - 16), Math.round(tsy));
        ctx.globalAlpha = 1;
      }
      if (A.fire[k] > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.3 + Math.random() * 0.25;
        ctx.drawImage(fireTile, Math.round(tsx - 16), Math.round(tsy));
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // ground-level hazards and particles
    for (const h of w.hazards) if (h.drawGround) h.drawGround(ctx, cam);
    FX.draw(ctx, cam, 0);
    // shadows + team rings
    for (const f of w.fighters) {
      if (f.removed) continue;
      if (f.st.stealth > 0 && viewer && Combat.enemies(viewer, f)) continue;
      const [sx, sy] = DF.sp(f.x, f.y, 0, cam);
      if (sx < -30 || sx > VW + 30 || sy < -10 || sy > VH + 40) continue;
      const s = Math.max(0.5, 1 - f.z / 120);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      PX.ellipse(ctx, sx, sy, 7 * s, 3.5 * s);
      if (!f.dead && !f.isClone) {
        ctx.fillStyle = f.teamColor;
        ctx.globalAlpha = f === viewer ? 0.95 : 0.6;
        PX.ellipseRing(ctx, sx, sy, 8, 4, 1);
        ctx.globalAlpha = 1;
      }
    }
    for (const p of w.projectiles) {
      if (p.z > 3 && p.kind !== 'shadow') { const [sx, sy] = DF.sp(p.x, p.y, 0, cam); ctx.fillStyle = 'rgba(0,0,0,0.22)'; PX.ellipse(ctx, sx, sy, Math.max(2, p.size * 0.8), Math.max(1, p.size * 0.4)); }
    }

    // depth-sorted scene
    const items = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const b = A.blocks[A.idx(i, j)];
      if (!b) continue;
      const tsx = (i - j) * HALF_W - cam.x, tsy = (i + j) * HALF_H - cam.y;
      if (tsx < -60 || tsx > VW + 60 || tsy < -30 || tsy > VH + 110) continue;
      items.push({ d: i + j + 1, b });
    }
    for (const f of w.fighters) if (!f.removed) items.push({ d: f.x + f.y + 0.01, f });
    for (const p of w.projectiles) items.push({ d: p.x + p.y + 0.02, p });
    items.sort((a, b) => a.d - b.d);

    // occlusion: fade props that hide the watched fighter
    let fade = null;
    if (viewer && viewer.alive) {
      const [vx, vy] = DF.sp(viewer.x, viewer.y, viewer.z, cam);
      fade = { x0: vx - 10, x1: vx + 10, y0: vy - 30, y1: vy, d: viewer.x + viewer.y };
    }
    for (const it of items) {
      if (it.b) drawBlock(ctx, it.b, A, cam, dt, fade && it.d > fade.d + 0.3 ? fade : null);
      else if (it.f) drawFighter(ctx, it.f, cam, viewer);
      else if (it.p) { const p = it.p; if (p.draw) p.draw(ctx, p, cam); else (PROJ_DRAW[p.kind] || PROJ_DRAW.orb)(ctx, p, cam); }
    }

    for (const h of w.hazards) if (h.draw) h.draw(ctx, cam);
    FX.draw(ctx, cam, 1);
    for (const f of w.fighters) drawOverhead(ctx, f, cam, viewer);
    FX.drawTexts(ctx, cam);

    // atmosphere
    if (A.T.tint) { ctx.fillStyle = A.T.tint; ctx.fillRect(0, 0, VW, VH); }
    ctx.drawImage(vignette, 0, 0);
    drawOffscreenArrows(w, cam, viewer);
    drawMoon(w);
    if (w.flashT > 0) {
      ctx.globalAlpha = Math.min(1, w.flashT / w.flashDur) * 0.8;
      ctx.fillStyle = w.flashCol; ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }
    if (w.cutin) drawCutin(w.cutin);
  }

  function drawOffscreenArrows(w, cam, viewer) {
    if (!viewer || !viewer.alive || w.demo) return;
    for (const f of w.fighters) {
      if (!f.alive || f.isClone || !Combat.enemies(viewer, f) || f.st.stealth > 0) continue;
      const d = U.dist(viewer.x, viewer.y, f.x, f.y);
      if (d > 20) continue;
      const [sx, sy] = DF.sp(f.x, f.y, 14, cam);
      if (sx > 0 && sx < VW && sy > 0 && sy < VH) continue;
      const cx = VW / 2, cy = VH / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const ex = U.clamp(cx + Math.cos(a) * VW, 10, VW - 10), ey = U.clamp(cy + Math.sin(a) * VH, 30, VH - 50);
      ctx.fillStyle = f.teamColor;
      ctx.globalAlpha = 0.5 + 0.5 * (1 - d / 20);
      for (let k = 0; k < 4; k++) {
        const bx = ex - Math.cos(a) * k * 1.5, by = ey - Math.sin(a) * k * 1.5;
        const px = -Math.sin(a) * (3 - k), py = Math.cos(a) * (3 - k);
        PX.line(ctx, bx - px, by - py, bx + px, by + py, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawMoon(w) {
    const m = w.moonFx;
    if (!m) return;
    const v = w.camTarget;
    if (!v || !(m.victims.includes(v) || m.caster === v)) return;
    const k = Math.min(1, m.t / 0.3) * (m.t > m.dur - 0.3 ? (m.dur - m.t) / 0.3 : 1);
    ctx.globalAlpha = 0.45 * k;
    ctx.fillStyle = '#5a0008'; ctx.fillRect(0, 0, VW, VH);
    ctx.globalAlpha = 0.9 * k;
    ctx.fillStyle = '#ff2030'; PX.circle(ctx, VW / 2, 60, 34);
    ctx.fillStyle = '#b00010'; PX.circle(ctx, VW / 2 + 6, 56, 26);
    ctx.fillStyle = '#ff5060'; PX.circle(ctx, VW / 2 - 10, 50, 8);
    ctx.globalAlpha = 1;
  }

  function drawCutin(c) {
    const f = c.f;
    const el = ELEMENTS[f.ultimate.element] || ELEMENTS.shinobi;
    const k = c.t / c.dur;
    const inK = Math.min(1, c.t / 0.15), outK = k > 0.8 ? (1 - k) / 0.2 : 1;
    const h = Math.round(64 * inK * outK);
    const y = Math.round(VH * 0.32);
    ctx.fillStyle = 'rgba(10,6,18,0.85)'; ctx.fillRect(0, y - h / 2, VW, h);
    ctx.fillStyle = el.color; ctx.fillRect(0, y - h / 2, VW, 2); ctx.fillRect(0, y + h / 2 - 2, VW, 2);
    if (h < 20) return;
    // speed lines
    ctx.fillStyle = U.rgba(el.light, 0.35);
    for (let n = 0; n < 12; n++) { const ly = y - h / 2 + 4 + ((n * 37 + Math.floor(c.t * 60) * 13) % (h - 8)); ctx.fillRect((n * 97 + c.t * 900) % VW, ly, 30 + (n % 3) * 20, 1); }
    const por = Sprites.portrait(lookFor(f), 3);
    const px = Math.round(U.lerp(-por.width, VW * 0.18, U.easeOutCubic(Math.min(1, c.t / 0.25))) + c.t * 12);
    ctx.save(); ctx.beginPath(); ctx.rect(0, y - h / 2 + 2, VW, h - 4); ctx.clip();
    ctx.drawImage(por, px, y - por.height / 2 + 6);
    ctx.restore();
    const tx = Math.round(U.lerp(VW + 50, VW * 0.42, U.easeOutCubic(Math.min(1, c.t / 0.3))));
    Font.draw(ctx, 'ULTIMATE', tx, y - 18, el.light, { outline: '#120a18' });
    Font.draw(ctx, c.name.toUpperCase(), tx, y - 6, '#ffffff', { scale: 2, outline: '#120a18' });
    Font.draw(ctx, f.name.toUpperCase(), tx, y + 14, el.color, { outline: '#120a18' });
  }

  return {
    init, resize, world, lookFor,
    get ctx() { return ctx; }, get VW() { return VW; }, get VH() { return VH; }, get scale() { return scale; }, get canvas() { return canvas; },
  };
})();
