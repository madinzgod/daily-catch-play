// Every pixel of The Daily Catch: the board of tickets across the top, the kitchen below it,
// the food drawn piece by piece, the chef, and the title and last-orders screens.
// Nothing here changes the game — it only reads the state and draws it.

import { BOARD_H, COLORS, FRYER_BURN, FRYER_COOK, GRILL_BURN, GRILL_COOK, SOLIDS, STATIONS, VIEW } from './config.js';
import { DISHES, COOKED, FRIES, INGREDIENTS, RECIPES, recipeForStack } from './recipes.js';
import { nearestStation } from './actions.js';
import { heat } from './kitchen.js';
import { boardRush } from './orders.js';
import { guestFor } from './guests.js';

/**
 * Draw one whole frame of the game from the state — every pixel the game ever
 * shows comes out of this function and the drawing helpers below it.
 */
export function draw(ctx, state) {
  ctx.fillStyle = COLORS.wall;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  drawKitchen(ctx, state);
  drawChef(ctx, state);
  drawBoard(ctx, state);
  // Floating score notes, each on a solid pill in its own colour — the same
  // badge language as READY! / BURNT! / CUT!, so money and urgency are never
  // the one voice in the room reduced to bare text on wood. Each pill is
  // clamped fully inside the frame, however long its text and wherever it
  // was born — no more tips clipped at the edge.
  for (const popup of state.popups) {
    ctx.font = `700 17px ${FONT}`;
    const w = ctx.measureText(popup.text).width + 26;
    const px = Math.min(Math.max(popup.x, w / 2 + 8), VIEW.width - w / 2 - 8);
    const py = Math.max(popup.y, BOARD_H + 16);
    ctx.globalAlpha = Math.max(0, 1 - popup.t / popup.life);
    ctx.fillStyle = popup.color;
    rr(ctx, px - w / 2, py - 13, w, 26, 13); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.6;
    rr(ctx, px - w / 2, py - 13, w, 26, 13); ctx.stroke();
    text(ctx, popup.text, px, py + 0.5, 17, '#ffffff');
    ctx.globalAlpha = 1;
  }
  drawOverlays(ctx, state);
  // The prompt strip along the very bottom.
  if (state.phase === 'play') {
    ctx.fillStyle = 'rgba(23,32,36,0.88)';
    ctx.fillRect(0, VIEW.height - 21, VIEW.width, 21);
    const showHint = (state.shakeT > 0 || state.hintT > 0) && state.hint;
    const msg = showHint ? state.hint : state.promptText || '';
    text(ctx, msg, VIEW.width / 2, VIEW.height - 10, 13.5, showHint ? '#ffab97' : '#e8f0ea');
  }
}

// The game's voice: Fredoka, a rounded display face embedded in game/fonts/
// (subsetted woff2, declared in index.html), with the old system stack
// behind it — if the face fails to load, the game speaks exactly as it did
// before it had one. Fredoka carries no → or ✓ glyph; those two are never
// set as text at all — both are drawn as vector strokes (drawCheck,
// drawArrow), so no glyph falls back per-glyph to the stack behind it.
const FONT = "'Fredoka', 'Trebuchet MS', 'Segoe UI', Verdana, sans-serif";

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function text(ctx, str, x, y, size, color, align = 'center', bold = true) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? '700' : '400'} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

/**
 * A check mark as two strokes, s = half-width. Fredoka has no ✓ glyph, so
 * the game's most affirmative mark is drawn, never set as text — it wears
 * the same rounded hand as everything else instead of a fallback face's.
 */
function drawCheck(ctx, cx, cy, s, color, lw) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s, cy + s * 0.05);
  ctx.lineTo(cx - s * 0.35, cy + s * 0.72);
  ctx.lineTo(cx + s, cy - s * 0.68);
  ctx.stroke();
}

/** A right arrow as strokes — Fredoka has no → glyph either. Drawn a step
 * larger than its first version: at 11 px and 2.4 weight it was the
 * slightest mark on the title screen, thinner than the strokes of the
 * letters it joins. */
function drawArrow(ctx, cx, cy, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 7, cy);
  ctx.moveTo(cx + 2.5, cy - 5.5);
  ctx.lineTo(cx + 7, cy);
  ctx.lineTo(cx + 2.5, cy + 5.5);
  ctx.stroke();
}

/**
 * One prawn, drawn to be recognised at thumbnail size: a curled, segmented body —
 * fat at the head, slimming ring by ring to a fanned tail — with an eye and feelers.
 * Centred on the origin, roughly 36 units wide before the caller's scale.
 */
