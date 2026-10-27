// Touch controls for iPad. Every finger is tracked on its own (Pointer Events).
// Three ways to move, chosen under the cog:
//   pad   - a fixed d-pad in the bottom corner; hold a direction to keep hopping.
//           One half of the screen moves, the other half is CURL.
//   stick - the same, but its centre is wherever the thumb lands.
//   swipe - swipe a direction for one hop, however long the swipe; a plain tap
//           hops forward. Keep the finger down and turn to hop another way;
//           lift it to hop the same way again. Works anywhere but the CURL
//           button, so it suits a phone held in one hand.
//
// Visibility: 'auto' shows the overlay on the first touch and hides it as soon
// as a keyboard or gamepad is used; 'on' / 'off' force it.

const STORE_KEY = 'hedgehog.touch';
const DEFAULTS = { enabled: 'auto', layout: 'swipe', size: 1, opacity: 0.35, swap: false };
const DEAD = 0.3;  // pad deadzone, fraction of ring radius
const SWIPE = 22;  // pixels a finger travels to count as a swipe

export const CHEATS = [
  ['lives', 'Unlimited lives', 'L'],
  ['invincible', "Can't be hurt", 'V'],
  ['noHunger', 'Never hungry', 'H'],
  ['noFox', 'No fox', 'U'],
];
export const SPEEDS = [[1, 'Normal'], [0.75, 'Slow'], [0.5, 'Very slow']];

export class Touch {
  constructor(el) {
    this.el = el;
    this.settings = { ...DEFAULTS, ...load() };
    this.pointers = new Map(); // pointerId -> { kind: 'move'|'swipe'|'curl', ... }
    this.startTapped = false;
    this.seenTouch = false;
    this.otherInputSeen = false;
    this.stickOrigin = null;
    this.knob = null;
    this.pulses = [];   // swipes waiting to be read, one per frame
    this.rest = false;  // a frame of nothing between pulses, so each reads as a fresh press
    this.state = { left: false, right: false, up: false, down: false, curl: false };
    this.onPanelToggle = null; // main.js: pause while the panel is open
    this.onCheat = null;       // main.js owns the cheats and the speed
    this.onSpeed = null;
    this.onAction = null;      // 'skip' | 'quit'
    this.buildOverlay();
    this.bindEvents();
    this.applySettings();
    window.addEventListener('resize', () => this.layout());
  }

  // ---- input side -----------------------------------------------------------

  get active() {
    const e = this.settings.enabled;
    return e === 'on' || (e === 'auto' && this.seenTouch && !this.otherInputSeen);
  }

  /** Called by the main loop when a keyboard/gamepad input is live. */
  notifyOtherInput() {
    if (!this.otherInputSeen) { this.otherInputSeen = true; this.applySettings(); }
  }

  read(into) {
    if (this.settings.enabled === 'off') return;
    for (const k in this.state) if (this.state[k]) into[k] = true;
    if (this.rest) this.rest = false;
    else if (this.pulses.length) { into[this.pulses.shift()] = true; this.rest = true; }
  }

  /** True once per tap anywhere (used for "tap to start"). */
  consumeStart() {
    if (this.settings.enabled === 'off') return false;
    const t = this.startTapped; this.startTapped = false; return t;
  }

  /** Forget any swipes not yet used (e.g. the tap that started the game). */
  clear() { this.pulses.length = 0; }

