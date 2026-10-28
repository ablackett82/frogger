// Turns the art into canvases, and draws the things that are easier as shapes
// than as strings: the vehicles, the logs and the turtles.
import { FROG, FROG_MINI, LADY, FLY, SKULL } from './art.js';
import { VEHICLES, TILE } from '../game/levels.js';

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

function fourWays(up) {
  const turn = { up: 0, right: 1, down: 2, left: 3 };
  const o = {};
  for (const d in turn) o[d] = rotate(up, turn[d]);
  return o;
}

export function buildSprites() {
  return {
    frog: fourWays(fromRows(FROG.rows, FROG.pal)),
    lady: fourWays(fromRows(LADY.rows, LADY.pal)),
    frogSit: fromRows(FROG.rows, FROG.pal),
    ladySit: fromRows(LADY.rows, LADY.pal),
    mini: fromRows(FROG_MINI.rows, FROG_MINI.pal),
    fly: fromRows(FLY.rows, FLY.pal),
    skull: fromRows(SKULL.rows, SKULL.pal),
    bayCroc: bayCrocHead(),
  };
}

// ---- vehicles, all drawn facing right ---------------------------------------

function box(x, a, b, w, h, c) { x.fillStyle = c; x.fillRect(a, b, w, h); }

const GLASS = '#bfe8ff', GLASS2 = '#6fa8cf', LAMP = '#fff6a0', TAIL = '#ff3030', TYRE = '#111';

const DRAW = {
  car(x, c) {
    for (const [a, b] of [[2, 0], [10, 0], [2, 9], [10, 9]]) box(x, a, b, 4, 2, TYRE);
    box(x, 0, 1, 16, 9, shade(c, 0.6)); box(x, 1, 2, 14, 7, c);
    box(x, 3, 3, 6, 5, GLASS); box(x, 10, 3, 3, 5, shade(c, 1.3));
    box(x, 15, 2, 1, 2, LAMP); box(x, 15, 7, 1, 2, LAMP); box(x, 0, 2, 1, 2, TAIL); box(x, 0, 7, 1, 2, TAIL);
  },
  truck(x, c) {
    for (const a of [4, 11, 30, 40]) { box(x, a, 0, 5, 2, TYRE); box(x, a, 10, 5, 2, TYRE); }
    box(x, 0, 1, 34, 11, shade(c, 0.55)); box(x, 1, 2, 32, 9, c); box(x, 2, 4, 30, 2, shade(c, 1.2));
    box(x, 34, 3, 2, 7, '#333');
    box(x, 36, 1, 12, 11, '#c9c9c9'); box(x, 37, 2, 10, 9, '#efefef'); box(x, 43, 3, 4, 5, GLASS);
    box(x, 47, 2, 1, 2, LAMP); box(x, 47, 9, 1, 2, LAMP); box(x, 0, 3, 1, 2, TAIL); box(x, 0, 8, 1, 2, TAIL);
  },
  racer(x, c) {
    for (const [a, b] of [[3, 0], [12, 0], [3, 8], [12, 8]]) box(x, a, b, 4, 2, TYRE);
    box(x, 0, 2, 18, 6, shade(c, 0.6)); box(x, 1, 3, 16, 4, c);
    box(x, 2, 3, 7, 1, '#e03030'); box(x, 9, 3, 7, 1, '#2a52d0'); // livery stripes
    box(x, 10, 3, 3, 4, GLASS); box(x, 16, 3, 2, 2, LAMP); box(x, 0, 3, 1, 2, TAIL);
  },
  dozer(x, c) {
    box(x, 3, 1, 8, 3, TYRE); box(x, 3, 9, 8, 3, TYRE); box(x, 4, 2, 6, 1, '#555'); box(x, 4, 10, 6, 1, '#555');
    box(x, 18, 2, 4, 3, TYRE); box(x, 18, 8, 4, 3, TYRE);
    box(x, 4, 3, 20, 7, shade(c, 0.6)); box(x, 5, 4, 18, 5, c);
    box(x, 6, 4, 7, 5, '#d8d8c0'); box(x, 7, 5, 5, 3, GLASS2);
    box(x, 24, 1, 4, 11, '#9a9a9a'); box(x, 23, 1, 1, 11, '#555'); // the blade
    box(x, 25, 5, 1, 1, LAMP); box(x, 25, 7, 1, 1, LAMP);
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
    DRAW[type](c.getContext('2d'), colour || '#d23c3c');
    s = dir > 0 ? c : flipX(c);
    vcache.set(key, s);
  }
  return s;
}

// ---- river things -----------------------------------------------------------

const BARK = '#7a4a24', WOOD = '#9a6334', DARK = '#5a3516', RING = '#c79464';