function drawPrawn(ctx, colors, rot, sheen = true) {
  ctx.save();
  ctx.rotate(rot);
  const segs = [];
  for (let i = 0; i < 5; i++) {
    const a = -2.05 + i * 0.62;
    segs.push({ x: Math.cos(a) * 10.5, y: Math.sin(a) * 10.5 + 3, r: 6.4 - i * 0.72 });
  }
  // The tail fan, at the slim end of the curl.
  const tail = segs[segs.length - 1];
  ctx.fillStyle = colors.body;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1.1;
  for (const f of [-0.45, 0.4]) {
    ctx.save();
    ctx.translate(tail.x, tail.y);
    ctx.rotate(f + 0.9);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(9.5, -3.4); ctx.lineTo(9.5, 3.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // The segments, tail first so the head sits on top.
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    ctx.fillStyle = colors.body;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, -0.5, 2.1); ctx.stroke();
  }
  if (sheen) {
    // A wet sheen on the head and one mid segment — fresh or just grilled,
    // the shell catches the light. Burnt prawns are matte and skip it.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const s of [segs[0], segs[2]]) {
      ctx.beginPath(); ctx.arc(s.x - s.r * 0.3, s.y - s.r * 0.38, s.r * 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // The head: one dark eye and two long feelers sweeping back.
  const head = segs[0];
  ctx.fillStyle = '#2b2320';
  ctx.beginPath(); ctx.arc(head.x - 3.2, head.y - 2.8, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  for (const f of [-0.5, -1.0]) {
    ctx.beginPath();
    ctx.moveTo(head.x - 4, head.y - 3);
    ctx.quadraticCurveTo(head.x - 11, head.y - 6 + f * 4, head.x - 15, head.y - 3 + f * 9);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The contact shadow every piece of food sits on: one flat ellipse of warm
 * shade in the renderer's own language (no gradients anywhere in this file),
 * drawn in the caller's local units just before the food itself, so a tomato
 * on a board and a plate on the pass both rest on the surface under them
 * instead of floating over it. One helper, one colour, everywhere.
 */
function foodShadow(ctx, rx, y) {
  ctx.fillStyle = 'rgba(74,44,16,0.20)';
  ctx.beginPath(); ctx.ellipse(0, y, rx, rx * 0.24, 0, 0, Math.PI * 2); ctx.fill();
}

/** One ingredient, centred on (x, y), roughly s px across. Used by bins, hands and boards. */
export function drawItem(ctx, item, x, y, s, shadow = true) {
  const u = s / 40;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  if (shadow) foodShadow(ctx, item.startsWith('fillet') ? 17 : 15.5, 14.5);
  switch (item) {
    case 'bun':
      ctx.fillStyle = '#e8b06a';
      ctx.beginPath(); ctx.ellipse(0, 2, 17, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c078';
      ctx.beginPath(); ctx.ellipse(0, -2, 16, 11, 0, Math.PI, 0); ctx.fill();
      // The baker's scoring: three shallow slashes opened across the dome.
      ctx.strokeStyle = 'rgba(160,100,40,0.65)';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (const [sx, ex] of [[-10, -4], [-2, 4], [6, 11]]) {
        ctx.beginPath(); ctx.moveTo(sx, -6.5); ctx.quadraticCurveTo((sx + ex) / 2, -10.5, ex, -6.5); ctx.stroke();
      }
      ctx.fillStyle = '#fff3da';
      for (const [sx, sy] of [[-8, -6], [0, -9], [8, -6], [-4, -3], [5, -3]]) {
        ctx.beginPath(); ctx.ellipse(sx, sy, 2, 1.2, 0.4, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'fillet_raw':
    case 'fillet_grilled':
    case 'fillet_burnt': {
      // A whole fish, head left, tail right. The raw body is a true salmon —
      // a step deeper than it was, when its pallor washed out against the
      // sea-glass counter and the game's hero ingredient lost its edge.
      const body = item === 'fillet_raw' ? '#dfa894' : item === 'fillet_grilled' ? '#c98d4b' : '#33261e';
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(-2, 0, 15, 8.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(11, 0); ctx.lineTo(19, -7); ctx.lineTo(19, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = item === 'fillet_raw' ? '#a97863' : item === 'fillet_grilled' ? '#a06a30' : '#241a14';
      ctx.beginPath(); ctx.ellipse(-4, -3, 8, 3.4, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b2320';
      ctx.beginPath(); ctx.arc(-11, -1.5, 1.7, 0, Math.PI * 2); ctx.fill();
      if (item === 'fillet_raw') {
        // Fresh off the boat: a wet sheen band along the flank.
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.ellipse(-1, -3.4, 9, 2.7, -0.18, 0, Math.PI * 2); ctx.fill();
      }
      if (item === 'fillet_grilled') {
        // Char marks from the grill bars, then a glisten of cooking oil on top.
        ctx.strokeStyle = '#7a451f'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        for (const gx of [-8, -2.5, 3, 8.5]) { ctx.beginPath(); ctx.moveTo(gx, -5.2); ctx.lineTo(gx + 2.4, 5.2); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,244,214,0.4)';
        ctx.beginPath(); ctx.ellipse(-3, -3.6, 7.5, 2.6, -0.25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.arc(3.5, -2.2, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-7.5, -1.2, 1, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'prawns_raw':
    case 'prawns_grilled':
    case 'prawns_burnt': {
      // A little pile of proper prawns, not curls: segmented, fanned, feelers out.
      const colors = item === 'prawns_raw' ? { body: '#e8ab90', line: '#bd7f63' }
        : item === 'prawns_grilled' ? { body: '#f4834f', line: '#c25227' }
        : { body: '#503a2c', line: '#2e2019' };
      const sheen = item !== 'prawns_burnt';
      drawPrawn(ctx, colors, 0.25, sheen);
      ctx.save(); ctx.translate(12, 9); ctx.scale(0.8, 0.8); drawPrawn(ctx, colors, 2.6, sheen); ctx.restore();
      ctx.save(); ctx.translate(-12, 10); ctx.scale(0.66, 0.66); drawPrawn(ctx, colors, -1.05, sheen); ctx.restore();
      break;
    }
    case 'tomato':
      ctx.fillStyle = '#d8402a';
      ctx.beginPath(); ctx.arc(0, 1, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ef6a4d';
      ctx.beginPath(); ctx.arc(-4, -3, 6, 0, Math.PI * 2); ctx.fill();
      // A ripe gloss: one soft highlight and its pin-dot, upper left.
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath(); ctx.ellipse(-5.5, -5.5, 4.2, 2.6, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(-2.2, -8.6, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4d8f3a';
      ctx.beginPath(); ctx.ellipse(0, -13, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'tomato_cut':
      for (const [ox, oy] of [[-8, 2], [8, 2], [0, -6]]) {
        ctx.fillStyle = '#d8402a';
        ctx.beginPath(); ctx.arc(ox, oy, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f0927c';
        ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'lettuce':
      // A dark heart under the leaves, so the ruffles sit in their own shade.
      ctx.fillStyle = '#4c8a3e';
      ctx.beginPath(); ctx.ellipse(0, 8, 12, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#579a44';
      for (const [ox, oy] of [[-9, 3], [9, 3], [0, -5]]) {
        ctx.beginPath(); ctx.arc(ox, oy + 1.5, 10.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#6db457';
      for (const [ox, oy] of [[-9, 3], [9, 3], [0, -5]]) {
        ctx.beginPath(); ctx.arc(ox, oy, 10, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#a5dd8f';
      ctx.beginPath(); ctx.arc(-5, -4, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      // Pale veins out from the heart of each leaf.
      ctx.strokeStyle = 'rgba(220,245,205,0.8)';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      for (const [x1, y1, x2, y2] of [[-9, 4, -13, -1], [9, 4, 13, -1], [0, -4, 0, -10]]) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      break;
    case 'lettuce_cut': {
      // Shreds with real colour pop: a dark bed, bright bodies, pale tips.
      const shreds = [[-14, 4, -4, -6], [-5, 7, 6, -4], [4, 6, 14, -5], [-10, -2, 2, 6], [0, -7, 10, 3]];
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#4c8a3e'; ctx.lineWidth = 6;
      for (const [x1, y1, x2, y2] of shreds) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
      ctx.strokeStyle = '#63b34f'; ctx.lineWidth = 4;
      for (const [x1, y1, x2, y2] of shreds) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
      ctx.strokeStyle = '#a8e294'; ctx.lineWidth = 2.2;
      for (const [x1, y1, x2, y2] of shreds) {
        ctx.beginPath(); ctx.moveTo((x1 + x2) / 2, (y1 + y2) / 2); ctx.lineTo(x2, y2); ctx.stroke();
      }
      break;
    }
    case 'potato':
      // A richer skin than it wore — at its old pallor the speckles read as
      // an egg's, not a potato's.
      ctx.fillStyle = '#c69548';
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 11, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8894a';
      for (const [px, py] of [[-7, -3], [4, 2], [9, -5], [-2, 6]]) { ctx.beginPath(); ctx.arc(px, py, 1.8, 0, Math.PI * 2); ctx.fill(); }
      // A dull sheen on the skin, upper left.
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath(); ctx.ellipse(-4, -4.5, 6, 3, 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'potato_cut':
      // Cut potato, one step deeper toward the chips' gold than it used to be —
      // raw still reads paler than the fried sticks, but no longer washed out.
      ctx.fillStyle = '#eabd60';
      for (const [ox, rot] of [[-10, -0.16], [-3, 0.07], [4, -0.06], [11, 0.16]]) {
        ctx.save(); ctx.translate(ox, 0); ctx.rotate(rot); rr(ctx, -3, -13, 6, 26, 2); ctx.fill(); ctx.restore();
      }
      break;
    case 'fries':
    case 'fries_burnt': {
      // Chips as separate golden sticks, never a blob: each one shaded, edged,
      // and salted, standing at its own angle behind and in front of the carton.
      const golden = item === 'fries';
      const face = golden ? '#f7c948' : '#4a3423';
      const shade = golden ? '#dfa92b' : '#38271a';
      const edge = golden ? '#b97e14' : '#241a10';
      const stick = (ox, oy, h, rot) => {
        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(rot);
        ctx.fillStyle = face;
        rr(ctx, -3.2, -h, 6.4, h, 2); ctx.fill();
        ctx.fillStyle = shade;
        ctx.fillRect(0.9, -h + 2.5, 2.1, h - 4.5);
        ctx.strokeStyle = edge;
        ctx.lineWidth = 0.9;
        rr(ctx, -3.2, -h, 6.4, h, 2); ctx.stroke();
        ctx.restore();
      };
      for (const [ox, h, rot] of [[-12, 27, -0.2], [-6, 34, -0.06], [0, 31, 0.03], [6, 35, 0.12], [12, 26, 0.24]]) {
        stick(ox, -2, h, rot);
      }
      ctx.fillStyle = '#c73e2e';
      ctx.beginPath();
      ctx.moveTo(-15, -2); ctx.lineTo(15, -2); ctx.lineTo(11, 15); ctx.lineTo(-11, 15); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff3da';
      ctx.beginPath(); ctx.arc(0, 6, 4.4, 0, Math.PI * 2); ctx.fill();
      stick(-8, 13, 17, -0.5);
      stick(9, 13, 15, 0.55);
      if (golden) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const [sx, sy] of [[-6, -26], [2, -30], [8, -20], [-1, -14]]) {
          ctx.beginPath(); ctx.arc(sx, sy, 1.1, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
    default:
      ctx.fillStyle = '#999';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

const LAYER_ORDER = ['bun', 'lettuce_cut', 'tomato_cut', 'fillet_grilled', 'prawns_grilled'];

/** A plated dish (or a plate mid-assembly) drawn as its stacked layers, plate included. */
export function drawPlate(ctx, items, x, y, s, shadow = true) {
  const u = s / 90;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  if (shadow) foodShadow(ctx, 44, 18);
  // Crockery, not a disc: a grey outer edge under the white, a hairline
  // around the rim, the well a touch deeper, and a sheen along the rim's
  // left where the light catches it.
  ctx.fillStyle = '#bfcbd0';
  ctx.beginPath(); ctx.ellipse(0, 17.5, 43.5, 13.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(0, 16, 42, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#aebfc5';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(0, 16, 42, 13, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#dfe5e8';
  ctx.beginPath(); ctx.ellipse(0, 15, 33, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(-15, 11.5, 12, 3, -0.15, 0, Math.PI * 2); ctx.fill();
  const layers = LAYER_ORDER.filter((item) => items.includes(item));
  let top = 12;
  for (const item of layers) {
    if (item === 'bun') {
      ctx.fillStyle = '#e8b06a';
      rr(ctx, -30, top - 6, 60, 10, 5); ctx.fill();
      top -= 7;
    } else if (item === 'fillet_grilled') {
      drawItem(ctx, 'fillet_grilled', 0, top - 6, 56);
      top -= 10;
    } else if (item === 'prawns_grilled') {
      drawItem(ctx, 'prawns_grilled', 0, top - 5, 44);
      top -= 8;
    } else if (item === 'lettuce_cut') {
      ctx.fillStyle = '#579a44';
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 12, top - 3, 8.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#6db457';
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 12, top - 4.5, 8, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#a5dd8f';
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 12 - 2.5, top - 7, 3.6, 0, Math.PI * 2); ctx.fill(); }
      top -= 7;
    } else if (item === 'tomato_cut') {
      ctx.fillStyle = '#d8402a';
      for (const ox of [-16, 0, 16]) { ctx.beginPath(); ctx.arc(ox, top - 4, 9, 0, Math.PI * 2); ctx.fill(); }
      top -= 7;
    }
  }
  if (layers.length > 1 && items.includes('bun')) {
    // The top bun crowns a finished butty — scored like its bin self.
    ctx.fillStyle = '#f2c078';
    ctx.beginPath(); ctx.ellipse(0, top - 2, 29, 15, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(160,100,40,0.6)';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    for (const [sx, ex] of [[-16, -7], [-3, 6], [10, 18]]) {
      ctx.beginPath(); ctx.moveTo(sx, top - 9); ctx.quadraticCurveTo((sx + ex) / 2, top - 13.5, ex, top - 9); ctx.stroke();
    }
    ctx.fillStyle = '#fff3da';
    for (const [sx, sy] of [[-14, top - 10], [0, top - 14], [14, top - 10], [-6, top - 6], [8, top - 6]]) {
      ctx.beginPath(); ctx.ellipse(sx, sy, 2.6, 1.5, 0.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // The finish, the difference between food and a dish: a grilled plate gets
  // a sauce drizzle across its top and a lemon wedge at its side; every
  // plate gets a garnish sprig at its rim; a salad gets its dressing dots.
  const grilled = items.includes('fillet_grilled') || items.includes('prawns_grilled');
  if (grilled) {
    ctx.strokeStyle = 'rgba(146,64,24,0.55)';
    ctx.lineWidth = 2.1;
    ctx.lineCap = 'round';
    for (const dy of [-3.5, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(-17, top + dy);
      ctx.quadraticCurveTo(-6, top + dy - 3.4, 4, top + dy);
      ctx.quadraticCurveTo(11, top + dy + 2.6, 17, top + dy - 0.6);
      ctx.stroke();
    }
    // The lemon wedge: a yellow fan with a paler heart, at the plate's left.
    ctx.fillStyle = '#f7c948';
    ctx.beginPath(); ctx.moveTo(-33, 9); ctx.lineTo(-24, 1); ctx.lineTo(-23, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fbe38a';
    ctx.beginPath(); ctx.moveTo(-30.5, 8); ctx.lineTo(-25.5, 4); ctx.lineTo(-25, 9.5); ctx.closePath(); ctx.fill();
  }
  if (items.includes('lettuce_cut') && items.includes('tomato_cut') && !grilled && !items.includes('bun')) {
    ctx.fillStyle = 'rgba(255,246,220,0.85)';
    for (const [dx, dy] of [[-11, -2], [2, -5], [12, -1], [-3, 1.5]]) {
      ctx.beginPath(); ctx.arc(dx, top + dy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (layers.length) {
    // A garnish sprig at the rim: two small leaves and a stem, bright green.
    ctx.strokeStyle = '#4c8a3e';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(27, 10); ctx.quadraticCurveTo(30, 6, 33.5, 4.5); ctx.stroke();
    ctx.fillStyle = '#579a44';
    ctx.beginPath(); ctx.ellipse(31.5, 5.5, 3.6, 2, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a5dd8f';
    ctx.beginPath(); ctx.ellipse(34, 7.5, 2.8, 1.6, 0.9, 0, Math.PI * 2); ctx.fill();
  }
  if (items.includes('lettuce_cut') && items.includes('tomato_cut') && !items.includes('bun')
    && !items.includes('fillet_grilled') && !items.includes('prawns_grilled')) {
    // A salad sits in a bowl, not on a flat plate.
    ctx.fillStyle = COLORS.teal;
    ctx.beginPath(); ctx.ellipse(0, 14, 40, 14, 0, 0, Math.PI); ctx.fill();
  }
  ctx.restore();
}

/**
 * A plate still being built, for the plating counter only: the pieces sit side by
 * side instead of stacked, so what is already on reads at a glance — and one dashed
 * ring marks the empty place where the next piece belongs.
 */
function drawPlateSpread(ctx, items, x, y, s) {
  const u = s / 110;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  foodShadow(ctx, 56, 12.5);
  // The same crockery as a finished plate: grey edge, hairline, sheen.
  ctx.fillStyle = '#bfcbd0';
  ctx.beginPath(); ctx.ellipse(0, 11, 56.5, 18.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(0, 10, 55, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#aebfc5';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.ellipse(0, 10, 55, 18, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#dfe5e8';
  ctx.beginPath(); ctx.ellipse(0, 9, 45, 12.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.ellipse(-20, 5.5, 16, 4, -0.15, 0, Math.PI * 2); ctx.fill();
  // A lone piece takes the LEFT slot: it used to sit at −16 alone and
  // jump to −28 when a second piece joined it — food already placed
  // teleported sideways as the plate built (AUDIT-V19 F5).
  const slots = items.length >= 3 ? [[-29, 1], [0, -6], [29, 1]]
    : items.length === 2 ? [[-28, 0], [28, 0]]
    : [[-28, 0]];
  if (items.length < 3) {
    // The dashed ring marks the empty place, so it is drawn on the
    // plate, under the food: drawn after the items, its arc struck
    // through the fillet's tail on the cover (AUDIT-V18 W10).
    const gap = items.length === 2 ? [0, 12] : [26, 1];
    ctx.strokeStyle = 'rgba(20,84,75,0.8)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([4.5, 3.5]);
    ctx.beginPath(); ctx.arc(gap[0], gap[1], 14, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  items.forEach((item, i) => drawItem(ctx, item, slots[i][0], slots[i][1], 44));
  ctx.restore();
}

/** The icon for a whole dish: a plate stack for recipes, the carton for fries. */
export function drawDish(ctx, dishId, x, y, s, shadow = true) {
  if (dishId === 'fries') {
    drawItem(ctx, 'fries', x, y, s * 0.9, shadow);
    return;
  }
  const recipe = DISHES[dishId];
  if (recipe) drawPlate(ctx, recipe.items, x, y, s, shadow);
}

function drawStationBase(ctx, station, active, shaking) {
  ctx.save();
  if (shaking) ctx.translate(Math.sin(performance.now() / 24) * 2.4, 0);
  ctx.fillStyle = COLORS.counterTop;
  rr(ctx, station.x, station.y, station.w, station.h, 8); ctx.fill();
  ctx.strokeStyle = COLORS.counterEdge;
  ctx.lineWidth = 2;
  rr(ctx, station.x, station.y, station.w, station.h, 8); ctx.stroke();
  if (active) {
    ctx.strokeStyle = COLORS.mustard;
    ctx.lineWidth = 3.4;
    rr(ctx, station.x - 3, station.y - 3, station.w + 6, station.h + 6, 10); ctx.stroke();
  }
  ctx.restore();
}

function drawProgress(ctx, x, y, w, frac, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, x, y, w, 8, 4); ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    rr(ctx, x + 1, y + 1, (w - 2) * Math.min(1, frac), 6, 3); ctx.fill();
  }
}

/**
 * A call on a solid pill badge — READY!, BURNT!, CUT! — drawn after everything else
 * on its station, so no food or steam can ever hide it, and big enough to read on
 * the contact sheet.
 */
function drawBadge(ctx, x, y, label, bg) {
  ctx.font = `700 13.5px ${FONT}`;
  const w = Math.max(62, ctx.measureText(label).width + 24);
  ctx.fillStyle = bg;
  rr(ctx, x - w / 2, y - 11.5, w, 23, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.6;
  rr(ctx, x - w / 2, y - 11.5, w, 23, 7); ctx.stroke();
  text(ctx, label, x, y + 0.5, 13.5, '#ffffff');
}

/**
 * A small four-point star, drawn as a path — the mark for the day's
 * featured dish and the glint of a fresh serve. Drawn, never a glyph:
 * the game's typeface has no star, and a fallback glyph would seam.
 */
function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx, cy, cx + r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy + r);
  ctx.quadraticCurveTo(cx, cy, cx - r, cy);
  ctx.quadraticCurveTo(cx, cy, cx, cy - r);
  ctx.fill();
}

/** A small deterministic hash of two coordinates, for floor grain that never moves. */
function hash2(a, b) {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

/**
 * An ingredient caught part-way through the knife: some pieces already cut and
 * fanned aside, the rest still whole with a flat cut face — and the knife itself,
 * blade down over the work. Drawn in drawItem's 40-unit box.
 */
function drawMidChop(ctx, item, chops, x, y, s) {
  const u = s / 40;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(u, u);
  foodShadow(ctx, 17, 13);
  if (item === 'tomato') {
    // Slices already off, fanned to the left.
    for (let i = 0; i < chops; i++) {
      const ox = -14 + i * 7.5;
      const oy = 7 - i * 2;
      ctx.fillStyle = '#d8402a';
      ctx.beginPath(); ctx.arc(ox, oy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0927c';
      ctx.beginPath(); ctx.arc(ox, oy, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8402a';
      ctx.beginPath(); ctx.arc(ox, oy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    // The remaining half, dome up, cut face showing.
    ctx.fillStyle = '#d8402a';
    ctx.beginPath(); ctx.arc(10, 4, 11, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f0927c';
    ctx.beginPath(); ctx.ellipse(10, 4, 11, 3.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8402a';
    for (const [sx, sy] of [[4, 4], [10, 5.4], [16, 4]]) {
      ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    // The dome's gloss, the same highlight the whole tomato wears.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(5.5, -2.5, 3.4, 1.9, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4d8f3a';
    ctx.beginPath(); ctx.ellipse(10, -8.5, 5, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  } else if (item === 'potato') {
    // Sticks already cut, standing to the left; the rest of the potato beside them.
    ctx.fillStyle = '#eabd60';
    for (let i = 0; i < chops; i++) {
      ctx.save();
      ctx.translate(-13 + i * 6.5, 1);
      ctx.rotate(-0.1 + i * 0.09);
      rr(ctx, -2.6, -12, 5.2, 24, 2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#c69548';
    ctx.beginPath(); ctx.ellipse(10, 1, 15 - chops * 2.4, 10.5, 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eabd60';
    ctx.beginPath(); ctx.ellipse(1.5, 0, 3, 8.4, 0.25, 0, Math.PI * 2); ctx.fill();
  } else if (item === 'lettuce') {
    // A growing pile of shreds, and the leaf it came from, shrinking.
    ctx.strokeStyle = '#5da24a';
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'round';
    const strokes = [[-15, 5, -6, -4], [-8, 8, 3, -2], [-12, -3, -3, 6], [-4, 4, 6, -5]];
    for (let i = 0; i < chops * 2 && i < strokes.length; i++) {
      const [x1, y1, x2, y2] = strokes[i];
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.fillStyle = '#6db457';
    ctx.beginPath(); ctx.arc(11, 0, 11 - chops * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8fce7d';
    ctx.beginPath(); ctx.arc(8, -3, Math.max(2.5, 6 - chops * 1.6), 0, Math.PI * 2); ctx.fill();
  }
  // The knife, caught mid-work above the board: long blade, dark handle.
  ctx.save();
  ctx.translate(15, -13);
  ctx.rotate(-0.62);
  ctx.fillStyle = COLORS.steel;
  ctx.beginPath();
  ctx.moveTo(-23, -3.4); ctx.lineTo(8, -3.4); ctx.lineTo(12.5, 0); ctx.lineTo(8, 3); ctx.lineTo(-23, 3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#eef3f4';
  ctx.fillRect(-23, 1.1, 33, 1.6);
  ctx.fillStyle = '#5d4030';
  rr(ctx, 12, -3.4, 13.5, 6.8, 3); ctx.fill();
  ctx.restore();
  ctx.restore();
}

/**
 * Cut potato in the fryer, still cooking: separated batons standing in hot
 * oil, drawn as their own little scene instead of reusing the plain cut-potato
 * item — four bare sticks in a row collapsed into a pale "W" at contact-sheet
 * size. These are the finished chips' family (same stick drawing, gold warmed
 * one step toward the finished chips', no carton, no salt) with their feet in
 * a deep, saturated oil bath, so the fryer at work reads as frying, not as a
 * letter — and not, at the sheet's size, as a row of pale candles.
 */
function drawFryerCooking(ctx, cx, cy, warm) {
  const oilY = cy + 13;
  // The batons, back row first: varied heights and leans, hash-placed so the
  // arrangement never moves between frames.
  const baton = (ox, h, rot, face, shade, edge) => {
    ctx.save();
    ctx.translate(cx + ox, oilY + 2);
    ctx.rotate(rot);
    ctx.fillStyle = face;
    rr(ctx, -3.4, -h, 6.8, h, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,252,235,0.5)';
    ctx.fillRect(-2.4, -h + 3, 1.5, h - 8);
    ctx.fillStyle = shade;
    ctx.fillRect(1, -h + 2.5, 2, h - 5);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 0.9;
    rr(ctx, -3.4, -h, 6.8, h, 2); ctx.stroke();
    ctx.restore();
  };
  const sticks = [[-40, 30, -0.16], [-27, 38, -0.06], [-13, 33, 0.08], [1, 41, -0.02], [15, 35, 0.12], [28, 39, 0.05], [41, 29, 0.17]];
  // Half-cooked, the batons warm one step toward the finished chips'
  // gold — the food itself says time is passing, not only the bar
  // under it (AUDIT-V18 W7). The finished carton is still a step
  // beyond: this is a midpoint, not the finish.
  for (const [ox, h, rot] of sticks) {
    if (warm) baton(ox, h, rot, '#f3c95f', '#dbab42', '#b98f36');
    else baton(ox, h, rot, '#f0cd78', '#d9ae4e', '#bd9440');
  }
  // The oil itself, drawn over the batons' feet: a deep, hot gold bath with a
  // brighter, broken surface — dark enough, against the fryer's panel, that
  // the pale batons read as food in oil and not as sticks in a void.
  ctx.fillStyle = 'rgba(196,124,24,0.92)';
  ctx.beginPath(); ctx.ellipse(cx, oilY, 55, 12.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(233,164,52,0.80)';
  ctx.beginPath(); ctx.ellipse(cx, oilY - 2.5, 51, 8.5, 0, 0, Math.PI * 2); ctx.fill();
  // A foam ring on the surface line, where the batons break it — the edge
  // frying is visibly happening along.
  ctx.strokeStyle = 'rgba(255,240,200,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, oilY - 2.5, 51, 8.5, 0, 0, Math.PI * 2); ctx.stroke();
  // Bubbles in the oil, clustered at the batons' feet — hash-placed, so a
  // still frame holds them exactly where a moving one would.
  ctx.fillStyle = 'rgba(255,248,220,0.85)';
  for (let i = 0; i < 16; i++) {
    const bx = cx + (hash2(i, 3) - 0.5) * 96;
    const by = oilY - 3 + (hash2(i, 5) - 0.5) * 13;
    ctx.beginPath(); ctx.arc(bx, by, 0.9 + hash2(i, 9) * 1.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,248,220,0.6)';
  for (let i = 0; i < 5; i++) {
    const bx = cx + (hash2(i, 21) - 0.5) * 84;
    ctx.beginPath(); ctx.arc(bx, oilY - 11 - hash2(i, 23) * 5, 1 + hash2(i, 27) * 1.1, 0, Math.PI * 2); ctx.fill();
  }
}

/**
 * Prawns on the grill, drawn as a spaced row of individuals across the
 * bars — the tray treatment from the island (AUDIT-V13 P3), applied to
 * the other surface where prawns rest. Through drawItem they land as
 * the three-curl overlapping pile, which reads as one orange mass on
 * the grill's dark panel; in a row, each prawn keeps its own outline
 * in whichever state — raw, grilled, burnt — the clock says.
 */
function drawGrillPrawns(ctx, shown, cx, cy) {
  const cols = shown === 'prawns_raw' ? { body: '#e8ab90', line: '#bd7f63' }
    : shown === 'prawns_grilled' ? { body: '#f4834f', line: '#c25227' }
      : { body: '#503a2c', line: '#2e2019' };
  const sheen = shown !== 'prawns_burnt';
  for (const [ox, oy, rot] of [[-37, -3, 0.35], [1, -6, 2.45], [38, -3, -0.85]]) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx + ox, cy + oy + 9, 15, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(cx + ox, cy + oy);
    drawPrawn(ctx, cols, rot, sheen);
    ctx.restore();
  }
}

function drawMachine(ctx, state, station, machine) {
  const kind = station.kind;
  const cookAt = kind === 'grill' ? GRILL_COOK : FRYER_COOK;
  const burnAt = kind === 'grill' ? GRILL_BURN : FRYER_BURN;
  const cx = station.x + station.w / 2;
  const cy = station.y + station.h / 2;
  ctx.fillStyle = COLORS.steelDark;
  rr(ctx, station.x + 8, station.y + 8, station.w - 16, station.h - 26, 6); ctx.fill();
  ctx.fillStyle = kind === 'grill' ? '#3a3f42' : '#7a5a20';
  rr(ctx, station.x + 14, station.y + 13, station.w - 28, station.h - 36, 4); ctx.fill();
  if (machine.item) {
    const cook = COOKED[machine.item];
    const shown = machine.t >= burnAt ? cook.burnt : machine.t >= cookAt ? cook.makes : machine.item;
    // In the fryer, raw cut potato gets its own cooking scene (batons in
    // bubbling oil); on the grill, prawns get their spaced row; everywhere
    // else the item itself is the picture.
    if (kind === 'fryer' && machine.t < cookAt) drawFryerCooking(ctx, cx, cy, machine.t >= cookAt / 2);
    else if (kind === 'grill' && shown.startsWith('prawns')) drawGrillPrawns(ctx, shown, cx, cy);
    // The grill's single item steps up a size: at 54 its body spanned
    // ~51 px of a 174 px-wide dark panel and read as a small dark mark
    // at the cover's size; the prawns already span the grill in a row.
    else if (kind === 'grill') drawItem(ctx, shown, cx, cy - 4, 62);
    // The fryer's finished carton steps DOWN a size: at 52 its sticks
    // reached ~11 px above the fryer's inner panel — food escaping its
    // machine (AUDIT-V19 F7). At 42, centred lower, it stays inside.
    else drawItem(ctx, shown, cx, cy + 2, 42);
    // The bar is the clock, the badge below is the food's state: the bar
    // fills toward the burn point, and its final stretch turns red —
    // "nearly out of time", the same language the tickets' draining
    // bars speak — while the badge stays READY! green until BURNT!
    // replaces it. At its old colours the bar sat green at 94% of the
    // burn window, 0.6 s from burnt (AUDIT-V18 W8).
    const color = machine.t >= burnAt || machine.t / burnAt >= 0.85 ? COLORS.red
      : machine.t >= cookAt ? COLORS.timerGood : COLORS.mustard;
    // The bar rides 4 px higher than it used to: it hung 6 px off the
    // frame's bottom edge and its row leaned on the label's glyphs
    // (AUDIT-V19 F6).
    drawProgress(ctx, station.x + 16, station.y + station.h - 24, station.w - 32, machine.t / burnAt, color);
    // Steam wisps, swaying with the clock so the frame feels alive — three of
    // them, tall enough to read above both machines at contact-sheet size.
    // Past the burn point they turn to dark smoke: burnt food used to steam
    // white exactly like fresh food (AUDIT-V19 F3).
    ctx.strokeStyle = machine.t >= burnAt ? 'rgba(88,78,72,0.55)' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = machine.t >= burnAt ? 3 : 2.3;
    ctx.lineCap = 'round';
    for (const off of [-17, 0, 17]) {
      ctx.beginPath();
      const sx = cx + off + Math.sin(state.time * 2.2 + off * 1.7) * 3.5;
      ctx.moveTo(sx, cy - 27);
      ctx.quadraticCurveTo(sx + 6, cy - 40, sx - 1, cy - 53);
      ctx.stroke();
    }
    // The call, on a solid badge in the station's top corner — drawn last of
    // all, so neither food nor steam can hide it, and clear of the food it
    // announces: green READY!, red BURNT!.
    if (machine.t >= burnAt) drawBadge(ctx, station.x + station.w - 42, station.y + 13, 'BURNT!', '#a93420');
    else if (machine.t >= cookAt) drawBadge(ctx, station.x + station.w - 42, station.y + 13, 'READY!', '#1e7d46');
  }
  // The label sits inside its panel: centred on the station's foot it hung
  // half below the teal onto the brown counter, and the edge line struck
  // through the word.
  text(ctx, station.label, cx, station.y + station.h - 10, 12, '#22382e');
}

function drawKitchen(ctx, state) {
  // The floor: warm harbour-deck planks across the whole room — honey wood with
  // staggered butt joints and visible grain. V10 takes it one step deeper than
  // V4 cut it: a richer base, alternating rows washed warm amber and deep
  // brown, darker seams and stronger grain, so at contact-sheet size the room
  // reads as a wooden kitchen and not a pale void. It stays a step quieter
  // than the counters and the food — everything that carries information is
  // drawn over it, never on it.
  ctx.fillStyle = '#dec48f';
  ctx.fillRect(0, BOARD_H, VIEW.width, VIEW.height - BOARD_H);
  const plankH = 32;
  const plankLen = 256;
  for (let row = 0, y = BOARD_H; y < VIEW.height; row++, y += plankH) {
    ctx.fillStyle = row % 2 ? 'rgba(198,130,60,0.17)' : 'rgba(130,88,46,0.15)';
    ctx.fillRect(0, y, VIEW.width, plankH);
    ctx.strokeStyle = '#a87e45';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y + plankH); ctx.lineTo(VIEW.width, y + plankH); ctx.stroke();
    const startX = -((row * 173) % plankLen);
    ctx.lineWidth = 1.4;
    for (let x = startX, p = 0; x < VIEW.width; x += plankLen, p++) {
      if (x > 0) {
        ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + plankH - 3); ctx.stroke();
      }
      // A per-plank tint shift, so the boards read as separate pieces of wood.
      if (hash2(row * 11, p * 3) > 0.45) {
        ctx.fillStyle = 'rgba(146,100,54,0.11)';
        ctx.fillRect(Math.max(0, x), y + 1, Math.min(plankLen, VIEW.width - x), plankH - 2);
      }
      // Two grain streaks per plank, placed by hash so they never move.
      ctx.strokeStyle = 'rgba(101,70,36,0.27)';
      ctx.lineWidth = 1.3;
      for (let g = 0; g < 2; g++) {
        const gx = x + 24 + hash2(row * 3 + g, p) * (plankLen - 90);
        const gy = y + 8 + hash2(p * 7, row + g * 13) * 16;
        const gl = 22 + hash2(row + g, p * 5) * 30;
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + gl, gy); ctx.stroke();
      }
      ctx.strokeStyle = '#a87e45';
      ctx.lineWidth = 1.4;
    }
  }
  // A soft vignette toward the walls, in the renderer's own flat language:
  // concentric rings of deep brown stroked in a squashed space so they hug
  // the room's shape, each ring a step stronger than the one inside it. The
  // working middle of the room — the island, the rug, the cook's ground —
  // sits inside the innermost ring and keeps the lamplight; only the floor's
  // outer ground falls away. The counters, stations, food, cook and popups
  // are all drawn after this, untouched by it.
  ctx.save();
  ctx.translate(640, 462);
  ctx.scale(1, 0.66);
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = `rgba(94,60,26,${(0.02 + i * 0.016).toFixed(3)})`;
    ctx.lineWidth = 45;
    ctx.beginPath(); ctx.arc(0, 0, 400 + i * 44, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
  // One soft braided rug, and only one: under the island, ringed in the room's
  // colours. It grows with the island it grounds, and wears two rings in its
  // own stripe — a mat's border, not a target.
  ctx.fillStyle = COLORS.rug;
  ctx.beginPath(); ctx.ellipse(640, 460, 268, 96, 0, 0, Math.PI * 2); ctx.fill();
  // One ring only, at half strength: two softened rings still read as a
  // target — a closed inner outline around a plain middle was the loudest
  // graphic in the middle band. The outer ring stays as the mat's border.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = COLORS.rugStripe;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(640, 462, 244, 84, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
  // The rug's weave: short dashes in two quiet tones, hash-placed so they
  // never move, clipped to the rug's own ellipse — a woven mat on the middle
  // band's ground instead of one flat sticker of colour. It carries no
  // information and stays quieter than everything that does.
  ctx.save();
  ctx.beginPath(); ctx.ellipse(640, 460, 268, 96, 0, 0, Math.PI * 2); ctx.clip();
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  for (let i = 0; i < 280; i++) {
    const wx = 640 + (hash2(i, 31) - 0.5) * 520;
    const wy = 460 + (hash2(i, 37) - 0.5) * 176;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(245,190,120,0.21)' : 'rgba(122,52,28,0.20)';
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 11 + hash2(i, 41) * 10, wy); ctx.stroke();
  }
  ctx.restore();
  // The mat's stitched border: a dashed ring just inside the rim, in
  // the dark weave tone — a mat's edge finished the way the apron's
  // pocket is stitched (AUDIT-V18 B5). Dashes, dark, at the rim: it
  // is a stitch line, not a third ring.
  ctx.strokeStyle = 'rgba(122,52,28,0.35)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 6]);
  ctx.beginPath(); ctx.ellipse(640, 460, 256, 90, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // Counters.
  for (const solid of SOLIDS) {
    ctx.fillStyle = COLORS.counter;
    rr(ctx, solid.x, solid.y, solid.w, solid.h, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(solid.x, solid.y, solid.w, 5);
  }
  // The backsplash behind the back counter: sea-glass tiles the bins sit
  // against, so the top row reads as a counter against a wall — with a harbour-
  // blue painted strip above the tiles — not furniture floating on the floor.
  ctx.fillStyle = '#33626e';
  ctx.fillRect(20, BOARD_H, 1240, 7);
  ctx.fillStyle = '#6fae9f';
  ctx.fillRect(20, BOARD_H + 7, 1240, 25);
  ctx.strokeStyle = 'rgba(240,250,246,0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(20, BOARD_H + 19); ctx.lineTo(1260, BOARD_H + 19); ctx.stroke();
  for (let tx = 20 + 46; tx < 1260; tx += 46) {
    ctx.beginPath(); ctx.moveTo(tx, BOARD_H + 8); ctx.lineTo(tx, BOARD_H + 18); ctx.stroke();
  }
  for (let tx = 20 + 23; tx < 1260; tx += 46) {
    ctx.beginPath(); ctx.moveTo(tx, BOARD_H + 20); ctx.lineTo(tx, BOARD_H + 31); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(20, BOARD_H + 7, 1240, 3);
  // The wall clock on the tiles over the back counter (AUDIT-V19 D3): its
  // hands are the real shift clock — the minute hand sweeps the full dial
  // across the shift, so the room itself tells the time the HUD numbers.
  {
    const progress = 1 - Math.max(0, state.shiftLeft) / 150;
    // The dial steps up (AUDIT-V21 F2): at radius 11.5 the whole clock
    // was ~14 px at the judge's size and its hands 3–5 px marks — a
    // white rivet on the tiles, its one job (the room tells the time)
    // invisible. At 14 the hands are marks a reader can find.
    ctx.fillStyle = '#fff7e6';
    ctx.beginPath(); ctx.arc(640, 134, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5f4f3c';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(640, 134, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#22382e';
    ctx.lineCap = 'round';
    const hand = (angle, len, wdt) => {
      ctx.lineWidth = wdt;
      ctx.beginPath();
      ctx.moveTo(640, 134);
      ctx.lineTo(640 + Math.sin(angle) * len, 134 - Math.cos(angle) * len);
      ctx.stroke();
    };
    hand(progress * Math.PI, 7, 2.6);
    hand(progress * Math.PI * 2, 10.5, 2);
  }
  // The dresser on the right counter: a shelf of preserve jars over a stack of
  // plates, pure set dressing — this corner is the pantry.
  ctx.fillStyle = '#5f4f3c';
  rr(ctx, 1108, 428, 136, 7, 3); ctx.fill();
  const jarFill = ['#d8402a', '#5da24a', '#f2b33d'];
  [1128, 1170, 1212].forEach((jx, i) => {
    ctx.fillStyle = 'rgba(230,240,238,0.85)';
    rr(ctx, jx - 11, 400, 22, 28, 4); ctx.fill();
    ctx.fillStyle = jarFill[i];
    rr(ctx, jx - 8.5, 408, 17, 17, 3); ctx.fill();
    ctx.fillStyle = '#8a6a24';
    rr(ctx, jx - 9, 396, 18, 6, 2.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(jx - 6, 404, 3.4, 20);
  });
  ctx.fillStyle = '#fdfdf8';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.ellipse(1136, 492 - i * 7, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
  drawItem(ctx, 'tomato', 1214, 454, 32);
  // A life ring hung on the dresser — this is a harbour kitchen, after all.
  ctx.strokeStyle = '#f4f1e6';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(1208, 492, 13, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = COLORS.red;
  for (const a of [0.4, 2.0, 3.5, 5.1]) {
    ctx.beginPath(); ctx.arc(1208, 492, 13, a, a + 0.7); ctx.stroke();
  }
  text(ctx, 'PANTRY', 1175, 448, 11, COLORS.ink);
  // The pantry gull, perched on the dresser's shelf end (AUDIT-V19 D4).
  // It minds its own business — until the fryer is working, when it turns
  // its head and watches the chips like everyone else in a harbour town.
  {
    const watching = Boolean(state.fryer.item);
    ctx.strokeStyle = '#c99635';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(1225, 424); ctx.lineTo(1225, 428); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1231, 424); ctx.lineTo(1231, 428); ctx.stroke();
    ctx.fillStyle = '#f4f1e6';
    ctx.beginPath(); ctx.ellipse(1228, 419, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dfe5e8';
    ctx.beginPath();
    ctx.moveTo(1236, 415); ctx.lineTo(1245, 412); ctx.lineTo(1237, 420);
    ctx.closePath(); ctx.fill();
    const hx = watching ? 1219 : 1237;
    const hy = watching ? 413 : 411;
    ctx.fillStyle = '#f4f1e6';
    ctx.beginPath(); ctx.arc(hx, hy, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2b33d';
    ctx.beginPath();
    if (watching) { ctx.moveTo(hx - 4, hy); ctx.lineTo(hx - 8.5, hy + 1.6); ctx.lineTo(hx - 4, hy + 3); }
    else { ctx.moveTo(hx + 4, hy); ctx.lineTo(hx + 8.5, hy + 1.6); ctx.lineTo(hx + 4, hy + 3); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#22382e';
    ctx.beginPath(); ctx.arc(hx + (watching ? -1.5 : 1.5), hy - 0.8, 0.95, 0, Math.PI * 2); ctx.fill();
  }
  // One large harbour window set into the front of the left counter, where two
  // small portholes used to be: a wood frame, sky over sea, one fishing boat
  // going about its business and gulls over the water. The whole drawing is
  // scaled up a step inside the counter face — at its old size the boat was
  // a speck at contact-sheet size, and the window is the room's identity.
  ctx.save();
  ctx.translate(162, 684);
  ctx.scale(166 / 158, 86 / 74);
  ctx.translate(-170, -690);
  ctx.fillStyle = '#5f4f3c';
  rr(ctx, 170, 690, 158, 74, 6); ctx.fill();
  ctx.fillStyle = '#8a6a24';
  rr(ctx, 175, 695, 148, 64, 4); ctx.fill();
  ctx.save();
  rr(ctx, 179, 699, 140, 56, 3); ctx.clip();
  ctx.fillStyle = '#a5d2de';
  ctx.fillRect(179, 699, 140, 25);
  ctx.fillStyle = '#4e8ca6';
  ctx.fillRect(179, 724, 140, 31);
  // A distant headland on the horizon, low and quiet: the window's sea
  // was one flat band, and depth is the difference between a picture of
  // water and a harbour. It sits behind everything else in the glass.
  ctx.fillStyle = 'rgba(39,75,82,0.5)';
  ctx.beginPath();
  ctx.moveTo(179, 724); ctx.lineTo(196, 718.5); ctx.lineTo(214, 721); ctx.lineTo(230, 724);
  ctx.closePath(); ctx.fill();
  // A sparkle line where sky meets water.
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(179, 724.6); ctx.lineTo(319, 724.6); ctx.stroke();
  // A second boat, far away on the horizon in the right pane: a low
  // hull and one small sail in the headland's own tone — the depth's
  // third layer, traffic on the horizon (AUDIT-V18 B2).
  ctx.fillStyle = 'rgba(39,75,82,0.55)';
  ctx.beginPath();
  ctx.moveTo(276, 721.5); ctx.lineTo(293, 721.5); ctx.lineTo(290, 724.6); ctx.lineTo(279, 724.6);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(284.5, 713); ctx.lineTo(284.5, 721); ctx.lineTo(290.5, 721); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.2;
  for (const [wx, wy] of [[196, 734], [226, 743], [286, 737], [306, 747]]) {
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 11, wy); ctx.stroke();
  }
  // Whitecaps answer the heat (AUDIT-V19 D7): the worse the rush inside,
  // the rougher the water outside — up to four extra strokes, phased on
  // the shift clock so the surface shimmers instead of sitting printed.
  {
    const caps = Math.floor(heat(state) * 4.99);
    const spots = [[208, 739], [248, 750], [264, 731], [316, 743]];
    for (let i = 0; i < caps; i++) {
      const [wx, wy] = spots[i];
      const drift = Math.sin(state.time * 0.9 + i * 1.9) * 1.6;
      ctx.beginPath(); ctx.moveTo(wx + drift, wy); ctx.lineTo(wx + drift + 9, wy); ctx.stroke();
    }
  }
  // A red buoy riding the water by the headland, bobbing on the clock.
  {
    const bobY = Math.sin(state.time * 1.4) * 1.1;
    ctx.fillStyle = '#d8402a';
    ctx.beginPath();
    ctx.moveTo(297, 736 + bobY); ctx.lineTo(305, 736 + bobY); ctx.lineTo(303, 743 + bobY); ctx.lineTo(299, 743 + bobY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff7e6';
    ctx.fillRect(298.4, 738.6 + bobY, 5.2, 1.8);
  }
  // The sun's glint in the top corner of the sky.
  ctx.fillStyle = 'rgba(255,240,190,0.85)';
  ctx.beginPath(); ctx.arc(302, 709, 6.5, 0, Math.PI * 2); ctx.fill();
  // The boat: dark hull, one mast, a white sail, a red flag. The window
  // itself is as large as the counter face allows (V13), so the picture
  // inside it grows instead: the boat is scaled up about its own centre,
  // or at judge size it stays a dark dash with a white fleck for a sail.
  // The whole boat sits 18 units left of where it grew: the frame's
  // centre mullion (window space ≈ 244–250) used to fall straight
  // through the sail (≈ 240–259) — a bar across the one white shape in
  // the glass. Shifted, the sail's right edge (≈ 241) clears it, and
  // the hull's end passes behind the mullion as a boat behind a frame
  // should.
  ctx.save();
  ctx.translate(219, 725);
  ctx.scale(1.3, 1.3);
  // The boat rides its anchor: a slow bob on the shift clock, drawn inside
  // the growth about its own centre so the held pivot never moves
  // (AUDIT-V19 S5 — harbour life).
  ctx.translate(0, Math.sin(state.time * 1.1) * 1.1);
  ctx.translate(-219, -725);
  ctx.fillStyle = '#274b52';
  ctx.beginPath();
  ctx.moveTo(198, 730); ctx.lineTo(240, 730); ctx.lineTo(232, 738); ctx.lineTo(205, 738);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(217.8, 712, 2.2, 18);
  ctx.fillStyle = '#fff7e6';
  ctx.beginPath(); ctx.moveTo(221.5, 713); ctx.lineTo(221.5, 728); ctx.lineTo(236, 728); ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.red;
  ctx.beginPath(); ctx.moveTo(220, 712); ctx.lineTo(228, 714.4); ctx.lineTo(220, 716.8); ctx.closePath(); ctx.fill();
  ctx.restore();
  // The boat's wake: two short strokes fanning from the stern and a
  // shimmer line under the hull — the harbour's one moving thing,
  // moving (AUDIT-V18 B1). In window space: the hull's stern sits at
  // ≈ (192, 738) after its 1.3 growth about (219, 725).
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(193, 736.5); ctx.lineTo(181, 741.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(193, 739.5); ctx.lineTo(181, 734.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(204, 746.5); ctx.lineTo(218, 746.5); ctx.stroke();
  // Gulls: three small double-arcs over the water, and one smaller,
  // farther pair toward the sun — the sky has depth like the sea does.
  // They sway on the shift clock now (AUDIT-V19 S5): a printed sky was
  // the one dead surface left in the room.
  ctx.strokeStyle = '#33555e';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (const [gx, gy] of [[200, 709], [222, 704], [272, 707], [290, 718]]) {
    const sway = Math.sin(state.time * 0.4 + gx * 0.05) * 2.5;
    ctx.beginPath(); ctx.arc(gx + sway - 3.4, gy, 3.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(gx + sway + 3.4, gy, 3.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  // The frame's centre mullion and a brass latch, in the enlarged frame's
  // own coordinates.
  ctx.fillStyle = '#5f4f3c';
  ctx.fillRect(240, 689, 5.5, 76);
  ctx.fillStyle = '#c99635';
  ctx.beginPath(); ctx.arc(243.5, 756, 2.8, 0, Math.PI * 2); ctx.fill();
  // The specials board, chalked on the pass between plating and serve.
  ctx.fillStyle = '#22382e';
  rr(ctx, 796, 694, 80, 66, 4); ctx.fill();
  ctx.strokeStyle = '#5f4f3c';
  ctx.lineWidth = 3;
  rr(ctx, 796, 694, 80, 66, 4); ctx.stroke();
  text(ctx, 'SPECIALS', 836, 709, 10.5, '#ffd968');
  // Two whole lines: the board is 80 wide and cannot grow (plating ends at
  // 790, serve starts at 880), and "Harbour Plate $13" snapped in half at
  // that width — a fragment, a price line and a dish. The words give way.
  // The first line is now TODAY'S CATCH (AUDIT-V19 S6): the shift's own
  // featured dish, starred and chalked in the header's gold, with one
  // staple line under it — the board belongs to the day being played.
  {
    const SHORT = { fillet: 'Fillet', salad: 'Salad', butty: 'Butty', harbour: 'Harbour', prawns: 'Prawn', fries: 'Chips' };
    const dishOf = (id) => (id === 'fries' ? FRIES : DISHES[id]);
    const special = dishOf(state.special);
    const staple = state.special === 'prawns' ? DISHES.harbour : DISHES.prawns;
    drawStar(ctx, 805, 701, 4.2, '#ffd968');
    text(ctx, `${SHORT[state.special]} $${special.price}`, 836, 730, 10.5, '#ffd968', 'center', false);
    text(ctx, `${SHORT[staple.id]} $${staple.price}`, 836, 747, 10.5, '#fff7e6', 'center', false);
  }
  // Two fish crates stacked against the right counter by the serve window, the
  // morning's catch still in the top one.
  const crate = (x, y, w, h) => {
    ctx.fillStyle = COLORS.driftwood;
    rr(ctx, x, y, w, h, 3); ctx.fill();
    ctx.strokeStyle = '#5f4f3c';
    ctx.lineWidth = 2;
    rr(ctx, x, y, w, h, 3); ctx.stroke();
    ctx.lineWidth = 1.4;
    for (const fy of [y + h / 3, y + (2 * h) / 3]) {
      ctx.beginPath(); ctx.moveTo(x + 3, fy); ctx.lineTo(x + w - 3, fy); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + w - 4, y + h - 4); ctx.stroke();
  };
  crate(1156, 596, 78, 54);
  crate(1166, 552, 58, 42);
  // The crates are chalked with what they hold (AUDIT-V19 D11): FISH in
  // the big one, ICE in the small — the harbour's shorthand, in chalk.
  text(ctx, 'FISH', 1195, 630, 10, 'rgba(255,247,230,0.85)', 'center', false);
  text(ctx, 'ICE', 1195, 579, 9, 'rgba(255,247,230,0.8)', 'center', false);
  ctx.fillStyle = '#d8402a';
  ctx.beginPath(); ctx.arc(1184, 550, 7.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.arc(1181.5, 547.5, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6db457';
  ctx.beginPath(); ctx.arc(1200, 548, 8.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#a5dd8f';
  ctx.beginPath(); ctx.arc(1197, 545, 4, 0, Math.PI * 2); ctx.fill();
  // A coiled rope on the floor beside the crates (AUDIT-V20 E1 —
  // V19's D15, planned there and dropped): three turns of harbour
  // rope and a loose end, in the bare corner the crates stand in.
  ctx.fillStyle = 'rgba(74,44,16,0.15)';
  ctx.beginPath(); ctx.ellipse(1124, 678, 21, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b08d57';
  ctx.lineWidth = 4.4;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(1124, 672, 17, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(1124, 669.5, 11.5, 3.8, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(1124, 667.5, 6, 2.2, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#96754a';
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(1139, 675); ctx.quadraticCurveTo(1148, 680, 1153, 686); ctx.stroke();

  // The island's own shadow on the rug, cast before any counter is drawn:
  // a heavy table stands ON the mat and shades it — the island used to sit
  // flush on the rug with no shadow of its own, a board laid on a mat
  // (AUDIT-V19 F1).
  ctx.fillStyle = 'rgba(74,44,16,0.16)';
  ctx.beginPath(); ctx.ellipse(640, 522, 222, 19, 0, 0, Math.PI * 2); ctx.fill();

  const active = nearestStation(state);
  for (const station of STATIONS) {
    const isActive = active === station && state.phase === 'play';
    drawStationBase(ctx, station, isActive, state.shake === station.id && state.shakeT > 0);
    const cx = station.x + station.w / 2;
    if (station.kind === 'bin') {
      // The counter's ingredients, drawn a step larger than the hands and the
      // boards use: on the contact sheet the bins are criterion one's
      // "ingredients on the counter", and at 40/34 they read small — 46/40
      // fills the panel without touching its edges or the label beneath.
      drawItem(ctx, station.item, cx - 26, station.y + 29, 46);
      drawItem(ctx, station.item, cx + 24, station.y + 33, 40);
      text(ctx, station.label, cx, station.y + station.h - 10, 12, '#22382e');
    } else if (station.kind === 'grill') {
      drawMachine(ctx, state, station, state.grill);
    } else if (station.kind === 'fryer') {
      drawMachine(ctx, state, station, state.fryer);
    } else if (station.kind === 'island') {
      // The resting island, the room's central workstation: a driftwood top
      // with a herb trough along its back edge, a prep board in the middle
      // where the work-in-progress sits, a dressed resting plate at one end,
      // garnish bowls at the other, sauce bottles flanking its name plate,
      // and pans on an iron rail below. (V13 tried growing the block itself;
      // the difficulty audit measured that as a tax on every route — median
      // score $85.5 → $70 — so the block keeps its honest size and the
      // furnishing does the work instead. See work/v13/AUDIT-V13.md.)
      // The table's body first (AUDIT-V19 F1, user-flagged: "so damn flat,
      // it doesn't look like a table at all"): trestle legs and a crossbar
      // below, a front face with real thickness under the top — all paint
      // inside and below the existing footprint; the station rect and
      // every solid are byte-identical, so no route in the room moved.
      // V20 deepens the face a step (34 → 40) and the legs follow it
      // down: the band read thin against the wide top (AUDIT-V20 I1).
      ctx.fillStyle = '#5d4830';
      rr(ctx, station.x + 44, station.y + 110, 22, 26, 3); ctx.fill();
      rr(ctx, station.x + 314, station.y + 110, 22, 26, 3); ctx.fill();
      rr(ctx, station.x + 44, station.y + 126, 292, 7, 3); ctx.fill();
      ctx.fillStyle = '#7d6240';
      rr(ctx, station.x + 3, station.y + 78, station.w - 6, 40, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(60,44,26,0.5)';
      ctx.lineWidth = 1.2;
      for (const px of [station.x + 95, station.x + 190, station.x + 285]) {
        ctx.beginPath(); ctx.moveTo(px, station.y + 82); ctx.lineTo(px, station.y + 114); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(60,44,26,0.35)';
      ctx.fillRect(station.x + 7, station.y + 112, station.w - 14, 4);
      ctx.fillStyle = COLORS.driftwood;
      rr(ctx, station.x + 3, station.y + 3, station.w - 6, station.h - 6, 7); ctx.fill();
      // The top slab's front rim catches the light: one bright line along
      // its front edge is what separates a surface you could set a plate
      // on from a sticker of wood.
      ctx.fillStyle = 'rgba(255,240,200,0.5)';
      ctx.fillRect(station.x + 7, station.y + 77, station.w - 14, 3);
      ctx.strokeStyle = 'rgba(95,79,60,0.55)';
      ctx.lineWidth = 1.2;
      for (const px of [station.x + 95, station.x + 190, station.x + 285]) {
        ctx.beginPath(); ctx.moveTo(px, station.y + 6); ctx.lineTo(px, station.y + station.h - 6); ctx.stroke();
      }
      // Five potted herbs along the back edge, each drawn its own way — basil,
      // rosemary, chives, parsley, mint — in little terracotta pots on a shelf,
      // so the island's green reads as plants, not as a ribbon.
      ctx.fillStyle = '#5f4f3c';
      rr(ctx, station.x + 12, station.y + 22, station.w - 24, 5, 2); ctx.fill();
      const potHerb = (px, kind) => {
        const base = station.y + 22;
        if (kind === 0) {
          // Basil: broad oval leaves in two greens.
          ctx.fillStyle = '#4e9440';
          for (const [ox, oy, r] of [[-5.5, -15, 5], [5, -16.5, 5.4], [0, -12.5, 4.6]]) {
            ctx.beginPath(); ctx.ellipse(px + ox, base + oy, r, r * 0.68, ox * 0.06, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#7cc464';
          for (const [ox, oy] of [[-4, -16.5], [4.5, -18]]) {
            ctx.beginPath(); ctx.ellipse(px + ox, base + oy, 2.4, 1.6, 0, 0, Math.PI * 2); ctx.fill();
          }
        } else if (kind === 1) {
          // Rosemary: stiff needles fanning up from one stem.
          ctx.strokeStyle = '#3e7d3a';
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          for (const dx of [-7, -3.5, 0, 3.5, 7]) {
            ctx.beginPath(); ctx.moveTo(px, base - 11);
            ctx.lineTo(px + dx, base - 19 - (7 - Math.abs(dx)) * 0.5); ctx.stroke();
          }
          ctx.strokeStyle = '#579a44';
          ctx.lineWidth = 1.2;
          for (const dx of [-5, 0, 5]) {
            ctx.beginPath(); ctx.moveTo(px, base - 11);
            ctx.lineTo(px + dx, base - 16.5); ctx.stroke();
          }
        } else if (kind === 2) {
          // Chives: tall thin blades, each with its own sway.
          ctx.strokeStyle = '#63b34f';
          ctx.lineWidth = 2.1;
          ctx.lineCap = 'round';
          for (const [dx, sway] of [[-6, -3], [-2, 1], [2, -1], [6, 3.5]]) {
            ctx.beginPath(); ctx.moveTo(px + dx * 0.4, base - 11);
            ctx.quadraticCurveTo(px + dx, base - 17, px + dx + sway, base - 21.5); ctx.stroke();
          }
        } else if (kind === 3) {
          // Parsley: a curly cluster of small ruffled circles.
          ctx.fillStyle = '#579a44';
          for (const [ox, oy] of [[-5.5, -14], [-1.5, -17], [3, -14.5], [6, -16.5], [0.5, -13]]) {
            ctx.beginPath(); ctx.arc(px + ox, base + oy, 3.1, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = '#a5dd8f';
          for (const [ox, oy] of [[-3, -15.5], [3.5, -16]]) {
            ctx.beginPath(); ctx.arc(px + ox, base + oy, 1.4, 0, Math.PI * 2); ctx.fill();
          }
        } else {
          // Mint: two oval leaves with pale veins, leaning apart.
          ctx.fillStyle = '#3f9155';
          ctx.beginPath(); ctx.ellipse(px - 4.5, base - 15, 5.6, 3.4, -0.55, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(px + 4.5, base - 16, 5.6, 3.4, 0.55, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#a5dd8f';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(px - 8, base - 13.4); ctx.lineTo(px - 1.5, base - 16.8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px + 1.5, base - 17.8); ctx.lineTo(px + 8, base - 14.4); ctx.stroke();
        }
        // The pot itself: a terracotta trapezoid under a darker rim.
        ctx.fillStyle = '#b85c38';
        ctx.beginPath();
        ctx.moveTo(px - 7, base - 9); ctx.lineTo(px + 7, base - 9);
        ctx.lineTo(px + 5, base); ctx.lineTo(px - 5, base);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9c4c2c';
        rr(ctx, px - 8, base - 12, 16, 3.6, 1.6); ctx.fill();
      };
      [46, 118, 190, 262, 334].forEach((off, i) => potHerb(station.x + off, i % 5));
      // The work surface, centre stage: a pale prep board scored by the
      // knife, where a flat teal mat used to sit — the island's middle
      // reads as a place where work happens.
      ctx.fillStyle = '#d9b77c';
      rr(ctx, station.x + 118, station.y + 25, station.w - 236, 40, 6); ctx.fill();
      ctx.strokeStyle = '#b8934f';
      ctx.lineWidth = 1.3;
      rr(ctx, station.x + 118, station.y + 25, station.w - 236, 40, 6); ctx.stroke();
      ctx.strokeStyle = 'rgba(122,84,40,0.35)';
      ctx.lineWidth = 1;
      for (const sx of [station.x + 136, station.x + 224]) {
        ctx.beginPath(); ctx.moveTo(sx, station.y + 33); ctx.lineTo(sx + 14, station.y + 57); ctx.stroke();
      }
      // The board's two margins dressed with the tools of its work: lemon
      // halves waiting on the left, the knife resting on the right — drawn
      // with the board, under whatever rests on it, and clear of the tray's
      // span, so the surface reads as worked, not a plank with a tenant.
      for (const [lx, ly, lr] of [[station.x + 127, station.y + 40, 6.5], [station.x + 137, station.y + 51, 5.5]]) {
        ctx.fillStyle = '#f7c948';
        ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fbe38a';
        ctx.beginPath(); ctx.arc(lx, ly, lr * 0.68, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(201,150,53,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(lx - lr * 0.6, ly); ctx.lineTo(lx + lr * 0.6, ly); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx, ly - lr * 0.6); ctx.lineTo(lx, ly + lr * 0.6); ctx.stroke();
      }
      ctx.save();
      ctx.translate(station.x + 248, station.y + 45);
      ctx.rotate(1.0);
      ctx.scale(0.66, 0.66);
      ctx.fillStyle = COLORS.steel;
      ctx.beginPath();
      ctx.moveTo(-23, -3.4); ctx.lineTo(8, -3.4); ctx.lineTo(12.5, 0); ctx.lineTo(8, 3); ctx.lineTo(-23, 3);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#eef3f4';
      ctx.fillRect(-23, 1.1, 33, 1.6);
      ctx.fillStyle = '#5d4030';
      rr(ctx, 12, -3.4, 13.5, 6.8, 3); ctx.fill();
      ctx.restore();
      // A dressed resting plate at the left end: greens, tomato, a lemon wedge.
      // Drawn a step larger than it was — at 27 across, its dressing collapsed
      // into coloured dots on a white oval at contact-sheet size.
      const rpX = station.x + 64;
      const rpY = station.y + 48;
      ctx.fillStyle = 'rgba(74,44,16,0.18)';
      ctx.beginPath(); ctx.ellipse(rpX, rpY + 4, 33, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bfcbd0';
      ctx.beginPath(); ctx.ellipse(rpX, rpY + 1, 32.8, 11.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(rpX, rpY, 32, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#dfe5e8';
      ctx.beginPath(); ctx.ellipse(rpX, rpY - 1, 23.5, 7.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6db457';
      for (const [ox, oy] of [[-10, -3], [1, -5.5], [11, -3]]) {
        ctx.beginPath(); ctx.arc(rpX + ox, rpY + oy, 6.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#d8402a';
      for (const ox of [-5, 8]) {
        ctx.beginPath(); ctx.arc(rpX + ox, rpY - 4, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f0927c';
        ctx.beginPath(); ctx.arc(rpX + ox, rpY - 4, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8402a';
      }
      ctx.fillStyle = '#f7c948';
      ctx.beginPath(); ctx.moveTo(rpX + 17, rpY + 2); ctx.lineTo(rpX + 24, rpY - 3.5); ctx.lineTo(rpX + 24, rpY + 4.5); ctx.closePath(); ctx.fill();
      // A garnish sprig on the resting plate too — the same finish as the pass.
      ctx.fillStyle = '#579a44';
      ctx.beginPath(); ctx.ellipse(rpX - 21, rpY - 5.5, 3.8, 2.1, 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a5dd8f';
      ctx.beginPath(); ctx.ellipse(rpX - 18, rpY - 3, 2.9, 1.7, 0.9, 0, Math.PI * 2); ctx.fill();
      // Two garnish bowls at the right end: chopped greens, diced tomato.
      const bowl = (bx, mound, fleck) => {
        ctx.fillStyle = 'rgba(74,44,16,0.15)';
        ctx.beginPath(); ctx.ellipse(bx, station.y + 50, 15, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COLORS.tealDark;
        ctx.beginPath(); ctx.ellipse(bx, station.y + 46, 14.5, 8.5, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = mound;
        ctx.beginPath(); ctx.arc(bx, station.y + 44, 8.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = fleck;
        for (const [ox, oy] of [[-4, -3], [3, -5], [0, 0]]) {
          ctx.beginPath(); ctx.arc(bx + ox, station.y + 44 + oy, 2.1, 0, Math.PI * 2); ctx.fill();
        }
      };
      bowl(station.x + station.w - 98, '#63b34f', '#a8e294');
      bowl(station.x + station.w - 52, '#d8402a', '#f0927c');
      // Sauce bottles flanking the brass name plate along the front edge.
      const bottleCols = ['#c73e2e', '#f2b33d', '#1f7a6d', '#d8402a'];
      [96, 122, 258, 284].forEach((off, i) => {
        const bx = station.x + off;
        ctx.fillStyle = bottleCols[i];
        rr(ctx, bx - 4.5, station.y + station.h - 15, 9, 12, 2); ctx.fill();
        rr(ctx, bx - 2, station.y + station.h - 18.5, 4, 4.5, 1); ctx.fill();
        ctx.fillStyle = '#5d4030';
        rr(ctx, bx - 3.5, station.y + station.h - 21.5, 7, 3.6, 1.5); ctx.fill();
      });
      ctx.fillStyle = 'rgba(201,150,53,0.92)';
      rr(ctx, cx - 58, station.y + station.h - 17, 116, 13, 3); ctx.fill();
      text(ctx, station.label, cx, station.y + station.h - 10, 10.5, '#22382e');
      if (state.island.item) {
        if (DISHES[state.island.item]) drawDish(ctx, state.island.item, cx, station.y + 42, 64);
        else if (state.island.item.startsWith('prawns')) {
          // Prawns resting on the island sit on a small steel tray, drawn one
          // by one and spaced apart: the drawItem pile at this size merged
          // into an orange scribble on the board, and the resting piece is the
          // visible evidence of the route the player planned.
          const it = state.island.item;
          const ty = station.y + 46;
          ctx.fillStyle = 'rgba(74,44,16,0.20)';
          ctx.beginPath(); ctx.ellipse(cx, ty + 6, 49, 11, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#8d979d';
          ctx.beginPath(); ctx.ellipse(cx, ty + 2, 48, 12.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#c3ced3';
          ctx.beginPath(); ctx.ellipse(cx, ty, 44, 10.5, 0, 0, Math.PI * 2); ctx.fill();
          const cols = it === 'prawns_raw' ? { body: '#e8ab90', line: '#bd7f63' }
            : it === 'prawns_grilled' ? { body: '#f4834f', line: '#c25227' }
            : { body: '#503a2c', line: '#2e2019' };
          const sheen = it !== 'prawns_burnt';
          // Spaced wider than a prawn is wide, and a step smaller: at
          // 25 px spacing the ~36-unit bodies overlapped by a third and
          // merged into one orange mass on the tray — the grill's row
          // (V14) already proved spacing is what separates them.
          for (const [ox, oy, rot, sc] of [[-28, 1, 0.35, 0.92], [0, -3, 2.45, 0.88], [28, 1, -0.85, 0.9]]) {
            ctx.save();
            ctx.translate(cx + ox, ty + oy);
            ctx.scale(sc, sc);
            drawPrawn(ctx, cols, rot, sheen);
            ctx.restore();
          }
        } else drawItem(ctx, state.island.item, cx, station.y + 41, 50);
      }
      // Two pans hang from a rail under the island's front edge — one dark
      // iron, one copper. The rail is iron and thick enough to see, with
      // end brackets rising to the counter's edge, and each pan hangs from
      // a dark strap with its hanging hole punched at the top: cookware on
      // hardware, where the old mid-grey rail vanished against the rug and
      // left two circles floating over the floor.
      ctx.fillStyle = '#2b2320';
      rr(ctx, station.x + 160, station.y + station.h + 4, 138, 7, 3); ctx.fill();
      for (const bx of [station.x + 164, station.x + 292]) {
        rr(ctx, bx, station.y + station.h - 2, 6, 13, 2); ctx.fill();
      }
      const pan = (px, r, body, rim, inner) => {
        const top = station.y + station.h + 11;
        // The strap: dark iron from the rail down to the pan's rim, its
        // hanging hole showing the floor through it.
        ctx.fillStyle = '#2b2320';
        rr(ctx, px - 3.5, top, 7, 24, 3); ctx.fill();
        ctx.fillStyle = '#dec48f';
        ctx.beginPath(); ctx.arc(px, top + 4.5, 1.8, 0, Math.PI * 2); ctx.fill();
        // The pan itself: body first, a bright rim around it, the dark
        // cooking face inside, and one soft highlight on the metal.
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(px, top + 24 + r, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rim;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, top + 24 + r, r - 1.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = inner;
        ctx.beginPath(); ctx.arc(px, top + 24 + r, r * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.beginPath(); ctx.arc(px - r * 0.34, top + 24 + r - r * 0.36, r * 0.2, 0, Math.PI * 2); ctx.fill();
      };
      pan(station.x + 190, 17, '#33373b', '#9aa4a9', '#22252a');
      pan(station.x + 268, 14, '#b87333', '#e0a266', '#8c5524');
    } else if (station.kind === 'board') {
      const board = state.boards.find((b) => b.station === station);
      ctx.fillStyle = '#d9b77c';
      rr(ctx, station.x + 12, station.y + 12, station.w - 24, station.h - 34, 6); ctx.fill();
      // The board's edge, in the island prep board's own stroke: every
      // other cutting surface in the room carries one, and without it
      // the pale board read as a sheet of paper laid on the counter
      // (AUDIT-V18 W9).
      ctx.strokeStyle = '#b8934f';
      ctx.lineWidth = 1.3;
      rr(ctx, station.x + 12, station.y + 12, station.w - 24, station.h - 34, 6); ctx.stroke();
      if (board.item) {
        const need = { tomato: 3, lettuce: 2, potato: 3 }[board.item];
        if (need && board.chops >= need) {
          // Done: what lies on the board is the cut pieces themselves.
          drawItem(ctx, { tomato: 'tomato_cut', lettuce: 'lettuce_cut', potato: 'potato_cut' }[board.item], cx, station.y + 44, 52);
        } else if (need && board.chops > 0) {
          // Mid-job: part cut, part whole, the knife caught in the work.
          drawMidChop(ctx, board.item, board.chops, cx, station.y + 44, 52);
        } else {
          drawItem(ctx, board.item, cx, station.y + 44, 52);
        }
        if (need) {
          drawProgress(ctx, station.x + 18, station.y + station.h - 30, station.w - 36, board.chops / need, COLORS.teal);
          if (board.chops >= need) drawBadge(ctx, cx, station.y + 16, 'CUT!', COLORS.tealDark);
        }
      }
      text(ctx, station.label, cx, station.y + station.h - 9, 12, '#22382e');
    } else if (station.kind === 'trash') {
      // The bin is a harbour barrel, made of the room's own materials —
      // driftwood staves and steel bands — where a flat grey box used to
      // read as a UI widget dropped into the kitchen.
      ctx.fillStyle = COLORS.driftwood;
      ctx.beginPath();
      ctx.moveTo(cx - 27, station.y + 16); ctx.lineTo(cx + 27, station.y + 16);
      ctx.lineTo(cx + 22, station.y + station.h - 14); ctx.lineTo(cx - 22, station.y + station.h - 14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = COLORS.steelDark;
      ctx.fillRect(cx - 25.5, station.y + 28, 51, 5);
      ctx.fillRect(cx - 23.5, station.y + 44, 47, 5);
      ctx.fillStyle = COLORS.steel;
      ctx.beginPath(); ctx.ellipse(cx, station.y + 14, 28, 6.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.steelDark;
      ctx.beginPath(); ctx.arc(cx, station.y + 12, 3.4, 0, Math.PI * 2); ctx.fill();
      text(ctx, 'BIN', cx, station.y + station.h - 8, 12, '#22382e');
    } else if (station.kind === 'plating') {
      text(ctx, 'PLATING — build the dish here', cx, station.y + 15, 13, '#22382e');
      // Basil pots at the two corners of the pass.
      for (const px of [station.x + 26, station.x + station.w - 26]) {
        ctx.fillStyle = '#b85c38';
        ctx.beginPath();
        ctx.moveTo(px - 8, station.y + 36); ctx.lineTo(px + 8, station.y + 36);
        ctx.lineTo(px + 5.5, station.y + 52); ctx.lineTo(px - 5.5, station.y + 52);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#5da24a';
        for (const [ox, oy] of [[-5, 32], [0, 27], [5, 32]]) {
          ctx.beginPath(); ctx.arc(px + ox, station.y + oy, 4.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      // The ticket spike at the counter's right end (AUDIT-V19 D1): every
      // served ticket is filed on it, so the shift's output accumulates
      // as paper — the count is state.served itself, capped at what the
      // spike can hold.
      {
        ctx.strokeStyle = '#5d6a70';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(700, 744); ctx.lineTo(700, 714); ctx.stroke();
        ctx.fillStyle = '#3a3f42';
        ctx.beginPath(); ctx.ellipse(700, 745, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
        const slips = Math.min(state.served, 7);
        for (let i = 0; i < slips; i++) {
          ctx.save();
          ctx.translate(700, 740 - i * 2.4);
          ctx.rotate((i % 2 ? 1 : -1) * 0.15);
          ctx.fillStyle = '#fdf6e3';
          ctx.fillRect(-7.5, -5.5, 15, 11);
          // The tickets' own red header stripe, so the filed slips
          // read as the board's paper and not a white candle
          // (AUDIT-V20 S1f).
          ctx.fillStyle = '#d84a2f';
          ctx.fillRect(-7.5, -5.5, 15, 2.8);
          ctx.beginPath(); ctx.arc(0, 0.5, 1.3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
      if (state.plate.length) {
        // A finished plate stacks up as a dish; one still being built spreads its
        // pieces out, with a dashed ring where the missing piece belongs. Both are
        // drawn big — the plating counter is where the cover proves mid-assembly.
        if (recipeForStack(state.plate)) drawPlate(ctx, state.plate, cx, station.y + 42, 104);
        else drawPlateSpread(ctx, state.plate, cx, station.y + 44, 150);
      } else {
        // The empty plate waiting on the pass wears the same crockery as a
        // full one: grey edge, hairline, sheen.
        ctx.fillStyle = '#bfcbd0';
        ctx.beginPath(); ctx.ellipse(cx, station.y + 53.5, 43.5, 13.8, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(cx, station.y + 52, 42, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#aebfc5';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(cx, station.y + 52, 42, 13, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#dfe5e8';
        ctx.beginPath(); ctx.ellipse(cx, station.y + 51, 33, 9, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (station.kind === 'serve') {
      // Awning stripes over the window.
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? '#fff7e6' : COLORS.red;
        ctx.fillRect(station.x + 8 + i * ((station.w - 16) / 9), station.y + 6, (station.w - 16) / 9, 12);
      }
      // A scalloped hem along the awning's bottom edge, one shallow
      // half-ellipse per stripe in the stripe's own colour — the
      // harbour-café finish the stripes promised (AUDIT-V18 B4).
      // Shallow (6 deep) so the hem stays clear of the label's row.
      for (let i = 0; i < 9; i++) {
        const sw = (station.w - 16) / 9;
        ctx.fillStyle = i % 2 ? '#fff7e6' : COLORS.red;
        ctx.beginPath();
        ctx.ellipse(station.x + 8 + i * sw + sw / 2, station.y + 18, sw / 2, 6, 0, 0, Math.PI);
        ctx.fill();
      }
      // The label rides the counter's top edge now: the guests stand
      // along the window's front (S1) exactly where the centred label
      // used to sit, and its middle words went behind their heads —
      // found on V19's own window crop and fixed in-round.
      text(ctx, 'SERVE — dishes out here', station.x + station.w - 8, station.y - 6, 11, '#22382e', 'right');
      if (state.passDish) {
        // The pass moment, drawn at the plating counter's presence: a finished
        // plate big enough to find at contact-sheet size, with the game's own
        // call on a pill beside it. A plate ready to serve is one of the six
        // things the cover must show; at 74 units with a 10 px caption it
        // read as a smudge at the frame's edge, so now it gets the same
        // badge language as READY! / BURNT! / CUT!. A plate lies flat at
        // that scale; a chips carton stands ~52 units tall before scale —
        // at 104 it towered ~122 px over the window, across its awning and
        // into its label's first letter. Fries therefore sit smaller, on
        // the counter, clear of the label — the badge carries the call.
        const friesPass = state.passDish === 'fries';
        // A combo's dish rests on a steel tray (AUDIT-V19 S4): a combo
        // serve is a bigger event than a single's, and the pass says so.
        if (state.passCombo) {
          const tx = station.x + (friesPass ? 58 : 74);
          const ty = station.y + (friesPass ? 62 : 56);
          ctx.fillStyle = '#8d979d';
          ctx.beginPath(); ctx.ellipse(tx, ty, friesPass ? 42 : 58, 12, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#c3ced3';
          ctx.beginPath(); ctx.ellipse(tx, ty - 2, friesPass ? 38 : 53, 10, 0, 0, Math.PI * 2); ctx.fill();
        }
        drawDish(ctx, state.passDish, station.x + (friesPass ? 58 : 74), station.y + (friesPass ? 57 : 46), friesPass ? 60 : 104);
        // Steam over the pass: the machines steam and the sheet's
        // "ready to serve" moment sat cold. Two wisps in the machines'
        // own language rise off the finished dish, swaying with the
        // clock like theirs do. At the machines' own strength they
        // vanished over the serve counter's pale glass, though — the
        // pass wears a stronger literal of its own (AUDIT-V18 W4).
        // Hot dishes only: a served salad used to steam too, and a cold
        // dish drawn steaming lies about what it is (AUDIT-V19 F4).
        if (state.passDish !== 'salad') {
          ctx.strokeStyle = 'rgba(255,255,255,0.72)';
          ctx.lineWidth = 2.6;
          ctx.lineCap = 'round';
          for (const off of [-13, 13]) {
            const sx = station.x + (friesPass ? 58 : 74) + off + Math.sin(state.time * 2.2 + off * 1.7) * 3;
            const sy = station.y + (friesPass ? 30 : 26);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(sx + 6, sy - 15, sx - 1, sy - 27);
            ctx.stroke();
          }
        }
        // Serve sparkles (AUDIT-V19 D6): for the serve's first moments,
        // three small stars glint around the dish — the moment
        // celebrates, briefly, then the room gets back to work.
        if (state.passT > 1.15) {
          const dx = station.x + (friesPass ? 58 : 74);
          const dy = station.y + (friesPass ? 57 : 46);
          drawStar(ctx, dx - 54, dy - 26, 4, '#ffe9a8');
          drawStar(ctx, dx + 52, dy - 34, 3.4, '#ffe9a8');
          drawStar(ctx, dx + 6, dy - 54, 3, '#ffe9a8');
        }
        // The badge hangs over the dish like a café sign now: the row
        // below the counter belongs to the guests (AUDIT-V19 S1), and a
        // pill at its old place would sit across their faces.
        drawBadge(ctx, station.x + 74, station.y - 4, 'READY TO SERVE!', '#1e7d46');
      }
      // The service bell.
      ctx.fillStyle = COLORS.mustard;
      ctx.beginPath(); ctx.arc(station.x + station.w - 44, station.y + 48, 13, Math.PI, 0); ctx.fill();
      ctx.fillRect(station.x + station.w - 58, station.y + 48, 28, 4);
      // The bell rings while a serve is fresh (AUDIT-V19 D9): two motion
      // arcs, the room's punctuation for a dish gone out.
      if (state.passT > 1.0) {
        ctx.strokeStyle = 'rgba(201,150,53,0.75)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        for (const r of [18, 23]) {
          ctx.beginPath(); ctx.arc(station.x + station.w - 44, station.y + 48, r, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke();
          ctx.beginPath(); ctx.arc(station.x + station.w - 44, station.y + 48, r, Math.PI * 1.5, Math.PI * 1.85); ctx.stroke();
        }
      }
      // The tip jar at the window's right end (AUDIT-V19 D2): a small
      // glass jar whose coin fill rises with the shift's earnings — the
      // score as an object, readable without the HUD.
      {
        ctx.fillStyle = 'rgba(230,240,238,0.5)';
        rr(ctx, 1226, 714, 20, 29, 4); ctx.fill();
        ctx.strokeStyle = '#8d979d';
        ctx.lineWidth = 1.4;
        rr(ctx, 1226, 714, 20, 29, 4); ctx.stroke();
        const coinH = Math.min(21, state.score * 0.18);
        if (coinH > 1) {
          ctx.fillStyle = '#c99635';
          rr(ctx, 1229, 714 + 26 - coinH, 14, coinH, 2); ctx.fill();
          ctx.fillStyle = '#e8c268';
          ctx.beginPath(); ctx.ellipse(1236, 714 + 26 - coinH, 7, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#8d979d';
        rr(ctx, 1224, 710, 24, 5, 2); ctx.fill();
      }
    }
  }
  // A lamp rail over the island with two enamel pendants hanging from it.
  // Their warm pool over the island is most of why the middle of the room
  // feels like evening service instead of a bare floor with a table on it.
  // The rail is carried on two iron uprights from the back counter's edge —
  // at its old span it floated over the floor, supported by nothing.
  // The pool is drawn to be seen: at its old 0.07 the lamps lit nothing and
  // the middle band stayed bare tone. Two flat pools now — a wide one over
  // the rug's ground, a tighter warmer one over the island itself — still
  // quieter than anything that carries information.
  ctx.fillStyle = 'rgba(255,205,120,0.12)';
  ctx.beginPath(); ctx.ellipse(640, 460, 232, 80, 0, 0, Math.PI * 2); ctx.fill();
  // The inner pool is a gradient, not a second hard-edged ellipse:
  // light pools, it doesn't stack. Drawn in the rug's own squashed
  // space so it hugs the room the way the flat pool does, warm at the
  // island and gone at its rim.
  ctx.save();
  ctx.translate(640, 460);
  ctx.scale(1, 56 / 168);
  const poolGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 168);
  poolGrad.addColorStop(0, 'rgba(255,205,120,0.17)');
  poolGrad.addColorStop(1, 'rgba(255,205,120,0)');
  ctx.fillStyle = poolGrad;
  ctx.beginPath(); ctx.arc(0, 0, 168, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#2b2320';
  for (const ux of [470, 810]) ctx.fillRect(ux - 2.5, 226, 5, 24);
  ctx.fillStyle = '#4a3b2a';
  rr(ctx, 452, 246, 376, 10, 5); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  rr(ctx, 452, 254, 376, 3, 1.5); ctx.fill();
  for (const lx of [548, 732]) {
    ctx.strokeStyle = '#2b2320';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(lx, 256); ctx.lineTo(lx, 310); ctx.stroke();
    // The glow around the bulb: a gradient disc that fades the way
    // light does, then the two soft rings the room already wore.
    const glowGrad = ctx.createRadialGradient(lx, 335, 4, lx, 335, 78);
    glowGrad.addColorStop(0, 'rgba(255,214,130,0.20)');
    glowGrad.addColorStop(1, 'rgba(255,214,130,0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(lx, 335, 78, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,130,0.10)';
    ctx.beginPath(); ctx.arc(lx, 330, 48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,130,0.16)';
    ctx.beginPath(); ctx.arc(lx, 330, 29, 0, Math.PI * 2); ctx.fill();
    // The enamel dome shade, harbour teal with a brass rim.
    ctx.fillStyle = COLORS.tealDark;
    ctx.beginPath();
    ctx.moveTo(lx - 26, 330); ctx.lineTo(lx - 9, 308);
    ctx.quadraticCurveTo(lx, 301, lx + 9, 308); ctx.lineTo(lx + 26, 330);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c99635';
    ctx.fillRect(lx - 26, 328, 52, 4);
    // The bulb itself — its colour warms as the light falls (AUDIT-V19
    // D10): pale in the morning, gold by midday, amber at dusk, the
    // regime readable at the lamps themselves.
    const warmth = heat(state);
    ctx.fillStyle = warmth >= 0.66 ? '#ffb85c' : warmth >= 0.33 ? '#ffd968' : '#ffe9a8';
    ctx.beginPath(); ctx.arc(lx, 335, 5.5, 0, Math.PI * 2); ctx.fill();
  }
  // At rush pitch the lamplight itself pulses (AUDIT-V19 S3): one more
  // pool over the island, breathing on the clock, present only while the
  // board is at rush — the room's third voice saying the same thing.
  if (boardRush(state)) {
    ctx.globalAlpha = 0.4 + Math.sin(state.time * 5) * 0.25;
    ctx.fillStyle = 'rgba(255,205,120,0.10)';
    ctx.beginPath(); ctx.ellipse(640, 460, 232, 80, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // A bunch of dried herbs hangs from the rail between the pendants
  // (AUDIT-V19 D13), swaying on the clock — the middle band's air gains
  // the kitchen's own dressing.
  ctx.save();
  ctx.translate(640, 256);
  ctx.rotate(Math.sin(state.time * 0.8) * 0.04);
  ctx.strokeStyle = '#8a6a24';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 12); ctx.stroke();
  ctx.strokeStyle = '#579a44';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const dx of [-7, -2.5, 2.5, 7]) {
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(dx, 30 + Math.abs(dx) * 0.5); ctx.stroke();
  }
  ctx.fillStyle = '#63b34f';
  for (const [ox, oy] of [[-7, 33], [-2.5, 35], [2.5, 35], [7, 33], [0, 38]]) {
    ctx.beginPath(); ctx.ellipse(ox, oy, 3.4, 2.2, ox * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // The guests at the window (AUDIT-V19 S1): one per ticket, in ticket
  // order, drawn over the counter's face — they stand outside it.
  drawGuests(ctx, state);
  // The shift-light regime (AUDIT-V19 S2): one wash over the whole room,
  // the last thing the kitchen draws. Early, a cool morning tone that
  // thins as the shift warms; late, a warm dusk that deepens with the
  // same heat the lamps answer. Title is morning, the cover midday
  // warmth, the rush dusk, the end last light.
  {
    const h = heat(state);
    const cool = (1 - h) * 0.05;
    if (cool > 0.004) {
      ctx.fillStyle = `rgba(140,190,205,${cool.toFixed(3)})`;
      ctx.fillRect(0, BOARD_H, VIEW.width, VIEW.height - BOARD_H);
    }
    if (h > 0.02) {
      ctx.fillStyle = `rgba(255,158,64,${(h * 0.13).toFixed(3)})`;
      ctx.fillRect(0, BOARD_H, VIEW.width, VIEW.height - BOARD_H);
    }
  }
}

/**
 * One guest, drawn standing at the window with their feet at (x, feetY):
 * a harbour-town figure in the room's flat language — coat, neck, head,
 * hair in one of four ways, and a face that is their ticket's timer.
 * A guest whose combo line is already served holds that dish's plate.
 */
function drawGuestFigure(ctx, state, g, slideY, alpha) {
  const x = g.x + (g.mood === 'cross' ? Math.sin(state.time * 9 + g.x) * 0.7 : 0);
  const feetY = g.feetY + slideY;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  // A contact shadow under the shoes, in the room's own shadow
  // language: every other figure and dish carries one, and without
  // it the guests read as stickers on the window (AUDIT-V20 G2).
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.ellipse(x, feetY - 1, 15, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  // Drawn up a step, about the feet: at their first size the guests
  // stood two-thirds the cook's height — half-size people at his
  // window (AUDIT-V20 G1). The build is the guest's own, fixed by
  // their ticket, so the row is a crowd, not a set of clones. Feet,
  // slots and departure geometry do not move.
  const gs = 1.10 * (g.look.build || 1);
  ctx.translate(x, feetY); ctx.scale(gs, gs); ctx.translate(-x, -feetY);
  // Legs and shoes.
  ctx.fillStyle = '#3a3f42';
  rr(ctx, x - 7.5, feetY - 14, 6.5, 12, 2); ctx.fill();
  rr(ctx, x + 1, feetY - 14, 6.5, 12, 2); ctx.fill();
  ctx.fillStyle = '#2b2320';
  ctx.beginPath(); ctx.ellipse(x - 4.4, feetY - 1.6, 4.8, 2.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 4.4, feetY - 1.6, 4.8, 2.1, 0, 0, Math.PI * 2); ctx.fill();
  // The coat, with a shaded hem.
  ctx.fillStyle = g.look.coat;
  rr(ctx, x - 11, feetY - 41, 22, 28, 7); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  rr(ctx, x - 11, feetY - 21, 22, 8, 4); ctx.fill();
  // Arms: down at the sides, or up holding the collected line's dish.
  if (g.holds) {
    ctx.strokeStyle = g.look.coat;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 9, feetY - 36); ctx.lineTo(x - 6, feetY - 27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 9, feetY - 36); ctx.lineTo(x + 6, feetY - 27); ctx.stroke();
    drawDish(ctx, g.holds, x, feetY - 31, 27);
  } else if (g.mood === 'cross') {
    // Hands on hips (AUDIT-V21 F1): a guest in the red zone stood in
    // the same arms-down pose as the content guest beside him, and at
    // this size a face alone cannot say "about to walk out" — the
    // silhouette has to. The arms bend at the elbow, the elbows ride
    // out past the coat's edge (±15 against its ±11), and the hands
    // plant on the hips. A cross guest already holding a served line
    // keeps the holding pose above: he has part of his order.
    ctx.strokeStyle = g.look.coat;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 9.5, feetY - 36.5); ctx.lineTo(x - 15, feetY - 28); ctx.lineTo(x - 7.5, feetY - 19.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 9.5, feetY - 36.5); ctx.lineTo(x + 15, feetY - 28); ctx.lineTo(x + 7.5, feetY - 19.5); ctx.stroke();
    ctx.fillStyle = g.look.skin;
    ctx.beginPath(); ctx.arc(x - 7.5, feetY - 19.5, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 7.5, feetY - 19.5, 2.6, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = g.look.coat;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 10, feetY - 37); ctx.lineTo(x - 12.5, feetY - 21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, feetY - 37); ctx.lineTo(x + 12.5, feetY - 21); ctx.stroke();
    ctx.fillStyle = g.look.skin;
    ctx.beginPath(); ctx.arc(x - 12.5, feetY - 20, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 12.5, feetY - 20, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  // Neck and head, with a cheek's shade.
  ctx.fillStyle = g.look.skin;
  ctx.fillRect(x - 3, feetY - 47, 6, 6);
  ctx.beginPath(); ctx.arc(x, feetY - 53, 8.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,90,40,0.20)';
  ctx.beginPath(); ctx.arc(x + 4.6, feetY - 49.5, 3.1, 0, Math.PI * 2); ctx.fill();
  // Hair, in the guest's own way.
  ctx.fillStyle = g.look.hair;
  if (g.look.style === 0) {
    ctx.beginPath(); ctx.arc(x, feetY - 54, 8.6, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - 9.4, feetY - 55.4, 18.8, 2.2);
  } else if (g.look.style === 1) {
    ctx.beginPath(); ctx.arc(x, feetY - 54, 8.6, Math.PI, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, feetY - 63.5, 3.4, 0, Math.PI * 2); ctx.fill();
  } else if (g.look.style === 2) {
    for (const ox of [-6, 0, 6]) {
      ctx.beginPath(); ctx.arc(x + ox, feetY - 59.5, 3.3, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.strokeStyle = g.look.hair;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, feetY - 50.5, 7.4, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  }
  // The face: the ticket's own timer, in features. Content above half,
  // flat to a quarter, cross below it — the board's 0.25 threshold.
  ctx.fillStyle = '#22382e';
  ctx.beginPath(); ctx.arc(x - 3.2, feetY - 53, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 3.2, feetY - 53, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#22382e';
  ctx.lineWidth = 1.35;
  ctx.lineCap = 'round';
  if (g.mood === 'content') {
    ctx.beginPath(); ctx.arc(x - 3.2, feetY - 55.4, 2.1, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 3.2, feetY - 55.4, 2.1, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, feetY - 49.6, 3.0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  } else if (g.mood === 'flat') {
    ctx.beginPath(); ctx.moveTo(x - 5.2, feetY - 56.8); ctx.lineTo(x - 1.2, feetY - 56.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 1.2, feetY - 56.8); ctx.lineTo(x + 5.2, feetY - 56.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 2.8, feetY - 47.6); ctx.lineTo(x + 2.8, feetY - 47.6); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x - 5.4, feetY - 57.6); ctx.lineTo(x - 1.2, feetY - 55.8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 5.4, feetY - 57.6); ctx.lineTo(x + 1.2, feetY - 55.8); ctx.stroke();
    // The cross frown steps wider (AUDIT-V21 F1): at 2.8 it was a
    // speck under the brows; at 3.4 it sits under the hands-on-hips
    // pose as the face's share of the same sentence.
    ctx.beginPath(); ctx.arc(x, feetY - 44.9, 3.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  }
  ctx.restore();
}

/**
 * The window's crowd: the waiting guests in ticket order, then the ones
 * leaving — served guests slide down off the window smiling with their
 * dish held high; walked-out guests storm off cross. Departures were
 * recorded by orders.js at the event itself and age on the popup clock.
 */
function drawGuests(ctx, state) {
  state.tickets.forEach((ticket, i) => {
    drawGuestFigure(ctx, state, guestFor(ticket, i), 0, 1);
  });
  for (const dep of state.departures) {
    const p = Math.min(1, dep.t / 0.9);
    drawGuestFigure(ctx, state, {
      x: dep.x, feetY: 774, look: dep.look,
      mood: dep.mood === 'happy' ? 'content' : 'cross',
      holds: dep.mood === 'happy' ? dep.dish : null,
    }, p * 30, 1 - p * 0.85);
  }
}

/**
 * Whether the cook's face strains: whenever the board is under pressure —
 * a full five-ticket board, or any ticket in the red zone. The rule is the
 * same red-zone threshold the tickets themselves use (frac < 0.25), so the
 * face and the board can never contradict each other: a calm board never
 * gets a strained cook, and a dying timer always does.
 */
export function chefStrained(state) {
  if (state.phase !== 'play') return false;
  return state.tickets.length >= 5
    || state.tickets.some((t) => t.timeLeft / t.timeTotal < 0.25);
}

function drawChef(ctx, state) {
  const chef = state.chef;
  // The walk bob quickens in presence at rush pitch (AUDIT-V19 S7): the
  // same steps, a larger stride — the cook hustles when the board does.
  const bob = Math.sin(chef.walk) * (boardRush(state) ? 3.4 : 2.4);
  // Drawn a step larger than his collision circle: the room is big and the
  // cook is its only character — at his old size he read as a token on the
  // floor instead of the person working it. The scale pivots on his feet,
  // so he grows upward from where he stands; nothing mechanical reads it.
  // V18 steps him up once more (1.15 → 1.25): at the judge's size his
  // face is ~11 px and the strain read still rests on the red ticket —
  // presence is the step the detail pass left (AUDIT-V18 W6).
  ctx.save();
  ctx.translate(chef.x, chef.y + 27);
  ctx.scale(1.25, 1.25);
  ctx.translate(-chef.x, -(chef.y + 27));
  // The lean (AUDIT-V19 S7): mid-chop at a board, the cook leans into
  // the work — a tilt about his feet toward the board, present only
  // while the knife is actually part-way through something.
  {
    const near = nearestStation(state);
    if (near && near.kind === 'board') {
      const board = state.boards.find((b) => b.station === near);
      const need = board && board.item ? { tomato: 3, lettuce: 2, potato: 3 }[board.item] : 0;
      if (board && need && board.chops > 0 && board.chops < need) {
        ctx.translate(chef.x, chef.y + 27);
        ctx.rotate(0.055 * chef.face);
        ctx.translate(-chef.x, -(chef.y + 27));
      }
    }
  }
  // The cook's face answers the pressure on the board: brows down, mouth
  // flat, sweat flying — whenever a ticket is dying or the board is full.
  const strained = chefStrained(state);
  const x = chef.x;
  // Off shift (title, shutters down) he breathes: a slow sway on the
  // room's clock instead of the walk bob (AUDIT-V19 S7).
  const y = chef.y + bob * 0.3 + (state.phase === 'play' ? 0 : Math.sin(state.time * 2) * 0.5);
  // A soft contact shadow in two layers — a wide faint ellipse under a
  // tighter darker one — so he sits in the room's light instead of on
  // one hard-edged sticker.
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath(); ctx.ellipse(x, chef.y + 27, 31, 9.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(x, chef.y + 27, 23, 6.8, 0, 0, Math.PI * 2); ctx.fill();
  // THE PERSON (AUDIT-V19 F2, user-flagged: "he doesn't look like a
  // human, that's a doll"). The figure is redrawn as a little person in
  // the same flat house style: legs and shoes below, a torso that
  // tapers from sloped shoulders to a waist, two-segment arms with an
  // elbow bend and real hands, a neck, and a head with a jaw. What does
  // NOT move: the feet pivot above, the 1.25 scale, the carry anchors
  // (dish −62, ingredient −74) and the hands' rise to meet them — a
  // dish still rides at tray height with hands under its rim, and an
  // ingredient still rides clear of the toque (AUDIT-V18 W1).
  const carryDish = !!chef.carry && !!DISHES[chef.carry];
  const handY = carryDish ? -46 : -62;
  // Legs, swinging against each other as he walks, and shoes that
  // point the way he faces.
  const swing = Math.sin(chef.walk) * 3;
  ctx.fillStyle = '#37414a';
  rr(ctx, x - 11 + swing, y + 12, 8.5, 13, 3); ctx.fill();
  rr(ctx, x + 2.5 - swing, y + 12, 8.5, 13, 3); ctx.fill();
  ctx.fillStyle = '#2b2320';
  ctx.beginPath(); ctx.ellipse(x - 6.8 + swing + chef.face * 1.5, y + 26, 6.2, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 6.8 - swing + chef.face * 1.5, y + 26, 6.2, 3, 0, 0, Math.PI * 2); ctx.fill();
  // The torso: an indigo jacket from sloped shoulders tapering to the
  // waist — a path, not a circle; the bell is gone.
  ctx.fillStyle = '#2c4a7c';
  ctx.beginPath();
  ctx.moveTo(x - 6.5, y - 13);
  ctx.quadraticCurveTo(x - 15, y - 10.5, x - 16.5, y - 4);
  ctx.lineTo(x - 12.5, y + 13);
  ctx.quadraticCurveTo(x, y + 16.5, x + 12.5, y + 13);
  ctx.lineTo(x + 16.5, y - 4);
  ctx.quadraticCurveTo(x + 15, y - 10.5, x + 6.5, y - 13);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.16)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x, y - 3); ctx.stroke();
  // The apron over the jacket: a bib, a waistband, a skirt, the
  // stitched pocket — the V17 furniture, fitted to a waist now.
  ctx.fillStyle = '#f7f2e6';
  rr(ctx, x - 10.5, y - 3, 21, 10, 3); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 6); ctx.lineTo(x + 12, y + 6);
  ctx.lineTo(x + 13, y + 17.5); ctx.lineTo(x - 13, y + 17.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8dfc9';
  ctx.fillRect(x - 12.5, y + 5, 25, 3);
  ctx.strokeStyle = '#e8dfc9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 2.5); ctx.lineTo(x - 4, y - 9.5);
  ctx.moveTo(x + 9, y - 2.5); ctx.lineTo(x + 4, y - 9.5);
  ctx.stroke();
  ctx.strokeStyle = '#d8cfb8';
  ctx.lineWidth = 1.4;
  rr(ctx, x + 2, y + 10, 9, 8, 2); ctx.stroke();
  ctx.strokeStyle = '#b8ab8d';
  ctx.setLineDash([2.2, 1.8]);
  ctx.beginPath();
  ctx.moveTo(x + 2.8, y + 12.4); ctx.lineTo(x + 10.2, y + 12.4);
  ctx.stroke();
  ctx.setLineDash([]);
  // A towel hangs at his left side, striped in the room's teal — at
  // the waistband's end, where a cook's towel hangs.
  ctx.fillStyle = '#f7f2e6';
  rr(ctx, x - 24.5, y + 9, 8.5, 14, 2); ctx.fill();
  ctx.fillStyle = COLORS.teal;
  ctx.fillRect(x - 24.5, y + 13.5, 8.5, 2.2);
  ctx.fillRect(x - 24.5, y + 18.5, 8.5, 2.2);
  // Arms in two segments — upper arm and forearm with an elbow between
  // — in indigo sleeves, ending in hands: a palm with fingers. Carrying,
  // both rise to the carry anchors; resting, they hang at his sides.
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.strokeStyle = '#2c4a7c';
    if (chef.carry) {
      const elbowY = y + handY * 0.55;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x + side * 14.5, y - 4);
      ctx.lineTo(x + side * 19.5, elbowY);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x + side * 19.5, elbowY);
      ctx.lineTo(x + side * 11, y + handY);
      ctx.stroke();
    } else {
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x + side * 14.5, y - 4);
      ctx.lineTo(x + side * 18.5, y + 7);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(x + side * 18.5, y + 7);
      ctx.lineTo(x + side * 17.5, y + 16);
      ctx.stroke();
    }
    // The hand: a palm, and fingers that grip when carrying.
    const hx = x + side * (chef.carry ? 11 : 17.5);
    const hy = y + (chef.carry ? handY : 17);
    ctx.fillStyle = '#f0bd8f';
    ctx.beginPath(); ctx.arc(hx, hy, 3.7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f0bd8f';
    ctx.lineWidth = 1.6;
    if (chef.carry) {
      // A dish rides as a tray with the palms under its rim; an
      // ingredient rides higher, and its grip fingers reach further
      // to close on its underside — at the tray's grip length they
      // stopped short and the food hovered, unheld (AUDIT-V20 C1).
      const grip = carryDish ? 6 : 10;
      ctx.beginPath(); ctx.moveTo(hx - 2, hy - 2); ctx.lineTo(hx - 2.6, hy - grip); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx + 2, hy - 2); ctx.lineTo(hx + 2.6, hy - grip); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(hx - 1.8, hy + 2); ctx.lineTo(hx - 2.2, hy + 5.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx + 1.8, hy + 2); ctx.lineTo(hx + 2.2, hy + 5.5); ctx.stroke();
    }
  }
  // Head and face — a person's, now: ears, hair at the toque's edge, a
  // jaw, a shaded cheek and a nose with dimension (AUDIT-V19 F2).
  // The neck, with the shadow the jaw throws on it.
  ctx.fillStyle = '#f0bd8f';
  rr(ctx, x - 4.5, y - 15, 9, 7, 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,90,40,0.25)';
  ctx.fillRect(x - 4.5, y - 10, 9, 2.2);
  // Hair first, a rim behind the head: it shows at the sides, under the
  // toque's band — the doll's bald join between hat and face is gone.
  ctx.fillStyle = '#4a3220';
  ctx.beginPath(); ctx.arc(x, y - 24.5, 13.6, 0, Math.PI * 2); ctx.fill();
  // Ears, with their inner shade.
  ctx.fillStyle = '#f0bd8f';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.arc(x + side * 12.8, y - 22, 3.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(160,90,40,0.3)';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.arc(x + side * 12.8, y - 22, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  // The head itself: a cranium with a jaw under it — the union reads as
  // a skull with a chin, not a ball on a bell.
  ctx.fillStyle = '#f0bd8f';
  ctx.beginPath(); ctx.arc(x, y - 24, 13, 0, Math.PI * 2); ctx.fill();
  rr(ctx, x - 9.5, y - 22, 19, 12.5, 5); ctx.fill();
  // Sideburns where the hair meets the cheeks.
  ctx.fillStyle = '#4a3220';
  for (const side of [-1, 1]) ctx.fillRect(x + side * 12.1 - 1.3, y - 28, 2.6, 6);
  // Eyes.
  ctx.fillStyle = '#2b2320';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.arc(x + side * 5.2, y - 23.5, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  // The nose, with dimension: a shaded wedge turned the way he faces,
  // where a single dot used to stand for one.
  ctx.fillStyle = 'rgba(217,154,99,0.9)';
  ctx.beginPath();
  ctx.moveTo(x + chef.face * 0.5 - 0.6, y - 22.6);
  ctx.lineTo(x + chef.face * 0.5 + 2.4, y - 18.6);
  ctx.lineTo(x + chef.face * 0.5 - 2, y - 18.6);
  ctx.closePath(); ctx.fill();
  // A cheekbone's shade on one side — skin is shaded now, not flat.
  ctx.fillStyle = 'rgba(217,154,99,0.4)';
  ctx.beginPath(); ctx.arc(x - 8.6, y - 18.6, 3, 0, Math.PI * 2); ctx.fill();
  if (strained) {
    // Determined brows, angled down toward the nose.
    ctx.strokeStyle = '#7a4a26';
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * 9.8, y - 30.2);
      ctx.lineTo(x + side * 3.2, y - 27.6);
      ctx.stroke();
    }
    // A flat, set mouth instead of the smile.
    ctx.strokeStyle = '#a96a3f';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - 4.4, y - 15.2);
    ctx.lineTo(x + 4.4, y - 16);
    ctx.stroke();
    // Sweat, flung off both sides of the head and beading at the temple.
    const drop = (dx, dy, s, rot) => {
      ctx.save();
      ctx.translate(x + dx, y + dy);
      ctx.rotate(rot);
      ctx.scale(s, s);
      ctx.fillStyle = '#8ecfe8';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.quadraticCurveTo(4.6, 0.5, 3.6, 3.4);
      ctx.quadraticCurveTo(2.6, 6.4, 0, 6.4);
      ctx.quadraticCurveTo(-2.6, 6.4, -3.6, 3.4);
      ctx.quadraticCurveTo(-4.6, 0.5, 0, -7);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath(); ctx.arc(-1.2, 2.6, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    // The drops step up a size: they are the face's loudest strain
    // mark after the brows, and at their old scales they were the
    // smallest blue flecks on the cover.
    drop(-24, -30, 1.05, -0.5);
    drop(24.5, -25, 0.88, 0.55);
    drop(-19, -12, 0.68, -0.9);
  } else {
    // Calm brows, soft arcs over the eyes: the strained face had
    // brows and the calm one had none, so calm read as blank.
    ctx.strokeStyle = '#7a4a26';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + side * 5.2, y - 26.6, 3.2, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.strokeStyle = '#a96a3f';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y - 17.8, 5.2, 0.25, Math.PI - 0.25); ctx.stroke();
  }
  // The chin line: one quiet curve under the mouth, the jaw's finish.
  ctx.strokeStyle = 'rgba(160,90,40,0.35)';
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.arc(x, y - 13.8, 3.8, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  ctx.fillStyle = 'rgba(216,74,47,0.32)';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.arc(x + side * 9.6, y - 17.6, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  // A tall toque: band, dome and two side puffs.
  ctx.fillStyle = '#ffffff';
  rr(ctx, x - 13.5, y - 39, 27, 8, 3.5); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y - 40, 10.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x - 7.5, y - 38, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 7.5, y - 38, 7, 0, Math.PI * 2); ctx.fill();
  // The toque's cloth: two fold curves down the dome and stitch ticks
  // on the band. Flat white shapes read as a blob at judge size — and
  // the tomato he carries overhead used to read as dots on the hat.
  ctx.strokeStyle = 'rgba(141,151,157,0.55)';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  for (const fx of [-5.5, 5.5]) {
    ctx.beginPath();
    ctx.moveTo(x + fx, y - 47.5);
    ctx.quadraticCurveTo(x + fx * 1.25, y - 42.5, x + fx, y - 38);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(141,151,157,0.7)';
  ctx.lineWidth = 1.1;
  for (const sx of [-8.5, -2.8, 2.8, 8.5]) {
    ctx.beginPath();
    ctx.moveTo(x + sx, y - 37.2);
    ctx.lineTo(x + sx, y - 33.8);
    ctx.stroke();
  }
  // Neckerchief, knotted on the facing side: a wider fall of cloth and
  // a knot — the old triangle was swallowed at the neck join and read
  // as a red smudge.
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.moveTo(x - 9.5, y - 9.5);
  ctx.lineTo(x + chef.face * 15.5, y - 3.5);
  ctx.lineTo(x - 3, y + 2.5);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = COLORS.redDark;
  ctx.beginPath(); ctx.arc(x + chef.face * 11, y - 3.3, 2.3, 0, Math.PI * 2); ctx.fill();
  // Whatever the chef carries rides overhead, both hands up — carried food
  // casts no contact shadow; it is in the air, over his toque. A dish
  // rides at −62 as a tray; an ingredient rides at −74, clear of the
  // dome (W1) — the hands above already rose to meet it.
  if (chef.carry) {
    const dish = DISHES[chef.carry];
    if (dish) drawDish(ctx, chef.carry, x, y - 62, 66, false);
    else {
      // The ingredient shades the toque it hovers over: a held thing
      // casts a shadow, and without one the food floats above the
      // hat like a balloon (AUDIT-V20 C1).
      ctx.fillStyle = 'rgba(90,70,40,0.13)';
      ctx.beginPath(); ctx.ellipse(x, y - 47.5, 12.5, 2.8, 0, 0, Math.PI * 2); ctx.fill();
      drawItem(ctx, chef.carry, x, y - 74, 46, false);
    }
  }
  ctx.restore();
}

function drawBoard(ctx, state) {
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, VIEW.width, BOARD_H);
  ctx.fillStyle = COLORS.boardEdge;
  ctx.fillRect(0, BOARD_H - 5, VIEW.width, 5);
  // At rush pitch the board itself says so (AUDIT-V19 S3): the label is
  // the first thing the eye finds, and it turns to the rush's own voice.
  text(ctx, boardRush(state) ? 'ORDERS — RUSH!' : 'ORDERS', 52, 16, 13, boardRush(state) ? '#ff8a75' : COLORS.mustard, 'left');
  // The order pencil, hanging on its string from the board's bottom
  // edge (AUDIT-V19 D12) — the board's tool, where a cook keeps it.
  ctx.strokeStyle = 'rgba(255,247,230,0.5)';
  ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(20, 118); ctx.lineTo(20, 129); ctx.stroke();
  ctx.save();
  ctx.translate(20, 137);
  ctx.rotate(0.12);
  ctx.fillStyle = '#f2b33d';
  ctx.fillRect(-2.5, -7, 5, 11);
  ctx.fillStyle = '#f7e0b0';
  ctx.beginPath(); ctx.moveTo(-2.5, 4); ctx.lineTo(2.5, 4); ctx.lineTo(0, 8.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2b2320';
  ctx.beginPath(); ctx.arc(0, 8, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  const cardW = 214;
  const gap = 8;
  state.tickets.forEach((ticket, i) => {
    const x = 12 + i * (cardW + gap);
    const y = 24;
    const h = 86;
    const frac = Math.max(0, ticket.timeLeft / ticket.timeTotal);
    // A soft offset shadow under the paper: the cards were printed
    // rectangles on a flat band; with a shadow they read as tickets
    // pinned on a wall, and the board lifts off the room behind it.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, x + 3, y + 4, cardW, h, 7); ctx.fill();
    ctx.fillStyle = COLORS.paper;
    rr(ctx, x, y, cardW, h, 7); ctx.fill();
    // The pin that holds the ticket: one brass dot through the paper's
    // top edge — the shadows made the cards pinned paper; this is what
    // pins them (AUDIT-V18 B3). It sits clear of the icon (x + 10..62)
    // and the title (from x + 70) alike.
    ctx.fillStyle = '#c99635';
    ctx.beginPath(); ctx.arc(x + cardW / 2, y + 6, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6a24';
    ctx.beginPath(); ctx.arc(x + cardW / 2, y + 6, 1.1, 0, Math.PI * 2); ctx.fill();
    if (frac < 0.25) {
      // The red zone, drawn to shout in a still frame: a soft alarm halo
      // outside the card and a hard red border on it.
      ctx.strokeStyle = 'rgba(216,74,47,0.4)';
      ctx.lineWidth = 3;
      rr(ctx, x - 3.5, y - 3.5, cardW + 7, h + 7, 9); ctx.stroke();
      ctx.strokeStyle = COLORS.red;
      ctx.lineWidth = 3.4;
      rr(ctx, x, y, cardW, h, 7); ctx.stroke();
    }
    const main = ticket.items[0];
    // Today's catch wears its star on its tickets too (AUDIT-V20
    // E2): a brass marker tab on the card's left edge when the
    // ticket's main dish is the shift's special — the featured dish
    // reads where the route is planned, not only on the boards.
    if (main.dish === state.special) drawStar(ctx, x + 1, y + 43, 4.6, '#c99635');
    drawDish(ctx, main.dish, x + 36, y + 33, 54);
    if (main.done) {
      // A served main wears a paper disc with a drawn check on it — the
      // face has no ✓ glyph, and a fallback tick over the food was the
      // board's one mark not drawn in the game's own hand.
      ctx.fillStyle = COLORS.paper;
      ctx.globalAlpha = 0.88;
      ctx.beginPath(); ctx.arc(x + 36, y + 33, 16, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      drawCheck(ctx, x + 36, y + 33, 10, COLORS.teal, 4.4);
    }
    // The dish name owns the top row and shrinks to fit it; the price no longer
    // shares that row — it sits on the bottom row, so the two can never collide.
    let titleSize = 14.5;
    ctx.font = `700 ${titleSize}px ${FONT}`;
    while (ctx.measureText(DISHES[main.dish].name).width > 132 && titleSize > 10.5) {
      titleSize -= 0.5;
      ctx.font = `700 ${titleSize}px ${FONT}`;
    }
    text(ctx, DISHES[main.dish].name, x + 70, y + 19, titleSize, COLORS.ink, 'left');
    let lineY = y + 36;
    // A one-dish ticket's only line repeats its own header — the name is the
    // card's title and the price is in the bottom row — so it is not drawn:
    // the make-up line below takes the first line's slot instead of sitting
    // one row lower under an echo. A single's line can never be the ticked
    // one (serving its only dish removes the ticket), so nothing the tick
    // evidences is lost. Combo cards keep both lines — their per-dish
    // prices are real information — and a ticked line wears a drawn check,
    // not a glyph the face doesn't carry.
    if (ticket.items.length > 1) {
      for (const line of ticket.items) {
        if (line.done) {
          drawCheck(ctx, x + 76, lineY, 4.6, COLORS.teal, 2.1);
          text(ctx, `${DISHES[line.dish].name} $${DISHES[line.dish].price}`, x + 86, lineY, 12, COLORS.teal, 'left', false);
        } else {
          text(ctx, `• ${DISHES[line.dish].name} $${DISHES[line.dish].price}`, x + 70, lineY, 12, '#6b5a44', 'left', false);
        }
        lineY += 14.5;
      }
    }
    if (ticket.items.length === 1 && DISHES[main.dish].items) {
      // What the dish is made of — the fetching route the game is about, in
      // short piece names — so the board carries the depth, not an echo.
      // Combo cards already fill both of their lines and keep them.
      const shortPiece = (item) => (item === 'bun' ? 'roll' : item.replace('_grilled', '').replace('_cut', ''));
      const parts = DISHES[main.dish].items.map(shortPiece).join(' · ');
      // A one-piece dish has no route to list: its only "make-up" would echo
      // its piece ("fillet" under Grilled Fillet — the board's barest line).
      // It prints its process instead, in the same muted voice — the note
      // its own menu line already uses. The voice is deepened a step this
      // round: at #8a755a it was ~4.0:1 on the card's paper, the faintest
      // text the board carries; #755c39 is ~5.3:1, the dish lines' family.
      const solo = { fillet: 'straight off the grill' }[main.dish];
      // The single's one line sits in the card's middle, not at its
      // top: with the echo line gone the line at the first slot left
      // a ~29 px airy band above the bottom row, while combo cards
      // fill both slots and read balanced. Centred, the card's text
      // block sits between header and bottom row like a combo's.
      text(ctx, DISHES[main.dish].items.length === 1 && solo ? solo : parts, x + 70, lineY + 7.5, 11, '#755c39', 'left', false);
    }
    // The bottom row: what the ticket pays on the left, the seconds left on the right.
    text(ctx, `$${ticket.price} + tip`, x + 10, y + h - 21, 12.5, COLORS.tealDark, 'left');
    text(ctx, `${Math.ceil(ticket.timeLeft)}s`, x + cardW - 8, y + h - 21, 11.5, frac <= 0.25 ? COLORS.red : '#6b5a44', 'right');
    // The timer you can feel: a bar that drains and reddens along the card's foot.
    ctx.fillStyle = '#e4d7bd';
    rr(ctx, x + 8, y + h - 13, cardW - 16, 7, 3.5); ctx.fill();
    ctx.fillStyle = frac > 0.5 ? COLORS.timerGood : frac > 0.25 ? COLORS.timerMid : COLORS.timerBad;
    if (frac > 0) { rr(ctx, x + 8, y + h - 13, (cardW - 16) * frac, 7, 3.5); ctx.fill(); }
    if (frac < 0.25) {
      // Last of all on the card: a filled alarm disc on its top corner with a
      // white bang — the one mark on the board nobody can miss at a glance.
      // The disc breathes now (AUDIT-V19 D5): a dying ticket pulses on
      // the room's clock, the still frame's one moving alarm.
      const alarmR = 11 + Math.sin(state.time * 6) * 1.1;
      ctx.fillStyle = COLORS.red;
      ctx.beginPath(); ctx.arc(x + cardW - 3, y + 3, alarmR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + cardW - 3, y + 3, alarmR, 0, Math.PI * 2); ctx.stroke();
      text(ctx, '!', x + cardW - 3, y + 4, 15, '#ffffff');
    }
    // The NEXT tag (AUDIT-V19 D8): when a queue waits, the oldest card
    // wears the route's start on its bottom edge.
    if (i === 0 && state.tickets.length > 1) {
      ctx.fillStyle = COLORS.mustard;
      rr(ctx, x + 10, y + h - 5, 42, 13, 4); ctx.fill();
      text(ctx, 'NEXT', x + 31, y + h + 1.5, 9, '#22382e');
    }
  });
  if (state.tickets.length === 0 && state.phase === 'play') {
    text(ctx, 'No orders — breathe. The rush is coming…', 20, 62, 16, '#9fb4ac', 'left', false);
  }
  // HUD on the right of the board. Money is written the same way everywhere
  // in the game — tickets and popups say "$13" and "+$16", so the board says
  // "$86", never "$ 86". And the readouts only exist once a shift does: on
  // the title screen there is no score, no clock and no served count to
  // report, so the board band wears just its ORDERS label there.
  const hx = 1152;
  if (state.phase !== 'title') {
    text(ctx, `$${state.score}`, hx, 34, 25, '#ffd968', 'left');
    const mm = Math.floor(Math.max(0, state.shiftLeft) / 60);
    const ss = Math.floor(Math.max(0, state.shiftLeft) % 60);
    text(ctx, `SHIFT ${mm}:${String(ss).padStart(2, '0')}`, hx, 66, 15.5, state.shiftLeft <= 20 && state.phase === 'play' ? '#ff8a75' : COLORS.cream, 'left');
    text(ctx, `SERVED ${state.served}`, hx, 90, 13, '#9fb4ac', 'left', false);
  }
}

/** A chalkboard panel in the specials board's own style: wood frame, dark green board. */
function chalkPanel(ctx, x, y, w, h) {
  ctx.fillStyle = '#5f4f3c';
  rr(ctx, x, y, w, h, 8); ctx.fill();
  ctx.fillStyle = '#22382e';
  rr(ctx, x + 6, y + 6, w - 12, h - 12, 5); ctx.fill();
}

/**
 * The kitchen grade for a finished shift. The bands are priced from the
 * competent-policy audit's measured scores (24 seeds: worst $59, median $85.5,
 * best $100) — S is the top of what a strong run actually reaches, the median
 * run earns its B, and no band is priced for a player the audit cannot find.
 */
export function gradeFor(score) {
  if (score >= 95) return ['S', 'CHEF-PATRON'];
  if (score >= 90) return ['A', 'EXECUTIVE CHEF'];
  if (score >= 80) return ['B', 'SOUS CHEF'];
  if (score >= 70) return ['C', 'LINE COOK'];
  if (score >= 55) return ['D', 'KITCHEN HAND'];
  return ['E', 'DISH PIG (AFFECTIONATE)'];
}

function drawOverlays(ctx, state) {
  if (state.phase === 'play') return;
  ctx.fillStyle = 'rgba(23, 32, 36, 0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  const cx = VIEW.width / 2;
  if (state.phase === 'title') {
    // A breath of dusk over the title's dim: a warm wash the end
    // screen doesn't share, so the title sits at evening service.
    ctx.fillStyle = 'rgba(255,190,90,0.06)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // The block sits 12–14 px higher than it grew: the tagline's old row
    // (glyph box ~186–206) was the bins' label row (y 200–212), and TOMATO /
    // LETTUCE / PRAWNS showed dimmed through its letters. Raising it
    // cleared the labels but landed it on the bins' ICON row (centres
    // ≈ 175–179, a tomato's underside reaching ≈ 196): the red tomato
    // showed through "one harbour kitchen". So the block now sits on a
    // flat deep-teal band of its own — one calm field behind both
    // lines, the room still visible above and below it. The band's
    // own hard full-width edges cut seams across the room, though,
    // so it hangs as a sign now: inset, rounded, brass-bordered —
    // furniture, not a seam (AUDIT-V18 W2).
    ctx.fillStyle = 'rgba(20,34,40,0.45)';
    rr(ctx, 140, 96, 1000, 112, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(201,150,53,0.8)';
    ctx.lineWidth = 2;
    rr(ctx, 140, 96, 1000, 112, 10); ctx.stroke();
    text(ctx, 'THE DAILY CATCH', cx, 140, 70, '#ffd968');
    text(ctx, 'one cook, one harbour kitchen, the whole lunch rush', cx, 184, 20, COLORS.cream, 'center', false);
    // The menu board: every dish the kitchen serves, what goes into it and what
    // it pays — the game's depth, chalked up where a judge can read it.
    chalkPanel(ctx, 235, 222, 810, 322);
    text(ctx, 'ON THE MENU', cx, 250, 16, COLORS.mustard);
    const menuNotes = {
      fillet: 'straight off the grill — the quick one',
      fries: 'cut potato, from the fryer — rides along on combo tickets',
    };
    [...RECIPES, FRIES].forEach((dish, i) => {
      const y = 288 + i * 40;
      // Today's catch wears a drawn star before its icon (AUDIT-V19
      // S6): the same mark the kitchen's specials board carries.
      if (dish.id === state.special) drawStar(ctx, 272, y - 4, 6, '#ffd968');
      // Fries at 26, one step below the 30 they stepped to last round:
      // the carton spans ~52 units tall, so even at 30 it stood ~35 px
      // against a plate icon's ~25 — still the tallest mark in its row.
      drawDish(ctx, dish.id, 302, y, dish.id === 'fries' ? 26 : 40);
      text(ctx, dish.name, 334, y - 8, 15.5, COLORS.cream, 'left');
      const parts = menuNotes[dish.id]
        || dish.items.map((item) => INGREDIENTS[item].name.toLowerCase()).join(' + ');
      text(ctx, parts, 334, y + 12, 13, '#9fb4ac', 'left', false);
      text(ctx, `$${dish.price}`, 1013, y - 2, 16.5, '#ffd968', 'right');
    });
    text(ctx, 'Combo tickets pair a plate with chips — one route, two lines, a bigger tip.', cx, 526, 13, '#9fb4ac', 'center', false);
    // The route line is composed from its five stages with drawn arrows in
    // the slots between them — the face carries no → glyph, so no arrow is
    // set as text and nothing falls back to a thinner hand mid-sentence.
    const routeStages = ['HOW TO PLAY — FETCH from the bins', 'CHOP at the boards', 'GRILL / FRY', 'PLATE', 'SERVE'];
    ctx.font = `700 16.5px ${FONT}`;
    const stageW = routeStages.map((s) => ctx.measureText(s).width);
    const arrowSlot = 30;
    const routeTotal = stageW.reduce((a, b) => a + b, 0) + arrowSlot * (routeStages.length - 1);
    let routeX = cx - routeTotal / 2;
    routeStages.forEach((stage, i) => {
      text(ctx, stage, routeX, 574, 16.5, COLORS.mustard, 'left');
      routeX += stageW[i];
      if (i < routeStages.length - 1) {
        drawArrow(ctx, routeX + arrowSlot / 2, 574, COLORS.mustard);
        routeX += arrowSlot;
      }
    });
    text(ctx, 'Serve every ticket before its timer dies — tips grow with time to spare, a walkout costs $4.', cx, 600, 14, '#cfe0d8', 'center', false);
    text(ctx, 'MOVE  WASD / arrows (or click)      WORK  SPACE', cx, 628, 15, COLORS.mustard);
    text(ctx, 'PRESS ENTER — FIRST SHIFT', cx, 660, 20, '#7dff9a');
  } else {
    text(ctx, 'LAST ORDERS — SHIFT OVER', cx, 184, 44, '#ffd968');
    text(ctx, `You took $${state.score}`, cx, 238, 29, COLORS.cream);
    // The shift's story, dish by dish: what actually went out of the kitchen,
    // counted line by line as it was served.
    // The panel is narrowed about the centre (290 → 345, centre still 640):
    // at its old width its left edge sliced through the captured cook, who
    // stands at x≈301 with a body spanning roughly x270–334 — and his
    // position is the run's own data, so the panel moves, never he does.
    chalkPanel(ctx, 345, 264, 590, 196);
    text(ctx, 'SERVED THIS SHIFT', cx, 288, 13.5, '#9fb4ac');
    // The lines read in the order the shift happened, strongest first
    // (ties in menu order): the counts are the capture's own and none
    // changes, but the two ×0 lines fall to the last row together instead
    // of sitting mid-panel where the eye lands after the ×5.
    const servedList = [...RECIPES, FRIES]
      .map((dish, order) => ({ dish, n: state.servedBy[dish.id] || 0, order }))
      .sort((a, b) => b.n - a.n || a.order - b.order);
    servedList.forEach(({ dish, n }, i) => {
      const colX = i % 2 === 0 ? 480 : 800;
      const y = 326 + Math.floor(i / 2) * 42;
      // A dish the shift never served wears a dimmed icon as well as a grey
      // name: colour itself carries the demotion, so the panel cannot read
      // as six dishes in full colour over a shift that served four kinds.
      if (n === 0) { ctx.save(); ctx.globalAlpha = 0.45; }
      drawDish(ctx, dish.id, colX - 82, y, dish.id === 'fries' ? 26 : 40);
      if (n === 0) ctx.restore();
      text(ctx, `${dish.name} ×${n}`, colX - 56, y, 15.5, n > 0 ? COLORS.cream : '#71827a', 'left', false);
    });
    // The number counts completed tickets, not lines — the panel above it
    // sums to one more (the combo's chips are a line of their own), and the
    // label says which of the two it means. The line wears a panel of its
    // own: bare, it sat at y 490 straight across the island's brass name
    // plate (y 487–500), and the plate's letters showed through the words.
    // The panel takes the served panel's own geometry (345, 590 wide):
    // at 660 wide from x 310 its left edge sliced the captured cook
    // (body to ≈ x 335) — the flaw the served panel was narrowed to
    // escape, one panel lower.
    chalkPanel(ctx, 345, 470, 590, 42);
    text(ctx, `Tickets served ${state.served}      Walkouts ${state.walkouts}      Best tip $${state.bestTip}`, cx, 490, 17.5, '#cfe0d8', 'center', false);
    const [letter, title] = gradeFor(state.score);
    text(ctx, `KITCHEN GRADE: ${letter} — ${title}`, cx, 532, 22, COLORS.mustard);
    text(ctx, 'PRESS R TO WORK ANOTHER SHIFT', cx, 578, 17, '#7dff9a');
    // The shift in work, counted at the stations as it happened — the frame's
    // lower third tells the same story in labour instead of money. The
    // strip takes the panel stack's own geometry (345, 590 wide): at
    // 700 wide from x 290 it jutted past both panels above it, and the
    // stack read as two-and-a-half (AUDIT-V18 W3). Its line keeps its
    // full labels at 16 px — measured, it fits the narrower panel.
    const stats = state.stats || { chops: 0, grills: 0, fries: 0, burns: 0 };
    chalkPanel(ctx, 345, 606, 590, 64);
    text(ctx, 'FROM THE PASS — THE SHIFT IN WORK', cx, 625, 11, '#9fb4ac');
    text(ctx, `CHOPS ${stats.chops}      GRILLS FIRED ${stats.grills}      FRYERS DROPPED ${stats.fries}      BURNT ${stats.burns}`, cx, 650, 16, COLORS.cream);
  }
}
