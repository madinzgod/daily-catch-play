// A tiny seeded random generator (mulberry32). One seed always deals the same shift,
// which is what makes the screenshot scenes and any replay come out identical.

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Random integer in [min, max], both ends included. */
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of a non-empty array. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}
