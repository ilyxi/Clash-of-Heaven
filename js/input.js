'use strict';
// ---------------------------------------------------------------------------
// Keyboard / mouse / gamepad input. Edges ("pressed") are queued between
// simulation ticks so no tap is ever lost regardless of frame timing.
// ---------------------------------------------------------------------------

const Input = (() => {
  const BINDINGS = {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    light: ['Mouse0', 'KeyJ'],
    heavy: ['Mouse2', 'KeyK'],
    dash: ['Space'],
    block: ['ShiftLeft', 'ShiftRight', 'KeyL'],
    j1: ['KeyQ', 'Digit1'],
    j2: ['KeyE', 'Digit2'],
    j3: ['KeyR', 'Digit3'],
    j4: ['KeyF', 'Digit4'],
    kunai: ['KeyX', 'Mouse1'],
    charge: ['KeyC'],
    awaken: ['KeyT', 'Digit5'],
    ultimate: ['KeyG', 'KeyV', 'Digit6'],
    score: ['Tab'],
    pause: ['Escape', 'KeyP'],
    mute: ['KeyM'],
  };
  const ACTIONS = Object.keys(BINDINGS);

  const down = new Set();
  const queued = new Set();    // pressed since last tick
  const queuedUp = new Set();  // released since last tick
  let pressed = new Set();
  let released = new Set();

  const mouse = { cx: 0, cy: 0, lastMove: -1e9, inside: false };
  const pad = { active: false, connected: false, sony: false, id: '', lx: 0, ly: 0, rx: 0, ry: 0, lastUse: -1e9 };
  let padPrev = {};
  let lastKeyT = -1e9;
  let canvas = null;
  let enabled = true; // false while typing in UI inputs

  function codeDown(code) {
    if (!down.has(code)) queued.add(code);
    down.add(code);
  }
  function codeUp(code) {
    if (down.has(code)) queuedUp.add(code);
    down.delete(code);
  }

  function attach(cv) {
    canvas = cv;
    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      lastKeyT = performance.now();
      codeDown(e.code);
    });
    window.addEventListener('keyup', (e) => codeUp(e.code));
    window.addEventListener('blur', () => { for (const c of [...down]) codeUp(c); });
    cv.addEventListener('mousedown', (e) => { codeDown('Mouse' + e.button); e.preventDefault(); });
    window.addEventListener('mouseup', (e) => codeUp('Mouse' + e.button));
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      mouse.cx = e.clientX; mouse.cy = e.clientY;
      mouse.lastMove = performance.now();
    });
    cv.addEventListener('mouseenter', () => { mouse.inside = true; });
    cv.addEventListener('mouseleave', () => { mouse.inside = false; });
  }

  // Called once per simulation tick. (Gamepads are polled once per frame by
  // poll(), before UI-level keys like pause are consumed.)
  function tick() {
    pressed = new Set(queued); queued.clear();
    released = new Set(queuedUp); queuedUp.clear();
  }

  function anyCode(action, set) {
    const b = BINDINGS[action];
    for (let i = 0; i < b.length; i++) if (set.has(b[i])) return true;
    return set.has('Pad:' + action);
  }
  const isDown = (a) => enabled && anyCode(a, down);
  const wasPressed = (a) => enabled && anyCode(a, pressed);
  const wasReleased = (a) => anyCode(a, released);

  // Consumes a UI-level key press immediately (menus, pause) outside ticks.
  function consume(action) {
    const b = BINDINGS[action];
    let hit = false;
    for (const c of b) if (queued.has(c)) { queued.delete(c); hit = true; }
    if (queued.has('Pad:' + action)) { queued.delete('Pad:' + action); hit = true; }
    return hit;
  }

  // ---- gamepads -------------------------------------------------------------
  // Every connected pad is read and merged (a phantom/virtual device in slot 0
  // must not hide the real controller). Pads are normalised to the W3C
  // "standard" layout: 0 A/Cross 1 B/Circle 2 X/Square 3 Y/Triangle 4 LB/L1
  // 5 RB/R1 6 LT/L2 7 RT/R2 8 Back/Create 9 Start/Options 10 L3 11 R3
  // 12-15 d-pad up/down/left/right 16 Home/PS 17 touchpad.
  let rawPads = [];
  const std = { b: new Array(18).fill(0), lx: 0, ly: 0, rx: 0, ry: 0 };

  function readPads() {
    let list = [];
    try { list = navigator.getGamepads ? Array.from(navigator.getGamepads() || []) : []; } catch (e) { list = []; }
    return list.filter((p) => p && p.connected !== false);
  }

  function isSony(gp) { return /054c|dualsense|dualshock|wireless controller|playstation/i.test(gp.id || ''); }

  function normalise(gp) {
    const raw = (i) => { const b = gp.buttons[i]; if (!b) return 0; return typeof b === 'object' ? Math.max(b.value || 0, b.pressed ? 1 : 0) : +b; };
    const ax = (i) => gp.axes[i] || 0;
    const out = { b: new Array(18).fill(0), lx: ax(0), ly: ax(1), rx: ax(2), ry: ax(3), sony: isSony(gp) };
    if (gp.mapping === 'standard' || !out.sony) {
      for (let i = 0; i < 18; i++) out.b[i] = raw(i);
      return out;
    }
    // Sony pad the browser didn't remap (e.g. Firefox on Windows):
    // raw 0 Square 1 Cross 2 Circle 3 Triangle 4 L1 5 R1 6 L2 7 R2 8 Create
    // 9 Options 10 L3 11 R3 12 PS 13 touchpad; right stick on axes 2/5; d-pad hat on axis 9.
    const b = out.b;
    b[0] = raw(1); b[1] = raw(2); b[2] = raw(0); b[3] = raw(3);
    b[4] = raw(4); b[5] = raw(5); b[6] = raw(6); b[7] = raw(7);
    b[8] = raw(8); b[9] = raw(9); b[10] = raw(10); b[11] = raw(11); b[16] = raw(12); b[17] = raw(13);
    if (gp.axes.length > 5) out.ry = ax(5);
    const hat = gp.axes[9];
    if (hat !== undefined && hat >= -1.01 && hat <= 1.01) {
      const k = Math.round((hat + 1) * 3.5); // 0 up .. 7 up-left, 8 = centred
      b[12] = [7, 0, 1].includes(k) ? 1 : 0; b[15] = [1, 2, 3].includes(k) ? 1 : 0;
      b[13] = [3, 4, 5].includes(k) ? 1 : 0; b[14] = [5, 6, 7].includes(k) ? 1 : 0;
    }
    return out;
  }

  function stick(x, y) {
    const m = Math.hypot(x, y);
    if (m < 0.2) return [0, 0];
    const k = Math.min(1, (m - 0.2) / 0.75) / m;
    return [x * k, y * k];
  }

  // Poll once per frame (before UI keys are consumed).
  function poll() {
    rawPads = readPads();
    std.b.fill(0); std.lx = std.ly = std.rx = std.ry = 0;
    let lm = 0, rm = 0;
    for (const gp of rawPads) {
      const n = normalise(gp);
      for (let i = 0; i < 18; i++) std.b[i] = Math.max(std.b[i], n.b[i]);
      const [lx, ly] = stick(n.lx, n.ly), [rx, ry] = stick(n.rx, n.ry);
      if (Math.hypot(lx, ly) > lm) { lm = Math.hypot(lx, ly); std.lx = lx; std.ly = ly; }
      if (Math.hypot(rx, ry) > rm) { rm = Math.hypot(rx, ry); std.rx = rx; std.ry = ry; }
      if (n.b.some((v) => v > 0.5) || lm || rm) { pad.sony = n.sony; pad.id = gp.id; }
    }
    pad.connected = rawPads.length > 0;
    pad.lx = std.lx; pad.ly = std.ly; pad.rx = std.rx; pad.ry = std.ry;
    const b = (i) => std.b[i] > 0.45;
    const l2 = b(6);
    const state = {
      light: b(0) && !l2, dash: b(1) && !l2, heavy: b(2) && !l2, kunai: b(3) && !l2,
      j1: l2 && b(0), j2: l2 && b(1), j3: l2 && b(2), j4: l2 && b(3),
      charge: b(4), block: b(5), ultimate: b(7) || b(11) || b(13), awaken: b(10) || b(12),
      pause: b(9), score: b(8) || b(17), left: b(14), right: b(15),
    };
    let any = !!(pad.lx || pad.ly || pad.rx || pad.ry);
    for (const k in state) {
      const code = 'Pad:' + k;
      if (state[k]) { any = true; codeDown(code); } else if (padPrev[k]) codeUp(code);
    }
    padPrev = state;
    if (any) { pad.active = true; pad.lastUse = performance.now(); }
    else if (!pad.connected) pad.active = false;
  }

  // Menu navigation edges from the pad: d-pad / left stick with auto-repeat.
  const menu = { prev: {}, dir: null, next: 0 };
  function menuEvents() {
    const ev = [];
    const now = performance.now();
    const b = (i) => std.b[i] > 0.45;
    let dir = null;
    if (b(12) || std.ly < -0.6) dir = 'up';
    else if (b(13) || std.ly > 0.6) dir = 'down';
    else if (b(14) || std.lx < -0.6) dir = 'left';
    else if (b(15) || std.lx > 0.6) dir = 'right';
    if (dir !== menu.dir) { menu.dir = dir; if (dir) { ev.push(dir); menu.next = now + 380; } }
    else if (dir && now >= menu.next) { ev.push(dir); menu.next = now + 110; }
    const cur = { accept: b(0), back: b(1), start: b(9), prevTab: b(4), nextTab: b(5) };
    for (const k in cur) if (cur[k] && !menu.prev[k]) ev.push(k);
    menu.prev = cur;
    if (ev.length) pad.lastUse = now;
    return ev;
  }

  let lastRumble = 0;
  function rumble(strong, weak, ms) {
    if (!usingPad()) return;
    const now = performance.now();
    if (now - lastRumble < 90) return;
    lastRumble = now;
    for (const gp of rawPads) {
      const va = gp.vibrationActuator;
      if (!va || !va.playEffect) continue;
      try { va.playEffect('dual-rumble', { duration: ms, strongMagnitude: U.clamp(strong, 0, 1), weakMagnitude: U.clamp(weak, 0, 1) }).catch(() => {}); } catch (e) { /* unsupported */ }
    }
  }

  // Movement vector in *screen* space (x right, y down), length <= 1.
  function moveVector() {
    let x = 0, y = 0;
    if (isDown('left')) x -= 1;
    if (isDown('right')) x += 1;
    if (isDown('up')) y -= 1;
    if (isDown('down')) y += 1;
    if (pad.lx || pad.ly) { x += pad.lx; y += pad.ly; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  function mouseView() {
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return {
      x: ((mouse.cx - r.left) / r.width) * canvas.width,
      y: ((mouse.cy - r.top) / r.height) * canvas.height,
    };
  }

  function usingMouse() {
    return mouse.lastMove > pad.lastUse && mouse.lastMove > 0;
  }
  // True when the controller was used more recently than keyboard or mouse.
  function usingPad() {
    return pad.connected && pad.lastUse > Math.max(mouse.lastMove, lastKeyT);
  }

  return {
    attach, tick, poll, menuEvents, rumble, isDown, wasPressed, wasReleased, consume, moveVector, mouseView, usingMouse, usingPad,
    pad, mouse, BINDINGS, ACTIONS,
    set enabled(v) { enabled = v; }, get enabled() { return enabled; },
  };
})();
