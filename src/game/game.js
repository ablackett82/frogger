// The simulation: the lanes, the hedgehog, the fox, the food and the hunger
// clock. No drawing or sound here — it pushes events ({ type }) for main.js to
// play, and is stepped at a fixed rate so it behaves the same on any screen.
import { buildLevel, COLS, ROWS, TILE, FIELD_W, LOOP, OFF, TRAIN_LEN, WARN_S, stoneState } from './levels.js';
import { Rng } from './rng.js';

export const HOP_S = 0.12;       // one hop, tile to tile
export const START_COL = 7, HOME_ROW = ROWS - 1;
export const START_LIVES = 3, LIFE_EVERY = 10000;
export const DIE_S = 1.6, CLEAR_S = 2.6, INTRO_S = 1.6;
export const FOX_W = 24;
const HOG_HALF = 5;              // the hedgehog's hit box is 10 pixels wide
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export const NO_INPUT = { up: false, down: false, left: false, right: false, curl: false };
export const DEFAULT_CHEATS = { lives: false, invincible: false, noHunger: false, noFox: false };

export const anyCheat = (c) => Object.values(c).some(Boolean);

/** demo: the title screen's attract mode — traffic only, nobody to run over. */
export function newGame({ seed = 1, cheats = {}, demo = false, level = 1 } = {}) {
  const g = {
    rng: new Rng(seed), t: 0, score: 0, lives: START_LIVES, nextLife: LIFE_EVERY, level: 0, demo,
    cheats: { ...DEFAULT_CHEATS, ...cheats }, cheated: false, events: [], prev: { ...NO_INPUT },
  };
  g.cheated = anyCheat(g.cheats);
  startLevel(g, level);
  return g;
}

/** Cheats can be switched any time; a game that ever used one is marked. */
export function setCheats(g, cheats) {
  g.cheats = { ...DEFAULT_CHEATS, ...cheats };
  if (anyCheat(g.cheats)) g.cheated = true;
}

export function skipLevel(g) {
  if (g.phase === 'over') return;
  g.cheated = true;
  startLevel(g, g.level + 1);
}

function startLevel(g, n) {
  const L = buildLevel(n, g.rng);
  g.level = n;
  g.lanes = L.lanes;
  g.night = L.night;
  g.hungerMax = L.hunger;
  g.fox = L.fox;
  g.foods = L.foods.map((f) => ({ ...f, state: 'waiting', slot: -1 }));
  g.beetle = null;
  g.beetleWait = g.rng.range(6, 12);
  resetHog(g);
  g.phase = 'intro';
  g.timer = INTRO_S;
  if (!g.demo) g.events.push({ type: 'level', n, night: g.night });
}

function resetHog(g) {
  g.hog = {
    col: START_COL, row: HOME_ROW, fromCol: START_COL, fromRow: HOME_ROW, t: 1, hopping: false,
    face: 'up', curled: false, carrying: null, step: 0, buffer: null, dead: null,
  };
  g.hunger = g.hungerMax;
  g.best = HOME_ROW; // furthest row reached on the way out (points for each new one)
  g.backBest = 0;    // ...and on the way home with food
}

/** Where the hedgehog is, in tiles, part way through a hop. */
export function hogPos(h) {
  if (h.dead) return h.dead.at;
  const e = h.hopping ? h.t : 1;
  return { col: h.fromCol + (h.col - h.fromCol) * e, row: h.fromRow + (h.row - h.fromRow) * e };
}

/** A vehicle's left edge on screen. */
export const screenX = (x) => ((x % LOOP) + LOOP) % LOOP - OFF;

export function update(g, dt, input = NO_INPUT) {
  g.t += dt;
  updateWorld(g, dt);
  if (!g.demo) {
    switch (g.phase) {
      case 'intro': if ((g.timer -= dt) <= 0) g.phase = 'play'; break;
      case 'play': play(g, dt, input); break;
      case 'dying': if ((g.timer -= dt) <= 0) afterDeath(g); break;
      case 'clear': if ((g.timer -= dt) <= 0) startLevel(g, g.level + 1); break;
    }
  }
  Object.assign(g.prev, input);
}

