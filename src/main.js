// Boot and the frame loop: read the URL, size the canvas, run the kitchen.
// With ?shot=<name> the game renders one composed scene and stops — that is how the
// screenshots in /screenshots were taken, reproducibly, from the game's own code.

import { VIEW } from './config.js';
import { createGame } from './kitchen.js';
import { interact, promptFor, update } from './actions.js';
import { spawnTicket } from './orders.js';
import {
  attachClicks, attachInput, clearPressed, dropClickTarget, isDown, peekClickTarget, wasPressed,
} from './input.js';
import { draw } from './render.js';
import { stageShot } from './shots.js';
import { enableSound } from './sound.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

// The page's live region (index.html's #status) speaks the game's state
// to a screen reader: the phase and the current prompt, written only
// when they change. It shipped empty and was never written to — a live
// region that never speaks is worse than none (AUDIT-V19 F9).
const statusEl = document.getElementById('status');
let lastStatus = '';
function announce(state) {
  if (!statusEl) return;
  const msg = state.phase === 'title'
    ? 'The Daily Catch. Press Enter to start a shift.'
    : state.phase === 'over'
      ? `Shift over. You took $${state.score}. Press R for another shift.`
      : (state.promptText || 'Working the kitchen.');
  if (msg !== lastStatus) {
    lastStatus = msg;
    statusEl.textContent = msg;
  }
}

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed'));

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
  canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

attachInput(window);
attachClicks(canvas, (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW.width,
    y: ((clientY - rect.top) / rect.height) * VIEW.height,
  };
});

if (shotName) {
  // Screenshot mode: compose the scene, draw it, and say when the frame is final.
  const state = stageShot(shotName);
  window.__game = state; // read by the screenshot/playtest tooling
  state.promptText = promptFor(state);
  draw(ctx, state);
  // The frame is final only once the embedded face has settled: a
  // screenshot must show the lettering the game actually wears, not
  // whichever system font was warm. fonts.ready resolves even if a face
  // fails to load, so a bad font can never hang the shot — the frame
  // just falls back down the stack, as it is designed to.
  const finish = () => {
    draw(ctx, state);
    window.__shotReady = true;
  };
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(finish));
  } else {
    requestAnimationFrame(finish);
  }
} else {
  let state = createGame(Number.isFinite(seedParam) && seedParam > 0 ? seedParam : (Date.now() % 2147483647) + 1);
  Object.defineProperty(window, '__game', { get: () => state }); // read by the playtest tooling
  let last = performance.now();

  function startShift() {
    const seed = (Date.now() % 2147483647) + 1;
    state = createGame(seed);
    state.phase = 'play';
    spawnTicket(state);
    spawnTicket(state);
    state.spawnT = 6;
    enableSound();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (state.phase === 'title' && (wasPressed('Enter') || wasPressed('Space'))) startShift();
    else if (state.phase === 'over' && wasPressed('KeyR')) startShift();
    else if (state.phase === 'play') {
      if (wasPressed('Space') || wasPressed('KeyE')) interact(state);
      const input = {
        x: (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0),
        y: (isDown('KeyS') || isDown('ArrowDown') ? 1 : 0) - (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0),
        target: peekClickTarget(),
      };
      if (input.x !== 0 || input.y !== 0) dropClickTarget();
      update(state, dt, input);
      input.target = peekClickTarget();
      state.promptText = promptFor(state);
    }
    clearPressed();
    announce(state);
    draw(ctx, state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
