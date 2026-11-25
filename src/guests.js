// The guests at the serve window: one guest per ticket, standing in ticket
// order at the window's front, their face reading their own ticket's timer.
// This module only derives who a guest is and how they feel — the renderer
// draws them, and orders.js records the moment one of them leaves.

import { stationById } from './config.js';

/**
 * Everything the renderer needs about the guest a ticket belongs to:
 * where they stand at the window, what they look like (fixed by their
 * ticket, so a guest never changes face mid-wait), how their patience
 * reads, and which served line they are already holding, if any.
 */
export function guestFor(ticket, index) {
  const frac = Math.max(0, ticket.timeLeft / ticket.timeTotal);
  const doneLine = ticket.items.find((line) => line.done);
  return {
    x: guestSlotX(index),
    feetY: stationById('serve').y + 84,
    look: guestLook(ticket.id),
    mood: frac > 0.5 ? 'content' : frac > 0.25 ? 'flat' : 'cross',
    frac,
    holds: doneLine ? doneLine.dish : null,
  };
}

/** Where the index-th guest stands: a row along the serve window's front,
 * clear of the pass dish at its left end. orders.js uses the same slots
 * for departures, so a guest leaves from exactly where they stood. */
export function guestSlotX(index) {
  return stationById('serve').x + 138 + index * 50;
}

/** A guest's fixed look, hashed from their ticket id: same ticket, same
 * person, every frame of the wait. */
export function guestLook(id) {
  let h = (id * 2654435761) >>> 0;
  h ^= h >>> 11;
  h >>>= 0; // the XOR can sign the hash; the lookups below need it unsigned
  return {
    coat: COATS[h % COATS.length],
    skin: SKINS[(h >>> 3) % SKINS.length],
    hair: HAIRS[(h >>> 5) % HAIRS.length],
    style: (h >>> 7) % 4, // 0 cap, 1 bun, 2 curls, 3 bald with a beard
    build: 0.96 + ((h >>> 9) % 3) * 0.04, // stature, 0.96–1.04 (AUDIT-V20 G1)
  };
}

/** The record of a guest leaving, made at the serve or the walkout:
 * where they stood, who they were, how they feel about it, and — when
 * they were served — the dish they carry away held high. */
export function departureFor(ticket, index, mood, dish) {
  return { x: guestSlotX(index), look: guestLook(ticket.id), mood, dish: dish || null, t: 0 };
}

const COATS = ['#b85c38', '#7a9e43', '#4e7fa6', '#8e5ea2', '#c2a15c', '#5f8a8b'];
const SKINS = ['#f0bd8f', '#c98a5e', '#8a5a3b'];
const HAIRS = ['#4a3220', '#22201e', '#8a8d90', '#a34a28'];
