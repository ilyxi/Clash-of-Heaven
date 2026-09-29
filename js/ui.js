'use strict';
// ---------------------------------------------------------------------------
// HTML menus: title, battle setup, character creator, roster, how-to-play,
// settings, pause and results. Rendered into #ui over the game canvas.
// ---------------------------------------------------------------------------

const UI = (() => {
  let root;
  let rafs = [];

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return el;
  }

  function clear() {
    for (const id of rafs) cancelAnimationFrame(id);
    rafs = [];
    root.innerHTML = '';
    Input.enabled = true;
  }

  function screen(cls, ...kids) {
    clear();
    const s = h('div', { class: 'screen ' + cls }, ...kids);
    root.appendChild(s);
    return s;
  }

  function btn(text, fn, cls = '') {
    return h('button', {
      class: 'btn ' + cls, text,
      onmouseenter: () => SFX.play('ui', 0.5),
      onclick: (e) => { SFX.init(); SFX.play(cls.includes('back') ? 'uiBack' : 'uiOk', 0.8); fn(e); },
    });
  }

  function seg(options, value, onPick) {
    const wrap = h('div', { class: 'seg' });
    for (const [v, label] of options) {
      wrap.appendChild(h('button', {
        class: v === value ? 'on' : '', text: label,
        onclick: () => { SFX.play('ui', 0.6); onPick(v); },
      }));
    }
    return wrap;
  }

  function portraitCanvas(look, scale = 2) {
    const src = Sprites.portrait(look, scale);
    const c = U.makeCanvas(src.width, src.height);
    c.className = 'px';
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  function iconImg(canvas, size = 48) { return h('img', { class: 'px', src: canvas.toDataURL(), width: size, height: size, alt: '' }); }

  function elTag(el) {
    const E = ELEMENTS[el] || ELEMENTS.shinobi;
    return h('span', { class: 'tag', style: `background:${E.color}`, text: E.short });
  }

  // =================================================================== TITLE
  function title() {
    screen('clear',
      h('div', { class: 'logo' }, h('span', { class: 'l1', text: 'CLASH' }), h('span', { class: 'l2', text: 'OF' }), h('span', { class: 'l3', text: 'HEAVEN' })),
      h('div', { class: 'tagline', text: 'SHINOBI ARENA  -  UP TO 10 FIGHTERS' }),
      h('div', { class: 'menu' },
        btn('Quick Battle', () => Game.quickBattle(), 'primary'),
        btn('Custom Battle', () => setup()),
        btn('Create Shinobi', () => creator(null, title)),
        btn('Roster', () => roster()),
        btn('How to Play', () => howto(title)),
        btn('Settings', () => settings(title)),
      ),
      h('div', { class: 'footer', text: 'Mouse + keyboard or gamepad  -  M to mute' }),
    );
  }

  // =================================================================== SETUP
  const SETUP_KEY = 'coh_setup_v1';
  function defaultSetup() {
    return { mode: 'ffa', teamCount: 2, count: 6, winType: 'kills', killLimit: 10, stock: 3, timeLimit: 300, map: 'random', diff: 'normal', player: PRESETS[7].id, spectate: false, slots: [] };
  }
  function loadSetup() {
    const s = Object.assign(defaultSetup(), Store.get(SETUP_KEY, {}));
    if (!Roster.byId(s.player)) s.player = Roster.all()[0].id;
    fixSlots(s);
    return s;
  }
  function fixSlots(s) {
    s.slots = s.slots || [];
    while (s.slots.length < s.count) { const i = s.slots.length; s.slots.push({ char: i === 0 ? s.player : 'random', team: i % s.teamCount, diff: s.diff }); }
    s.slots.length = s.count;
    s.slots[0].char = s.player;
    for (const sl of s.slots) { if (sl.team >= s.teamCount) sl.team = sl.team % s.teamCount; if (sl.char !== 'random' && !Roster.byId(sl.char)) sl.char = 'random'; }
  }

  function setup() {
    const s = loadSetup();
    const save = () => Store.set(SETUP_KEY, s);
    const rerender = () => { save(); setup(); };
    const all = Roster.all();

    const rules = h('div', { class: 'panel' },
      h('h3', { text: 'MODE' }),
      seg([['ffa', 'Free For All'], ['teams', 'Teams']], s.mode, (v) => { s.mode = v; rerender(); }),
      s.mode === 'teams' ? h('div', null, h('h3', { text: 'TEAMS' }), seg([[2, '2 Teams'], [3, '3'], [4, '4'], [5, '5']], s.teamCount, (v) => { s.teamCount = v; s.slots.forEach((sl, i) => { sl.team = i % v; }); rerender(); })) : null,
      h('h3', { text: 'FIGHTERS' }),
      seg([2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [n, String(n)]), s.count, (v) => { s.count = v; fixSlots(s); rerender(); }),
      h('h3', { text: 'VICTORY' }),
      seg([['kills', 'KO Race'], ['stock', 'Survival']], s.winType, (v) => { s.winType = v; rerender(); }),
      h('div', { style: 'margin-top:8px' }, s.winType === 'kills'
        ? seg([[5, '5 KO'], [10, '10 KO'], [15, '15 KO'], [25, '25 KO']], s.killLimit, (v) => { s.killLimit = v; rerender(); })
        : seg([[1, '1 Life'], [3, '3 Lives'], [5, '5 Lives']], s.stock, (v) => { s.stock = v; rerender(); })),
      h('h3', { text: 'TIME LIMIT' }),
      seg([[180, '3 min'], [300, '5 min'], [480, '8 min'], [720, '12 min'], [0, 'None']], s.timeLimit, (v) => { s.timeLimit = v; rerender(); }),
      h('h3', { text: 'ARENA' }),
      seg([['random', 'Random'], ...Object.keys(THEMES).map((k) => [k, THEMES[k].name])], s.map, (v) => { s.map = v; rerender(); }),
      h('h3', { text: 'AI DIFFICULTY (ALL)' }),
      seg([...Object.keys(AI_DIFF).map((k) => [k, AI_DIFF[k].name]), ['mixed', 'Mixed']], s.diff, (v) => { s.diff = v; s.slots.forEach((sl) => { sl.diff = v === 'mixed' ? U.pick(Object.keys(AI_DIFF)) : v; }); rerender(); }),
    );

    const playerPick = h('div', { class: 'roster', style: 'max-height:210px;overflow-y:auto' });
    for (const c of all) {
      const card = h('div', { class: 'rcard' + (c.id === s.player ? ' on' : ''), onclick: () => { s.player = c.id; s.slots[0].char = c.id; rerender(); } },
        portraitCanvas(c.look, 1), h('div', { class: 'n', text: c.name }), h('div', { class: 'el', style: `color:${(ELEMENTS[c.affinity] || ELEMENTS.shinobi).color}`, text: (ELEMENTS[c.affinity] || ELEMENTS.shinobi).name }));
      if (!c.id.startsWith('p_')) card.appendChild(h('div', { class: 'badge', text: 'CUSTOM' }));
      playerPick.appendChild(card);
    }

    const list = h('div', { class: 'slotlist' });
    s.slots.forEach((sl, i) => {
      const isPlayer = i === 0 && !s.spectate;
      const ch = sl.char === 'random' ? null : Roster.byId(sl.char);
      const sel = h('select', { onchange: (e) => { sl.char = e.target.value; if (i === 0) s.player = sl.char === 'random' ? s.player : sl.char; rerender(); } },
        !isPlayer ? h('option', { value: 'random', text: 'Random' }) : null,
        ...all.map((c) => h('option', { value: c.id, text: c.name })));
      sel.value = sl.char;
      const teamSel = s.mode === 'teams' ? h('select', { onchange: (e) => { sl.team = +e.target.value; save(); } }, ...Array.from({ length: s.teamCount }, (_, t) => h('option', { value: t, text: TEAM_NAMES[t] }))) : h('span');
      if (s.mode === 'teams') { teamSel.value = sl.team; teamSel.style.color = TEAM_COLORS[sl.team]; }
      const diffSel = isPlayer ? h('span', { class: 'you', text: 'YOU' }) : h('select', { onchange: (e) => { sl.diff = e.target.value; save(); } }, ...Object.keys(AI_DIFF).map((k) => h('option', { value: k, text: AI_DIFF[k].name })));
      if (!isPlayer) diffSel.value = sl.diff in AI_DIFF ? sl.diff : 'normal';
      list.appendChild(h('div', { class: 'srow' }, ch ? portraitCanvas(ch.look, 1) : h('canvas', { width: 24, height: 22 }), sel, teamSel, diffSel));
    });

    const fighters = h('div', { class: 'panel' },
      h('h3', { text: 'YOUR SHINOBI' }),
      playerPick,
      h('div', { class: 'row', style: 'margin:10px 0' },
        h('label', { class: 'row', style: 'gap:6px;cursor:pointer' }, h('input', { type: 'checkbox', checked: s.spectate, onchange: (e) => { s.spectate = e.target.checked; rerender(); } }), 'Spectate only (all AI)'),
        h('span', { class: 'grow' }),
        btn('Create New', () => creator(null, setup), 'small')),
      h('h3', { text: 'ROSTER' }),
      list,
    );

    screen('dim',
      h('div', { class: 'topbar' }, btn('Back', title, 'small back'), h('h2', { text: 'CUSTOM BATTLE' }), btn('Start Battle', () => { save(); Game.startFromSetup(s); }, 'primary')),
      h('div', { class: 'wrap cols setup' }, rules, fighters),
    );
  }

  // Turn a setup into a World config.
  function buildConfig(s) {
    const all = Roster.all();
    const used = new Set();
    const map = s.map === 'random' ? U.pick(Object.keys(THEMES)) : s.map;
    const entries = s.slots.map((sl, i) => {
      let c = sl.char === 'random' ? null : Roster.byId(sl.char);
      if (!c) {
        const pool = all.filter((x) => !used.has(x.id));
        c = U.pick(pool.length ? pool : all);
      }
      used.add(c.id);
      const isPlayer = i === 0 && !s.spectate;
      return { char: U.deepCopy(c), team: s.mode === 'teams' ? sl.team : i, isPlayer, diff: sl.diff === 'mixed' || !AI_DIFF[sl.diff] ? U.pick(Object.keys(AI_DIFF)) : sl.diff };
    });
    return { map, mode: s.mode, teamCount: s.teamCount, winType: s.winType, killLimit: s.killLimit, stock: s.stock, timeLimit: s.timeLimit, entries, seed: (Math.random() * 1e9) | 0 };
  }

  // ================================================================= CREATOR
  function creator(existing, back) {
    const isNew = !existing || existing.id.startsWith('p_');
    const ch = existing ? U.deepCopy(existing) : Roster.randomCharacter('New Shinobi');
    if (!existing || existing.id.startsWith('p_')) { ch.id = Roster.newId(); if (existing) ch.name = existing.name + ' II'; }
    let tab = 'look', selSlot = 0, filter = 'all';
    let view = 'F', flip = false, poseIdx = 0, facingIdx = 0;
    const POSE_CYCLE = [['idle', 2], ['run', 4], ['jab', 1], ['cross', 1], ['kick', 1], ['uppercut', 1], ['seal', 2], ['release', 1], ['block', 1], ['charge', 2], ['raise', 1], ['victory', 1]];

    const prev = U.makeCanvas(SPR_W * 5, SPR_H * 5);
    prev.className = 'px';
    const pctx = prev.getContext('2d');
    const statsBox = h('div', { style: 'width:100%' });
    const body = h('div');
    const nameInput = h('input', { type: 'text', value: ch.name, maxlength: 20, oninput: (e) => { ch.name = e.target.value; renderStats(); } });

    function renderStats() {
      statsBox.innerHTML = '';
      const E = ELEMENTS[ch.affinity] || ELEMENTS.shinobi;
      const add = (k, v, col) => statsBox.appendChild(h('div', { class: 'stat' }, h('span', { text: k }), h('b', { text: v, style: col ? `color:${col}` : '' })));
      add('Name', ch.name || '-');
      add('Affinity', E.name, E.color);
      ch.jutsu.forEach((id, i) => add('Jutsu ' + ['Q', 'E', 'R', 'F'][i], JUTSU[id] ? JUTSU[id].name : '-', JUTSU[id] ? ELEMENTS[JUTSU[id].element].color : ''));
      add('Awakening', AWAKENINGS[ch.awakening].name, AWAKENINGS[ch.awakening].colors[1]);
      add('Ultimate', ULTIMATES[ch.ultimate].name, ELEMENTS[ULTIMATES[ch.ultimate].element].color);
    }

    let t0 = performance.now();
    function anim() {
      const t = (performance.now() - t0) / 1000;
      const [pose, n] = POSE_CYCLE[poseIdx % POSE_CYCLE.length];
      const frame = Math.floor(t * (pose === 'run' ? 8 : 3)) % n;
      pctx.clearRect(0, 0, prev.width, prev.height);
      const spr = Sprites.get(ch.look, pose, frame, view);
      pctx.save();
      if (flip) { pctx.translate(prev.width, 0); pctx.scale(-1, 1); }
      pctx.fillStyle = 'rgba(0,0,0,0.3)';
      pctx.fillRect(SPR_OX * 5 - 30, (SPR_OY - 1) * 5, 60, 8);
      pctx.drawImage(spr, 0, 0, SPR_W * 5, SPR_H * 5);
      pctx.restore();
      rafs.push(requestAnimationFrame(anim));
    }

    function lookTab() {
      const L = ch.look;
      const swatch = (key, options) => h('div', { class: 'swatches' }, ...options.map((c) => h('div', { class: 'sw' + (L[key] === c ? ' on' : ''), style: `background:${c}`, title: c, onclick: () => { L[key] = c; renderBody(); } })));
      return h('div', null,
        h('label', { class: 'field' }, 'NAME', nameInput),
        h('h3', { text: 'HAIR STYLE' }), seg(LOOKS.hairStyles.map((x) => [x.id, x.name]), L.hairStyle, (v) => { L.hairStyle = v; renderBody(); }),
        h('h3', { text: 'HAIR COLOR' }), swatch('hair', LOOKS.hairColor),
        h('h3', { text: 'SKIN' }), swatch('skin', LOOKS.skin),
        h('h3', { text: 'EYES' }), swatch('eyes', LOOKS.eyeColor),
        h('h3', { text: 'OUTFIT' }), swatch('outfit', LOOKS.outfit),
        h('h3', { text: 'PANTS' }), swatch('pants', LOOKS.pants),
        h('h3', { text: 'HEADBAND / SCARF / CLOAK CLOTH' }), swatch('cloth', LOOKS.cloth),
        h('h3', { text: 'HEADBAND' }), seg(LOOKS.headbands.map((x) => [x.id, x.name]), L.headband, (v) => { L.headband = v; renderBody(); }),
        h('h3', { text: 'EXTRA' }), seg(LOOKS.extras.map((x) => [x.id, x.name]), L.extra, (v) => { L.extra = v; renderBody(); }),
        h('div', { class: 'row', style: 'margin-top:14px' }, btn('Randomize Look', () => { const r = Roster.randomCharacter(); ch.look = r.look; renderBody(); }, 'small')),
      );
    }

    function elementTab() {
      const cards = h('div', { class: 'cards' });
      for (const id of ELEMENT_ORDER) {
        const E = ELEMENTS[id];
        const beatenBy = Object.values(ELEMENTS).find((x) => x.beats === id);
        cards.appendChild(h('button', { class: 'card' + (ch.affinity === id ? ' on' : ''), onclick: () => { ch.affinity = id; renderBody(); } },
          iconImg(Icons.make(id === 'fire' ? 'ball' : id === 'water' ? 'wave' : id === 'earth' ? 'boulder' : id === 'wind' ? 'tornado' : id === 'lightning' ? 'bolt' : 'orb', id)),
          h('div', null,
            h('div', { class: 't', text: E.name }),
            h('div', { class: 'd', text: id === 'shinobi' ? 'No elemental weakness. +15% damage with Shinobi arts.' : `+15% damage with ${E.name} jutsu. Strong vs ${ELEMENTS[E.beats].short}${beatenBy ? ', weak vs ' + beatenBy.short : ''}.` }))));
      }
      return h('div', null,
        h('p', { class: 'note', text: 'Your chakra nature. Jutsu of your affinity hit 15% harder, and elemental matchups follow the cycle below. You may still learn jutsu of ANY element.' }),
        h('div', { class: 'wheel' }, ...['fire', 'wind', 'lightning', 'earth', 'water', 'fire'].map((e, i, a) => [h('span', { style: `color:${ELEMENTS[e].color}`, text: ELEMENTS[e].short }), i < a.length - 1 ? h('span', { class: 'note', text: ' beats ' }) : null]).flat()),
        cards);
    }

    function jutsuTab() {
      const slots = h('div', { class: 'slots' });
      ch.jutsu.forEach((id, i) => {
        const def = JUTSU[id];
        slots.appendChild(h('div', { class: 'slot' + (selSlot === i ? ' on' : ''), onclick: () => { selSlot = i; renderBody(); } },
          h('div', { class: 'k', text: ['Q', 'E', 'R', 'F'][i] }), def ? iconImg(Icons.jutsu(def), 40) : null, h('div', { text: def ? def.name : 'Empty' })));
      });
      const filters = seg([['all', 'All'], ...ELEMENT_ORDER.map((e) => [e, ELEMENTS[e].short])], filter, (v) => { filter = v; renderBody(); });
      const cards = h('div', { class: 'cards', style: 'margin-top:10px' });
      for (const def of Object.values(JUTSU)) {
        if (filter !== 'all' && def.element !== filter) continue;
        const inSlot = ch.jutsu.indexOf(def.id);
        cards.appendChild(h('button', {
          class: 'card' + (inSlot === selSlot ? ' on' : ''),
          onclick: () => {
            const other = ch.jutsu.indexOf(def.id);
            if (other >= 0 && other !== selSlot) ch.jutsu[other] = ch.jutsu[selSlot];
            ch.jutsu[selSlot] = def.id;
            selSlot = (selSlot + 1) % 4;
            renderBody();
          },
        }, iconImg(Icons.jutsu(def)), h('div', null,
          h('div', { class: 't', text: def.name + (inSlot >= 0 ? '  [' + ['Q', 'E', 'R', 'F'][inSlot] + ']' : '') }),
          h('div', { class: 'meta' }, elTag(def.element), `${def.cost} chakra  -  ${def.cd}s cooldown`),
          h('div', { class: 'd', text: def.desc }),
          h('div', { class: 'm', text: def.mastery }))));
      }
      return h('div', null, h('p', { class: 'note', text: 'Pick a slot, then click a jutsu to learn it. Jutsu level up (Lv1-5) during matches as you land hits and score KOs; Lv5 unlocks a mastery perk.' }), slots, filters, cards);
    }

    function awakeningTab() {
      const cards = h('div', { class: 'cards' });
      for (const a of Object.values(AWAKENINGS)) {
        cards.appendChild(h('button', { class: 'card' + (ch.awakening === a.id ? ' on' : ''), onclick: () => { ch.awakening = a.id; renderBody(); } },
          iconImg(Icons.awakening(a)), h('div', null, h('div', { class: 't', text: a.name }), h('div', { class: 'meta', text: a.dur + 's transformation' }), h('div', { class: 'd', text: a.desc }))));
      }
      return h('div', null, h('p', { class: 'note', text: 'The awakening meter fills as you deal and take damage, parry and score KOs. Press T when full to transform (with a shockwave that blows enemies away).' }), cards);
    }

    function ultimateTab() {
      const cards = h('div', { class: 'cards' });
      for (const u of Object.values(ULTIMATES)) {
        cards.appendChild(h('button', { class: 'card' + (ch.ultimate === u.id ? ' on' : ''), onclick: () => { ch.ultimate = u.id; renderBody(); } },
          iconImg(Icons.ultimate(u)), h('div', null, h('div', { class: 't', text: u.name }), h('div', { class: 'meta' }, elTag(u.element)), h('div', { class: 'd', text: u.desc }))));
      }
      return h('div', null, h('p', { class: 'note', text: 'The ultimate meter charges from combat (and slowly over time). Press G when full: you are invulnerable during the wind-up.' }), cards);
    }

    function renderBody() {
      body.innerHTML = '';
      const tabs = h('div', { class: 'tabs' }, ...[['look', 'Look'], ['element', 'Affinity'], ['jutsu', 'Jutsu'], ['awakening', 'Awakening'], ['ultimate', 'Ultimate']].map(([k, l]) => h('button', { class: tab === k ? 'on' : '', text: l, onclick: () => { SFX.play('ui', 0.6); tab = k; renderBody(); } })));
      body.appendChild(tabs);
      body.appendChild({ look: lookTab, element: elementTab, jutsu: jutsuTab, awakening: awakeningTab, ultimate: ultimateTab }[tab]());
      renderStats();
    }

    function doSave(then) {
      ch.name = (ch.name || '').trim() || 'Nameless';
      if (new Set(ch.jutsu).size !== 4) { alert('Pick four different jutsu.'); return; }
      Roster.save(ch);
      then();
    }

    const left = h('div', { class: 'panel preview' },
      prev,
      h('div', { class: 'row center' },
        btn('Turn', () => { facingIdx = (facingIdx + 1) % 4; view = facingIdx < 2 ? 'F' : 'B'; flip = facingIdx % 2 === 1; }, 'small'),
        btn('Pose', () => { poseIdx++; t0 = performance.now(); }, 'small')),
      statsBox,
    );
    screen('dim',
      h('div', { class: 'topbar' }, btn('Cancel', () => (back || title)(), 'small back'), h('h2', { text: isNew ? 'CREATE SHINOBI' : 'EDIT SHINOBI' }),
        btn('Save', () => doSave(() => (back || title)()), 'small'),
        btn('Save & Battle', () => doSave(() => { const st = loadSetup(); st.player = ch.id; st.slots[0].char = ch.id; st.spectate = false; Store.set(SETUP_KEY, st); setup(); }), 'primary')),
      h('div', { class: 'wrap cols two' }, left, h('div', { class: 'panel' }, body)),
    );
    renderBody();
    anim();
  }

  // ================================================================== ROSTER
  function roster(selId) {
    const all = Roster.all();
    let sel = Roster.byId(selId) || all[0];
    const grid = h('div', { class: 'roster' });
    for (const c of all) {
      const card = h('div', { class: 'rcard' + (c.id === sel.id ? ' on' : ''), onclick: () => roster(c.id) },
        portraitCanvas(c.look, 1), h('div', { class: 'n', text: c.name }),
        h('div', { class: 'el', style: `color:${(ELEMENTS[c.affinity] || ELEMENTS.shinobi).color}`, text: (ELEMENTS[c.affinity] || ELEMENTS.shinobi).name }));
      if (!c.id.startsWith('p_')) card.appendChild(h('div', { class: 'badge', text: 'CUSTOM' }));
      grid.appendChild(card);
    }
    const custom = !sel.id.startsWith('p_');
    const info = h('div', { class: 'panel' },
      h('div', { class: 'row' }, portraitCanvas(sel.look, 3), h('div', null, h('h2', { text: sel.name.toUpperCase() }), h('div', { style: `color:${(ELEMENTS[sel.affinity] || ELEMENTS.shinobi).color}`, text: (ELEMENTS[sel.affinity] || ELEMENTS.shinobi).name + ' affinity' }))),
      h('h3', { text: 'JUTSU' }),
      h('div', { class: 'cards' }, ...sel.jutsu.map((id, i) => { const d = JUTSU[id]; return h('div', { class: 'card' }, iconImg(Icons.jutsu(d), 40), h('div', null, h('div', { class: 't', text: ['Q', 'E', 'R', 'F'][i] + '  ' + d.name }), h('div', { class: 'd', text: d.desc }))); })),
      h('h3', { text: 'AWAKENING & ULTIMATE' }),
      h('div', { class: 'cards' },
        h('div', { class: 'card' }, iconImg(Icons.awakening(AWAKENINGS[sel.awakening]), 40), h('div', null, h('div', { class: 't', text: AWAKENINGS[sel.awakening].name }), h('div', { class: 'd', text: AWAKENINGS[sel.awakening].desc }))),
        h('div', { class: 'card' }, iconImg(Icons.ultimate(ULTIMATES[sel.ultimate]), 40), h('div', null, h('div', { class: 't', text: ULTIMATES[sel.ultimate].name }), h('div', { class: 'd', text: ULTIMATES[sel.ultimate].desc })))),
      h('div', { class: 'row', style: 'margin-top:14px' },
        btn(custom ? 'Edit' : 'Customize Copy', () => creator(sel, () => roster(sel.id)), 'small'),
        custom ? btn('Delete', () => { if (confirm('Delete ' + sel.name + '?')) { Roster.remove(sel.id); roster(); } }, 'small danger') : null,
        btn('Battle as ' + sel.name.split(' ')[0], () => { const st = loadSetup(); st.player = sel.id; st.slots[0].char = sel.id; st.spectate = false; Store.set(SETUP_KEY, st); setup(); }, 'primary small')),
    );
    screen('dim',
      h('div', { class: 'topbar' }, btn('Back', title, 'small back'), h('h2', { text: 'ROSTER' }), btn('Create New', () => creator(null, () => roster()), 'small')),
      h('div', { class: 'wrap cols setup' }, h('div', { class: 'panel' }, grid), info),
    );
  }

  // ================================================================= HOW TO
  function howto(back) {
    const k = (key, what) => [h('span', { class: 'key', text: key }), h('span', { text: what })];
    screen('dim',
      h('div', { class: 'topbar' }, btn('Back', () => back(), 'small back'), h('h2', { text: 'HOW TO PLAY' })),
      h('div', { class: 'wrap panel howto' },
        h('section', null, h('h3', { text: 'CONTROLS' }), h('div', { class: 'keys' },
          k('WASD', 'Move (arrow keys work too)'), k('MOUSE', 'Aim - jutsu fly toward the cursor'), k('LMB / J', 'Light attack - tap for a combo'),
          k('RMB / K', 'Heavy attack - hold to charge, breaks guards'), k('SPACE', 'Dash (invulnerable start) / Substitution when hit'),
          k('SHIFT / L', 'Block - tap right before a hit to PARRY'), k('Q E R F', 'Your four jutsu (or 1-4)'), k('X / MMB', 'Throw kunai (3 ammo)'),
          k('C', 'Hold to charge chakra'), k('T', 'Awaken (meter full)'), k('G / V', 'Ultimate (meter full)'), k('TAB', 'Scoreboard'), k('ESC', 'Pause'), k('M', 'Mute'))),
        h('section', null, h('h3', { text: 'GAMEPAD' }), h('p', { text: 'Left stick move, right stick aim. A light, X heavy, B dash, RB block, LB kunai, RT charge. Hold LT + A/B/X/Y for jutsu 1-4. L3 awaken, R3 ultimate.' })),
        h('section', null, h('h3', { text: 'COMBAT BASICS' }),
          h('p', { text: 'Mash light attack for a 4-hit string ending in a launcher. Launched enemies can be juggled with more hits or jutsu. Slam enemies into walls, trees and houses for bonus damage - big hits smash straight through.' }),
          h('p', { text: 'Heavy attacks are slow but crush blocks. A fully charged heavy breaks any guard.' }),
          h('p', { text: 'Dash through attacks: dodging a hit during the first moments of a dash is a PERFECT DODGE - you gain chakra and your next hit deals +30%.' })),
        h('section', null, h('h3', { text: 'DEFENCE' }),
          h('p', { text: 'Blocking stops melee and most of a jutsu, but drains your guard. Tapping block just before a hit PARRIES: melee attackers are stunned and projectiles are reflected back. Mashing block disables the parry window.' }),
          h('p', { text: 'Caught in a combo? Press SPACE to SUBSTITUTE: you leave a log behind and reappear behind your attacker. The gauge holds two uses and refills over time. When knocked down, press SPACE to tech-roll.' })),
        h('section', null, h('h3', { text: 'ELEMENTS' }),
          h('div', { class: 'wheel' }, ...['fire', 'wind', 'lightning', 'earth', 'water', 'fire'].map((e, i, a) => [h('span', { style: `color:${ELEMENTS[e].color}`, text: ELEMENTS[e].short }), i < a.length - 1 ? h('span', { class: 'note', text: ' > ' }) : null]).flat()),
          h('p', { text: 'Advantaged elements deal +20% to that affinity and win jutsu clashes. Fire ignites grass and wood and spreads; water soaks targets and puts fires out; soaked targets take +45% lightning damage and lightning arcs through puddles and rivers; wind fans flames and hurls enemy fire back; earth raises walls and cracks the ground.' })),
        h('section', null, h('h3', { text: 'AWAKENING & ULTIMATE' }),
          h('p', { text: 'Two meters fill as you fight. AWAKEN (T) to transform for a while - Crimson Eye, Sage Mode, Beast Cloak, Eight Gates, Spirit Armor or Cursed Seal. ULTIMATE (G) unleashes your signature technique - meteors, tsunamis, lightning dragons and more. You are invulnerable while it winds up.' })),
        h('section', null, h('h3', { text: 'LEVELING UP' }),
          h('p', { text: 'Damage, KOs, assists and parries level your shinobi (Lv1-10: more health and damage). Every jutsu also levels (Lv1-5) from use: stronger, faster cooldowns, and a Lv5 mastery perk. Taijutsu levels too: Lv3 adds a 5th combo hit, Lv4 lets you chase launched enemies into the air (press attack after the launcher), Lv5 makes a full heavy unblockable.' })),
        h('section', null, h('h3', { text: 'TIPS' }),
          h('p', { text: '- Earth walls block projectiles. Lightning shreds them.' }),
          h('p', { text: '- Hide in mist or smoke - enemies lose track of you.' }),
          h('p', { text: '- Charge chakra only when nobody is close.' }),
          h('p', { text: '- Use launchers + jutsu for huge juggle combos.' })),
      ),
    );
  }

  // ================================================================ SETTINGS
  function settings(back) {
    const S = Settings.data;
    const slider = (label, key, min, max, step) => h('label', { class: 'field' }, label, h('input', { type: 'range', min, max, step, value: S[key], oninput: (e) => { S[key] = +e.target.value; Settings.save(); } }));
    screen('dim',
      h('div', { class: 'topbar' }, btn('Back', () => back(), 'small back'), h('h2', { text: 'SETTINGS' })),
      h('div', { class: 'wrap panel', style: 'max-width:560px' },
        slider('SOUND EFFECTS', 'sfx', 0, 1, 0.05),
        h('div', { style: 'height:10px' }),
        slider('MUSIC', 'music', 0, 1, 0.05),
        h('div', { style: 'height:10px' }),
        slider('SCREEN SHAKE', 'shake', 0, 1.5, 0.1),
        h('h3', { text: 'CAMERA ZOOM' }),
        seg([['near', 'Near'], ['normal', 'Normal'], ['far', 'Far']], S.zoom, (v) => { S.zoom = v; Settings.save(); Render.resize(); settings(back); }),
        h('h3', { text: 'OPTIONS' }),
        h('label', { class: 'row', style: 'gap:6px;cursor:pointer' }, h('input', { type: 'checkbox', checked: S.numbers, onchange: (e) => { S.numbers = e.target.checked; Settings.save(); if (W) W.showNumbers = S.numbers; } }), 'Show damage numbers'),
        h('label', { class: 'row', style: 'gap:6px;cursor:pointer;margin-top:8px' }, h('input', { type: 'checkbox', checked: S.muted, onchange: (e) => { S.muted = e.target.checked; Settings.save(); } }), 'Mute all audio'),
        h('p', { class: 'note', style: 'margin-top:14px', text: 'Custom shinobi and settings are saved in this browser.' }),
      ),
    );
  }

  // =================================================================== PAUSE
  function pause() {
    screen('dim',
      h('div', { class: 'pausebox panel' },
        h('h2', { text: 'PAUSED' }),
        btn('Resume', () => Game.resume(), 'primary'),
        btn('How to Play', () => howto(pause)),
        btn('Settings', () => settings(pause)),
        btn('Restart Match', () => Game.rematch()),
        btn('Quit to Menu', () => Game.toMenu(), 'back'),
      ),
    );
  }

  // ================================================================= RESULTS
  function results(w) {
    const rows = w.fighters.filter((f) => !f.isClone);
    const score = (f) => f.kills * 3 + f.assists + f.dmgDealt / 250;
    const mvp = rows.slice().sort((a, b) => score(b) - score(a))[0];
    rows.sort((a, b) => (b.team === w.winner) - (a.team === w.winner) || b.kills - a.kills || b.dmgDealt - a.dmgDealt);
    const p = w.player;
    let head, col;
    if (w.winner === null) { head = 'DRAW'; col = '#c8c0d8'; }
    else if (p) { const won = p.team === w.winner; head = won ? 'VICTORY' : 'DEFEAT'; col = won ? '#ffd35c' : '#ff6a6a'; }
    else { head = w.teamLabel(w.winner).toUpperCase() + ' WINS'; col = '#ffd35c'; }
    const table = h('table', { class: 'res' },
      h('tr', null, ...['', 'SHINOBI', 'LV', 'KO', 'DOWN', 'ASSIST', 'DAMAGE', 'BEST COMBO'].map((t) => h('th', { text: t }))),
      ...rows.map((f) => h('tr', { class: f === p ? 'me' : '' },
        h('td', null, portraitCanvas(f.look, 1)),
        h('td', null, h('span', { style: `color:${f.teamColor}`, text: f.name }), f === mvp ? h('span', { class: 'mvp', text: 'MVP' }) : null, f.team === w.winner ? h('span', { class: 'note', text: '  winner' }) : null),
        ...[f.level, f.kills, f.deaths, f.assists, Math.round(f.dmgDealt), f.bestCombo || 0].map((v) => h('td', { text: String(v) })))));
    let mastery = null;
    if (p) {
      const ms = Object.entries(p.mastery).map(([id, m]) => `${id === 'taijutsu' ? 'Taijutsu' : (JUTSU[id] || ULTIMATES[id]).name} Lv${m.lvl}`).join('  -  ');
      mastery = h('p', { class: 'note', style: 'margin-top:12px', text: 'Your mastery this match: ' + ms });
    }
    screen('dim',
      h('div', { class: 'bigresult', style: `color:${col}`, text: head }),
      h('div', { class: 'wrap panel', style: 'max-width:860px' }, table, mastery),
      h('div', { class: 'row center', style: 'margin-top:16px' },
        btn('Rematch', () => Game.rematch(), 'primary'),
        btn('Change Setup', () => { Game.toMenu(true); setup(); }),
        btn('Main Menu', () => Game.toMenu(), 'back')),
    );
  }

  function init() { root = document.getElementById('ui'); }
  function hide() { clear(); }

  return { init, title, setup, creator, roster, howto, settings, pause, results, hide, buildConfig, loadSetup, get open() { return root && root.childElementCount > 0; } };
})();
