// The pixel art, as strings: one character per pixel, '.' is see-through.
// Plain data so tools/icons.mjs can use it in node as well.

// Prickles, seen from above, nose up. Feet are added per frame in sprites.js.
export const HOG = {
  pal: { n: '#1a1010', e: '#000000', f: '#e3c08e', k: '#4a2f17', b: '#7d5230', l: '#c9a27a', p: '#b07a5a' },
  rows: [
    '................',
    '.......nn.......',
    '......ffff......',
    '.....effffe.....',
    '.....ffffff.....',
    '....lkblbklb....',
    '...lbkbkbkbkl...',
    '..lkbkblbkbkbl..',
    '..bkbkbkbkbkbk..',
    '.lkbklbkbkblkbl.',
    '.bkbkbkbkbkbkbk.',
    '.kbkblbkbklbkbk.',
    '..kbkbkbkbkbkb..',
    '..lkbkbklbkbkl..',
    '...kbkbkbkbkk...',
    '....kk.kk.kk....',
  ],
  feet: [[[2, 6], [13, 6], [1, 12], [14, 12]], [[1, 7], [14, 7], [1, 13], [14, 13]]],
};

// the little one in the corner, for lives
export const HOG_MINI = {
  pal: HOG.pal,
  rows: [
    '..lklk..',
    '.kbkbkb.',
    'lbkbkbff',
    'kbkbkbfn',
    '.kbkbff.',
    '..p..p..',
  ],
};

export const FOOD = {
  apple: {
    pal: { r: '#d8282a', w: '#ff9a8a', g: '#3fa535', s: '#5a3a1e' },
    rows: ['....s...', '...sgg..', '.rrrrrr.', 'rwrrrrrr', 'rwrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..'],
  },
  mushroom: {
    pal: { r: '#c8302a', w: '#fff4e0', c: '#efe2c4', d: '#c9b896' },
    rows: ['..rrrr..', '.rwrrwr.', 'rrrrrrrr', 'rwrrrrwr', '..cccc..', '...cd...', '...cd...', '..cccd..'],
  },
  berry: {
    pal: { g: '#3fa535', d: '#2a1240', p: '#5b2a7a', h: '#b07ad8' },
    rows: ['...gg...', '..ggg...', '..pdpd..', '.dphdpd.', '.pdpdpd.', '.dpdpdp.', '..pdpd..', '...dd...'],
  },
};

export const BEETLE = {
  pal: { k: '#101010', g: '#2e9b5a', h: '#9cf0b8' },
  rows: ['..k..k..', '...kk...', 'kgghgggk', '.gghkgg.', 'kgghkggk', '.gggkgg.', 'kgggkggk', '..gggg..'],
};
