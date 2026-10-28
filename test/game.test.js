import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, update, frogPos, screenX, skipLevel, setCheats, NO_INPUT,
  HOP_S, START_COL, START_X, START_LIVES, INTRO_S, DIE_S, TIME_MAX, FROG_HALF,
} from '../src/game/game.js';
import { buildLevel, turtleState, crocJaw, LOOP, OFF, COLS, ROWS, TILE, FIELD_W, HOME_COLS, START_ROW } from '../src/game/levels.js';
import { Rng } from '../src/game/rng.js';

const DT = 1 / 120;
const run = (g, s, input = NO_INPUT) => { for (let t = 0; t < s; t += DT) update(g, DT, input); };

/** A game past its intro with safe, still logs across every river lane and the roads empty. */
function calm(opts = {}) {
  const g = newGame({ seed: 3, ...opts });
  run(g, INTRO_S + 0.02);
  for (const l of g.lanes) {
    if (l.kind === 'road') l.things.length = 0;
    if (l.kind === 'river') { l.turtle = false; l.speed = 0; l.things = [{ x: 0, w: LOOP, tiles: 99 }]; }
  }
  g.lady = null; g.fly = null; g.flyWait = 1e9; g.ladyWait = 1e9;
  return g;
}
function hop(g, dir) { update(g, DT, { ...NO_INPUT, [dir]: true }); run(g, HOP_S + 0.02); }
function placeFrog(g, row, x) { const f = g.frog; f.row = f.fromRow = f.toRow = row; f.x = f.fromX = f.toX = x; f.hopping = false; f.t = 1; }
const riverRow = (g) => g.lanes.findIndex((l) => l.kind === 'river');
const roadRow = (g) => g.lanes.findIndex((l) => l.kind === 'road');

test('a hop moves one tile forward and scores 10', () => {
  const g = calm();
  update(g, DT, { ...NO_INPUT, up: true }); // the hop begins
  run(g, HOP_S * 0.5);
  assert.ok(frogPos(g.frog).row < START_ROW, 'part way up mid-hop');
  run(g, HOP_S);
  assert.equal(g.frog.row, START_ROW - 1);
  assert.equal(g.score, 10);
});

test('the frog stays on the field', () => {
  const g = calm();
  for (let i = 0; i < 10; i++) hop(g, 'left');
  assert.equal(g.frog.x, 0);
  for (let i = 0; i < 20; i++) hop(g, 'right');
  assert.equal(g.frog.x, FIELD_W - TILE);
});

test('a log carries the frog along; open water drowns it', () => {
  const g = calm();
  const row = riverRow(g);
  const lane = g.lanes[row];
  lane.speed = 20; lane.dir = 1;
  placeFrog(g, row, START_X);
  run(g, 0.5);
  assert.equal(g.phase, 'play');
  assert.ok(g.frog.x > START_X, 'rode downstream with the log');

  const h = calm();
  const r2 = riverRow(h);
  h.lanes[r2].things.length = 0; // nothing to stand on
  placeFrog(h, r2, START_X);
  update(h, DT);
  assert.equal(h.frog.dead?.cause, 'drown');
});

test('a diving turtle is safe up and drowns you under', () => {
  assert.equal(turtleState({ dive: true, phase: 0 }, 1.0), 'up');
  assert.equal(turtleState({ dive: true, phase: 0 }, 2.7), 'diving');
  assert.equal(turtleState({ dive: true, phase: 0 }, 3.4), 'under');

  const g = calm();
  const row = riverRow(g);
  const lane = g.lanes[row];
  lane.turtle = true; lane.speed = 0;
  lane.things = [{ x: OFF, w: FIELD_W, tiles: 99, dive: true, phase: 0 }];
  placeFrog(g, row, START_X);
  g.t = 1.0; update(g, DT); // turtle up
  assert.equal(g.phase, 'play');
  g.t = 3.4; update(g, DT); // turtle under
  assert.equal(g.frog.dead?.cause, 'drown');
});

test("a crocodile's back is safe but its open jaws eat you", () => {
  // the head segment, for dir +1, is the front TILE of the platform
  const setup = (phase) => {
    const g = calm();
    const row = riverRow(g);
    const lane = g.lanes[row];
    lane.turtle = false; lane.dir = 1; lane.speed = 0;
    // place a 3-tile croc so its head covers the frog's start column
    lane.things = [{ x: (60 + OFF) % LOOP, w: 3 * TILE, tiles: 3, croc: true, phase }];
    placeFrog(g, row, START_X);
    g.t = 0;
    return g;
  };
  assert.equal(crocJaw({ phase: 1.6 }, 0), 'open');
  const bitten = setup(1.6);
  update(bitten, DT);
  assert.equal(bitten.frog.dead?.cause, 'croc');

  assert.equal(crocJaw({ phase: 0 }, 0), 'closed');
  const safe = setup(0);
  update(safe, DT);
  assert.equal(safe.phase, 'play', 'riding a shut-jawed croc is fine');
});

