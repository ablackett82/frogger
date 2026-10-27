// Draws a frame: the lanes, everything on them, night-time darkness, the score
// line along the top and the lives / hunger / food bar along the bottom.
import { COLS, TILE, FIELD_W, FIELD_H, VEHICLES, TRAIN_LEN, stoneState } from '../game/levels.js';
import { hogPos, screenX, DIE_S, HOME_ROW } from '../game/game.js';
import { Rng } from '../game/rng.js';
import { buildSprites, makeCanvas, vehicle } from './sprites.js';
import { drawText, textWidth } from './font.js';

export const SCREEN_W = FIELD_W, SCREEN_H = FIELD_H + 24, FIELD_Y = 16;
const NEST_COL = 6; // the log pile spans columns 6-8 of the garden

export class Screen {
  constructor(canvas) {
    canvas.width = SCREEN_W; canvas.height = SCREEN_H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.spr = buildSprites();
    this.bg = makeCanvas(FIELD_W, FIELD_H);
    this.bgFor = null;
    this.dark = makeCanvas(FIELD_W, FIELD_H);
  }

  text(s, x, y, colour = '#fff', scale = 1) { drawText(this.ctx, s, x, y, colour, scale); }
  centre(s, y, colour = '#fff', scale = 1) { this.text(s, Math.round((SCREEN_W - textWidth(s, scale)) / 2), y, colour, scale); }

  /** The playing field and all on it. hideHog for the title screen. */
  drawWorld(g, { hideHog = false } = {}) {
    const c = this.ctx;
    if (this.bgFor !== g.lanes) { paintBackground(this.bg, g.lanes, g.level); this.bgFor = g.lanes; }
    c.fillStyle = '#000';
    c.fillRect(0, 0, SCREEN_W, SCREEN_H);
    c.save();
    c.translate(0, FIELD_Y);
    c.beginPath(); c.rect(0, 0, FIELD_W, FIELD_H); c.clip();
    c.drawImage(this.bg, 0, 0);

    g.lanes.forEach((lane, r) => {
      const y = r * TILE;
      if (lane.kind === 'brook') this.brook(lane, y, g.t);
      if (lane.kind === 'rail') this.signal(lane, y, g.t);
    });
    this.foods(g);
    if (g.beetle && (g.beetle.life > 2 || Math.floor(g.t * 8) % 2)) c.drawImage(this.spr.beetle, g.beetle.col * TILE + 4, g.beetle.row * TILE + 4);
    g.lanes.forEach((lane, r) => {
      const y = r * TILE;
      if (lane.kind === 'road') {
        const v = VEHICLES[lane.type], vy = y + ((TILE - v.h) >> 1);
        for (const t of lane.things) c.drawImage(vehicle(t.type, t.colour, lane.dir), Math.round(screenX(t.x)), vy);
      } else if (lane.kind === 'rail' && lane.train) c.drawImage(this.spr.train[lane.dir], Math.round(lane.train.x), y + 1);
    });
    const f = g.fox;
    if (f && !g.cheats.noFox) c.drawImage(this.spr.fox[f.pause > 0 ? 0 : Math.floor(f.walk / 6) % 2][f.dir > 0 ? 'right' : 'left'], Math.round(f.x), f.row * TILE + 2);
    if (!hideHog) this.hog(g);
    if (g.night) this.nightfall(g, hideHog);
    c.restore();
  }