function updateWorld(g, dt) {
  for (const lane of g.lanes) {
    if (lane.kind === 'road') {
      for (const v of lane.things) v.x = (v.x + lane.dir * lane.speed * dt + LOOP) % LOOP;
    } else if (lane.kind === 'rail') {
      if (lane.train) {
        lane.train.x += lane.dir * lane.speed * dt;
        if (lane.dir > 0 ? lane.train.x > FIELD_W + 8 : lane.train.x + TRAIN_LEN < -8) {
          lane.train = null;
          lane.wait = g.rng.range(...lane.gap);
        }
      } else {
        lane.wait -= dt;
        lane.warn = lane.wait < WARN_S;
        if (lane.warn && (lane.ding -= dt) <= 0) { lane.ding = 0.45; event(g, 'ding'); }
        if (lane.wait <= 0) {
          lane.train = { x: lane.dir > 0 ? -TRAIN_LEN : FIELD_W };
          lane.warn = false;
          lane.ding = 0;
          event(g, 'train');
        }
      }
    }
  }
  moveFox(g, dt);
}

function moveFox(g, dt) {
  const f = g.fox;
  if (!f || g.cheats.noFox) return;
  if (f.bump > 0) f.bump -= dt;
  if (f.pause > 0) { f.pause -= dt; return; }
  let speed = f.speed;
  const h = g.hog;
  // from level 4 the fox comes for you if you're on its verge
  if (f.chase && f.bump <= 0 && g.phase === 'play' && !h.dead && Math.round(hogPos(h).row) === f.row) {
    const hx = hogPos(h).col * TILE + TILE / 2;
    f.dir = hx > f.x + FOX_W / 2 ? 1 : -1;
    speed *= 1.6;
  }
  f.x += f.dir * speed * dt;
  f.walk += dt * speed;
  if (f.x < -6 && f.dir < 0) { f.dir = 1; f.pause = g.rng.range(0.3, 1.2); }
  else if (f.x > FIELD_W - FOX_W + 6 && f.dir > 0) { f.dir = -1; f.pause = g.rng.range(0.3, 1.2); }
}

function play(g, dt, input) {
  const h = g.hog;
  // a direction pressed mid-hop is remembered, so quick taps are never lost
  for (const d in DIRS) if (input[d] && !g.prev[d]) h.buffer = d;

  if (!g.cheats.noHunger) {
    const before = g.hunger;
    g.hunger = Math.max(0, g.hunger - dt);
    if (g.hunger < 5 && g.hunger > 0 && Math.ceil(g.hunger) < Math.ceil(before)) event(g, 'tick');
    if (g.hunger <= 0 && !g.cheats.invincible) { die(g, 'hunger'); return; }
  }

  if (h.hopping) {
    h.t += dt / HOP_S;
    if (h.t >= 1) {
      h.t = 1;
      h.hopping = false;
      arrive(g);
      if (g.phase !== 'play') return;
    }
  }
  h.curled = !h.hopping && !!input.curl;
  if (h.curled) h.buffer = null;
  if (!h.hopping && !h.curled) {
    const d = h.buffer || Object.keys(DIRS).find((k) => input[k]);
    h.buffer = null;
    if (d) hop(g, d);
  }
  beetle(g, dt);
  collide(g);
}

function hop(g, d) {
  const h = g.hog;
  const [dx, dy] = DIRS[d];
  h.face = d;
  const col = h.col + dx, row = h.row + dy;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  h.fromCol = h.col; h.fromRow = h.row;
  h.col = col; h.row = row;
  h.t = 0;
  h.hopping = true;
  h.step++;
  event(g, 'hop');
}

function arrive(g) {
  const h = g.hog;
  if (!h.carrying && h.row < g.best) { addScore(g, 10 * (g.best - h.row)); g.best = h.row; }
  if (h.carrying && h.row > g.backBest) { addScore(g, 10 * (h.row - g.backBest)); g.backBest = h.row; }
  if (h.row === 0 && !h.carrying) {
    const f = g.foods.find((f) => f.state === 'waiting' && f.col === h.col);
    if (f) {
      f.state = 'carried';
      h.carrying = f;
      g.backBest = 0;
      addScore(g, 50);
      event(g, 'pickup');
    }
  }
  if (h.row === HOME_ROW && h.carrying) deliver(g);
}