test('a crocodile lurking in a home bay eats you', () => {
  const g = calm();
  g.homes[2].croc = true; // the middle bay, column 6
  placeFrog(g, 1, HOME_COLS[2] * TILE);
  hop(g, 'up');
  assert.equal(g.frog.dead?.cause, 'croc');
  assert.equal(g.homes[2].filled, false);
});

test('a car squishes the frog; a life is lost', () => {
  const g = calm();
  const row = roadRow(g);
  const lane = g.lanes[row];
  lane.dir = 1;
  lane.things = [{ x: (START_X + OFF) % LOOP, w: 16, colour: null }];
  placeFrog(g, row, START_X);
  assert.ok(Math.abs(screenX(lane.things[0].x) - START_X) < 1);
  update(g, DT);
  assert.equal(g.frog.dead?.cause, 'squish');
  run(g, DIE_S);
  assert.equal(g.lives, START_LIVES - 1);
  assert.equal(g.frog.row, START_ROW);
});

test('reaching the five home bays clears the level', () => {
  const g = calm();
  for (let i = 0; i < HOME_COLS.length; i++) {
    const col = HOME_COLS[i];
    placeFrog(g, 1, col * TILE);
    hop(g, 'up');
    assert.ok(g.homes[i].filled, `bay ${i} filled`);
    if (i < HOME_COLS.length - 1) assert.equal(g.frog.row, START_ROW, 'a fresh frog after each home');
  }
  assert.equal(g.phase, 'clear');
  run(g, 3);
  assert.equal(g.level, 2);
});

test('missing a bay and landing in the hedge is a death', () => {
  const g = calm();
  placeFrog(g, 1, TILE); // column 1 — between bays 0 and 3
  hop(g, 'up');
  assert.equal(g.frog.dead?.cause, 'hedge');
});

test('the clock running out costs a life', () => {
  const g = calm();
  run(g, TIME_MAX + 0.1);
  assert.equal(g.frog.dead?.cause, 'time');
});

test("can't-be-hurt walks on water and ignores the clock", () => {
  const g = calm({ cheats: { invincible: true } });
  assert.ok(g.cheated);
  const row = riverRow(g);
  g.lanes[row].things.length = 0;
  placeFrog(g, row, START_X);
  g.time = 0.001;
  run(g, 1);
  assert.equal(g.phase, 'play');
});

test('unlimited lives cheat keeps the frog in the game', () => {
  const g = calm();
  assert.equal(g.cheated, false);
  setCheats(g, { lives: true });
  assert.ok(g.cheated);
  const row = roadRow(g);
  g.lanes[row].things = [{ x: (START_X + OFF) % LOOP, w: 16 }];
  placeFrog(g, row, START_X);
  run(g, DIE_S + 0.1);
  assert.equal(g.lives, START_LIVES);
});

test('an extra life every 20,000', () => {
  const g = calm();
  g.score = 19990;
  hop(g, 'up');
  assert.equal(g.lives, START_LIVES + 1);
  assert.ok(g.events.some((e) => e.type === 'life'));
});

test('skipping a level marks the game as a cheat game', () => {
  const g = calm();
  skipLevel(g);
  assert.equal(g.level, 2);
  assert.ok(g.cheated);
});

test('every level is built whole and crossable', () => {
  for (let seed = 1; seed < 40; seed++) for (let n = 1; n <= 14; n++) {
    const L = buildLevel(n, new Rng(seed * 100 + n));
    assert.equal(L.lanes.length, ROWS);
    assert.equal(L.homes.length, 5);
    L.lanes.forEach((lane) => {
      if (lane.kind === 'road') {
        assert.ok(lane.things.length >= 2, `level ${n}: too few vehicles`);
        const xs = lane.things.map((t) => t.x).sort((a, b) => a - b);
        xs.forEach((x, i) => {
          const next = i + 1 < xs.length ? xs[i + 1] : xs[0] + LOOP;
          assert.ok(next - x - lane.things[0].w >= 20, `level ${n}: vehicles too close`);
        });
      }
      if (lane.kind === 'river') assert.ok(lane.things.length >= 2, `level ${n}: too few platforms`);
    });
  }
});
