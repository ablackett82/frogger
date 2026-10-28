// The simulation: the traffic, the river, the frog that rides what floats by,
// the five home bays, the clock and the bonuses. No drawing or sound here — it
// pushes events ({ type }) for main.js to play, and is stepped at a fixed rate
// so it behaves the same on any screen.
import {
  buildLevel, COLS, ROWS, TILE, FIELD_W, LOOP, OFF, turtleState, crocJaw,
  HOME_ROW, MEDIAN_ROW, START_ROW, HOME_COLS, BAY_ACCEPT, BAY_CROC_LEVEL,
} from './levels.js';
import { Rng } from './rng.js';

export const HOP_S = 0.11;       // one hop, tile to tile
export const START_COL = 6;
export const START_X = START_COL * TILE;
export const START_LIVES = 3, LIFE_EVERY = 20000;
export const DIE_S = 1.5, CLEAR_S = 2.6, INTRO_S = 1.4;
export const FROG_HALF = 5;      // the frog's hit box is 10 pixels wide
export const TIME_MAX = 32;      // seconds to get a frog home
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export const NO_INPUT = { up: false, down: false, left: false, right: false };
export const DEFAULT_CHEATS = { lives: false, invincible: false };

export const anyCheat = (c) => Object.values(c).some(Boolean);

/** demo: the title screen's attract mode — traffic and river only, no frog. */
export function newGame({ seed = 1, cheats = {}, demo = false, level = 1 } = {}) {
  const g = {
    rng: new Rng(seed), t: 0, score: 0, lives: START_LIVES, nextLife: LIFE_EVERY, level: 0, demo,
    cheats: { ...DEFAULT_CHEATS, ...cheats }, cheated: false, events: [], prev: { ...NO_INPUT },
  };
  g.cheated = anyCheat(g.cheats);
  startLevel(g, level);
  return g;
}

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
  g.homes = L.homes;
  g.logRows = L.logRows;
  g.fly = null;
  g.flyWait = g.rng.range(4, 9);
  g.lady = null;
  g.ladyWait = g.rng.range(6, 12);
  g.bayCroc = null;
  g.bayCrocWait = g.rng.range(5, 10);
  resetFrog(g);
  g.phase = 'intro';
  g.timer = INTRO_S;
  if (!g.demo) g.events.push({ type: 'level', n });
}

function resetFrog(g) {
  g.frog = {
    x: START_X, row: START_ROW, fromX: START_X, fromRow: START_ROW, toX: START_X, toRow: START_ROW,
    t: 1, hopping: false, face: 'up', carrying: null, buffer: null, dead: null,
  };
  g.time = TIME_MAX;
  g.best = START_ROW; // furthest row reached this trip (10 points for each new one)
}

/** Where the frog is, in pixels across and tiles down, part way through a hop. */
export function frogPos(f) {
  if (f.dead) return f.dead.at;
  if (!f.hopping) return { x: f.x, row: f.row };
  return { x: f.fromX + (f.toX - f.fromX) * f.t, row: f.fromRow + (f.toRow - f.fromRow) * f.t };
}

/** A thing's left edge on screen, from its position on the loop. */
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
    if (lane.kind === 'road' || lane.kind === 'river') {
      for (const thing of lane.things) thing.x = (thing.x + lane.dir * lane.speed * dt + LOOP) % LOOP;
    }
  }
}

function play(g, dt, input) {
  const f = g.frog;

  if (!g.cheats.invincible) {
    const before = g.time;
    g.time = Math.max(0, g.time - dt);
    if (g.time < 5 && g.time > 0 && Math.ceil(g.time) < Math.ceil(before)) event(g, 'tick');
    if (g.time <= 0) { die(g, 'time'); return; }
  }

  // a direction pressed mid-hop is remembered, so quick taps are never lost
  for (const d in DIRS) if (input[d] && !g.prev[d]) f.buffer = d;

  if (f.hopping) {
    f.t += dt / HOP_S;
    if (f.t >= 1) {
      f.t = 1;
      f.hopping = false;
      land(g);
      if (g.phase !== 'play') return;
    }
  }
  if (!f.hopping) {
    const d = f.buffer || Object.keys(DIRS).find((k) => input[k]);
    f.buffer = null;
    if (d) hop(g, d);
  }

  ride(g, dt);
  if (g.phase !== 'play') return;
  bonuses(g, dt);
  collide(g);
}

function hop(g, d) {
  const f = g.frog;
  const [dx, dy] = DIRS[d];
  f.face = d;
  let toX = f.x, toRow = f.row;
  if (dy) { toRow = f.row + dy; if (toRow < HOME_ROW || toRow > START_ROW) return; }
  else { toX = f.x + dx * TILE; if (toX < 0 || toX > FIELD_W - TILE) return; }
  f.fromX = f.x; f.fromRow = f.row;
  f.toX = toX; f.toRow = toRow;
  f.t = 0; f.hopping = true;
  event(g, 'hop');
}

function land(g) {
  const f = g.frog;
  f.x = f.toX; f.row = f.toRow;
  if (f.row < g.best) { addScore(g, 10 * (g.best - f.row)); g.best = f.row; }
  if (f.row === HOME_ROW) reachHome(g);
}

