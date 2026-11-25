// What the chef's hands do: the one context action button, read against whatever station
// the chef is standing at — and the per-frame update of the whole kitchen (movement,
// cooking, frying, timers, the rush building, the shift ending).

import {
  CHEF, FRYER_BURN, FRYER_COOK, GRILL_BURN, GRILL_COOK, INTERACT_RANGE, SOLIDS, STATIONS, VIEW,
} from './config.js';
import { CHOPS, COOKED, isDish, recipeForStack, stackCanGrow } from './recipes.js';
import { addPopup, heat } from './kitchen.js';
import { serveDish, spawnTicket, updateTickets } from './orders.js';
import { sfx } from './sound.js';

/** The station the chef can use right now, or null when they are mid-floor. */
export function nearestStation(state) {
  let best = null;
  let bestDist = INTERACT_RANGE;
  for (const station of STATIONS) {
    const d = distanceToRect(state.chef.x, state.chef.y, station);
    if (d < bestDist) {
      bestDist = d;
      best = station;
    }
  }
  return best;
}

/**
 * The one action button, resolved against the nearest station and what the chef holds.
 * Every verb in the game — take, place, chop, lift, plate, serve, bin — is this function.
 */
export function interact(state) {
  const station = nearestStation(state);
  if (!station) return;
  const chef = state.chef;
  const held = chef.carry;

  if (station.kind === 'bin') {
    if (held) return refuse(state, station, 'Hands full — put that down first');
    chef.carry = station.item;
    sfx.pickup();
    return;
  }

  if (station.kind === 'trash') {
    if (!held && state.plate.length === 0) return refuse(state, station, 'Nothing to throw away');
    if (held) chef.carry = null;
    else state.plate = [];
    state.hint = 'Cleared away';
    state.hintT = 1.6;
    sfx.place();
    return;
  }

  if (station.kind === 'grill' || station.kind === 'fryer') {
    const machine = station.kind === 'grill' ? state.grill : state.fryer;
    const readyAt = station.kind === 'grill' ? GRILL_COOK : FRYER_COOK;
    const burnAt = station.kind === 'grill' ? GRILL_BURN : FRYER_BURN;
    if (machine.item === null) {
      const cook = held ? COOKED[held] : null;
      if (!cook || cook.machine !== station.kind) {
        return refuse(state, station, station.kind === 'grill' ? 'The grill wants raw fish or prawns' : 'The fryer wants cut potato');
      }
      machine.item = held;
      machine.t = 0;
      chef.carry = null;
      if (station.kind === 'grill') state.stats.grills += 1;
      else state.stats.fries += 1;
      sfx.place();
      return;
    }
    if (held) return refuse(state, station, 'Hands full');
    if (machine.t < readyAt) return refuse(state, station, 'Still cooking…');
    chef.carry = machine.t >= burnAt ? COOKED[machine.item].burnt : COOKED[machine.item].makes;
    machine.item = null;
    machine.t = 0;
    sfx.pickup();
    return;
  }

  if (station.kind === 'board') {
    const board = boardOf(state, station);
    if (board.item === null) {
      if (!held || !CHOPS[held]) return refuse(state, station, 'Bring something to chop: tomato, lettuce, potato');
      board.item = held;
      board.chops = 0;
      chef.carry = null;
      sfx.place();
      return;
    }
    const recipe = CHOPS[board.item];
    if (board.chops >= recipe.presses) {
      if (held) return refuse(state, station, 'Hands full');
      chef.carry = recipe.makes;
      board.item = null;
      board.chops = 0;
      sfx.pickup();
      return;
    }
    if (held) return refuse(state, station, 'Hands full — chop with empty hands');
    board.chops += 1;
    sfx.chop();
    if (board.chops >= recipe.presses) {
      state.stats.chops += 1; // a finished chop, counted for the shift's story
      sfx.ready();
    }
    return;
  }

  if (station.kind === 'island') {
    // The resting island is a spare pair of hands: set down, pick up, or swap what
    // rests there. It cooks nothing and asks for nothing — it never becomes a chore.
    const resting = state.island.item;
    if (!resting && !held) return refuse(state, station, 'Nothing to rest — the island holds work-in-progress');
    state.island.item = held || null;
    chef.carry = resting || null;
    sfx.place();
    return;
  }

  if (station.kind === 'plating') {
    if (held) {
      if (isDish(held)) return refuse(state, station, 'That dish is done — take it to SERVE');
      const next = [...state.plate, held];
      const finished = recipeForStack(next);
      if (!finished && !stackCanGrow(next)) return refuse(state, station, 'No recipe starts like that — BIN clears the plate');
      state.plate = next;
      chef.carry = null;
      sfx.place();
      if (finished) {
        sfx.ready();
        state.hint = `${finished.name} plated! Take it to SERVE`;
        state.hintT = 2.6;
      }
      return;
    }
    const finished = recipeForStack(state.plate);
    if (!finished) return refuse(state, station, state.plate.length ? 'That plate matches no recipe yet' : 'The plate is empty — build a dish here');
    chef.carry = finished.id;
    state.plate = [];
    sfx.pickup();
    return;
  }

  if (station.kind === 'serve') {
    if (!held || !isDish(held)) return refuse(state, station, 'Bring a finished dish to serve');
    if (!serveDish(state, held)) return refuse(state, station, 'No ticket is waiting for that dish');
    state.passDish = held;
    state.passT = 1.6;
    chef.carry = null;
    sfx.serve();
  }
}

