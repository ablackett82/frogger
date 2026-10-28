#!/usr/bin/env node
// Renders the home-screen icons: icons/icon-180.png (iOS), icon-192.png,
// icon-512.png. The frog on a road between two green verges. Everything sits
// inside the middle 80% so the maskable crop is safe.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, hexToRgb } from './png.js';
import { FROG } from '../src/render/art.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GRASS = hexToRgb('#1f8a2a'), ROAD = hexToRgb('#101014'), LINE = hexToRgb('#44444c'), KERB = hexToRgb('#c8c8c8');

function icon(size) {
  const r = new Raster(size, size);
  const u = size / 24;
  const px = (x, y, c) => r.fill(Math.floor(x * u), Math.floor(y * u), Math.ceil((x + 1) * u) - Math.floor(x * u), Math.ceil((y + 1) * u) - Math.floor(y * u), c);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) px(x, y, y >= 6 && y < 18 ? ROAD : GRASS);
  for (let x = 0; x < 24; x++) { px(x, 6, KERB); px(x, 17, KERB); if (x % 4 < 2) px(x, 12, LINE); }
  const draw = (rows, pal, ox, oy) => rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') px(ox + x, oy + y, hexToRgb(pal[ch])); }));
  draw(FROG.rows, FROG.pal, 4, 4);
  return r.encode(1);
}

fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
for (const s of [180, 192, 512]) fs.writeFileSync(path.join(ROOT, `icons/icon-${s}.png`), icon(s));
console.log('wrote icons/icon-{180,192,512}.png');