function reachHome(g) {
  const f = g.frog;
  const centre = f.x + TILE / 2;
  let bay = null, best = BAY_ACCEPT + 0.5;
  for (const h of g.homes) { const dx = Math.abs(centre - (h.col * TILE + TILE / 2)); if (dx < best) { best = dx; bay = h; } }
  if (!bay || bay.filled) return die(g, bay ? 'occupied' : 'hedge');
  if (bay.croc) return die(g, 'croc'); // straight into the lurking crocodile's mouth

  bay.filled = true;
  let gained = 50 + 10 * Math.floor(g.time);
  if (bay.fly) { bay.fly = false; g.fly = null; gained += 200; bay.hadFly = true; }
  if (f.carrying === 'lady') { f.carrying = null; g.lady = null; gained += 200; bay.lady = true; }
  addScore(g, gained);
  event(g, 'home', { fly: bay.hadFly, lady: bay.lady });

  if (g.homes.every((h) => h.filled)) {
    addScore(g, 1000);
    g.phase = 'clear';
    g.timer = CLEAR_S;
    event(g, 'clear');
  } else {
    resetFrog(g);
  }
}

// Ride whatever floats under the frog; open water, a dived turtle or the river's
// edge is a drowning. Only while resting — mid-hop the frog is in the air.
function ride(g, dt) {
  const f = g.frog;
  if (f.hopping) return;
  const lane = g.lanes[f.row];
  if (!lane || lane.kind !== 'river') return;
  if (g.cheats.invincible) return;
  const centre = f.x + TILE / 2;
  let platform = null;
  for (const thing of lane.things) {
    const sx = screenX(thing.x);
    if (centre >= sx && centre <= sx + thing.w) {
      if (lane.turtle && turtleState(thing, g.t) === 'under') continue;
      platform = thing;
      break;
    }
  }
  if (!platform) return die(g, 'drown');
  // a crocodile is a fine raft until you are over its open jaws (the head, at the
  // front in its direction of travel)
  if (platform.croc && crocJaw(platform, g.t) === 'open') {
    const sx = screenX(platform.x);
    const headL = lane.dir > 0 ? sx + platform.w - TILE : sx;
    if (centre >= headL && centre <= headL + TILE) return die(g, 'croc');
  }
  f.x += lane.dir * lane.speed * dt;
  if (f.x < -2 || f.x > FIELD_W - TILE + 2) return die(g, 'drown');
  f.x = Math.max(0, Math.min(FIELD_W - TILE, f.x));

  // the lady frog hops on when you share her log
  if (g.lady && g.lady.row === f.row && !f.carrying) {
    const lx = screenX(g.lady.x) + g.lady.w / 2;
    if (Math.abs(centre - lx) < TILE) { f.carrying = 'lady'; g.lady = null; event(g, 'ladypickup'); }
  }
}

function bonuses(g, dt) {
  // a fly lands in an empty bay for a few seconds
  if (g.fly) {
    if ((g.fly.life -= dt) <= 0) { const h = g.homes[g.fly.bay]; if (h) h.fly = false; g.fly = null; }
  } else if ((g.flyWait -= dt) <= 0) {
    g.flyWait = g.rng.range(6, 12);
    const open = g.homes.map((h, i) => (!h.filled && !h.fly ? i : -1)).filter((i) => i >= 0);
    if (open.length) { const bay = g.rng.pick(open); g.homes[bay].fly = true; g.fly = { bay, life: g.rng.range(3.5, 6) }; }
  }

  // a crocodile lurks in an empty bay for a while at higher levels
  if (g.bayCroc) {
    if ((g.bayCroc.life -= dt) <= 0) { const h = g.homes[g.bayCroc.bay]; if (h) h.croc = false; g.bayCroc = null; }
  } else if (g.level >= BAY_CROC_LEVEL && (g.bayCrocWait -= dt) <= 0) {
    g.bayCrocWait = g.rng.range(7, 13);
    const open = g.homes.map((h, i) => (!h.filled && !h.fly && !h.croc ? i : -1)).filter((i) => i >= 0);
    if (open.length) { const bay = g.rng.pick(open); g.homes[bay].croc = true; g.bayCroc = { bay, life: g.rng.range(3, 5.5) }; }
  }

  // the lady frog rides a log across now and then
  if (g.lady) {
    const lane = g.lanes[g.lady.row];
    g.lady.x = (g.lady.x + lane.dir * lane.speed * dt + LOOP) % LOOP;
    const sx = screenX(g.lady.x);
    if (sx < -g.lady.w - 8 || sx > FIELD_W + 8) g.lady = null;
  } else if ((g.ladyWait -= dt) <= 0) {
    g.ladyWait = g.rng.range(10, 18);
    if (g.logRows.length) {
      const row = g.rng.pick(g.logRows), lane = g.lanes[row];
      const start = lane.dir > 0 ? OFF - TILE : OFF + FIELD_W;
      g.lady = { row, x: (start + LOOP) % LOOP, w: TILE };
    }
  }
}

function collide(g) {
  const f = g.frog;
  if (g.cheats.invincible) return;
  const p = frogPos(f);
  const lane = g.lanes[Math.round(p.row)];
  if (!lane || lane.kind !== 'road') return;
  const centre = p.x + TILE / 2;
  for (const v of lane.things) {
    const sx = screenX(v.x);
    if (centre + FROG_HALF > sx + 1 && centre - FROG_HALF < sx + v.w - 1) return die(g, 'squish');
  }
}

function die(g, cause) {
  if (g.cheats.invincible) return;
  const f = g.frog;
  f.dead = { cause, at: frogPos(f) };
  f.hopping = false;
  f.carrying = null;
  g.phase = 'dying';
  g.timer = DIE_S;
  event(g, 'die', { cause });
}

function afterDeath(g) {
  if (!g.cheats.lives) g.lives--;
  if (g.lives <= 0) { g.phase = 'over'; event(g, 'gameover'); return; }
  resetFrog(g);
  g.phase = 'play';
}

function addScore(g, n) {
  g.score += n;
  while (g.score >= g.nextLife) { g.lives++; g.nextLife += LIFE_EVERY; event(g, 'life'); }
}

function event(g, type, extra) { if (!g.demo) g.events.push({ type, ...extra }); }
