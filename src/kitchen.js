// The kitchen itself: one fresh state for a shift, the chef, the machines and the plate.
// No rules live here — this module only holds what the world currently looks like.

import { CHEF, SHIFT_SECONDS, stationById } from './config.js';
import { makeRng } from './random.js';
import { dailySpecial } from './recipes.js';

export function createGame(seed) {
  return {
    rng: makeRng(seed),
    special: dailySpecial(seed), // today's catch, featured on the boards
    phase: 'title', // title -> play -> over
    time: 0,
    shiftLeft: SHIFT_SECONDS,
    score: 0,
    served: 0,
    servedBy: {}, // dish id -> lines handed over: the shift's story, dish by dish
    stats: { chops: 0, grills: 0, fries: 0, burns: 0 }, // the shift in work, counted at the stations as it happens
    walkouts: 0,
    bestTip: 0,
    chef: { x: 640, y: 596, face: 1, carry: null, walk: 0 },
    grill: { item: null, t: 0 },
    fryer: { item: null, t: 0 },
    island: { item: null }, // one piece resting mid-route on the island
    boards: [
      { station: stationById('board-1'), item: null, chops: 0 },
      { station: stationById('board-2'), item: null, chops: 0 },
    ],
    plate: [], // ingredient ids stacked on the plating counter's plate
    passDish: null, // a served dish resting on the pass, briefly
    passT: 0,
    passCombo: false, // the pass dish came from a combo ticket — it rests on a tray
    departures: [], // guests leaving the window: {x, look, mood, dish, t}
    tickets: [],
    nextTicketId: 1,
    spawnT: 0,
    popups: [], // {x, y, text, color, t, life}
    shake: null, // station id that just refused an action
    shakeT: 0,
    hint: '',
    hintT: 0, // how long the hint line stays up after the prompt
  };
}

/** Add a floating score note that drifts up and fades. */
export function addPopup(state, x, y, text, color) {
  state.popups.push({ x, y, text, color, t: 0, life: 1.4 });
}

/** How far through the shift we are, 0 at the doors opening and 1 at last orders. */
export function heat(state) {
  return Math.min(1, Math.max(0, 1 - state.shiftLeft / SHIFT_SECONDS));
}