  brook(lane, y, t) {
    const c = this.ctx;
    c.fillStyle = '#2a66a8';
    c.fillRect(0, y, FIELD_W, TILE);
    c.fillStyle = '#4f8fd0';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 53 + lane.flow * t * 14) % 260 + 260) % 260 - 10;
      c.fillRect(Math.round(x), y + 2 + ((i * 5) % 12), 4, 1);
    }
    for (let col = 0; col < COLS; col++) {
      const s = lane.stones[col];
      if (!s) continue;
      const st = stoneState(s, t), x = col * TILE + 1;
      const img = s.sink ? this.spr.mossy : this.spr.stone;
      if (st === 'up') c.drawImage(img, x, y + 2);
      else if (st === 'sinking') {
        c.drawImage(img, x, y + 3 + (Math.floor(t * 10) % 2));
        c.fillStyle = '#9fd0ff'; c.fillRect(x, y + 12, 14, 1);
      } else { c.fillStyle = '#7fb8ef'; c.fillRect(x + 2, y + 7, 10, 1); c.fillRect(x + 4, y + 5, 6, 1); }
    }
  }

  signal(lane, y, t) {
    const c = this.ctx, x = lane.dir > 0 ? 2 : FIELD_W - 5;
    c.fillStyle = '#ddd'; c.fillRect(x + 1, y + 4, 1, 10);
    c.fillStyle = '#222'; c.fillRect(x, y + 1, 3, 4);
    c.fillStyle = lane.warn && Math.floor(t * 6) % 2 ? '#ff3030' : '#4a1010';
    c.fillRect(x, y + 2, 3, 2);
  }

  foods(g) {
    const c = this.ctx;
    for (const f of g.foods) {
      if (f.state === 'waiting') c.drawImage(this.spr.food[f.kind], f.col * TILE + 4, 5 + (Math.floor(g.t * 2 + f.col) % 2));
      else if (f.state === 'home') c.drawImage(this.spr.food[f.kind], NEST_COL * TILE + 6 + f.slot * 13, HOME_ROW * TILE + 2);
    }
  }

  hog(g) {
    const c = this.ctx, h = g.hog, s = this.spr;
    if (h.dead) return this.deadHog(g);
    const p = hogPos(h);
    const x = Math.round(p.col * TILE), y = Math.round(p.row * TILE - (h.hopping ? Math.sin(Math.PI * h.t) * 3 : 0));
    if (h.curled) c.drawImage(s.ball, x + 1, y + 1);
    else c.drawImage(s.hog[h.face][h.step & 1], x, y);
    if (h.carrying) c.drawImage(s.food[h.carrying.kind], x + 4, y + (h.curled ? 4 : 6));
  }

  deadHog(g) {
    const c = this.ctx, h = g.hog, s = this.spr;
    const t = DIE_S - g.timer, x = Math.round(h.dead.at.col * TILE), y = Math.round(h.dead.at.row * TILE);
    switch (h.dead.cause) {
      case 'splash':
        c.fillStyle = '#d8ecff';
        for (let k = 0; k < 3; k++) {
          const r = Math.floor((t * 12 + k * 4) % 12);
          c.fillRect(x + 8 - r, y + 8, 2 * r, 1); c.fillRect(x + 8 - (r >> 1), y + 8 - (r >> 1), r, 1); c.fillRect(x + 8 - (r >> 1), y + 8 + (r >> 1), r, 1);
        }
        if (t < 0.25) c.drawImage(s.ball, x + 1, y + 1);
        break;
      case 'fox':
        c.fillStyle = '#7d5230';
        for (let i = 0; i < 14; i++) { const a = i * 2.4, d = 2 + t * 16; c.fillRect(Math.round(x + 8 + Math.cos(a) * d), Math.round(y + 8 + Math.sin(a) * d), 1, 2); }
        if (t < 0.2) c.drawImage(s.ball, x + 1, y + 1);
        break;
      case 'hunger':
        c.drawImage(s.ball, x + 1, y + 1);
        drawText(c, 'Z', x + 10, Math.round(y - t * 6), '#fff');
        if (t > 0.6) drawText(c, 'Z', x + 4, Math.round(y - (t - 0.6) * 6), '#fff');
        break;
      default: // squashed flat, seeing stars
        c.drawImage(s.hog[h.face][0], x, y + 10, 16, 5);
        c.fillStyle = '#ffe640';
        for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; c.fillRect(Math.round(x + 7 + Math.cos(a) * 7), Math.round(y + 7 + Math.sin(a) * 3), 2, 2); }
    }
  }

  // Night: everything dark but for headlamps, the hedgehog's own patch, the
  // glow-worms by the food and the lantern at the nest.
  nightfall(g, hideHog) {
    const d = this.dark.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, FIELD_W, FIELD_H);
    d.fillStyle = 'rgba(4,8,28,0.9)';
    d.fillRect(0, 0, FIELD_W, FIELD_H);
    d.globalCompositeOperation = 'destination-out';
    const glow = (x, y, r, a = 1) => {
      const gr = d.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = gr; d.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    const lamps = [];
    if (!hideHog) { const p = g.hog.dead ? g.hog.dead.at : hogPos(g.hog); glow(p.col * TILE + 8, p.row * TILE + 8, 30); }
    glow((NEST_COL + 1.5) * TILE, HOME_ROW * TILE + 8, 40);
    for (const f of g.foods) if (f.state === 'waiting') glow(f.col * TILE + 8, 8, 14, 0.8);
    if (g.beetle) glow(g.beetle.col * TILE + 8, g.beetle.row * TILE + 8, 10, 0.6);
    g.lanes.forEach((lane, r) => {
      const y = r * TILE + 8;
      if (lane.kind === 'road') {
        const w = VEHICLES[lane.type].w;
        for (const t of lane.things) {
          const sx = Math.round(screenX(t.x)), front = lane.dir > 0 ? sx + w : sx;
          glow(sx + w / 2, y, w / 2 + 6, 0.7);
          glow(front + lane.dir * 16, y, 16);
          lamps.push([front - (lane.dir > 0 ? 1 : 0), y]);
        }
      } else if (lane.kind === 'rail') {
        if (lane.train) {
          const tx = lane.train.x, front = lane.dir > 0 ? tx + TRAIN_LEN : tx;
          for (let i = 0; i < TRAIN_LEN; i += 24) glow(tx + i + 12, y, 14, 0.6);
          glow(front + lane.dir * 24, y, 26);
        }
        if (lane.warn) glow(lane.dir > 0 ? 3 : FIELD_W - 4, r * TILE + 3, 10);
      }
    });
    if (g.fox && !g.cheats.noFox) { const f = g.fox; glow(f.x + (f.dir > 0 ? 20 : 4), f.row * TILE + 5, 5, 0.9); }
    const c = this.ctx;
    c.drawImage(this.dark, 0, 0);
    c.fillStyle = '#fff6a0';
    for (const [x, y] of lamps) { c.fillRect(x, y - 4, 1, 2); c.fillRect(x, y + 2, 1, 2); }
  }

  /** Score line, and the bottom bar: lives, hunger, food home. */
  hud(g, hi) {
    const c = this.ctx;
    c.fillStyle = '#000';
    c.fillRect(0, 0, SCREEN_W, FIELD_Y);
    c.fillRect(0, FIELD_Y + FIELD_H, SCREEN_W, SCREEN_H - FIELD_Y - FIELD_H);
    this.text('SCORE', 2, 4, '#ff6a3a'); this.text(String(g.score).padStart(6, '0'), 38, 4, '#fff');
    this.text('HI', 88, 4, '#ff6a3a'); this.text(String(hi).padStart(6, '0'), 104, 4, '#fff');
    const lv = `${g.night ? 'NIGHT ' : 'LEVEL '}${g.level}`;
    this.text(lv, SCREEN_W - textWidth(lv) - 2, 4, g.night ? '#9fb8ff' : '#ffe640');

    const by = FIELD_Y + FIELD_H + 2;
    const shown = Math.min(g.lives, 6);
    for (let i = 0; i < shown; i++) c.drawImage(this.spr.mini, 2 + i * 10, by + 1);
    if (g.lives > 6) this.text(`+${g.lives - 6}`, 64, by + 1, '#fff');
    if (g.cheats.lives) this.text('+', 2 + shown * 10, by + 1, '#ffe640');

    // hunger: full when you leave home, empties as you go
    const bx = 84, bw = 96, frac = g.hungerMax ? g.hunger / g.hungerMax : 0;
    this.text('FOOD', 58, by + 1, '#ffe640');
    c.fillStyle = '#333'; c.fillRect(bx, by + 2, bw, 5);
    const col = g.cheats.noHunger ? '#5ad2ff' : frac > 0.4 ? '#3fc84a' : frac > 0.2 ? '#ffd23a' : Math.floor(g.t * 6) % 2 ? '#ff3030' : '#802020';
    c.fillStyle = col; c.fillRect(bx, by + 2, Math.round(bw * frac), 5);

    // the food brought home so far
    g.foods.forEach((f, i) => {
      const x = SCREEN_W - 12 - (g.foods.length - 1 - i) * 12;
      if (f.state === 'home') c.drawImage(this.spr.food[f.kind], x, by);
      else { c.fillStyle = '#444'; c.fillRect(x + 3, by + 3, 2, 2); }
    });
  }

  /** A boxed message over the middle of the field. */
  banner(lines) {
    const c = this.ctx;
    const w = Math.max(...lines.map(([s, , scale = 1]) => textWidth(s, scale))) + 16;
    const h = lines.reduce((a, [, , scale = 1]) => a + 10 * scale, 0) + 8;
    const x = Math.round((SCREEN_W - w) / 2), y = Math.round(FIELD_Y + (FIELD_H - h) / 2);
    c.fillStyle = '#000'; c.fillRect(x, y, w, h);
    c.fillStyle = '#ffe640'; c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1); c.fillRect(x, y, 1, h); c.fillRect(x + w - 1, y, 1, h);
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
function paintBackground(canvas, lanes, level) {
  const c = canvas.getContext('2d');
  const rng = new Rng(level * 7919 + 13);
  const px = (x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
  const speckle = (y, cols, n) => { for (let i = 0; i < n; i++) px(rng.int(FIELD_W), y + rng.int(TILE), rng.pick(cols)); };
  lanes.forEach((lane, r) => {
    const y = r * TILE;
    const above = lanes[r - 1]?.kind, below = lanes[r + 1]?.kind;
    switch (lane.kind) {
      case 'woods':
        c.fillStyle = '#24461f'; c.fillRect(0, y, FIELD_W, TILE);
        speckle(y, ['#5a3d24', '#7a5a2a', '#1a3416', '#8a6a2a'], 120);
        for (let x = 0; x < FIELD_W; x += 16) { c.fillStyle = '#163012'; c.fillRect(x + rng.int(10), y, 6, 2); }
        break;
      case 'garden':
        for (let col = 0; col < COLS; col++) { c.fillStyle = col % 2 ? '#5aa140' : '#64ae49'; c.fillRect(col * TILE, y, TILE, TILE); }
        for (let i = 0; i < 18; i++) {
          const x = rng.int(FIELD_W);
          if (x > NEST_COL * TILE - 4 && x < (NEST_COL + 3) * TILE + 4) continue;
          px(x, y + 3 + rng.int(10), rng.pick(['#ffffff', '#ffe640', '#ff8ad0']));
        }
        // the nest: a pile of logs under a bush
        c.fillStyle = '#2f6a2a'; c.fillRect(NEST_COL * TILE + 2, y, 44, 4);
        for (let i = 0; i < 4; i++) {
          const lx = NEST_COL * TILE + 2 + i * 11;
          c.fillStyle = '#6a4424'; c.fillRect(lx, y + 9, 10, 6);
          c.fillStyle = '#c8a070'; c.fillRect(lx + 7, y + 10, 3, 4);
          c.fillStyle = '#8a5e34'; c.fillRect(lx + 8, y + 11, 1, 2);
        }
        break;
      case 'grass':
        c.fillStyle = '#4c9a3a'; c.fillRect(0, y, FIELD_W, TILE);
        speckle(y, ['#3d8030', '#5aa845', '#3d8030'], 90);
        for (let i = 0; i < 4; i++) px(rng.int(FIELD_W), y + 2 + rng.int(12), '#ffffff');
        break;
      case 'road':
        c.fillStyle = '#3b3b44'; c.fillRect(0, y, FIELD_W, TILE);
        speckle(y, ['#45454f', '#33333a'], 120);
        if (above === 'road') { c.fillStyle = '#e8e8e8'; for (let x = 2; x < FIELD_W; x += 14) c.fillRect(x, y, 7, 1); }
        else { c.fillStyle = '#b8b8b0'; c.fillRect(0, y, FIELD_W, 1); c.fillStyle = '#26262c'; c.fillRect(0, y + 1, FIELD_W, 1); }
        if (below !== 'road') { c.fillStyle = '#b8b8b0'; c.fillRect(0, y + TILE - 1, FIELD_W, 1); }
        break;
      case 'rail':
        c.fillStyle = '#6b625a'; c.fillRect(0, y, FIELD_W, TILE);
        speckle(y, ['#7d746b', '#57504a', '#8a8178'], 160);
        c.fillStyle = '#5a3d24'; for (let x = 1; x < FIELD_W; x += 8) c.fillRect(x, y + 2, 3, 12);
        c.fillStyle = '#b9bec6'; c.fillRect(0, y + 4, FIELD_W, 1); c.fillRect(0, y + 11, FIELD_W, 1);
        c.fillStyle = '#4a4e55'; c.fillRect(0, y + 5, FIELD_W, 1); c.fillRect(0, y + 12, FIELD_W, 1);
        break;
      // brooks move, so they are drawn every frame
    }
  });
}