const pcache = new Map();
/** A log of the given pixel width, cached. */
export function log(w) {
  let s = pcache.get(w);
  if (!s) {
    const c = makeCanvas(w, 13), x = c.getContext('2d');
    box(x, 0, 1, w, 11, DARK); box(x, 0, 2, w, 9, BARK); box(x, 0, 3, w, 2, WOOD);
    box(x, 0, 9, w, 1, DARK);
    for (let i = 6; i < w - 2; i += 9) box(x, i, 4, 1, 5, shade(BARK, 0.8)); // bark grooves
    // sawn ends, with rings
    for (const ex of [0, w - 4]) { box(x, ex, 1, 4, 11, '#6a4420'); box(x, ex, 2, 4, 9, RING); box(x, ex + 1, 4, 2, 5, '#9c6c3e'); box(x, ex + 1, 5, 2, 3, '#6a4420'); }
    s = c;
    pcache.set(w, s);
  }
  return s;
}

const CROC_BODY = '#2f7a3a', CROC_DK = '#1c5527', CROC_HI = '#4fa85f', CROC_EYE = '#f2e23a', CROC_K = '#0e2a16', MOUTH = '#8a1020', TOOTH = '#f4f4f4';

const ccache = new Map();
/** A crocodile `tiles` long, heading `dir`, jaws open or shut. Head leads the way. */
export function croc(tiles, open, dir) {
  const key = `${tiles}${open ? 1 : 0}${dir}`;
  let s = ccache.get(key);
  if (!s) {
    const w = tiles * TILE, c = makeCanvas(w, 13), x = c.getContext('2d');
    const hx = w - TILE; // the head segment
    box(x, 0, 2, w, 9, CROC_DK); box(x, 0, 3, w, 7, CROC_BODY); box(x, 0, 4, hx, 1, CROC_HI);
    for (let i = 4; i < hx - 1; i += 6) { box(x, i, 2, 2, 1, CROC_DK); box(x, i + 3, 10, 2, 1, CROC_DK); } // back ridges & feet
    box(x, 0, 5, 3, 3, CROC_BODY); // blunt tail
    // head
    box(x, hx, 1, TILE, 10, CROC_DK); box(x, hx, 2, TILE, 8, CROC_BODY);
    box(x, hx + 1, 1, 3, 3, CROC_BODY); box(x, hx + 2, 2, 2, 2, CROC_EYE); box(x, hx + 2, 2, 1, 1, CROC_K); // eye bump
    if (open) {
      box(x, hx + 6, 2, TILE - 6, 2, CROC_BODY);   // upper jaw
      box(x, hx + 6, 4, TILE - 6, 3, MOUTH);        // gullet
      box(x, hx + 6, 8, TILE - 6, 2, CROC_BODY);    // lower jaw
      for (let tx = hx + 7; tx < w - 1; tx += 2) { box(x, tx, 4, 1, 1, TOOTH); box(x, tx, 7, 1, 1, TOOTH); }
    } else {
      box(x, hx + 6, 2, TILE - 6, 5, CROC_BODY); box(x, hx + 6, 6, TILE - 6, 1, CROC_K); // shut snout
    }
    s = dir > 0 ? c : flipX(c);
    ccache.set(key, s);
  }
  return s;
}

/** A crocodile's head rising into a home bay, jaws agape. */
function bayCrocHead() {
  const c = makeCanvas(16, 16), x = c.getContext('2d');
  box(x, 3, 0, 10, 7, CROC_DK); box(x, 3, 1, 10, 6, CROC_BODY);
  box(x, 4, 1, 3, 3, CROC_BODY); box(x, 10, 1, 3, 3, CROC_BODY); // eye bumps
  box(x, 5, 2, 2, 2, CROC_EYE); box(x, 10, 2, 2, 2, CROC_EYE); box(x, 5, 2, 1, 1, CROC_K); box(x, 11, 2, 1, 1, CROC_K);
  box(x, 2, 7, 12, 2, CROC_BODY);  // upper jaw
  box(x, 3, 9, 10, 3, MOUTH);       // open mouth
  box(x, 2, 12, 12, 3, CROC_BODY);  // lower jaw
  for (let tx = 3; tx < 13; tx += 2) { box(x, tx, 9, 1, 1, TOOTH); box(x, tx, 11, 1, 1, TOOTH); }
  return c;
}

const tcache = new Map();
/** A row of `n` turtles, drawn up or part-dived, cached. */
export function turtles(n, diving) {
  const key = `${n}${diving ? 1 : 0}`;
  let s = tcache.get(key);
  if (!s) {
    const c = makeCanvas(n * TILE, 13), x = c.getContext('2d');
    const SH = '#2f9e4f', RIM = '#1c6b35', HI = '#79e08c', HEAD = '#3bb562', K = '#0e2a16';
    for (let i = 0; i < n; i++) {
      const ox = i * TILE + 1, drop = diving ? 3 : 0;
      // head and flippers peek out to the left (the way turtles swim)
      box(x, ox, 5 + drop, 3, 3, HEAD); box(x, ox, 6 + drop, 1, 1, K);
      box(x, ox + 2, 2 + drop, 11, 9 - drop, RIM);
      box(x, ox + 3, 3 + drop, 9, 7 - drop, SH);
      if (!diving) { box(x, ox + 5, 4, 5, 2, HI); box(x, ox + 4, 6, 7, 2, shade(SH, 0.8)); }
      box(x, ox + 12, 5 + drop, 2, 3, HEAD); // back flipper
    }
    s = c;
    tcache.set(key, s);
  }
  return s;
}
