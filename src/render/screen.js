// Draws a frame: the lanes and all that rides them, the frog, the score line
// along the top and the spare frogs / level / time bar along the bottom.
import {
  COLS, TILE, FIELD_W, FIELD_H, VEHICLES, turtleState, crocJaw,
  HOME_ROW, MEDIAN_ROW, START_ROW, HOME_COLS,
} from '../game/levels.js';
import { frogPos, screenX, DIE_S, START_X, TIME_MAX } from '../game/game.js';
import { Rng } from '../game/rng.js';
import { buildSprites, makeCanvas, vehicle, log, turtles, croc } from './sprites.js';
import { drawText, textWidth } from './font.js';

export const FIELD_Y = 16, BOTTOM = 16;
export const SCREEN_W = FIELD_W, SCREEN_H = FIELD_Y + FIELD_H + BOTTOM;

const WATER = '#0d2b86';

export class Screen {
  constructor(canvas) {
    canvas.width = SCREEN_W; canvas.height = SCREEN_H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.spr = buildSprites();
    this.bg = makeCanvas(FIELD_W, FIELD_H);
    this.bgFor = null;
  }

  text(s, x, y, colour = '#fff', scale = 1) { drawText(this.ctx, s, x, y, colour, scale); }
  centre(s, y, colour = '#fff', scale = 1) { this.text(s, Math.round((SCREEN_W - textWidth(s, scale)) / 2), y, colour, scale); }

  /** The playing field and all on it. hideFrog for the title screen. */
  drawWorld(g, { hideFrog = false } = {}) {
    const c = this.ctx;
    if (this.bgFor !== g.lanes) { paintBackground(this.bg, g.lanes); this.bgFor = g.lanes; }
    c.fillStyle = '#000';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    c.save();
    c.translate(0, FIELD_Y);
    c.beginPath(); c.rect(0, 0, FIELD_W, FIELD_H); c.clip();
    c.drawImage(this.bg, 0, 0);

    // moving water, then the logs and turtles that float on it
    g.lanes.forEach((lane, r) => { if (lane.kind === 'river') this.ripples(r * TILE, lane, g.t); });
    g.lanes.forEach((lane, r) => {
      const y = r * TILE;
      if (lane.kind !== 'river') return;
      for (const thing of lane.things) {
        const x = Math.round(screenX(thing.x));
        if (lane.turtle) this.turtleGroup(thing, x, y, g.t);
        else if (thing.croc) c.drawImage(croc(thing.tiles, crocJaw(thing, g.t) === 'open', lane.dir), x, y + 2);
        else c.drawImage(log(thing.w), x, y + 2);
      }
    });

    if (g.lady) c.drawImage(this.spr.lady.up, Math.round(screenX(g.lady.x)), g.lady.row * TILE);
    this.homes(g);

    // the vehicles
    g.lanes.forEach((lane, r) => {
      if (lane.kind !== 'road') return;
      const v = VEHICLES[lane.vehicle], vy = r * TILE + ((TILE - v.h) >> 1);
      for (const t of lane.things) c.drawImage(vehicle(lane.vehicle, t.colour, lane.dir), Math.round(screenX(t.x)), vy);
    });

    if (!hideFrog) this.frog(g);
    c.restore();
  }

  ripples(y, lane, t) {
    const c = this.ctx;
    c.fillStyle = '#2a58c8';
    for (let i = 0; i < 16; i++) {
      const x = ((i * 47 + lane.dir * t * 18) % (FIELD_W + 20) + FIELD_W + 20) % (FIELD_W + 20) - 10;
      c.fillRect(Math.round(x), y + 3 + ((i * 7) % 11), 3, 1);
    }
  }

  turtleGroup(thing, x, y, t) {
    const st = turtleState(thing, t);
    if (st === 'under') {
      // just ripples where the shells were
      const c = this.ctx;
      c.fillStyle = '#4f7fe0';
      for (let i = 0; i < thing.tiles; i++) { const ox = x + i * TILE + 8; c.fillRect(ox - 4, y + 7, 8, 1); c.fillRect(ox - 2, y + 5, 4, 1); }
      return;
    }
    this.ctx.drawImage(turtles(thing.tiles, st === 'diving'), x, y);
  }

