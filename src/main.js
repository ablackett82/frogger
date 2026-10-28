// Entry point: title screen, the fixed-timestep loop, settings and cheats.
import { newGame, update, setCheats, skipLevel, NO_INPUT, DEFAULT_CHEATS } from './game/game.js';
import { Screen, SCREEN_W, SCREEN_H } from './render/screen.js';
import { Sound } from './render/audio.js';
import { Keyboard } from './input/keyboard.js';
import { Gamepad } from './input/gamepad.js';
import { Touch, CHEATS, SPEEDS } from './input/touch.js';

const STEP = 1 / 120;      // simulation step, seconds
const MAX_FRAME_S = 0.1;   // never simulate more than this per animation frame
const KEY = 'frogger.';

function load(k, d) { try { const v = localStorage.getItem(KEY + k); return v === null ? d : JSON.parse(v); } catch { return d; } }
function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* storage blocked */ } }

function main() {
  const canvas = document.getElementById('screen');
  const screen = new Screen(canvas);
  const sound = new Sound();
  const keyboard = new Keyboard();
  const gamepad = new Gamepad();
  const touch = new Touch(document.getElementById('touch'));

  let mode = 'title';
  let game = null;
  let demo = newGame({ seed: 7, demo: true, level: 4 });
  let highScore = Number(load('highscore', 0)) || 0;
  let cheats = { ...DEFAULT_CHEATS, ...load('cheats', {}) };
  let speed = load('speed', 1);
  if (!SPEEDS.some(([v]) => v === speed)) speed = 1;
  let paused = false;
  let gameOverUntil = 0;
  let acc = 0, last = performance.now();
  const input = { ...NO_INPUT };

  touch.setCheats(cheats, speed);
  touch.setInGame(false);
  touch.onPanelToggle = (open) => { if (mode === 'game') paused = open; };
  touch.onCheat = (k, on) => changeCheats({ ...cheats, [k]: on });
  touch.onSpeed = (v) => setSpeed(v);
  touch.onAction = (a) => { if (a === 'quit') quit(); else if (a === 'skip' && game && mode === 'game') skipLevel(game); };

  function changeCheats(c) {
    cheats = c;
    save('cheats', cheats);
    touch.setCheats(cheats, speed);
    if (game) setCheats(game, cheats);
  }

  /** A slowed game never sets the high score either. */
  function setSpeed(v) {
    speed = v;
    save('speed', v);
    touch.setCheats(cheats, speed);
    if (game && v < 1) game.cheated = true;
  }

  function recordHighScore() {
    if (!game || game.cheated) return;
    if (game.score > highScore) { highScore = game.score; save('highscore', highScore); }
  }

  function startGame() {
    game = newGame({ seed: (Math.random() * 2 ** 32) >>> 0, cheats });
    if (speed < 1) game.cheated = true;
    mode = 'game';
    paused = false;
    acc = 0;
    touch.clear();
    touch.setInGame(true);
    sound.unlock();
  }

  function quit() {
    recordHighScore();
    mode = 'title';
    paused = false;
    touch.setInGame(false);
    keyboard.clearPressed();
  }

  function readInput() {
    for (const k in input) input[k] = false;
    keyboard.read(input);
    gamepad.read(input);
    if (input.left || input.right || input.up || input.down) touch.notifyOtherInput();
    touch.read(input);
    return input;
  }

  function fit() {
    const stage = document.getElementById('stage');
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const s = Math.min(vw / SCREEN_W, vh / SCREEN_H);
    const scale = s >= 2 ? Math.floor(s) : s; // whole pixels when big enough; a phone fills the width instead
    canvas.style.width = `${SCREEN_W * scale}px`;
    canvas.style.height = `${SCREEN_H * scale}px`;
  }
  window.addEventListener('resize', fit);
  fit();

  function playEvents(g) {
    for (const e of g.events) {
      sound.play(e.type, e);
      if (e.type === 'gameover') { recordHighScore(); mode = 'gameover'; gameOverUntil = performance.now() + 4000; }
    }
    g.events.length = 0;
  }

  function drawTitle(now) {
    screen.drawWorld(demo, { hideFrog: true });
    screen.dim(0.72);
    const t = touch.active;
    screen.centre('FROGGER', 24, '#8affa0', 2);
    screen.centre('GET ALL FIVE FROGS SAFELY HOME', 50, '#fff');
    screen.centre('DODGE THE TRAFFIC, RIDE THE RIVER', 60, '#fff');
    screen.centre(`HI-SCORE ${String(highScore).padStart(6, '0')}`, 78, '#5ad2ff');
    screen.centre(t ? 'SWIPE TO HOP  (TAP = FORWARD)' : 'ARROWS OR WASD TO HOP', 96, '#ccc');
    screen.centre('WATER KILLS-USE LOGS AND TURTLES', 106, '#ccc');
    if (!t) screen.centre('P PAUSE  M MUTE  F FULL  ESC QUIT', 116, '#999');
    const sp = SPEEDS.find(([v]) => v === speed)[1].toUpperCase();
    const lines = [[`GAME SPEED ${sp}`, speed < 1, 'C'], ...CHEATS.map(([k, n, key]) => [`${n.toUpperCase()} ${cheats[k] ? 'ON' : 'OFF'}`, cheats[k], key])];
    lines.forEach(([s, on, key], i) => screen.centre(`${s} ${t ? '' : `(${key})`}`.trim(), 134 + i * 10, on ? '#f2e23a' : '#777'));
    screen.centre(t ? 'CHEATS UNDER THE COG' : 'K SKIPS A LEVEL IN A CHEAT GAME', 182, '#777');
    if (Math.floor(now / 500) % 2) screen.centre(t ? 'TAP TO START' : 'PRESS SPACE TO START', 202, '#f2e23a');
  }

  function frame(now) {
    const dt = Math.min(MAX_FRAME_S, (now - last) / 1000);
    last = now;
    const inp = readInput();
    const start = keyboard.consume('Space', 'Enter') || gamepad.anyPressed || touch.consumeStart();

    if (keyboard.consume('KeyF')) toggleFullscreen();
    if (keyboard.consume('KeyM')) sound.muted = !sound.muted;
    if (keyboard.consume('KeyP') && mode === 'game') { paused = !paused; touch.notifyOtherInput(); }
    if (keyboard.consume('Escape') && mode !== 'title') quit();

    if (mode === 'title') {
      if (updateReady) { location.reload(); return; } // never mid-game: wait for the title screen
      if (keyboard.consume('KeyC')) setSpeed(SPEEDS[(SPEEDS.findIndex(([v]) => v === speed) + 1) % SPEEDS.length][0]);
      for (const [k, , key] of CHEATS) if (keyboard.consume(`Key${key}`)) changeCheats({ ...cheats, [k]: !cheats[k] });
      update(demo, dt);
      demo.events.length = 0;
      drawTitle(now);
      if (start && !touch.panelOpen) startGame();
    } else {
      if (mode === 'game' && !paused) {
        if (keyboard.consume('KeyK')) skipLevel(game);
        acc += dt * speed;
        while (acc >= STEP) { update(game, STEP, inp); acc -= STEP; }
        playEvents(game);
      } else if (mode === 'gameover') {
        update(game, dt, NO_INPUT); // traffic carries on
        game.events.length = 0;
        if (now > gameOverUntil || (start && now > gameOverUntil - 2500)) quit();
      }
      drawGame();
    }
    requestAnimationFrame(frame);
  }

  function drawGame() {
    screen.drawWorld(game);
    screen.hud(game, Math.max(highScore, game.cheated ? 0 : game.score));
    if (mode === 'gameover') screen.banner([['GAME OVER', '#ff6a3a', 2], [`SCORE ${game.score}`, '#fff'], [game.cheated ? 'CHEAT GAME - NO HIGH SCORE' : game.score >= highScore && game.score > 0 ? 'NEW HIGH SCORE!' : '', '#f2e23a']]);
    else if (paused) screen.banner([['PAUSED', '#fff', 2], [touch.active ? '' : 'P TO CARRY ON  ESC TO QUIT', '#ccc']]);
    else if (game.phase === 'intro') screen.banner([[`LEVEL ${game.level}`, '#f2e23a', 2], [game.level === 1 ? 'GET YOUR FROGS HOME!' : 'FASTER NOW!', '#fff']]);
    else if (game.phase === 'clear') screen.banner([['ALL FROGS HOME!', '#8affa0', 2], ['LEVEL BONUS 1000', '#fff']]);
    if (game.cheated) screen.text('CHEAT', SCREEN_W - 32, SCREEN_H - 8, '#f2e23a');
  }

  // pause when the app is put away mid-game
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'game') paused = true; });

  // A new build has been installed by the service worker (sw.js activates it at once).
  // Reload into it from the title screen, so a home-screen app updates on one launch.
  // No controller at load means a first install, where there is nothing to update.
  let updateReady = false;
  const sw = navigator.serviceWorker;
  if (sw?.controller) sw.addEventListener('controllerchange', () => { updateReady = true; });
  requestAnimationFrame(frame);

  // unlock audio on the first interaction of any kind
  for (const ev of ['keydown', 'pointerdown', 'touchstart']) window.addEventListener(ev, () => sound.unlock(), { passive: true });
}

function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) el.requestFullscreen?.();
  else document.exitFullscreen?.();
}

try { main(); } catch (err) {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f55;padding:1em">${err.stack || err}</pre>`);
}