  bindEvents() {
    const el = this.el;
    const opts = { passive: false };
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      if (!this.seenTouch || this.otherInputSeen) { this.seenTouch = true; this.otherInputSeen = false; this.applySettings(); }
      if (this.settings.enabled === 'off') return;
      try { el.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
      this.startTapped = true;
      this.down(e.pointerId, e.clientX, e.clientY);
    }, opts);
    el.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      e.preventDefault();
      this.move(e.pointerId, e.clientX, e.clientY);
    }, opts);
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      el.addEventListener(ev, (e) => { this.up(e.pointerId, ev === 'pointerup'); }, opts);
    }
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => { this.pointers.clear(); this.recompute(); });
  }

  down(id, x, y) {
    const g = this.geom;
    const layout = this.settings.layout;
    // swiping works anywhere but the CURL button; the pads split the screen in half
    const curl = layout === 'swipe'
      ? Math.hypot(x - g.curlX, y - g.curlY) <= g.curlR * 1.4
      : (this.settings.swap ? x < g.mid : x > g.mid);
    if (curl) this.pointers.set(id, { kind: 'curl' });
    else if (layout === 'swipe') this.pointers.set(id, { kind: 'swipe', sx: x, sy: y, fired: false });
    else {
      const fixed = layout === 'pad';
      const p = { kind: 'move', cx: fixed ? g.padX : x, cy: fixed ? g.padY : y, x, y };
      this.pointers.set(id, p);
      if (!fixed) this.stickOrigin = [p.cx, p.cy];
    }
    this.recompute();
  }

  move(id, x, y) {
    const p = this.pointers.get(id);
    if (p.kind === 'swipe') {
      const dx = x - p.sx, dy = y - p.sy;
      if (Math.hypot(dx, dy) >= SWIPE) {
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        if (dir !== p.dir) this.pulses.push(dir); // a long swipe is still one hop
        p.sx = x; p.sy = y; p.fired = true; p.dir = dir;
      }
      return;
    }
    if (p.kind !== 'move') return;
    p.x = x; p.y = y;
    if (this.settings.layout === 'stick') {
      // drag the centre along so the thumb never runs off the ring
      const R = this.geom.padR, dx = x - p.cx, dy = y - p.cy, d = Math.hypot(dx, dy);
      if (d > R) { p.cx = x - dx * R / d; p.cy = y - dy * R / d; this.stickOrigin = [p.cx, p.cy]; }
    }
    this.recompute();
  }

  up(id, lifted) {
    const p = this.pointers.get(id);
    if (!p) return;
    this.pointers.delete(id);
    if (p.kind === 'swipe' && !p.fired && lifted) this.pulses.push('up'); // a tap hops forward
    if (![...this.pointers.values()].some((q) => q.kind === 'move')) this.stickOrigin = null;
    this.recompute();
  }

  /** Derive the held inputs from every live finger: one direction at a time, the stronger one. */
  recompute() {
    const s = this.state;
    s.left = s.right = s.up = s.down = s.curl = false;
    const R = this.geom.padR;
    let knob = null;
    for (const p of this.pointers.values()) {
      if (p.kind === 'curl') { s.curl = true; continue; }
      if (p.kind !== 'move') continue;
      const dx = p.x - p.cx, dy = p.y - p.cy, d = Math.hypot(dx, dy);
      const k = Math.min(1, R * 0.7 / Math.max(d, 1e-6)); // knob stays inside the ring
      knob = [p.cx + dx * k, p.cy + dy * k];
      if (d < R * DEAD) continue;
      if (Math.abs(dx) > Math.abs(dy)) s[dx > 0 ? 'right' : 'left'] = true;
      else s[dy > 0 ? 'down' : 'up'] = true;
    }
    this.knob = knob;
    this.paint();
  }

  // ---- visual side ----------------------------------------------------------

  buildOverlay() {
    const el = this.el;
    el.innerHTML = `
      <div class="tc-pad"><div class="tc-arrow tc-l">&#9664;</div><div class="tc-arrow tc-r">&#9654;</div>
        <div class="tc-arrow tc-u">&#9650;</div><div class="tc-arrow tc-d">&#9660;</div><div class="tc-knob"></div></div>
      <div class="tc-hint">SWIPE TO HOP<br>TAP = FORWARD</div>
      <div class="tc-jump">CURL</div>
      <button class="tc-gear" type="button" aria-label="Settings and pause">&#9881;</button>
      <div class="tc-panel" hidden>
        <h2>Paused</h2>
        <div class="tc-row"><button class="tc-act" data-act="quit" type="button">Quit to title</button><button class="tc-act" data-act="skip" type="button">Skip level</button></div>
        <h3>Touch controls</h3>
        <label>Show <select name="enabled"><option value="auto">Auto (hide when keyboard used)</option><option value="on">Always</option><option value="off">Off</option></select></label>
        <label>Move by <select name="layout"><option value="swipe">Swiping (tap = forward)</option><option value="pad">D-pad (fixed)</option><option value="stick">Stick (floats under thumb)</option></select></label>
        <label>Size <input name="size" type="range" min="0.6" max="1.6" step="0.1"></label>
        <label>Opacity <input name="opacity" type="range" min="0.1" max="0.9" step="0.05"></label>
        <label><input name="swap" type="checkbox"> Curl button on the left</label>
        <h3>Cheats <small>(no high score)</small></h3>
        <label>Game speed <select class="tc-speed">${SPEEDS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
        ${CHEATS.map(([k, n]) => `<label><input class="tc-cheat" data-cheat="${k}" type="checkbox"> ${n}</label>`).join('')}
        <button class="tc-close" type="button">Done</button>
      </div>`;
    this.pad = el.querySelector('.tc-pad');
    this.hint = el.querySelector('.tc-hint');
    this.curlEl = el.querySelector('.tc-jump');
    this.knobEl = el.querySelector('.tc-knob');
    this.arrows = { left: el.querySelector('.tc-l'), right: el.querySelector('.tc-r'), up: el.querySelector('.tc-u'), down: el.querySelector('.tc-d') };
    this.panel = el.querySelector('.tc-panel');
    this.gear = el.querySelector('.tc-gear');
    this.speedSel = el.querySelector('.tc-speed');
    this.speedSel.addEventListener('change', () => this.onSpeed?.(Number(this.speedSel.value)));
    for (const box of el.querySelectorAll('.tc-cheat')) box.addEventListener('change', () => this.onCheat?.(box.dataset.cheat, box.checked));
    for (const b of el.querySelectorAll('.tc-act')) b.addEventListener('click', () => { this.openPanel(false); this.onAction?.(b.dataset.act); });
    const stop = (e) => e.stopPropagation();
    for (const n of [this.gear, this.panel]) for (const ev of ['pointerdown', 'pointerup', 'pointermove']) n.addEventListener(ev, stop);
    this.gear.addEventListener('click', () => this.openPanel(true));
    el.querySelector('.tc-close').addEventListener('click', () => this.openPanel(false));
    this.panel.addEventListener('input', (e) => {
      const f = e.target;
      if (!f.name) return; // cheats and speed are not touch settings
      this.settings[f.name] = f.type === 'checkbox' ? f.checked : f.type === 'range' ? Number(f.value) : f.value;
      save(this.settings);
      this.applySettings();
    });
  }

  /** Show the cheats as main.js has them. */
  setCheats(cheats, speed) {
    for (const box of this.el.querySelectorAll('.tc-cheat')) box.checked = !!cheats[box.dataset.cheat];
    this.speedSel.value = String(speed);
  }
  /** The in-game buttons only make sense during a game. */
  setInGame(on) { for (const b of this.el.querySelectorAll('.tc-act')) b.hidden = !on; this.panel.querySelector('h2').textContent = on ? 'Paused' : 'Settings'; }

  get panelOpen() { return !this.panel.hidden; }

  openPanel(open) {
    this.panel.hidden = !open;
    this.pointers.clear(); this.pulses.length = 0; this.recompute();
    this.onPanelToggle?.(open);
  }

  applySettings() {
    const s = this.settings, el = this.el;
    for (const f of this.panel.querySelectorAll('[name]')) {
      if (f.type === 'checkbox') f.checked = !!s[f.name]; else f.value = String(s[f.name]);
    }
    el.style.setProperty('--tc-opacity', s.opacity);
    el.classList.toggle('tc-visible', this.active);
    el.classList.toggle('tc-stick', s.layout === 'stick');
    el.classList.toggle('tc-swipe', s.layout === 'swipe');
    this.layout();
  }

  /** Geometry in window pixels, used for both hit-testing and drawing. */
  layout() {
    const W = window.innerWidth, H = window.innerHeight;
    const cs = getComputedStyle(document.documentElement);
    const inset = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
    const sb = inset('--sat-b'), sl = inset('--sat-l'), sr = inset('--sat-r');
    const u = this.settings.size * Math.min(W, H) * 0.11;
    const padR = 2 * u, curlR = 1.4 * u;
    const swap = this.settings.swap;
    const padX = swap ? W - sr - padR - u * 0.6 : sl + padR + u * 0.6;
    const padY = H - sb - padR - u * 0.6;
    const curlX = swap ? sl + curlR + u : W - sr - curlR - u;
    const curlY = H - sb - curlR - u * 0.8;
    this.geom = { mid: W / 2, padX, padY, padR, curlX, curlY, curlR };
    const j = this.curlEl.style;
    j.left = `${curlX - curlR}px`; j.top = `${curlY - curlR}px`; j.width = j.height = `${2 * curlR}px`;
    const h = this.hint.style;
    h.left = `${padX - padR}px`; h.top = `${padY - u * 0.6}px`; h.width = `${2 * padR}px`; h.fontSize = `${u * 0.3}px`;
    this.pad.style.fontSize = `${u * 0.5}px`;
    this.curlEl.style.fontSize = `${u * 0.45}px`;
    this.paint();
  }

  paint() {
    const g = this.geom, s = this.state;
    const stick = this.settings.layout === 'stick';
    const c = stick && this.stickOrigin ? this.stickOrigin : [g.padX, g.padY];
    this.pad.classList.toggle('tc-hidden', stick && !this.stickOrigin);
    const p = this.pad.style;
    p.left = `${c[0] - g.padR}px`; p.top = `${c[1] - g.padR}px`; p.width = p.height = `${2 * g.padR}px`;
    for (const k in this.arrows) this.arrows[k].classList.toggle('on', s[k]);
    this.curlEl.classList.toggle('on', s.curl);
    const k = this.knob || c, kr = g.padR * 0.3, ks = this.knobEl.style;
    ks.left = `${k[0] - c[0] + g.padR - kr}px`; ks.top = `${k[1] - c[1] + g.padR - kr}px`; ks.width = ks.height = `${2 * kr}px`;
  }
}

function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function save(s) { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* private mode / quota */ } }