function deliver(g) {
  const h = g.hog, f = h.carrying;
  f.state = 'home';
  f.slot = g.foods.filter((x) => x.state === 'home').length - 1;
  h.carrying = null;
  const bonus = Math.ceil(g.hunger) * 10;
  addScore(g, 200 + bonus);
  event(g, 'deliver', { bonus });
  g.hunger = g.hungerMax;
  g.best = HOME_ROW;
  if (g.foods.every((x) => x.state === 'home')) {
    addScore(g, 1000);
    g.phase = 'clear';
    g.timer = CLEAR_S;
    event(g, 'clear');
  }
}

// a beetle turns up on a verge now and then: worth points, and a bit less hungry
function beetle(g, dt) {
  const h = g.hog;
  if (g.beetle) {
    if ((g.beetle.life -= dt) <= 0) g.beetle = null;
    else if (!h.hopping && h.col === g.beetle.col && h.row === g.beetle.row) {
      g.beetle = null;
      addScore(g, 150);
      g.hunger = Math.min(g.hungerMax, g.hunger + 5);
      event(g, 'munch');
    }
  } else if ((g.beetleWait -= dt) <= 0) {
    g.beetleWait = g.rng.range(8, 16);
    const rows = g.lanes.map((l, r) => (l.kind === 'grass' ? r : -1)).filter((r) => r > 0);
    if (rows.length) {
      const row = g.rng.pick(rows), col = g.rng.int(COLS);
      if (row !== h.row || col !== h.col) g.beetle = { row, col, life: 7 };
    }
  }
}

function collide(g) {
  const h = g.hog;
  const p = hogPos(h);
  const row = Math.round(p.row);
  const x = p.col * TILE + TILE / 2;
  const lane = g.lanes[row];
  const hits = (l, r) => x + HOG_HALF > l && x - HOG_HALF < r;

  if (lane.kind === 'road') {
    for (const v of lane.things) { const sx = screenX(v.x); if (hits(sx + 1, sx + v.w - 1)) return die(g, 'squish'); }
  } else if (lane.kind === 'rail') {
    if (lane.train && hits(lane.train.x, lane.train.x + TRAIN_LEN)) return die(g, 'train');
  } else if (lane.kind === 'brook' && !h.hopping) {
    if (stoneState(lane.stones[h.col], g.t) === 'under' || !lane.stones[h.col]) return die(g, 'splash');
  }

  const f = g.fox;
  if (f && !g.cheats.noFox && row === f.row && hits(f.x + 2, f.x + FOX_W - 2)) {
    if (h.curled) {
      // prickles! the fox yelps and backs off
      if (f.bump <= 0) {
        f.dir = x > f.x + FOX_W / 2 ? -1 : 1;
        f.x = f.dir < 0 ? x - HOG_HALF - FOX_W : x + HOG_HALF;
        f.bump = 2;
        f.pause = 0.4;
        addScore(g, 100);
        event(g, 'yelp');
      }
    } else return die(g, 'fox');
  }
}

function die(g, cause) {
  if (g.cheats.invincible) return;
  const h = g.hog;
  h.dead = { cause, at: hogPos(h) };
  h.hopping = false;
  h.curled = false;
  g.phase = 'dying';
  g.timer = DIE_S;
  event(g, 'die', { cause });
}

function afterDeath(g) {
  if (!g.cheats.lives) g.lives--;
  if (g.lives <= 0) { g.phase = 'over'; event(g, 'gameover'); return; }
  if (g.hog.carrying) g.hog.carrying.state = 'waiting';
  resetHog(g);
  g.phase = 'play';
}

function addScore(g, n) {
  g.score += n;
  while (g.score >= g.nextLife) { g.lives++; g.nextLife += LIFE_EVERY; event(g, 'life'); }
}

function event(g, type, extra) { if (!g.demo) g.events.push({ type, ...extra }); }
