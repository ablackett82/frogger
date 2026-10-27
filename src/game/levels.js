// Each level is a stack of twelve lanes, top to bottom: the wood (row 0) where
// the food lies, ten lanes to cross, and the garden (row 11) with the nest.

export const COLS = 15, ROWS = 12, TILE = 16;
export const FIELD_W = COLS * TILE, FIELD_H = ROWS * TILE;
export const LOOP = FIELD_W + 96; // vehicles go round a loop longer than the screen...
export const OFF = 48;            // ...which starts this far off the left edge

export const VEHICLES = {
  car:     { w: 16, h: 12, speed: 36, count: 3 },
  van:     { w: 28, h: 12, speed: 28, count: 2 },
  lorry:   { w: 44, h: 14, speed: 22, count: 2 },
  tractor: { w: 26, h: 14, speed: 14, count: 2 },
  bike:    { w: 12, h: 8,  speed: 50, count: 3 },
};
const COLOURS = {
  car: ['#d23c3c', '#3c6fd2', '#e8c43a', '#e8e8e8', '#9b4fd0', '#3caa6e', '#e07a2e'],
  van: ['#e8e8e8', '#3c6fd2', '#d23c3c', '#4a4a52'],
  lorry: ['#d23c3c', '#3c6fd2', '#2e8b57', '#e07a2e'],
  tractor: ['#3a9a3a', '#c83a2a'],
  bike: ['#ffd23a', '#ff6fa8', '#5ad2ff', '#ff8a2a'],
};
const MIN_GAP = 40; // always room for a hedgehog between two vehicles

export const TRAIN_LEN = 40 + 4 * 34; // engine and four coaches
export const WARN_S = 1.8;            // the signal flashes this long before a train
export const FOODS = ['apple', 'mushroom', 'berry'];
export const FOOD_COUNT = 3;

// rows 1..10, top to bottom; anything not grass/rail/brook is a road of that vehicle
const LAYOUTS = [
  ['grass', 'car', 'van', 'car', 'grass', 'tractor', 'car', 'bike', 'grass', 'car'],
  ['grass', 'car', 'lorry', 'grass', 'rail', 'grass', 'van', 'car', 'bike', 'grass'],
  ['grass', 'brook', 'brook', 'grass', 'car', 'van', 'grass', 'rail', 'car', 'tractor'],
  ['rail', 'grass', 'lorry', 'car', 'van', 'grass', 'brook', 'grass', 'bike', 'car'],
  ['grass', 'car', 'lorry', 'car', 'rail', 'brook', 'brook', 'grass', 'van', 'bike'],
  ['brook', 'grass', 'bike', 'car', 'rail', 'grass', 'lorry', 'van', 'grass', 'car'],
];

export function layoutFor(n) {
  return n <= LAYOUTS.length ? LAYOUTS[n - 1] : LAYOUTS[1 + ((n - 2) % (LAYOUTS.length - 1))];
}

/** Stones in a brook bob under now and then; this says where one is in its cycle. */
export const SINK_PERIOD = 4.5;
export function stoneState(stone, t) {
  if (!stone) return 'none';
  if (!stone.sink) return 'up';
  const p = (t + stone.phase) % SINK_PERIOD;
  return p < 2.8 ? 'up' : p < 3.5 ? 'sinking' : 'under';
}

export function buildLevel(n, rng) {
  const diff = Math.min(n - 1, 12);
  const lanes = [{ kind: 'woods' }];
  let dir = rng.next() < 0.5 ? 1 : -1;
  for (const spec of layoutFor(n)) {
    const above = lanes[lanes.length - 1];
    if (spec === 'grass') lanes.push({ kind: 'grass' });
    else if (spec === 'rail') lanes.push(railLane(diff, rng));
    else if (spec === 'brook') lanes.push(brookLane(diff, rng, above));
    else { lanes.push(roadLane(spec, dir, diff, rng)); dir = -dir; }
  }
  lanes.push({ kind: 'garden' });

  const grass = lanes.map((l, r) => (l.kind === 'grass' ? r : -1)).filter((r) => r > 0);
  const fox = n >= 2 && grass.length ? {
    row: rng.pick(grass), x: rng.range(0, FIELD_W - 24), dir: rng.next() < 0.5 ? 1 : -1,
    speed: 26 + 2 * diff, chase: n >= 4, pause: 0, bump: 0, walk: 0,
  } : null;

  const foods = [];
  while (foods.length < FOOD_COUNT) {
    const col = 1 + rng.int(COLS - 2);
    if (foods.every((f) => Math.abs(f.col - col) >= 2)) foods.push({ col, kind: rng.pick(FOODS) });
  }

  return { n, lanes, fox, foods, night: n % 3 === 0, hunger: Math.max(18, 32 - 1.5 * diff) };
}

function roadLane(type, dir, diff, rng) {
  const v = VEHICLES[type];
  const count = Math.min(v.count + Math.floor(diff / 3), Math.floor(LOOP / (v.w + MIN_GAP)));
  const spacing = LOOP / count;
  const slack = spacing - v.w - MIN_GAP;
  const things = [];
  for (let i = 0; i < count; i++) things.push({ x: i * spacing + rng.next() * slack, w: v.w, type, colour: rng.pick(COLOURS[type]) });
  return { kind: 'road', type, dir, speed: v.speed * (1 + 0.08 * diff) * rng.range(0.85, 1.15), things };
}

function railLane(diff, rng) {
  return {
    kind: 'rail', dir: rng.next() < 0.5 ? 1 : -1, speed: 280 + 12 * diff,
    wait: rng.range(2, 5), gap: [Math.max(2.5, 5 - 0.25 * diff), Math.max(4.5, 9 - 0.35 * diff)],
    train: null, warn: false, ding: 0,
  };
}

// A brook has stepping stones; some (mossy) sink for a moment now and then.
// Two brooks in a row always share a couple of steady stones, so there is a way across.
function brookLane(diff, rng, above) {
  const fixed = new Set();
  if (above.kind === 'brook') {
    const steady = [...above.fixed];
    while (fixed.size < Math.min(2, steady.length)) fixed.add(rng.pick(steady));
  }
  while (fixed.size < 2) fixed.add(rng.int(COLS));
  const total = Math.max(6, 9 - Math.floor(diff / 3));
  const stones = new Array(COLS).fill(null);
  for (const c of fixed) stones[c] = { sink: false };
  let placed = fixed.size, tries = 0;
  const sinkChance = Math.min(0.65, 0.35 + 0.04 * diff);
  while (placed < total && tries++ < 200) {
    const c = rng.int(COLS);
    if (stones[c]) continue;
    stones[c] = rng.next() < sinkChance ? { sink: true, phase: rng.range(0, SINK_PERIOD) } : { sink: false };
    if (!stones[c].sink) fixed.add(c);
    placed++;
  }
  return { kind: 'brook', stones, fixed: [...fixed], flow: rng.next() < 0.5 ? 1 : -1 };
}
