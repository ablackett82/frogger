import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, update, hogPos, screenX, skipLevel, setCheats, NO_INPUT, HOP_S, HOME_ROW, START_COL, START_LIVES, INTRO_S, DIE_S } from '../src/game/game.js';
import { buildLevel, stoneState, LOOP, COLS, TILE } from '../src/game/levels.js';
import { Rng } from '../src/game/rng.js';

const DT = 1 / 120;
const run = (g, s, input = NO_INPUT) => { for (let t = 0; t < s; t += DT) update(g, DT, input); };
/** A game past its intro, with the roads emptied so nothing gets in the way. */
function quiet(opts = {}) {
  const g = newGame({ seed: 3, ...opts });
  for (const l of g.lanes) { if (l.things) l.things.length = 0; if (l.kind === 'rail') l.wait = 1e9; if (l.kind === 'brook') l.stones = l.stones.map(() => ({ sink: false })); }
  g.fox = null;
  run(g, INTRO_S + 0.05);
  return g;
}
function hop(g, dir) { const i = { ...NO_INPUT, [dir]: true }; update(g, DT, i); run(g, HOP_S + 0.02); }

test('a hop moves one tile and takes HOP_S', () => {
  const g = quiet();
  update(g, DT, { ...NO_INPUT, up: true });
  assert.equal(g.hog.row, HOME_ROW - 1);
  assert.ok(hogPos(g.hog).row > HOME_ROW - 1);
  run(g, HOP_S);
  assert.equal(hogPos(g.hog).row, HOME_ROW - 1);
  assert.equal(g.score, 10);
});

test('the hedgehog stays on the field', () => {
  const g = quiet();
  hop(g, 'down');
  assert.equal(g.hog.row, HOME_ROW);
  for (let i = 0; i < 10; i++) hop(g, 'left');
  assert.equal(g.hog.col, 0);
});

test('fetch three treats and bring them home to clear the level', () => {
  const g = quiet();
  g.cheats.noHunger = true;
  for (const f of g.foods) {
    while (g.hog.col !== f.col) hop(g, g.hog.col < f.col ? 'right' : 'left');
    while (g.hog.row > 0) hop(g, 'up');
    assert.equal(g.hog.carrying, f);
    while (g.hog.row < HOME_ROW) hop(g, 'down');
    assert.equal(f.state, 'home');
  }
  assert.equal(g.phase, 'clear');
  run(g, 3);
  assert.equal(g.level, 2);
});

test('a car runs the hedgehog over; a life is lost and food goes back', () => {
  const g = quiet();
  const row = g.lanes.findIndex((l) => l.kind === 'road');
  const lane = g.lanes[row];
  g.hog.row = g.hog.fromRow = row; g.hog.col = g.hog.fromCol = START_COL;
  g.hog.carrying = g.foods[0]; g.foods[0].state = 'carried';
  // put a car right on top of the hedgehog
  lane.things.push({ x: START_COL * TILE + 4 + 48, w: 16, type: 'car', colour: '#fff' });
  assert.ok(Math.abs(screenX(lane.things[0].x) - (START_COL * TILE + 4)) < 1);
  update(g, DT);
  assert.equal(g.phase, 'dying');
  assert.equal(g.hog.dead.cause, 'squish');
  run(g, DIE_S);
  assert.equal(g.lives, START_LIVES - 1);
  assert.equal(g.foods[0].state, 'waiting');
  assert.equal(g.hog.row, HOME_ROW);
});

test("can't-be-hurt and unlimited lives cheats", () => {
  const g = quiet({ cheats: { invincible: true } });
  assert.ok(g.cheated);
  g.hunger = 0.001;
  run(g, 1);
  assert.equal(g.phase, 'play');
  const h = quiet();
  assert.equal(h.cheated, false);
  setCheats(h, { lives: true });
  assert.ok(h.cheated);
  h.hunger = 0.001;
  run(h, 0.1 + DIE_S);
  assert.equal(h.lives, START_LIVES);
});

