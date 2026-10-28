// Keyboard: arrows or WASD to hop. Space/Enter start a game (read in main.js).
const MAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
};

export class Keyboard {
  constructor(target = window) {
    this.down = new Set();
    this.pressed = new Set(); // edge-triggered, cleared by consume()
    target.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.pressed.add(e.code);
      const a = MAP[e.code];
      if (a) { this.down.add(a); e.preventDefault(); }
    });
    target.addEventListener('keyup', (e) => {
      const a = MAP[e.code];
      if (a) { this.down.delete(a); e.preventDefault(); }
    });
    window.addEventListener('blur', () => this.down.clear());
  }
  read(into) { for (const a of this.down) into[a] = true; }
  /** True once per key press of any of the given codes. */
  consume(...codes) {
    for (const c of codes) if (this.pressed.has(c)) { this.pressed.delete(c); return true; }
    return false;
  }
  clearPressed() { this.pressed.clear(); }
}
