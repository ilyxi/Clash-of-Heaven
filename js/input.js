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
  const pad = { active: false, lx: 0, ly: 0, rx: 0, ry: 0, lastUse: -1e9 };
  let padPrev = {};
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

  // Called once per simulation tick.
  function tick() {
    pollPad();
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

  // ---- gamepad (standard mapping) ------------------------------------------
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    if (!gp) { pad.active = false; return; }
    const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
    pad.lx = dz(gp.axes[0] || 0); pad.ly = dz(gp.axes[1] || 0);
    pad.rx = dz(gp.axes[2] || 0); pad.ry = dz(gp.axes[3] || 0);
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    const lt = b(6);
    const state = {
      light: b(0) && !lt, dash: b(1) && !lt, heavy: b(2) && !lt, kunai: b(4),
      block: b(5), charge: b(7), awaken: b(10), ultimate: b(11),
      j1: lt && b(0), j2: lt && b(1), j3: lt && b(2), j4: lt && b(3),
      pause: b(9), score: b(8),
    };
    let any = pad.lx || pad.ly || pad.rx || pad.ry;
    for (const k in state) {
      const code = 'Pad:' + k;
      if (state[k]) { any = true; codeDown(code); } else if (padPrev[k]) codeUp(code);
    }
    padPrev = state;
    if (any) { pad.active = true; pad.lastUse = performance.now(); }
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

  return {
    attach, tick, isDown, wasPressed, wasReleased, consume, moveVector, mouseView, usingMouse,
    pad, mouse, BINDINGS, ACTIONS,
    set enabled(v) { enabled = v; }, get enabled() { return enabled; },
  };
})();
