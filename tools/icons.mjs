#!/usr/bin/env node
// Renders the home-screen icons: icons/icon-180.png (iOS), icon-192.png,
// icon-512.png. Prickles with an apple on her back, crossing a road between two
// verges. Everything sits inside the middle 80% so the maskable crop is safe.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, hexToRgb } from './png.js';
import { HOG, FOOD } from '../src/render/art.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GRASS = hexToRgb('#4c9a3a'), ROAD = hexToRgb('#3b3b44'), LINE = hexToRgb('#e8e8e8'), KERB = hexToRgb('#b8b8b0');

function icon(size) {
  const r = new Raster(size, size);
  const u = size / 24;
  const px = (x, y, c) => r.fill(Math.floor(x * u), Math.floor(y * u), Math.ceil((x + 1) * u) - Math.floor(x * u), Math.ceil((y + 1) * u) - Math.floor(y * u), c);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) px(x, y, y >= 7 && y < 17 ? ROAD : GRASS);
  for (let x = 0; x < 24; x++) { px(x, 7, KERB); px(x, 16, KERB); if (x % 4 < 2) px(x, 12, LINE); }
  const draw = (rows, pal, ox, oy) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') px(ox + x, oy + y, hexToRgb(pal[ch])); }));
  const rows = HOG.rows.map((row) => row.split(''));
  for (const [x, y] of HOG.feet[0]) if (rows[y][x] === '.') rows[y][x] = 'p';
  draw(rows.map((row) => row.join('')), HOG.pal, 4, 4);
  draw(FOOD.apple.rows, FOOD.apple.pal, 8, 10);
  return r.encode(1);
}

fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
for (const s of [180, 192, 512]) fs.writeFileSync(path.join(ROOT, `icons/icon-${s}.png`), icon(s));
console.log('wrote icons/icon-{180,192,512}.png');