test('running out of food (hunger) costs a life', () => {
  const g = quiet();
  run(g, g.hungerMax + 0.1);
  assert.equal(g.hog.dead?.cause, 'hunger');
});

test('curled up, the fox bounces off; uncurled, it bites', () => {
  for (const curl of [true, false]) {
    const g = newGame({ seed: 5, level: 2 });
    run(g, INTRO_S + 0.05);
    const f = g.fox;
    assert.ok(f, 'level 2 has a fox');
    for (const l of g.lanes) if (l.things) l.things.length = 0;
    g.hog.row = g.hog.fromRow = f.row; g.hog.col = g.hog.fromCol = START_COL;
    f.x = START_COL * TILE - 10; f.dir = 1; f.pause = 0;
    const score = g.score;
    update(g, DT, { ...NO_INPUT, curl });
    if (curl) { assert.equal(g.phase, 'play'); assert.equal(g.score, score + 100); assert.equal(f.dir, -1); }
    else assert.equal(g.hog.dead?.cause, 'fox');
  }
});

test('stepping into the brook is a splash; stones are safe until they sink', () => {
  const g = newGame({ seed: 1, level: 3 });
  run(g, INTRO_S + 0.05);
  for (const l of g.lanes) if (l.things) l.things.length = 0;
  g.fox = null;
  const row = g.lanes.findIndex((l) => l.kind === 'brook');
  const lane = g.lanes[row];
  const wet = lane.stones.findIndex((s) => !s);
  const dry = lane.stones.findIndex((s) => s && !s.sink);
  g.hog.row = g.hog.fromRow = row; g.hog.col = g.hog.fromCol = dry;
  run(g, 0.5);
  assert.equal(g.phase, 'play');
  g.hog.col = g.hog.fromCol = wet;
  update(g, DT);
  assert.equal(g.hog.dead?.cause, 'splash');
  assert.equal(stoneState({ sink: true, phase: 0 }, 1), 'up');
  assert.equal(stoneState({ sink: true, phase: 0 }, 3.0), 'sinking');
  assert.equal(stoneState({ sink: true, phase: 0 }, 4.0), 'under');
});

test('every level can be crossed: room between vehicles, and steady stones joining brooks', () => {
  for (let seed = 1; seed < 40; seed++) for (let n = 1; n <= 14; n++) {
    const L = buildLevel(n, new Rng(seed * 100 + n));
    assert.equal(L.lanes.length, 12);
    L.lanes.forEach((lane, r) => {
      if (lane.kind === 'road') {
        const xs = lane.things.map((t) => t.x).sort((a, b) => a - b);
        xs.forEach((x, i) => {
          const next = i + 1 < xs.length ? xs[i + 1] : xs[0] + LOOP;
          assert.ok(next - x - lane.things[0].w >= 40, `level ${n} row ${r}: vehicles too close`);
        });
      }
      if (lane.kind === 'brook') {
        assert.ok(lane.stones.filter((s) => s && !s.sink).length >= 2);
        const above = L.lanes[r - 1];
        if (above.kind === 'brook') assert.ok(lane.stones.some((s, c) => s && !s.sink && above.stones[c] && !above.stones[c].sink), `level ${n} row ${r}: brooks don't join`);
      }
    });
    assert.equal(new Set(L.foods.map((f) => f.col)).size, 3);
    assert.ok(L.foods.every((f) => f.col > 0 && f.col < COLS - 1));
  }
});

test('skipping a level marks the game as a cheat game', () => {
  const g = quiet();
  skipLevel(g);
  assert.equal(g.level, 2);
  assert.ok(g.cheated);
});

test('an extra life every 10,000', () => {
  const g = quiet();
  g.score = 9990;
  g.cheats.noHunger = true;
  hop(g, 'up');
  assert.equal(g.lives, START_LIVES + 1);
  assert.ok(g.events.some((e) => e.type === 'life'));
});
