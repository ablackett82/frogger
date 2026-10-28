// Gamepad API: d-pad or left stick to hop. Any face button starts a game.
export class Gamepad {
  constructor() { this.anyPressed = false; this.lastButtons = 0; }
  read(into) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let buttons = 0;
    for (const p of pads) {
      if (!p) continue;
      const b = p.buttons;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (b[14]?.pressed || ax < -0.5) into.left = true;
      if (b[15]?.pressed || ax > 0.5) into.right = true;
      if (b[12]?.pressed || ay < -0.5) into.up = true;
      if (b[13]?.pressed || ay > 0.5) into.down = true;
      for (let i = 0; i < b.length; i++) if (b[i]?.pressed) buttons |= 1 << i;
    }
    this.anyPressed = buttons & ~this.lastButtons;
    this.lastButtons = buttons;
  }
}