  homes(g) {
    const c = this.ctx;
    for (const h of g.homes) {
      const x = h.col * TILE;
      if (h.filled) c.drawImage(h.lady ? this.spr.ladySit : this.spr.frogSit, x, HOME_ROW * TILE);
      else if (h.croc) c.drawImage(this.spr.bayCroc, x, HOME_ROW * TILE);
      else if (h.fly && Math.floor(g.t * 6) % 4) c.drawImage(this.spr.fly, x + 4, HOME_ROW * TILE + 5);
    }
  }

  frog(g) {
    const c = this.ctx, f = g.frog, s = this.spr;
    if (f.dead) return this.deadFrog(g);
    const p = frogPos(f);
    const arc = f.hopping ? Math.sin(Math.PI * f.t) * 5 : 0;
    const x = Math.round(p.x), y = Math.round(p.row * TILE - arc);
    c.drawImage(s.frog[f.face], x, y);
    if (f.carrying === 'lady') c.drawImage(s.lady[f.face], x, y - 3);
  }

  deadFrog(g) {
    const c = this.ctx, f = g.frog, s = this.spr;
    const t = DIE_S - g.timer, x = Math.round(f.dead.at.x), y = Math.round(f.dead.at.row * TILE);
    if (f.dead.cause === 'drown') {
      c.fillStyle = '#cfe4ff';
      for (let k = 0; k < 3; k++) {
        const r = Math.floor((t * 14 + k * 4) % 14);
        c.fillRect(x + 8 - r, y + 8, 2 * r, 1); c.fillRect(x + 8 - (r >> 1), y + 8 - (r >> 1), r, 1); c.fillRect(x + 8 - (r >> 1), y + 8 + (r >> 1), r, 1);
      }
      if (t < 0.2) c.drawImage(s.frog[f.face], x, y);
      return;
    }
    if (f.dead.cause === 'squish' && t < 0.25) { c.drawImage(s.frog[f.face], x, y + 11, 16, 4); return; }
    c.drawImage(s.skull, x + 4, Math.round(y + 4 - Math.min(t, 0.4) * 8));
  }

  /** Score line along the top, spare frogs / level / time along the bottom. */
  hud(g, hi) {
    const c = this.ctx;
    c.fillStyle = '#000';
    c.fillRect(0, 0, SCREEN_W, FIELD_Y);
    c.fillRect(0, FIELD_Y + FIELD_H, SCREEN_W, BOTTOM);

    this.text('SCORE', 2, 4, '#e03c3c');
    this.text(String(g.score).padStart(6, '0'), 2, 11, '#f2e23a');
    const hs = String(hi).padStart(6, '0');
    this.text('HI-SCORE', SCREEN_W - textWidth('HI-SCORE') - 2, 4, '#e03c3c');
    this.text(hs, SCREEN_W - textWidth(hs) - 2, 11, '#f2e23a');
    const lv = `LEVEL ${g.level}`;
    this.centre(lv, 7, '#8affa0');

    const by = FIELD_Y + FIELD_H + 2;
    const shown = Math.min(g.lives - 1, 5); // lives beyond the one in play
    for (let i = 0; i < Math.max(0, shown); i++) c.drawImage(this.spr.mini, 2 + i * 10, by + 3);
    if (g.lives - 1 > 5) this.text(`+${g.lives - 1 - 5}`, 54, by + 3, '#fff');
    if (g.cheats.lives) this.text('+', 2, by + 3, '#f2e23a');

    // the time bar, draining right to left
    const bw = 64, bx = SCREEN_W - bw - 2, frac = g.cheats.invincible ? 1 : Math.max(0, g.time / TIME_MAX);
    this.text('TIME', bx - textWidth('TIME') - 3, by + 3, '#f2e23a');
    c.fillStyle = '#222'; c.fillRect(bx, by + 2, bw, 7);
    c.fillStyle = frac > 0.3 ? '#3fc84a' : Math.floor(g.t * 6) % 2 ? '#ff3030' : '#802020';
    c.fillRect(bx + bw - Math.round(bw * frac), by + 2, Math.round(bw * frac), 7);
  }

