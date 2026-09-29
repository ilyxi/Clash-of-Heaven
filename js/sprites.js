'use strict';
// ---------------------------------------------------------------------------
// Procedural pixel-art ninja sprites. Each look + pose + frame + view is drawn
// once to a small canvas (with a 1px outline) and cached.
// Views: 'F' = front (facing down-right), 'B' = back (facing up-right).
// Left-facing variants are mirrored at draw time.
// ---------------------------------------------------------------------------

const SPR_W = 34, SPR_H = 38;
const SPR_OX = 17, SPR_OY = 35; // feet anchor inside the sprite canvas
const DX = 1, DY = 2;           // offset of the design grid inside the canvas

const Sprites = (() => {
  // ---- poses ----------------------------------------------------------------
  // Arms: shoulder -> e (elbow) -> h (hand), offsets from shoulder, 2px brush.
  // Legs: hip -> k (knee, from hip) -> f (foot, from default hip; y=6 is ground).
  // front:true = arm drawn over torso; back:true = arm drawn behind torso.
  const A_DOWN = { e: [0, 3], h: [0, 6] };
  const L_STAND = { k: [0, 3], f: [-1, 6] };
  const R_STAND = { k: [0, 3], f: [1, 6] };
  const POSES = {
    idle: [
      { armL: A_DOWN, armR: A_DOWN, legL: L_STAND, legR: R_STAND },
      { by: 1, armL: { e: [0, 3], h: [-1, 5] }, armR: { e: [0, 3], h: [1, 5] }, legL: L_STAND, legR: R_STAND },
    ],
    run: [
      { lean: 2, armL: { e: [-3, 1], h: [-6, 2] }, armR: { e: [-4, 1], h: [-8, 2], back: true }, legL: { k: [2, 3], f: [4, 6] }, legR: { k: [-2, 2], f: [-4, 4] } },
      { lean: 2, by: -1, armL: { e: [-3, 1], h: [-6, 1] }, armR: { e: [-4, 1], h: [-8, 1], back: true }, legL: { k: [1, 3], f: [1, 6] }, legR: { k: [0, 2], f: [-2, 3] } },
      { lean: 2, armL: { e: [-3, 1], h: [-6, 2] }, armR: { e: [-4, 1], h: [-8, 2], back: true }, legL: { k: [-2, 2], f: [-4, 4] }, legR: { k: [2, 3], f: [4, 6] } },
      { lean: 2, by: -1, armL: { e: [-3, 1], h: [-6, 1] }, armR: { e: [-4, 1], h: [-8, 1], back: true }, legL: { k: [0, 2], f: [-2, 3] }, legR: { k: [1, 3], f: [1, 6] } },
    ],
    jab: [{ lean: 1, armR: { e: [3, 1], h: [7, 1] }, armL: { e: [1, 2], h: [3, 1], front: true }, legL: { k: [-1, 3], f: [-2, 6] }, legR: { k: [1, 3], f: [3, 6] } }],
    cross: [{ lean: 2, armL: { e: [4, 1], h: [9, 0], front: true }, armR: { e: [-1, 2], h: [-2, 4], back: true }, legL: { k: [1, 3], f: [2, 6] }, legR: { k: [-1, 3], f: [-3, 6] } }],
    kick: [{ lean: -1, armL: { e: [-2, 0], h: [-4, -2] }, armR: { e: [2, 1], h: [4, 3] }, legL: { k: [0, 3], f: [-1, 6] }, legR: { k: [4, -1], f: [9, -1] } }],
    uppercut: [{ by: 1, lean: 2, armR: { e: [2, -2], h: [3, -7] }, armL: { e: [-1, 2], h: [-3, 3] }, legL: { k: [-2, 3], f: [-4, 6] }, legR: { k: [3, 2], f: [5, 6] } }],
    sweep: [{ by: 3, lean: 1, armL: { e: [-2, 1], h: [-4, 4] }, armR: { e: [2, 0], h: [4, -2] }, legL: { k: [-2, 2], f: [-3, 6] }, legR: { k: [4, 1], f: [9, 5] } }],
    heavyWind: [{ by: 2, lean: -1, armR: { e: [-3, 1], h: [-6, 1], back: true }, armL: { e: [2, 1], h: [4, 0], front: true }, legL: { k: [-2, 3], f: [-3, 6] }, legR: { k: [2, 3], f: [3, 6] } }],
    palm: [{ by: 1, lean: 3, armR: { e: [4, 0], h: [9, -1] }, armL: { e: [-1, 2], h: [-3, 2] }, legL: { k: [-2, 3], f: [-4, 6] }, legR: { k: [3, 2], f: [5, 6] } }],
    throw: [{ lean: 1, armR: { e: [2, -2], h: [6, -2] }, armL: { e: [-1, 2], h: [-3, 4] }, legL: { k: [-1, 3], f: [-2, 6] }, legR: { k: [1, 3], f: [2, 6] } }],
    seal: [
      { armL: { e: [1, 3], h: [4, 3], front: true }, armR: { e: [-1, 3], h: [-4, 3], front: true }, legL: L_STAND, legR: R_STAND },
      { armL: { e: [1, 2], h: [4, 1], front: true }, armR: { e: [-1, 2], h: [-4, 1], front: true }, legL: L_STAND, legR: R_STAND },
    ],
    release: [{ lean: 1, armR: { e: [3, 0], h: [7, 0] }, armL: { e: [2, 2], h: [5, 1], front: true }, legL: { k: [-1, 3], f: [-2, 6] }, legR: { k: [1, 3], f: [3, 6] } }],
    block: [{ by: 1, armL: { e: [3, -1], h: [6, -3], front: true }, armR: { e: [-3, -1], h: [-6, -3], front: true }, legL: { k: [-1, 3], f: [-2, 6] }, legR: { k: [1, 3], f: [2, 6] } }],
    dash: [{ by: 2, lean: 3, armL: { e: [-3, 1], h: [-6, 1] }, armR: { e: [-3, 1], h: [-6, 0], back: true }, legL: { k: [3, 2], f: [5, 5] }, legR: { k: [-3, 2], f: [-6, 4] } }],
    hurt: [
      { lean: -2, armL: { e: [-2, -1], h: [-4, -3] }, armR: { e: [2, -1], h: [3, -4] }, legL: { k: [-1, 3], f: [-2, 6] }, legR: { k: [1, 3], f: [2, 6] } },
      { lean: -1, by: 1, armL: { e: [-1, 2], h: [-3, 4] }, armR: { e: [1, 2], h: [3, 4] }, legL: { k: [-1, 3], f: [-2, 6] }, legR: { k: [1, 3], f: [2, 6] } },
    ],
    air: [{ lean: -2, armL: { e: [-2, -2], h: [-3, -5] }, armR: { e: [2, -2], h: [4, -4] }, legL: { k: [1, 2], f: [0, 3] }, legR: { k: [-1, 2], f: [-3, 3] } }],
    charge: [
      { by: 2, armL: { e: [-1, 2], h: [-2, 5] }, armR: { e: [1, 2], h: [2, 5] }, legL: { k: [-2, 3], f: [-3, 6] }, legR: { k: [2, 3], f: [3, 6] } },
      { by: 2, armL: { e: [-1, 2], h: [-3, 5] }, armR: { e: [1, 2], h: [3, 5] }, legL: { k: [-2, 3], f: [-3, 6] }, legR: { k: [2, 3], f: [3, 6] } },
    ],
    raise: [{ armL: { e: [-1, -3], h: [1, -7] }, armR: { e: [1, -3], h: [-1, -7] }, legL: { k: [-1, 3], f: [-2, 6] }, legR: { k: [1, 3], f: [2, 6] } }],
    slam: [{ by: 3, lean: 1, armL: { e: [2, 3], h: [4, 6], front: true }, armR: { e: [2, 3], h: [5, 6] }, legL: { k: [-2, 2], f: [-3, 6] }, legR: { k: [2, 2], f: [3, 6] } }],
    victory: [{ armL: A_DOWN, armR: { e: [1, -3], h: [1, -7] }, legL: { k: [-1, 3], f: [-2, 6] }, legR: { k: [1, 3], f: [2, 6] } }],
  };

  // ---- hair masks (front view), origin (8,1), '#' base '+' light '-' dark ---
  const HAIR = {
    spiky: [
      '......#....#....',
      '..#...##..##..#.',
      '..##.###.####.#.',
      '.#++####-###-##.',
      '##+++#######-##-',
      '.#++##########-.',
      '##+###########--',
      '.#############-.',
      '..############-.',
      '..##.##.###.##-.',
      '..#...#..#..#-..',
      '..#..........#..',
    ],
    long: [
      '................',
      '................',
      '....#######.....',
      '...#++++#####...',
      '..#+++########..',
      '..#++#########-.',
      '..#+##########-.',
      '..############-.',
      '..############-.',
      '..###.####.###-.',
      '..##........###.',
      '..##.........##.',
      '..#..........##.',
      '..#..........#-.',
      '..#..........#..',
    ],
    pony: [
      '.##.............',
      '#+##............',
      '#++##.#######...',
      '.#+###+++#####..',
      '..###++#######..',
      '..#+##########-.',
      '..#+##########-.',
      '..############-.',
      '..############-.',
      '..##.###.####-..',
      '..#.........#-..',
    ],
    buns: [
      '................',
      '.###.......###..',
      '#+###.....#+###.',
      '#++##.....#+###.',
      '.###+######-##..',
      '..#++#########..',
      '..#+##########..',
      '..############-.',
      '..############-.',
      '..##.#.##.#.##-.',
      '..#..........#..',
    ],
    bowl: [
      '................',
      '................',
      '................',
      '....######......',
      '...##++#####....',
      '..#+++#######...',
      '..#++#########..',
      '..############-.',
      '..############-.',
      '..############-.',
      '..##........###.',
      '..#..........#..',
    ],
    wild: [
      '...#....#.......',
      '..##...##..#....',
      '.###.#.###.##...',
      '####+#######-#..',
      '.#+++##########.',
      '##++###########-',
      '.#+############-',
      '###############-',
      '.##############.',
      '###.##.##.###-#.',
      '##..#...#...#-..',
      '#............#..',
      '##..............',
      '#...............',
    ],
    short: [
      '................',
      '................',
      '................',
      '....#.#.#.......',
      '...#########....',
      '..#++########...',
      '..#+#########-..',
      '..###########-..',
      '..############..',
      '..#.#.#.#.#.##..',
    ],
    hood: [
      '................',
      '................',
      '.....######.....',
      '...##++######...',
      '..#++#########..',
      '.#++##########-.',
      '.#+###########-.',
      '.#+##......###-.',
      '.###........##-.',
      '.##..........#-.',
      '.##..........#-.',
      '.##..........#-.',
      '.##..........#-.',
      '.###........##-.',
      '..###......###..',
      '...##########...',
    ],
  };
  // Hair that hangs behind the body: [x0, y0, x1, y1] rough boxes + jag.
  const BACK_HAIR = {
    long: { x0: 10, x1: 21, y0: 9, y1: 23 },
    wild: { x0: 9, x1: 21, y0: 9, y1: 23 },
    pony: { x0: 6, x1: 10, y0: 4, y1: 17, tail: true },
  };

  // ---- palette ----------------------------------------------------------------
  function palette(look) {
    const s = U.shade;
    return {
      skin: look.skin, skinD: s(look.skin, -0.2), skinL: s(look.skin, 0.25),
      hair: look.hair, hairD: s(look.hair, -0.32), hairL: s(look.hair, 0.3),
      out: look.outfit, outD: s(look.outfit, -0.3), outL: s(look.outfit, 0.22),
      pants: look.pants, pantsD: s(look.pants, -0.3), pantsL: s(look.pants, 0.18),
      cloth: look.cloth, clothD: s(look.cloth, -0.3), clothL: s(look.cloth, 0.25),
      eye: look.eyes, metal: '#cfd6e2', metalD: '#7b8598',
      sandal: '#262c44', wrap: '#e9e3d6', outline: '#120a18',
    };
  }

  function lookKey(look) {
    return [look.skin, look.hair, look.hairStyle, look.eyes, look.outfit, look.pants, look.cloth, look.headband, look.extra].join(',');
  }

  // ---- drawing primitives -------------------------------------------------------
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x + DX, y + DY, w, h); }
  function brushLine(ctx, x0, y0, x1, y1, bw, bh, c) {
    ctx.fillStyle = c;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      ctx.fillRect(x + DX, y + DY, bw, bh);
    }
  }
  function mask(ctx, rows, ox, oy, map) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let k = 0; k < row.length; k++) {
        const c = map[row[k]];
        if (c) { ctx.fillStyle = c; ctx.fillRect(ox + k + DX, oy + r + DY, 1, 1); }
      }
    }
  }

  function drawArm(ctx, P, sx, sy, arm, dim) {
    const ex = sx + arm.e[0], ey = sy + arm.e[1];
    const hx = sx + arm.h[0], hy = sy + arm.h[1];
    const sleeve = dim ? P.outD : P.out;
    brushLine(ctx, sx, sy, ex, ey, 2, 2, sleeve);
    brushLine(ctx, ex, ey, hx, hy, 2, 2, sleeve);
    rect(ctx, hx, hy, 2, 2, dim ? P.skinD : P.skin);
  }

  function drawLeg(ctx, P, hx, hy, leg, lead) {
    const kx = hx + leg.k[0], ky = hy + leg.k[1];
    const fx = hx + leg.f[0], fy = 25 + leg.f[1];
    const col = lead ? P.pants : P.pantsD;
    brushLine(ctx, hx, hy, kx, ky, 3, 2, col);
    brushLine(ctx, kx, ky, fx, fy, 3, 2, col);
    // shin wrap
    const wx = Math.round(U.lerp(kx, fx, 0.55)), wy = Math.round(U.lerp(ky, fy, 0.55));
    rect(ctx, wx, wy, 3, 1, P.wrap);
    // sandal
    rect(ctx, fx, fy, 3, 2, P.sandal);
    rect(ctx, fx + 3, fy + 1, 1, 1, P.sandal);
    rect(ctx, fx + 2, fy + 1, 1, 1, P.skinD);
  }

  function drawTorso(ctx, P, look, tx, ty, back) {
    // torso block 8x8 with shading
    rect(ctx, tx, ty, 8, 8, P.out);
    rect(ctx, tx, ty, 2, 7, P.outL);
    rect(ctx, tx + 7, ty, 1, 8, P.outD);
    if (!back) {
      rect(ctx, tx + 2, ty, 4, 2, P.outL);        // collar
      rect(ctx, tx + 3, ty + 1, 2, 1, P.skinD);   // neck shadow
      rect(ctx, tx + 4, ty + 2, 1, 5, P.outD);    // zipper
      rect(ctx, tx + 1, ty + 3, 2, 2, P.outD);    // pocket
      rect(ctx, tx + 5, ty + 3, 2, 2, P.outD);
    } else {
      rect(ctx, tx + 1, ty, 6, 1, P.outL);
      // clan emblem (spiral)
      rect(ctx, tx + 2, ty + 2, 4, 3, P.cloth);
      rect(ctx, tx + 3, ty + 3, 2, 1, P.clothL);
    }
    rect(ctx, tx, ty + 7, 8, 1, P.pantsD); // belt
    rect(ctx, tx + 3, ty + 7, 2, 1, P.metalD);
    if (look.extra === 'cloak') {
      rect(ctx, tx - 1, ty, 10, 12, P.cloth);
      rect(ctx, tx - 1, ty, 2, 12, P.clothL);
      rect(ctx, tx + 8, ty, 1, 12, P.clothD);
      rect(ctx, tx - 1, ty + 11, 10, 1, P.clothD);
      if (!back) { rect(ctx, tx + 3, ty, 2, 11, P.out); rect(ctx, tx + 2, ty - 1, 4, 1, P.cloth); }
      else { rect(ctx, tx + 2, ty + 3, 4, 3, P.clothD); }
    }
  }

  function drawHead(ctx, P, look, hx, hy, back) {
    // face shape 10 wide x 10 tall at (hx, hy)
    const rows = [[2, 6], [1, 8], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [0, 10], [1, 8], [2, 6]];
    for (let r = 0; r < rows.length; r++) rect(ctx, hx + rows[r][0], hy + r, rows[r][1], 1, P.skin);
    rect(ctx, hx + 9, hy + 2, 1, 6, P.skinD);
    rect(ctx, hx + 2, hy + 9, 6, 1, P.skinD);
    if (back) return;
    // eyes (shifted 1px toward facing side)
    rect(ctx, hx + 3, hy + 5, 2, 1, P.outline);
    rect(ctx, hx + 7, hy + 5, 2, 1, P.outline);
    rect(ctx, hx + 3, hy + 6, 2, 1, P.eye);
    rect(ctx, hx + 7, hy + 6, 2, 1, P.eye);
    rect(ctx, hx + 3, hy + 6, 1, 1, '#ffffff');
    rect(ctx, hx + 7, hy + 6, 1, 1, '#ffffff');
    rect(ctx, hx + 6, hy + 8, 1, 1, P.skinD); // mouth
    if (look.extra === 'marks') {
      rect(ctx, hx + 1, hy + 7, 2, 1, P.skinD); rect(ctx, hx + 1, hy + 8, 2, 1, P.skinD);
      rect(ctx, hx + 8, hy + 7, 2, 1, P.skinD); rect(ctx, hx + 8, hy + 8, 1, 1, P.skinD);
    }
    if (look.extra === 'mask') {
      rect(ctx, hx, hy + 7, 10, 2, P.cloth);
      rect(ctx, hx + 1, hy + 9, 8, 1, P.cloth);
      rect(ctx, hx + 9, hy + 7, 1, 2, P.clothD);
    }
  }

  function hairMap(P) { return { '#': P.hair, '+': P.hairL, '-': P.hairD }; }

  function drawHairFront(ctx, P, look, hx, hy) {
    const rows = HAIR[look.hairStyle] || HAIR.spiky;
    const map = look.hairStyle === 'hood' ? { '#': P.cloth, '+': P.clothL, '-': P.clothD } : hairMap(P);
    mask(ctx, rows, hx - 3, hy - 6, map);
  }

  function drawHairBackLayer(ctx, P, look, hx, hy, back) {
    const b = BACK_HAIR[look.hairStyle];
    if (!b) return;
    const ox = hx - 11, oy = hy - 7;
    if (b.tail) {
      // ponytail hangs from the back of the head
      if (back) {
        rect(ctx, 14 + ox, 5 + oy, 4, 12, P.hair);
        rect(ctx, 15 + ox, 5 + oy, 1, 11, P.hairL);
        rect(ctx, 14 + ox, 17 + oy, 2, 2, P.hairD);
      } else {
        rect(ctx, b.x0 + ox, b.y0 + oy, b.x1 - b.x0, b.y1 - b.y0, P.hair);
        rect(ctx, b.x0 + ox, b.y0 + oy, 1, b.y1 - b.y0 - 2, P.hairL);
        rect(ctx, b.x0 + 1 + ox, b.y1 + oy, 2, 2, P.hairD);
      }
      return;
    }
    const w = b.x1 - b.x0 + 1;
    for (let y = b.y0; y <= b.y1; y++) {
      const jag = y > b.y1 - 3 ? ((y * 7 + 3) % 3) : 0;
      rect(ctx, b.x0 + ox + jag, y + oy, w - jag * 2, 1, y % 4 === 0 ? P.hairD : P.hair);
    }
    rect(ctx, b.x0 + ox, b.y0 + oy, 1, b.y1 - b.y0 - 2, P.hairL);
  }

  function drawHairBackView(ctx, P, look, hx, hy) {
    if (look.hairStyle === 'hood') {
      mask(ctx, HAIR.hood, hx - 3, hy - 6, { '#': P.cloth, '+': P.clothL, '-': P.clothD, '.': null });
      rect(ctx, hx, hy + 1, 10, 9, P.cloth);
      rect(ctx, hx + 8, hy + 1, 2, 9, P.clothD);
      return;
    }
    drawHairFront(ctx, P, look, hx, hy);
    // cover the face area fully
    const map = hairMap(P);
    rect(ctx, hx, hy, 10, 9, map['#']);
    rect(ctx, hx + 1, hy + 8, 8, 1, map['-']);
    rect(ctx, hx + 3, hy + 9, 4, 1, P.skinD);
    rect(ctx, hx + 8, hy + 1, 2, 7, map['-']);
    rect(ctx, hx + 1, hy + 1, 2, 3, map['+']);
  }

  function drawHeadband(ctx, P, look, hx, hy, back, tx, ty) {
    const hb = look.headband;
    if (hb === 'forehead') {
      if (!back) {
        rect(ctx, hx, hy + 2, 10, 2, P.cloth);
        rect(ctx, hx + 2, hy + 2, 6, 2, P.metal);
        rect(ctx, hx + 2, hy + 3, 6, 1, P.metalD);
        rect(ctx, hx + 4, hy + 2, 2, 1, P.outline);
        // tails flutter behind (left)
        rect(ctx, hx - 2, hy + 3, 2, 1, P.cloth);
        rect(ctx, hx - 3, hy + 4, 2, 1, P.clothD);
      } else {
        rect(ctx, hx, hy + 2, 10, 2, P.cloth);
        rect(ctx, hx + 4, hy + 2, 2, 3, P.clothD);
        rect(ctx, hx + 3, hy + 5, 1, 3, P.cloth);
        rect(ctx, hx + 6, hy + 5, 1, 2, P.cloth);
      }
    } else if (hb === 'neck') {
      rect(ctx, tx, ty - 1, 8, 2, P.cloth);
      if (!back) { rect(ctx, tx + 2, ty - 1, 4, 2, P.metal); rect(ctx, tx + 2, ty, 4, 1, P.metalD); }
    }
  }

  function drawScarf(ctx, P, look, tx, ty, back, stage) {
    if (look.extra !== 'scarf') return;
    if (stage === 'tail') {
      if (!back) {
        rect(ctx, tx - 3, ty, 3, 2, P.cloth);
        rect(ctx, tx - 5, ty + 1, 3, 2, P.clothD);
        rect(ctx, tx - 6, ty + 3, 2, 1, P.clothD);
      } else {
        rect(ctx, tx + 2, ty + 1, 3, 7, P.cloth);
        rect(ctx, tx + 4, ty + 1, 1, 7, P.clothD);
      }
      return;
    }
    rect(ctx, tx - 1, ty - 1, 10, 3, P.cloth);
    rect(ctx, tx - 1, ty + 1, 10, 1, P.clothD);
    rect(ctx, tx + 1, ty - 1, 3, 1, P.clothL);
  }

  // ---- full character composite ----------------------------------------------
  function drawCharacter(ctx, look, poseName, frame, view) {
    const P = palette(look);
    const frames = POSES[poseName] || POSES.idle;
    const pz = frames[frame % frames.length];
    const back = view === 'B';
    const by = pz.by || 0, lean = pz.lean || 0;
    const tl = Math.round(lean / 2);
    const hx = 11 + lean, hy = 7 + by;
    const tx = 12 + tl, ty = 17 + by;
    const sL = [10 + tl, 18 + by], sR = [20 + tl, 18 + by];
    const hipL = [12, 25 + by], hipR = [17, 25 + by];
    const armL = pz.armL || A_DOWN, armR = pz.armR || A_DOWN;
    const legL = pz.legL || L_STAND, legR = pz.legR || R_STAND;

    const armsBefore = [], armsAfter = [];
    const place = (arm, s, dim) => {
      const behindTorso = back ? !!arm.front : !!arm.back;
      (behindTorso ? armsBefore : armsAfter).push([arm, s, dim]);
    };
    place(armL, sL, back);
    place(armR, sR, !back);

    if (!back) drawHairBackLayer(ctx, P, look, hx, hy, false);
    drawScarf(ctx, P, look, tx, ty, back, back ? '' : 'tail');
    for (const a of armsBefore) drawArm(ctx, P, a[1][0], a[1][1], a[0], true);
    drawLeg(ctx, P, hipR[0], hipR[1], legR, !back);
    drawLeg(ctx, P, hipL[0], hipL[1], legL, back);
    drawTorso(ctx, P, look, tx, ty, back);
    if (back) drawScarf(ctx, P, look, tx, ty, back, 'tail');
    drawHead(ctx, P, look, hx, hy, back);
    if (back) {
      drawHairBackView(ctx, P, look, hx, hy);
      drawHairBackLayer(ctx, P, look, hx, hy, true);
    } else {
      drawHairFront(ctx, P, look, hx, hy);
    }
    drawHeadband(ctx, P, look, hx, hy, back, tx, ty);
    drawScarf(ctx, P, look, tx, ty, back, 'front');
    for (const a of armsAfter) drawArm(ctx, P, a[1][0], a[1][1], a[0], a[2]);
    if (look.headband === 'arm') {
      const a = armsAfter.find((q) => q[1] === sR) || armsAfter[0];
      if (a) {
        const ax = a[1][0] + Math.round(a[0].e[0] / 2), ay = a[1][1] + Math.round(a[0].e[1] / 2);
        rect(ctx, ax, ay, 2, 2, P.cloth);
        rect(ctx, ax, ay, 1, 1, P.metal);
      }
    }
  }

  function outline(canvas, color) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const [r, g, b] = U.hexToRgb(color);
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
          d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  const cache = new Map();
  function get(look, pose, frame, view) {
    const key = lookKey(look) + '|' + pose + '|' + frame + '|' + view;
    let c = cache.get(key);
    if (c) return c;
    c = U.makeCanvas(SPR_W, SPR_H);
    drawCharacter(c.getContext('2d'), look, pose, frame, view);
    outline(c, '#120a18');
    cache.set(key, c);
    return c;
  }

  // Solid-color silhouette of any sprite (hit flash, auras, afterimages).
  const tintCache = new Map();
  function tinted(src, color, key) {
    const k = key + '|' + color;
    let c = tintCache.get(k);
    if (c) return c;
    if (tintCache.size > 1500) tintCache.clear();
    c = U.makeCanvas(src.width, src.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    tintCache.set(k, c);
    return c;
  }
  function getTinted(look, pose, frame, view, color) {
    const src = get(look, pose, frame, view);
    return tinted(src, color, lookKey(look) + '|' + pose + '|' + frame + '|' + view);
  }

  // Portrait (head + shoulders) for HUD, scaled by an integer factor.
  const portraitCache = new Map();
  function portrait(look, scale = 2) {
    const key = lookKey(look) + '|' + scale;
    let c = portraitCache.get(key);
    if (c) return c;
    const src = get(look, 'idle', 0, 'F');
    const sx = 5, sy = 1, sw = 24, sh = 22;
    c = U.makeCanvas(sw * scale, sh * scale);
    c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);
    portraitCache.set(key, c);
    return c;
  }

  function frameCount(pose) { return (POSES[pose] || POSES.idle).length; }

  return { get, getTinted, portrait, frameCount, POSES, lookKey };
})();
