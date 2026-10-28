// The board, which is the same every level in the way the arcade's was: a row
// of five home bays at the top, five river lanes (logs and turtles) you cross
// by riding what floats past, a safe median, five road lanes, and the grass you
// start on. Each new level only makes the traffic and the water quicker and
// sends more turtles diving. Rows, top to bottom: 0 homes, 1-5 river, 6 median,
// 7-11 road, 12 start.

export const COLS = 13, ROWS = 13, TILE = 16;
export const FIELD_W = COLS * TILE, FIELD_H = ROWS * TILE;
export const LOOP = FIELD_W + 112; // things ride a loop longer than the screen...
export const OFF = 56;             // ...that starts this far off the left edge

export const HOME_ROW = 0, MEDIAN_ROW = 6, START_ROW = ROWS - 1;
export const RIVER_TOP = 1, RIVER_BOT = 5, ROAD_TOP = 7, ROAD_BOT = 11;

// the five home bays, by column; the frog must line up with one to get in
export const HOME_COLS = [0, 3, 6, 9, 12];
export const BAY_ACCEPT = 12; // how close the frog's centre must be to a bay

export const VEHICLES = {
  car:   { w: 16, h: 11, speed: 30 },
  truck: { w: 48, h: 12, speed: 24 },
  racer: { w: 18, h: 10, speed: 56 },
  dozer: { w: 28, h: 13, speed: 18 },
};
const CAR_COLOURS = ['#e8d83a', '#5ad2ff', '#ff7ad0', '#8affa0', '#ff8a3a'];

// one platform width, in tiles, per name
const LOG_TILES = { short: 2, medium: 3, long: 5 };

export const DIVE_PERIOD = 4.0; // a diving turtle's up/dive/under cycle, seconds
export function turtleState(turtle, t) {
  if (!turtle.dive) return 'up';
  const p = ((t + turtle.phase) % DIVE_PERIOD + DIVE_PERIOD) % DIVE_PERIOD;
  return p < 2.4 ? 'up' : p < 3.0 ? 'diving' : 'under';
}

export const JAW_PERIOD = 2.4; // a river crocodile's jaw open/close cycle, seconds
export function crocJaw(croc, t) {
  const p = ((t + croc.phase) % JAW_PERIOD + JAW_PERIOD) % JAW_PERIOD;
  return p < 1.5 ? 'closed' : 'open';
}
export const CROC_LEVEL = 3;      // crocodiles start appearing in the river here
export const BAY_CROC_LEVEL = 4;  // ...and lurking in the home bays here

// The fixed board. river/road lanes name a direction and what rides them; the
// turtle lanes say how big the groups are. +1 is rightward, -1 leftward.
const BOARD = [
  { row: 1, kind: 'river', platform: 'turtle', group: 3, dir: -1, base: 26 },
  { row: 2, kind: 'river', platform: 'long',   dir: 1,  base: 22 },
  { row: 3, kind: 'river', platform: 'turtle', group: 2, dir: -1, base: 30 },
  { row: 4, kind: 'river', platform: 'medium', dir: 1,  base: 20 },
  { row: 5, kind: 'river', platform: 'short',  dir: 1,  base: 34 },
  { row: 7,  kind: 'road', vehicle: 'racer', dir: 1,  base: 56 },
  { row: 8,  kind: 'road', vehicle: 'truck', dir: -1, base: 24 },
  { row: 9,  kind: 'road', vehicle: 'car',   dir: 1,  base: 34 },
  { row: 10, kind: 'road', vehicle: 'dozer', dir: -1, base: 18 },
  { row: 11, kind: 'road', vehicle: 'car',   dir: 1,  base: 28 },
];

export function buildLevel(n, rng) {
  const diff = Math.min(n - 1, 10);
  const mult = 1 + 0.12 * diff;
  const lanes = [];
  for (let r = 0; r < ROWS; r++) {
    if (r === HOME_ROW) lanes.push({ kind: 'home' });
    else if (r === MEDIAN_ROW) lanes.push({ kind: 'median' });
    else if (r === START_ROW) lanes.push({ kind: 'grass' });
    else {
      const spec = BOARD.find((b) => b.row === r);
      lanes.push(spec.kind === 'road' ? roadLane(spec, mult, rng) : riverLane(spec, n, diff, mult, rng));
    }
  }

  // which river rows carry logs long enough for the lady frog to hitch a ride
  const logRows = lanes.map((l, r) => (l.kind === 'river' && l.platform !== 'turtle' && l.tiles >= 3 ? r : -1)).filter((r) => r >= 0);
  return { n, lanes, logRows, homes: HOME_COLS.map((col) => ({ col, filled: false, fly: false })) };
}

function roadLane(spec, mult, rng) {
  const v = VEHICLES[spec.vehicle];
  const gap = v.w + 40 + rng.range(0, 24);
  const count = Math.max(2, Math.floor(LOOP / gap));
  const spacing = LOOP / count;
  const slack = spacing - v.w - 36;
  const things = [];
  for (let i = 0; i < count; i++) {
    things.push({ x: i * spacing + (slack > 0 ? rng.next() * slack : 0), w: v.w, colour: spec.vehicle === 'car' ? rng.pick(CAR_COLOURS) : null });
  }
  return { kind: 'road', vehicle: spec.vehicle, dir: spec.dir, speed: spec.base * mult, things };
}

function riverLane(spec, n, diff, mult, rng) {
  const turtle = spec.platform === 'turtle';
  const tiles = turtle ? spec.group : LOG_TILES[spec.platform];
  const w = tiles * TILE;
  // leave a gap of one or two tiles between platforms so a way across comes round
  const gap = TILE * (turtle ? 1.6 : 1.9);
  const count = Math.max(2, Math.round(LOOP / (w + gap)));
  const spacing = LOOP / count;
  const diveChance = turtle ? Math.min(0.75, 0.3 + 0.06 * diff) : 0;
  // some logs (never turtles) are crocodiles at higher levels, but never all of
  // them in a lane, so there is always a safe log coming round too
  const crocChance = !turtle && n >= CROC_LEVEL ? Math.min(0.5, 0.15 * (n - CROC_LEVEL + 1)) : 0;
  const maxCrocs = Math.max(0, count - 1);
  const things = [];
  let crocs = 0;
  for (let i = 0; i < count; i++) {
    const t = { x: i * spacing, w, tiles };
    if (turtle) { t.dive = rng.next() < diveChance; t.phase = (i / count) * DIVE_PERIOD + rng.range(0, 0.6); }
    else if (crocs < maxCrocs && rng.next() < crocChance) { t.croc = true; t.phase = rng.range(0, JAW_PERIOD); crocs++; }
    things.push(t);
  }
  return { kind: 'river', platform: spec.platform, turtle, tiles, dir: spec.dir, speed: spec.base * mult, things };
}
