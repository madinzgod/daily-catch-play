// Boot and the frame loop: read the URL, size the canvas, run the kitchen.
// With ?shot=<name> the game renders one composed scene and stops — that is how the
// screenshots in /screenshots were taken, reproducibly, from the game's own code.

import { CHEF, INTERACT_RANGE, SOLIDS, STATIONS, VIEW, stationById } from './config.js';
import { createGame } from './kitchen.js';
import { interact, nearestStation, promptFor, update } from './actions.js';
import { spawnTicket } from './orders.js';
import {
  attachClicks, attachInput, clearPressed, dropClickTarget, isDown, peekClickTarget,
  setClickTarget, takeTap, wasPressed,
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
    ? 'The Daily Catch. Press Enter or tap to start a shift.'
    : state.phase === 'over'
      ? `Shift over. You took $${state.score}. Press R or tap for another shift.`
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

  // A station the player tapped, to be worked on arrival — one queued press
  // per tap, so a chop still takes as many taps as it takes SPACE presses.
  let workIntent = null;
  // The corners the current tap's walk is routed through (see planPath).
  let walkQueue = [];

  function startShift() {
    const seed = (Date.now() % 2147483647) + 1;
    state = createGame(seed);
    state.phase = 'play';
    spawnTicket(state);
    spawnTicket(state);
    state.spawnT = 6;
    workIntent = null;
    walkQueue = [];
    dropClickTarget(); // the tap or click that started the shift is not a walk order
    enableSound();
  }

  // --- Getting there -------------------------------------------------------
  // The counters are boxes, and a straight walk across a box's corner can
  // strand the chef against it: his step aims through the corner while the
  // counter pushes him out along it, and the two cancel (a tap on the tomato
  // bin from the shift's start wedged him on the island's corner for good).
  // Hands on keys steer around corners without thinking; a tap cannot. So a
  // tap's walk is routed: nodes are the corners of the counters grown by the
  // chef's radius, edges are the straight lines that stay clear of every
  // counter, and the shortest chain of corners leads the walk.
  const WALLS = SOLIDS.map((s) => ({
    minX: s.x - CHEF.radius - 2, maxX: s.x + s.w + CHEF.radius + 2,
    minY: s.y - CHEF.radius - 2, maxY: s.y + s.h + CHEF.radius + 2,
  }));

  /** Does the segment cross the wall's inside? Grazing its face is clear. */
  function segmentBlocked(ax, ay, bx, by, wall) {
    const minX = wall.minX + 1, maxX = wall.maxX - 1, minY = wall.minY + 1, maxY = wall.maxY - 1;
    const dx = bx - ax, dy = by - ay;
    let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (ax < minX || ax > maxX) return false; } else {
      let ta = (minX - ax) / dx, tb = (maxX - ax) / dx;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
    if (Math.abs(dy) < 1e-9) { if (ay < minY || ay > maxY) return false; } else {
      let ta = (minY - ay) / dy, tb = (maxY - ay) / dy;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
    return true;
  }

  /** The corner chain that walks the chef from where he stands to a point. */
  function planPath(target) {
    const nodes = [{ x: state.chef.x, y: state.chef.y }];
    for (const wall of WALLS) {
      for (const [nx, ny] of [[wall.minX, wall.minY], [wall.maxX, wall.minY], [wall.minX, wall.maxY], [wall.maxX, wall.maxY]]) {
        nodes.push({
          x: Math.min(VIEW.width - CHEF.radius, Math.max(CHEF.radius, nx)),
          y: Math.min(VIEW.height - CHEF.radius, Math.max(CHEF.radius, ny)),
        });
      }
    }
    nodes.push({ x: target.x, y: target.y });
    const goal = nodes.length - 1;
    const inside = (p, wall) => p.x > wall.minX && p.x < wall.maxX && p.y > wall.minY && p.y < wall.maxY;
    // A wall an endpoint already stands against cannot block that leg: the
    // last steps into a counter's margin are the collision system's work.
    const clear = (a, b) => WALLS.every((wall) => inside(a, wall) || inside(b, wall)
      || !segmentBlocked(a.x, a.y, b.x, b.y, wall));
    const dist = nodes.map(() => Infinity);
    const prev = nodes.map(() => -1);
    const done = nodes.map(() => false);
    dist[0] = 0;
    for (let n = 0; n < nodes.length; n++) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!done[i] && (u === -1 || dist[i] < dist[u])) u = i;
      if (u === -1 || dist[u] === Infinity || u === goal) break;
      done[u] = true;
      for (let v = 0; v < nodes.length; v++) {
        if (v === u || done[v]) continue;
        const w = Math.hypot(nodes[u].x - nodes[v].x, nodes[u].y - nodes[v].y);
        if (dist[u] + w < dist[v] && clear(nodes[u], nodes[v])) {
          dist[v] = dist[u] + w;
          prev[v] = u;
        }
      }
    }
    if (prev[goal] === -1) return [{ x: target.x, y: target.y }];
    const path = [];
    for (let u = goal; u > 0; u = prev[u]) path.unshift({ x: nodes[u].x, y: nodes[u].y });
    return path;
  }

  /** Send the chef to a point, around whatever counters stand in the way. */
  function walkTo(point) {
    walkQueue = planPath(point);
    setClickTarget(walkQueue[0] || point);
  }

  function distToRect(x, y, rect) {
    const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w));
    const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h));
    return Math.hypot(dx, dy);
  }

  /** The station a tap means: the one it lands on, or the nearest it nearly lands on. */
  function stationAt(point) {
    for (const station of STATIONS) {
      if (point.x >= station.x && point.x <= station.x + station.w
        && point.y >= station.y && point.y <= station.y + station.h) return station;
    }
    // Forgiving: a tap just off a counter's edge still names that counter —
    // on a phone screen a counter is a small target, and near should count.
    let best = null;
    let bestDist = 44;
    for (const station of STATIONS) {
      const d = distToRect(point.x, point.y, station);
      if (d < bestDist) { bestDist = d; best = station; }
    }
    return best;
  }

  /**
   * The open floor in front of a station: its doorstep. Each counter is worked
   * from one side — the back counter from below, the front counter from above,
   * the side counters from the room — and the doorstep sits on that side, in
   * front of the spot the player tapped, so the chef queues up in front of the
   * station they named and not in front of its neighbour. The island stands
   * alone in the room, so its doorstep is whichever edge is nearest the chef.
   */
  function doorstepFor(station, tap) {
    const step = 30;
    const clampX = Math.min(station.x + station.w - 12, Math.max(station.x + 12, tap.x));
    const clampY = Math.min(station.y + station.h - 12, Math.max(station.y + 12, tap.y));
    if (station.y < 240) return { x: clampX, y: station.y + station.h + step };
    if (station.y > 600) return { x: clampX, y: station.y - step };
    if (station.x < 200) return { x: station.x + station.w + step, y: clampY };
    if (station.x + station.w > 1080) return { x: station.x - step, y: clampY };
    const ex = Math.min(station.x + station.w, Math.max(station.x, state.chef.x));
    const ey = Math.min(station.y + station.h, Math.max(station.y, state.chef.y));
    let dx = state.chef.x - ex;
    let dy = state.chef.y - ey;
    const len = Math.hypot(dx, dy);
    if (len === 0) { dx = 0; dy = 1; } else { dx /= len; dy /= len; }
    return { x: ex + dx * step, y: ey + dy * step };
  }

  /** A tap in play: a station means "walk there and work it"; the floor just means "walk there". */
  function handleTap(tap) {
    const station = stationAt(tap);
    if (!station) {
      workIntent = null;
      walkTo(tap);
      return;
    }
    if (workIntent && workIntent.id === station.id) {
      workIntent.presses = Math.min(4, workIntent.presses + 1);
    } else {
      workIntent = { id: station.id, presses: 1 };
    }
    walkTo(doorstepFor(station, tap));
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const tap = takeTap();
    if (state.phase === 'title' && (tap || wasPressed('Enter') || wasPressed('Space'))) startShift();
    else if (state.phase === 'over' && (tap || wasPressed('KeyR'))) startShift();
    else if (state.phase === 'play') {
      if (wasPressed('Space') || wasPressed('KeyE')) interact(state);
      if (tap) handleTap(tap);
      // Walk the routed path corner by corner; reaching one aims at the next.
      if (walkQueue.length) {
        const head = walkQueue[0];
        if (Math.hypot(state.chef.x - head.x, state.chef.y - head.y) <= 12) walkQueue.shift();
        if (walkQueue.length) setClickTarget(walkQueue[0]);
      }
      const input = {
        x: (isDown('KeyD') || isDown('ArrowRight') ? 1 : 0) - (isDown('KeyA') || isDown('ArrowLeft') ? 1 : 0),
        y: (isDown('KeyS') || isDown('ArrowDown') ? 1 : 0) - (isDown('KeyW') || isDown('ArrowUp') ? 1 : 0),
        target: peekClickTarget(),
      };
      if (input.x !== 0 || input.y !== 0) { dropClickTarget(); workIntent = null; walkQueue = []; }
      update(state, dt, input);
      // Arrived at the tapped station? Work it — the one action button,
      // pressed once per tap that asked for it.
      if (workIntent) {
        const near = nearestStation(state);
        if (near && near.id === workIntent.id) {
          interact(state);
          workIntent.presses -= 1;
          if (workIntent.presses <= 0) workIntent = null;
        } else {
          // In range of the tapped station but standing nearer a neighbour
          // (the grill and the fryer stand close): step in toward the tapped
          // counter's doorstep until it is the station in hand.
          const tapped = stationById(workIntent.id);
          if (tapped && distToRect(state.chef.x, state.chef.y, tapped) < INTERACT_RANGE) {
            walkTo(doorstepFor(tapped, state.chef));
          }
        }
      }
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
