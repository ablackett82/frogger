// The pixel art, as strings: one character per pixel, '.' is see-through.
// Plain data so tools/icons.mjs can use it in node as well. The frog faces up;
// sprites.js rotates it for the other ways.

export const FROG = {
  pal: { G: '#3cc23c', D: '#16631a', L: '#86ea5a', E: '#0c1a0b', W: '#eafff0', R: '#e03c3c' },
  rows: [
    '...D........D...',
    '...DD......DD...',
    '....DD....DD....',
    '....DWWGGWWD....',
    '...DGWEGGEWGD...',
    '..DGGGGGGGGGGD..',
    '.DGGLGGGGGGLGGD.',
    '.DGGGGGGGGGGGGD.',
    '..DGGGGGGGGGGD..',
    '...GGGGGGGGGG...',
    '..DGGGGGGGGGGD..',
    '.DDGGGGGGGGGGDD.',
    'DD..DGGGGGGD..DD',
    'D...DDGGGGDD...D',
    '.....D....D.....',
    '....DD....DD....',
  ],
};

// a little frog in the corner, for spare lives
export const FROG_MINI = {
  pal: FROG.pal,
  rows: [
    'D......D',
    '.DWGGWD.',
    '.GEGGEG.',
    'DGGGGGGD',
    '.DGGGGD.',
    'D.D..D.D',
  ],
};

// the lady frog you can escort home: pink, facing up
export const LADY = {
  pal: { G: '#ff6fc0', D: '#a8306f', L: '#ffb6e0', E: '#2a0c1c', W: '#ffffff' },
  rows: [
    '...D........D...',
    '...DD......DD...',
    '....DD....DD....',
    '....DWWGGWWD....',
    '...DGWEGGEWGD...',
    '..DGGGGGGGGGGD..',
    '.DGGLGGGGGGLGGD.',
    '.DGGGGGGGGGGGGD.',
    '..DGGGGGGGGGGD..',
    '...GGGGGGGGGG...',
    '..DGGGGGGGGGGD..',
    '.DDGGGGGGGGGGDD.',
    'DD..DGGGGGGD..DD',
    'D...DDGGGGDD...D',
    '.....D....D.....',
    '....DD....DD....',
  ],
};

// a fly, the home-bay bonus
export const FLY = {
  pal: { k: '#1a1a1a', w: '#bfe8ff', r: '#e03c3c' },
  rows: [
    'w......w',
    'ww....ww',
    '.wwkkww.',
    '..krrk..',
    '..kkkk..',
    '...kk...',
  ],
};

// the skull shown where a frog was lost to the clock or the hedge
export const SKULL = {
  pal: { w: '#f2f2f2', k: '#20201e', s: '#b8b8b2' },
  rows: [
    '..wwww..',
    '.wwwwww.',
    'wkwwwwkw',
    'wkkwwkkw',
    'wwwkkwww',
    'wwwwwwww',
    '.w.ww.w.',
    '.w.ww.w.',
  ],
};
