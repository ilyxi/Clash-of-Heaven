'use strict';
// ---------------------------------------------------------------------------
// In-game HUD drawn in pixel space on top of the world.
// ---------------------------------------------------------------------------

const HUD = (() => {
  let mini = null, miniT = 0, miniFor = null;
  const OUT = '#120a18';
  const KEYS = ['Q', 'E', 'R', 'F'];

  function bar(ctx, x, y, w, h, k, col, bg = '#2a2030', edge = OUT) {
    ctx.fillStyle = edge; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    const fw = Math.round(w * U.clamp(k, 0, 1));
    ctx.fillStyle = col; ctx.fillRect(x, y, fw, h);
    if (h >= 4) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y, fw, 1); }
  }

  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(12,8,20,0.72)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3a2e4a'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  }

  function draw(ctx, w) {
    const VW = Render.VW, VH = Render.VH;
    const f = w.player || w.camTarget;
    if (!f) return;
    if (w.player && w.player.alive && w.player.hp < w.player.maxHp * 0.25) {
      // low health warning pulse
      const k = 0.5 + 0.5 * Math.sin(w.realTime * 7);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `rgba(200,20,30,${(0.28 - i * 0.045) * (0.5 + 0.5 * k)})`;
        ctx.fillRect(i * 3, i * 3, VW - i * 6, 3); ctx.fillRect(i * 3, VH - i * 3 - 3, VW - i * 6, 3);
        ctx.fillRect(i * 3, i * 3, 3, VH - i * 6); ctx.fillRect(VW - i * 3 - 3, i * 3, 3, VH - i * 6);
      }
    }
    if (!w.demo) {
      drawStatus(ctx, f, w);
      drawSlots(ctx, f, VW, VH, w);
    }
    drawMatchInfo(ctx, w, VW);
    drawMinimap(ctx, w, VW);
    drawKillfeed(ctx, w, VW);
    drawCombo(ctx, f, VH);
    drawNotices(ctx, w, VW, VH);
    if (w.player && w.player.dead && !w.over) {
      const p = w.player;
      const txt = p.eliminated ? 'ELIMINATED - SPECTATING' : 'RESPAWN IN ' + Math.max(1, Math.ceil(p.respawnT));
      Font.draw(ctx, txt, VW / 2, VH * 0.62, '#ffffff', { align: 'center', scale: 2, outline: OUT });
    }
    if (!w.player && !w.demo) Font.draw(ctx, 'SPECTATING ' + (w.camTarget ? w.camTarget.name.toUpperCase() : '') + '   [A]/[D] SWITCH', VW / 2, VH - 62, '#c9b6ff', { align: 'center', outline: OUT });
    if (w.player && w.startT < 14 && !w.over) drawControlsHint(ctx, VW, VH, w.startT);
    if (Input.isDown('score') && !w.demo) drawScoreboard(ctx, w, VW, VH);
  }

  function drawStatus(ctx, f, w) {
    const x = 5, y = 5;
    panel(ctx, x, y, 176, 52);
    const por = Sprites.portrait(Render.lookFor(f), 2);
    ctx.fillStyle = '#1a1226'; ctx.fillRect(x + 3, y + 3, 46, 46);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 3, 46, 46); ctx.clip();
    ctx.drawImage(por, x + 1, y + 5);
    ctx.restore();
    ctx.fillStyle = f.teamColor; ctx.fillRect(x + 3, y + 48, 46, 1);
    const tx = x + 54;
    Font.draw(ctx, f.name.toUpperCase(), tx, y + 4, '#ffffff', { outline: OUT });
    Font.draw(ctx, 'LV' + f.level, x + 172, y + 4, '#ffe14a', { align: 'right', outline: OUT });
    bar(ctx, tx, y + 14, 118, 7, f.hp / f.maxHp, f.hp < f.maxHp * 0.3 ? '#ff4a4a' : '#5ad06a');
    Font.draw(ctx, Math.ceil(f.hp) + '/' + Math.round(f.maxHp), tx + 116, y + 14, '#ffffff', { align: 'right', outline: OUT });
    bar(ctx, tx, y + 24, 118, 4, f.chakra / f.maxChakra, f.state === 'charge' && Math.floor(f.time * 10) % 2 ? '#bfe0ff' : '#4a8cff');
    bar(ctx, tx, y + 31, 118, 2, f.level >= MAX_LEVEL ? 1 : f.xp / f.xpNext(), '#ffe14a');
    // guard
    if (f.guard < 100) bar(ctx, tx, y + 36, 58, 2, f.guard / 100, f.guard < 30 ? '#ff8a4a' : '#e8e8f0');
    // substitution logs
    for (let k = 0; k < 2; k++) {
      const full = f.sub >= (k + 1) * 50;
      const lx = tx + 64 + k * 12, ly = y + 36;
      ctx.fillStyle = full ? '#a8763e' : '#3a2a20'; ctx.fillRect(lx, ly, 10, 4);
      ctx.fillStyle = full ? '#e8c890' : '#4a3a2a'; ctx.fillRect(lx + 8, ly, 2, 4);
      if (!full && f.sub > k * 50) { ctx.fillStyle = '#6a4a2a'; ctx.fillRect(lx, ly + 3, Math.round(10 * ((f.sub - k * 50) / 50)), 1); }
    }
    Font.draw(ctx, 'SUB', tx + 90, y + 35, '#b8a888', { outline: OUT });
    Font.draw(ctx, 'TAI ' + f.taiLvl(), tx, y + 41, '#ffb070', { outline: OUT });
    // kunai
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = k < f.kunai ? '#d8dce6' : '#3a3a44';
      ctx.fillRect(tx + 40 + k * 6, y + 42, 1, 6); ctx.fillRect(tx + 39 + k * 6, y + 46, 3, 1);
    }
    // status icons
    let sx = tx + 64;
    const st = [];
    if (f.st.burn > 0) st.push(['BURN', '#ff8a1f']);
    if (f.st.wet > 0) st.push(['WET', '#6ec6ff']);
    if (f.st.para > 0) st.push(['SHOCK', '#e0f0ff']);
    if (f.st.slow > 0) st.push(['SLOW', '#c08a4a']);
    if (f.st.stealth > 0) st.push(['HIDDEN', '#c9b6ff']);
    for (const b of f.buffs) st.push([b.id === 'stoneskin' ? 'STONE' : b.id === 'larmor' ? 'VOLT' : 'BUFF', '#ffe14a']);
    for (const [t, c] of st.slice(0, 3)) { sx += Font.draw(ctx, t, sx, y + 42, c, { outline: OUT }) + 4; }
  }

  function orb(ctx, cx, cy, r, k, col, label, ready, time, active) {
    ctx.fillStyle = OUT; PX.circle(ctx, cx, cy, r + 1);
    ctx.fillStyle = '#1e1628'; PX.circle(ctx, cx, cy, r);
    const fillTo = Math.round(cy + r - k * r * 2);
    ctx.save(); ctx.beginPath(); ctx.rect(cx - r - 1, fillTo, r * 2 + 3, r * 2 + 2); ctx.clip();
    ctx.fillStyle = col; PX.circle(ctx, cx, cy, r);
    ctx.restore();
    if (ready) {
      const p = Math.floor(time * 6) % 2;
      ctx.fillStyle = '#ffffff'; PX.ellipseRing(ctx, cx, cy, r + 2 + p, r + 2 + p, 1);
    }
    if (active) { ctx.fillStyle = '#ffffff'; PX.ellipseRing(ctx, cx, cy, r + 1, r + 1, 1); }
    Font.draw(ctx, label, cx, cy - 3, ready ? '#ffffff' : '#c8c0d8', { align: 'center', outline: OUT });
  }

  function drawSlots(ctx, f, VW, VH, w) {
    const size = 24, gap = 5;
    const total = size * 4 + gap * 3;
    const x0 = Math.round(VW / 2 - total / 2), y0 = VH - size - 14;
    panel(ctx, x0 - 36, y0 - 9, total + 72, size + 21);
    for (let i = 0; i < 4; i++) {
      const s = f.jutsu[i];
      const x = x0 + i * (size + gap);
      if (!s) { ctx.fillStyle = '#1a1226'; ctx.fillRect(x, y0, size, size); continue; }
      ctx.drawImage(Icons.jutsu(s.def), x, y0);
      const maxCd = f.cooldownFor(s);
      if (s.cd > 0) {
        const k = s.cd / maxCd;
        ctx.fillStyle = 'rgba(8,4,14,0.72)'; ctx.fillRect(x + 1, y0 + 1, size - 2, Math.round((size - 2) * k));
        Font.draw(ctx, String(Math.ceil(s.cd)), x + size / 2, y0 + 8, '#ffffff', { align: 'center', outline: OUT });
      } else if (f.chakra < f.costFor(s)) {
        ctx.fillStyle = 'rgba(30,60,160,0.55)'; ctx.fillRect(x + 1, y0 + 1, size - 2, size - 2);
      }
      if (f.state === 'cast' && f.castSlot === i) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y0 - 1, size, 1); ctx.fillRect(x, y0 + size, size, 1); }
      Font.draw(ctx, KEYS[i], x + size / 2, y0 + size + 3, '#e8dcc0', { align: 'center', outline: OUT });
      const L = f.lvlOf(s.id);
      for (let p = 0; p < 5; p++) {
        ctx.fillStyle = p < L ? (L >= 5 ? '#ff9af0' : '#8ff0ff') : '#3a2e4a';
        ctx.fillRect(x + 2 + p * 4, y0 - 5, 3, 2);
      }
      Font.draw(ctx, String(f.costFor(s)), x + size - 2, y0 + size - 8, '#8fb8ff', { align: 'right', outline: OUT });
    }
    // awakening & ultimate orbs
    const aw = f.awakening, ul = f.ultimate;
    if (aw) {
      const k = f.awakened ? f.awakened.t / aw.dur : f.awak / 100;
      orb(ctx, x0 - 20, y0 + 11, 11, k, aw.colors[1], 'T', !f.awakened && f.awak >= 100, f.time, !!f.awakened);
    }
    if (ul) {
      const el = ELEMENTS[ul.element] || ELEMENTS.shinobi;
      orb(ctx, x0 + total + 20, y0 + 11, 11, f.ult / 100, el.color, 'G', f.ult >= 100, f.time, f.state === 'ult');
    }
    // hover labels
    if (f.awak >= 100 && aw && !f.awakened) Font.draw(ctx, 'AWAKEN!', x0 - 20, y0 - 18, aw.colors[0], { align: 'center', outline: OUT });
    if (f.ult >= 100 && ul) Font.draw(ctx, 'ULTIMATE!', x0 + total + 20, y0 - 18, '#ffe14a', { align: 'center', outline: OUT });
    void w;
  }

  function drawMatchInfo(ctx, w, VW) {
    const c = w.cfg;
    if (w.demo) return;
    const cx = VW / 2;
    let y = 5;
    if (c.timeLimit) {
      const col = w.timeLeft < 30 ? (Math.floor(w.realTime * 4) % 2 ? '#ff6a6a' : '#ffffff') : '#ffffff';
      Font.draw(ctx, U.fmtTime(w.timeLeft), cx, y, col, { align: 'center', scale: 2, outline: OUT });
      y += 18;
    }
    if (c.training) {
      Font.draw(ctx, 'TRAINING DOJO', cx, y, '#ffd35c', { align: 'center', scale: 2, outline: OUT });
      Font.draw(ctx, 'PARTNERS REVIVE - METERS CHARGE FAST - ESC TO LEAVE', cx, y + 18, '#c8c0d8', { align: 'center', outline: OUT });
      return;
    }
    const goal = c.winType === 'kills' ? 'FIRST TO ' + c.killLimit + ' KO' : c.stock + ' LIVES - LAST ONE STANDING';
    Font.draw(ctx, goal, cx, y, '#c8c0d8', { align: 'center', outline: OUT });
    y += 11;
    if (c.mode === 'teams') {
      const teams = Object.keys(w.teamScore).map(Number);
      const bw = 28;
      let x = cx - (teams.length * (bw + 4)) / 2;
      for (const t of teams) {
        ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 1, bw + 2, 12);
        ctx.fillStyle = U.shade(TEAM_COLORS[t], -0.45); ctx.fillRect(x, y, bw, 10);
        ctx.fillStyle = TEAM_COLORS[t]; ctx.fillRect(x, y, bw, 2);
        const val = c.winType === 'stock' ? w.fighters.filter((f) => f.team === t && !f.isClone).reduce((a, f) => a + Math.max(0, f.lives), 0) : w.teamScore[t];
        Font.draw(ctx, String(val), x + bw / 2, y + 2, '#ffffff', { align: 'center' });
        x += bw + 4;
      }
    } else {
      const list = w.fighters.filter((f) => !f.isClone).sort((a, b) => (c.winType === 'stock' ? b.lives - a.lives : 0) || b.kills - a.kills || b.dmgDealt - a.dmgDealt).slice(0, 3);
      list.forEach((f, i) => {
        const v = c.winType === 'stock' ? f.lives + ' LIVES' : f.kills + ' KO';
        Font.draw(ctx, (i + 1) + '. ' + f.name.split(' ')[0].toUpperCase() + '  ' + v, cx, y + i * 9, f === w.player ? '#ffe14a' : f.teamColor, { align: 'center', outline: OUT });
      });
    }
  }

  const MQ = 0.75; // minimap pixels per tile step
  function buildMini(w) {
    const A = w.arena;
    const Wd = Math.ceil((A.w + A.h) * MQ), Hd = Math.ceil((A.w + A.h) * MQ / 2);
    const c = U.makeCanvas(Wd + 3, Hd + 3);
    const x = c.getContext('2d');
    const P = A.T.pal;
    for (let j = 0; j < A.h; j++) for (let i = 0; i < A.w; i++) {
      const k = A.idx(i, j);
      const t = A.tiles[k];
      let col = [P.grass, P.dirt, P.stone, P.sand, P.water, P.wood, P.rock, P.snow][t][1];
      const b = A.blocks[k];
      if (b) col = b.type === 'cliff' ? [40, 34, 40] : [col[0] * 0.55, col[1] * 0.55, col[2] * 0.55];
      if (A.fire[k] > 0) col = [255, 120, 30];
      x.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
      x.fillRect(Math.round((i - j + A.h) * MQ) + 1, Math.round((i + j) * MQ / 2) + 1, 2, 1);
    }
    return c;
  }

  function drawMinimap(ctx, w, VW) {
    const A = w.arena;
    miniT -= 1 / 60;
    if (!mini || miniT <= 0 || miniFor !== A) { mini = buildMini(w); miniT = 1.5; miniFor = A; }
    const mx = VW - mini.width - 6, my = 5;
    panel(ctx, mx - 3, my - 2, mini.width + 6, mini.height + 5);
    ctx.drawImage(mini, mx, my);
    const toMini = (x, y) => [mx + 1 + Math.round((x - y + A.h) * MQ), my + 1 + Math.round((x + y) * MQ / 2)];
    // camera frame
    const c = w.cam;
    const p1 = w.screenToWorld(0, 0), p2 = w.screenToWorld(c.w, c.h);
    const [ax, ay] = toMini(p1.x, p1.y), [bx, by] = toMini(p2.x, p2.y);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(ax, ay, bx - ax, 1); ctx.fillRect(ax, by, bx - ax, 1); ctx.fillRect(ax, ay, 1, by - ay); ctx.fillRect(bx, ay, 1, by - ay);
    const viewer = w.player;
    for (const f of w.fighters) {
      if (!f.alive || f.isClone) continue;
      if (viewer && f.st.stealth > 0 && Combat.enemies(viewer, f)) continue;
      const [px, py] = toMini(f.x, f.y);
      ctx.fillStyle = OUT; ctx.fillRect(px - 2, py - 2, 4, 4);
      ctx.fillStyle = f === viewer ? (Math.floor(w.realTime * 4) % 2 ? '#ffffff' : '#ffe14a') : f.teamColor;
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }
  }

  function drawKillfeed(ctx, w, VW) {
    let y = 72;
    for (const k of w.killfeed) {
      const age = w.realTime - k.t;
      if (age > 6) continue;
      ctx.globalAlpha = age > 5 ? 6 - age : 1;
      const vn = k.victim.name.split(' ')[0].toUpperCase();
      const kn = k.killer ? k.killer.name.split(' ')[0].toUpperCase() : '';
      const mid = k.name ? ' [' + k.name.toUpperCase() + '] ' : ' > ';
      const total = Font.measure(kn + mid + vn) + 8;
      const x = VW - 6 - total;
      ctx.fillStyle = 'rgba(12,8,20,0.6)'; ctx.fillRect(x, y - 2, total, 11);
      let cx = x + 4;
      if (kn) cx += Font.draw(ctx, kn, cx, y, k.killer.teamColor);
      cx += Font.draw(ctx, mid, cx, y, '#a898b8');
      Font.draw(ctx, vn, cx, y, k.victim.teamColor);
      ctx.globalAlpha = 1;
      y += 12;
    }
  }

  function drawCombo(ctx, f, VH) {
    if (!f || f.comboShowT <= 0 || f.comboShow < 2) return;
    const n = f.comboShow;
    f.bestCombo = Math.max(f.bestCombo || 0, n);
    const k = f.comboShowT;
    ctx.globalAlpha = Math.min(1, k * 2);
    const col = n >= 15 ? '#ff5af0' : n >= 10 ? '#ff6a3a' : n >= 5 ? '#ffc83a' : '#ffffff';
    const pop = k > 1.3 ? 4 : 3;
    Font.draw(ctx, String(n), 12, VH * 0.42, col, { scale: pop, outline: OUT });
    Font.draw(ctx, 'HIT COMBO', 12, VH * 0.42 + pop * 7 + 3, '#ffffff', { outline: OUT });
    ctx.globalAlpha = 1;
  }

  function drawNotices(ctx, w, VW, VH) {
    let y = VH * 0.2;
    for (const n of w.notices) {
      const a = n.t < 0.15 ? n.t / 0.15 : n.t > 2.4 ? (3 - n.t) / 0.6 : 1;
      ctx.globalAlpha = U.clamp(a, 0, 1);
      const big = /VICTORY|DEFEAT|WINS|DRAW/.test(n.text);
      Font.draw(ctx, n.text, VW / 2, y, n.color, { align: 'center', scale: big ? 3 : 1, outline: OUT });
      y += big ? 30 : 12;
      ctx.globalAlpha = 1;
    }
  }

  function drawControlsHint(ctx, VW, VH, t) {
    const lines = [
      'WASD MOVE   MOUSE AIM   LMB ATTACK   RMB HEAVY (HOLD)',
      'SPACE DASH / SUBSTITUTE   SHIFT BLOCK (TAP = PARRY)',
      'Q E R F JUTSU   X KUNAI   C CHARGE CHAKRA',
      'T AWAKEN   G ULTIMATE   TAB SCORES   ESC PAUSE',
    ];
    ctx.globalAlpha = t > 11 ? (14 - t) / 3 : 1;
    const wdt = 250;
    panel(ctx, 5, 62, wdt, 50);
    lines.forEach((l, i) => Font.draw(ctx, l, 10, 67 + i * 11, '#e8dcc0'));
    ctx.globalAlpha = 1;
    void VW; void VH;
  }

  function drawScoreboard(ctx, w, VW, VH) {
    const list = w.fighters.filter((f) => !f.isClone).sort((a, b) => (w.cfg.mode === 'teams' ? a.team - b.team : 0) || b.kills - a.kills || b.dmgDealt - a.dmgDealt);
    const rowH = 12, wd = 300, h = 30 + list.length * rowH;
    const x = Math.round(VW / 2 - wd / 2), y = Math.round(VH / 2 - h / 2);
    panel(ctx, x, y, wd, h);
    Font.draw(ctx, 'SHINOBI', x + 8, y + 8, '#c8c0d8');
    const cols = [['LV', 150], ['K', 175], ['D', 197], ['A', 219], ['DMG', 255], [w.cfg.winType === 'stock' ? 'LIVES' : 'COMBO', 290]];
    for (const [t, cx] of cols) Font.draw(ctx, t, x + cx, y + 8, '#c8c0d8', { align: 'right' });
    list.forEach((f, i) => {
      const ry = y + 22 + i * rowH;
      if (f === w.player) { ctx.fillStyle = 'rgba(255,225,74,0.12)'; ctx.fillRect(x + 2, ry - 2, wd - 4, rowH); }
      ctx.fillStyle = f.teamColor; ctx.fillRect(x + 6, ry, 3, 7);
      Font.draw(ctx, f.name.toUpperCase(), x + 13, ry, f.dead ? '#806878' : '#ffffff');
      const vals = [f.level, f.kills, f.deaths, f.assists, Math.round(f.dmgDealt), w.cfg.winType === 'stock' ? Math.max(0, f.lives) : f.bestCombo || 0];
      vals.forEach((v, k) => Font.draw(ctx, String(v), x + cols[k][1], ry, '#e8dcc0', { align: 'right' }));
    });
  }

  return { draw, invalidateMini() { mini = null; } };
})();
