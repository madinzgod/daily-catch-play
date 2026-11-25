// The Daily Catch — shared constants: the room, the counters, the clock and the colours.
// Everything that more than one module needs to agree on lives here and nowhere else.

export const VIEW = { width: 1280, height: 800 };

/** Height of the order-board strip across the top of the screen. */
export const BOARD_H = 118;

/** A shift lasts this long; when the clock runs out the shutters come down. */
export const SHIFT_SECONDS = 150;

export const CHEF = { radius: 21, speed: 272 };

/** Seconds fish needs on the grill, and the extra grace before it burns. */
export const GRILL_COOK = 4.5;
export const GRILL_BURN = 9.5;
/** Seconds cut potatoes need in the fryer, and the grace before they burn. */
export const FRYER_COOK = 3.5;
export const FRYER_BURN = 8.0;

/** Money lost when a ticket's timer runs out and the guest walks. */
export const WALKOUT_FINE = 4;

export const COLORS = {
  floor: '#e7f0ea',
  floorLine: '#c9ddd2',
  wall: '#274b52',
  board: '#1d3038',
  boardEdge: '#12222a',
  counter: '#7d6a53',
  counterEdge: '#5f4f3c',
  counterTop: '#8fb8ab',
  steel: '#b9c2c7',
  steelDark: '#8d979d',
  paper: '#fff7e6',
  ink: '#2b2320',
  red: '#d84a2f',
  redDark: '#a93420',
  teal: '#1f7a6d',
  tealDark: '#14544b',
  mustard: '#f2b33d',
  cream: '#fff3da',
  green: '#5da24a',
  timerGood: '#57a773',
  timerMid: '#f2b33d',
  timerBad: '#d84a2f',
  rug: '#b85c38',
  rugStripe: '#e5aa5e',
  driftwood: '#9c815e',
};

/**
 * The fixed furniture. Bins sit in a row on the back counter; the grill shares that counter.
 * Chopping boards line the left counter, the fryer the right, and the front counter holds
 * the trash, the plating pass and the serve window, left to right. Mid-floor stands the
 * resting island: a spare surface where work-in-progress can be set down, nothing more.
 */
export const STATIONS = [
  { id: 'bin-bun', kind: 'bin', item: 'bun', label: 'ROLLS', x: 36, y: 146, w: 150, h: 70 },
  { id: 'bin-patty', kind: 'bin', item: 'fillet_raw', label: 'FILLET', x: 200, y: 146, w: 150, h: 70 },
  { id: 'bin-tomato', kind: 'bin', item: 'tomato', label: 'TOMATO', x: 364, y: 146, w: 150, h: 70 },
  { id: 'bin-lettuce', kind: 'bin', item: 'lettuce', label: 'LETTUCE', x: 528, y: 146, w: 150, h: 70 },
  { id: 'bin-prawns', kind: 'bin', item: 'prawns_raw', label: 'PRAWNS', x: 692, y: 146, w: 150, h: 70 },
  { id: 'bin-potato', kind: 'bin', item: 'potato', label: 'POTATO', x: 856, y: 146, w: 150, h: 70 },
  { id: 'grill', kind: 'grill', label: 'GRILL', x: 1022, y: 140, w: 222, h: 80 },
  { id: 'board-1', kind: 'board', label: 'CHOP', x: 30, y: 282, w: 150, h: 108 },
  { id: 'board-2', kind: 'board', label: 'CHOP', x: 30, y: 406, w: 150, h: 108 },
  { id: 'fryer', kind: 'fryer', label: 'FRYER', x: 1100, y: 282, w: 150, h: 108 },
  { id: 'island', kind: 'island', label: 'RESTING ISLAND', x: 450, y: 420, w: 380, h: 84 },
  { id: 'trash', kind: 'trash', label: 'BIN', x: 36, y: 690, w: 120, h: 76 },
  { id: 'plating', kind: 'plating', label: 'PLATING', x: 330, y: 690, w: 460, h: 76 },
  { id: 'serve', kind: 'serve', label: 'SERVE', x: 880, y: 690, w: 364, h: 76 },
];

/** Solid blocks the chef cannot walk through: the four counters and the island. */
export const SOLIDS = [
  { x: 20, y: 130, w: 1240, h: 96 },
  { x: 20, y: 272, w: 170, h: 264 },
  { x: 1090, y: 272, w: 170, h: 264 },
  { x: 440, y: 410, w: 400, h: 104 },
  { x: 20, y: 676, w: 1240, h: 104 },
];

/** How close (in px, from the chef's centre to a station's edge) the chef must be to use it. */
export const INTERACT_RANGE = 86;

export function stationById(id) {
  return STATIONS.find((s) => s.id === id);
}