  /** A boxed message over the middle of the field. */
  banner(lines) {
    const c = this.ctx;
    const w = Math.max(...lines.map(([s, , scale = 1]) => textWidth(s, scale))) + 16;
    const h = lines.reduce((a, [, , scale = 1]) => a + 10 * scale, 0) + 8;
    const x = Math.round((SCREEN_W - w) / 2), y = Math.round(FIELD_Y + (FIELD_H - h) / 2);
    c.fillStyle = '#000'; c.fillRect(x, y, w, h);
    c.fillStyle = '#f2e23a'; c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1); c.fillRect(x, y, 1, h); c.fillRect(x + w - 1, y, 1, h);
    let ty = y + 6;
    for (const [s, colour, scale = 1] of lines) { this.centre(s, ty, colour, scale); ty += 10 * scale; }
  }

  /** Darken the field (the title screen's text goes over the traffic). */
  dim(alpha = 0.6) {
    this.ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  }
}


// The lanes that don't move, painted once per level.
function paintBackground(canvas, lanes) {
  const c = canvas.getContext('2d');
  const rng = new Rng(20250711);
  const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
  const speckle = (y, cols, n) => { for (let i = 0; i < n; i++) px(rng.int(FIELD_W), y + rng.int(TILE), rng.pick(cols)); };
  lanes.forEach((lane, r) => {
    const y = r * TILE;
    switch (lane.kind) {
      case 'home': {
        c.fillStyle = '#0a1030'; c.fillRect(0, y, FIELD_W, TILE); // the dark bank behind the bays
        // the hedge: bushy green everywhere but the five bays
        for (let col = 0; col < COLS; col++) {
          if (HOME_COLS.includes(col)) continue;
          const bx = col * TILE;
          c.fillStyle = '#15611d'; c.fillRect(bx, y, TILE, TILE);
          c.fillStyle = '#1f7a28'; c.fillRect(bx, y, TILE, TILE - 3);
        }
        for (let i = 0; i < 140; i++) { const x = rng.int(FIELD_W); if (HOME_COLS.includes(Math.floor(x / TILE))) continue; px(x, y + rng.int(TILE - 2), rng.pick(['#2a9a34', '#114d17', '#36b345'])); }
        // the lip of each bay
        for (const col of HOME_COLS) { const bx = col * TILE; c.fillStyle = '#2a9a34'; c.fillRect(bx, y + TILE - 2, TILE, 2); c.fillRect(bx, y, 1, TILE); c.fillRect(bx + TILE - 1, y, 1, TILE); }
        break;
      }
      case 'median':
        c.fillStyle = '#4a2c7a'; c.fillRect(0, y, FIELD_W, TILE);
        c.fillStyle = '#5c3a93'; c.fillRect(0, y + 2, FIELD_W, TILE - 4);
        speckle(y, ['#6b49a6', '#3c2266'], 70);
        c.fillStyle = '#c8c8c8'; c.fillRect(0, y, FIELD_W, 1); c.fillRect(0, y + TILE - 1, FIELD_W, 1);
        break;
      case 'grass':
        c.fillStyle = '#1f8a2a'; c.fillRect(0, y, FIELD_W, TILE);
        c.fillStyle = '#25a033'; c.fillRect(0, y + 2, FIELD_W, TILE - 3);
        speckle(y, ['#36b345', '#17711f'], 80);
        c.fillStyle = '#c8c8c8'; c.fillRect(0, y, FIELD_W, 1);
        break;
      case 'river':
        c.fillStyle = WATER; c.fillRect(0, y, FIELD_W, TILE);
        c.fillStyle = '#0a2270'; c.fillRect(0, y, FIELD_W, 1); c.fillRect(0, y + TILE - 1, FIELD_W, 1);
        break;
      case 'road': {
        c.fillStyle = '#101014'; c.fillRect(0, y, FIELD_W, TILE);
        speckle(y, ['#17171c', '#0b0b0e'], 60);
        const above = lanes[r - 1]?.kind, below = lanes[r + 1]?.kind;
        if (above === 'road') { c.fillStyle = '#44444c'; for (let x = 2; x < FIELD_W; x += 14) c.fillRect(x, y, 7, 1); }
        if (above === 'median') { c.fillStyle = '#c8c8c8'; c.fillRect(0, y, FIELD_W, 1); }
        if (below === 'grass') { c.fillStyle = '#c8c8c8'; c.fillRect(0, y + TILE - 1, FIELD_W, 1); }
        break;
      }
    }
  });
}