/** The line of help text under the board: what the action button would do right here. */
export function promptFor(state) {
  const station = nearestStation(state);
  if (!station) return state.hint || 'Walk to a counter — SPACE works there';
  const held = state.chef.carry;
  switch (station.kind) {
    case 'bin': return held ? 'Hands full' : `SPACE: take ${station.label.toLowerCase()}`;
    case 'grill': return state.grill.item === null ? 'SPACE: lay fish or prawns' : 'SPACE: lift it off the grill';
    case 'fryer': return state.fryer.item === null ? 'SPACE: drop the cut potato' : 'SPACE: lift the chips';
    case 'board': {
      const board = boardOf(state, station);
      if (board.item === null) return 'SPACE: set down to chop';
      const recipe = CHOPS[board.item];
      return board.chops >= recipe.presses ? 'SPACE: take the cut pieces' : `SPACE: CHOP! (${board.chops}/${recipe.presses})`;
    }
    case 'plating': {
      const finished = recipeForStack(state.plate);
      if (held) return 'SPACE: add to the plate';
      return finished ? `SPACE: pick up the ${finished.name}` : 'SPACE: the plate builds a dish';
    }
    case 'serve': return 'SPACE: serve the dish you carry';
    case 'island': return held ? 'SPACE: rest it on the island' : state.island.item ? 'SPACE: pick up what rests here' : 'The island rests work-in-progress';
    case 'trash': return 'SPACE: throw away what you hold / clear the plate';
    default: return '';
  }
}

function moveChef(state, dt, input) {
  const chef = state.chef;
  let dx = input.x;
  let dy = input.y;
  if (dx === 0 && dy === 0 && input.target) {
    const tx = input.target.x - chef.x;
    const ty = input.target.y - chef.y;
    if (Math.hypot(tx, ty) > 10) {
      dx = Math.sign(tx);
      dy = Math.sign(ty);
    } else {
      input.target = null;
    }
  }
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    const step = (CHEF.speed * dt) / len;
    chef.x += dx * step;
    chef.y += dy * step;
    chef.face = dx !== 0 ? Math.sign(dx) : chef.face;
    chef.walk += dt * 11;
    input.target = null;
  }
  // Keep the chef in the room and out of the counters.
  chef.x = Math.min(VIEW.width - CHEF.radius, Math.max(CHEF.radius, chef.x));
  chef.y = Math.min(VIEW.height - CHEF.radius, Math.max(CHEF.radius, chef.y));
  for (const solid of SOLIDS) {
    const nearX = Math.min(solid.x + solid.w, Math.max(solid.x, chef.x));
    const nearY = Math.min(solid.y + solid.h, Math.max(solid.y, chef.y));
    const ddx = chef.x - nearX;
    const ddy = chef.y - nearY;
    const dist = Math.hypot(ddx, ddy);
    if (dist < CHEF.radius) {
      if (dist === 0) {
        chef.y = solid.y + solid.h + CHEF.radius;
      } else {
        chef.x = nearX + (ddx / dist) * CHEF.radius;
        chef.y = nearY + (ddy / dist) * CHEF.radius;
      }
    }
  }
}

/** Advance the whole kitchen by dt seconds. `input` = {x, y, target}. */
export function update(state, dt, input) {
  state.time += dt;
  if (state.phase !== 'play') return;

  state.shiftLeft -= dt;
  if (state.shiftLeft <= 0) {
    state.shiftLeft = 0;
    state.phase = 'over';
    return;
  }

  moveChef(state, dt, input);

  // Cooking advances, and the moment a piece crosses from ready to burnt the
  // shift's story counts it — once per piece, at the crossing.
  for (const [machine, burnAt] of [[state.grill, GRILL_BURN], [state.fryer, FRYER_BURN]]) {
    if (!machine.item) continue;
    const was = machine.t;
    machine.t += dt;
    if (was < burnAt && machine.t >= burnAt) state.stats.burns += 1;
  }
  if (state.passT > 0) {
    state.passT -= dt;
    if (state.passT <= 0) {
      state.passDish = null;
      state.passCombo = false;
    }
  }
  // Departing guests walk off on the same clock the popups rise on.
  for (const guest of state.departures) guest.t += dt;
  state.departures = state.departures.filter((g) => g.t < 0.9);
  if (state.shakeT > 0) state.shakeT -= dt;
  if (state.hintT > 0) state.hintT -= dt;

  const before = state.walkouts;
  updateTickets(state, dt);
  if (state.walkouts > before) sfx.walkout();

  state.spawnT -= dt;
  const tempo = 9.5 - heat(state) * 4.5;
  if (state.spawnT <= 0) {
    spawnTicket(state);
    state.spawnT = tempo * (0.75 + state.rng() * 0.5);
  }

  for (const popup of state.popups) {
    popup.t += dt;
    popup.y -= dt * 34;
  }
  state.popups = state.popups.filter((p) => p.t < p.life);
  if (state.popups.length === 0 && state.hint) {
    // Hints linger until the next one replaces them; nothing to do.
  }
}

// --- Helpers the verbs above share ---------------------------------------------

function distanceToRect(x, y, rect) {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w));
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

function boardOf(state, station) {
  return state.boards.find((b) => b.station === station);
}

function refuse(state, station, why) {
  state.shake = station.id;
  state.shakeT = 0.3;
  state.hint = why;
  state.hintT = 2.4;
  sfx.error();
}
