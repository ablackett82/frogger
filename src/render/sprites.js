// Turns the art into canvases, and draws the things that are easier as shapes
// than as strings: the vehicles, the train, the fox, stones and the curled ball.
import { HOG, HOG_MINI, FOOD, BEETLE } from './art.js';
import { VEHICLES, TRAIN_LEN } from '../game/levels.js';

export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function fromRows(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const c = makeCanvas(w, h), x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = rows[j][i];
    if (ch !== '.') { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); }
  }
  return c;
}

/** Each pixel from fn(x, y), a colour or null. */
function fromFn(w, h, fn) {
  const c = makeCanvas(w, h), x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const col = fn(i, j); if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } }
  return c;
}

function rotate(src, quarters) {
  const c = makeCanvas(src.width, src.height), x = c.getContext('2d');
  x.translate(src.width / 2, src.height / 2);
  x.rotate((quarters * Math.PI) / 2);
  x.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

export function flipX(src) {
  const c = makeCanvas(src.width, src.height), x = c.getContext('2d');
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function hogFrame(feet) {
  const rows = HOG.rows.map((r) => r.split(''));
  for (const [x, y] of feet) if (rows[y][x] === '.') rows[y][x] = 'p';
  return fromRows(rows.map((r) => r.join('')), HOG.pal);
}

export function buildSprites() {
  const frames = HOG.feet.map(hogFrame);
  const turn = { up: 0, right: 1, down: 2, left: 3 };
  const hog = {};
  for (const d in turn) hog[d] = frames.map((f) => rotate(f, turn[d]));
  const { k, b, l } = HOG.pal;
  const ball = fromFn(14, 14, (x, y) => {
    const dx = x - 6.5, dy = y - 6.5;
    if (dx * dx + dy * dy > 6.9 * 6.9) return null;
    if ((x * 3 + y * 5) % 7 === 0) return l;
    return (x + y) % 2 ? k : b;
  });
  const food = {};
  for (const kind in FOOD) food[kind] = fromRows(FOOD[kind].rows, FOOD[kind].pal);
  return {
    hog, ball, food,
    mini: fromRows(HOG_MINI.rows, HOG_MINI.pal),
    beetle: fromRows(BEETLE.rows, BEETLE.pal),
    stone: stone('#8b9097', '#b4b9bf', '#5f646b'),
    mossy: stone('#7f9474', '#a9bb98', '#55654c'),
    fox: [0, 1].map((f) => { const r = fox(f); return { right: r, left: flipX(r) }; }),
    train: (() => { const r = train(); return { 1: r, [-1]: flipX(r) }; })(),
  };
}

function stone(mid, hi, lo) {
  return fromFn(14, 12, (x, y) => {
    const dx = (x - 6.5) / 6.8, dy = (y - 5.5) / 5.3;
    const d = dx * dx + dy * dy;
    if (d > 1) return null;
    if (dx + dy < -0.6) return hi;
    if (dx + dy > 0.7 || d > 0.8) return lo;
    return mid;
  });
}

// ---- vehicles, all drawn facing right ---------------------------------------

function box(x, a, b, w, h, c) { x.fillStyle = c; x.fillRect(a, b, w, h); }

const GLASS = '#9fd8ff', GLASS2 = '#6fa8cf', LAMP = '#fff6a0', TAIL = '#ff3030', TYRE = '#151515';

const DRAW = {
  car(x, c) {
    for (const [a, b] of [[2, 0], [10, 0], [2, 10], [10, 10]]) box(x, a, b, 4, 2, TYRE);
    box(x, 0, 1, 16, 10, shade(c, 0.6)); box(x, 1, 2, 14, 8, c);
    box(x, 4, 3, 7, 6, shade(c, 1.25)); box(x, 11, 3, 2, 6, GLASS); box(x, 3, 3, 1, 6, GLASS2);
    box(x, 15, 2, 1, 2, LAMP); box(x, 15, 8, 1, 2, LAMP); box(x, 0, 2, 1, 2, TAIL); box(x, 0, 8, 1, 2, TAIL);
  },
  van(x, c) {
    for (const [a, b] of [[3, 0], [20, 0], [3, 10], [20, 10]]) box(x, a, b, 5, 2, TYRE);
    box(x, 0, 1, 28, 10, shade(c, 0.6)); box(x, 1, 2, 26, 8, c);
    box(x, 2, 3, 19, 6, shade(c, 1.15)); box(x, 2, 5, 19, 2, shade(c, 0.85));
    box(x, 23, 2, 2, 8, GLASS); box(x, 27, 2, 1, 2, LAMP); box(x, 27, 8, 1, 2, LAMP);
    box(x, 0, 2, 1, 2, TAIL); box(x, 0, 8, 1, 2, TAIL);
  },
  lorry(x, c) {
    for (const a of [3, 9, 22, 36]) { box(x, a, 0, 5, 2, TYRE); box(x, a, 12, 5, 2, TYRE); }
    box(x, 0, 1, 33, 12, '#9a9a9a'); box(x, 1, 2, 31, 10, '#e2e2e2'); box(x, 1, 6, 31, 2, c);
    box(x, 33, 4, 2, 6, '#333');
    box(x, 35, 1, 9, 12, shade(c, 0.6)); box(x, 36, 2, 7, 10, c); box(x, 40, 3, 2, 8, GLASS);
    box(x, 43, 2, 1, 2, LAMP); box(x, 43, 10, 1, 2, LAMP); box(x, 0, 2, 1, 2, TAIL); box(x, 0, 10, 1, 2, TAIL);
  },
  tractor(x, c) {
    box(x, 2, 0, 9, 3, TYRE); box(x, 2, 11, 9, 3, TYRE);
    for (let a = 3; a < 11; a += 2) { box(x, a, 0, 1, 1, '#444'); box(x, a, 13, 1, 1, '#444'); }
    box(x, 19, 1, 4, 2, TYRE); box(x, 19, 11, 4, 2, TYRE);
    box(x, 3, 3, 22, 8, shade(c, 0.6)); box(x, 4, 4, 20, 6, c);
    box(x, 4, 4, 8, 6, '#d8d8d0'); box(x, 5, 5, 6, 4, GLASS2);
    box(x, 16, 6, 2, 2, '#222'); box(x, 25, 5, 1, 1, LAMP); box(x, 25, 8, 1, 1, LAMP);
  },
  bike(x, c) {
    box(x, 0, 3, 12, 2, '#333'); box(x, 0, 3, 3, 2, '#111'); box(x, 9, 3, 3, 2, '#111');
    box(x, 3, 1, 5, 6, c); box(x, 4, 2, 3, 4, shade(c, 1.2));
    box(x, 7, 2, 3, 4, '#2a2a2a'); box(x, 8, 0, 2, 1, c); box(x, 8, 7, 2, 1, c);
  },
};

const vcache = new Map();
/** A vehicle facing its way along the lane, cached by type, colour and direction. */
export function vehicle(type, colour, dir) {
  const key = `${type}${colour}${dir}`;
  let s = vcache.get(key);
  if (!s) {
    const v = VEHICLES[type];
    const c = makeCanvas(v.w, v.h);
    DRAW[type](c.getContext('2d'), colour);
    s = dir > 0 ? c : flipX(c);
    vcache.set(key, s);
  }
  return s;
}

function train() {
  const c = makeCanvas(TRAIN_LEN, 14), x = c.getContext('2d');
  for (let i = 0; i < 4; i++) {
    const a = i * 34;
    box(x, a, 0, 32, 14, '#4a1018'); box(x, a + 1, 1, 30, 12, '#8a2232'); box(x, a + 1, 6, 30, 2, '#e8dcb8');
    for (let w = a + 3; w < a + 30; w += 6) { box(x, w, 2, 4, 3, GLASS2); box(x, w, 9, 4, 3, GLASS2); }
    box(x, a + 32, 5, 2, 4, '#222');
  }
  const e = 4 * 34;
  box(x, e, 0, 40, 14, '#16391f'); box(x, e + 1, 1, 38, 12, '#2e6b3a'); box(x, e + 4, 3, 24, 8, '#3d8a4c');
  box(x, e + 28, 2, 5, 10, GLASS); box(x, e + 33, 1, 7, 12, '#f2c230'); box(x, e + 38, 3, 2, 2, LAMP); box(x, e + 38, 9, 2, 2, LAMP);
  return c;
}

function fox(frame) {
  const c = makeCanvas(24, 12), x = c.getContext('2d');
  const O = '#e06a1c', D = '#a3420f', W = '#f6efe4', K = '#1a1010';
  // legs
  const legs = frame ? [7, 11, 15, 19] : [8, 10, 16, 18];
  for (const a of legs) box(x, a, 9, 1, 3, K);
  // tail, with a white tip
  box(x, 1, 3, 7, 4, O); box(x, 0, 4, 2, 3, W); box(x, 2, 2, 4, 1, D);
  // body and belly
  box(x, 6, 3, 13, 6, O); box(x, 6, 3, 13, 1, D); box(x, 9, 7, 8, 2, W);
  // head, ears, snout
  box(x, 17, 1, 5, 6, O); box(x, 17, 0, 1, 1, K); box(x, 20, 0, 1, 1, K);
  box(x, 21, 4, 3, 2, W); box(x, 23, 4, 1, 1, K); box(x, 19, 2, 1, 1, K); box(x, 18, 5, 3, 1, W);
  return c;
}
