// Keyboard and pointer input: held keys for walking, edge-triggered presses for actions,
// a click-to-walk target, and a tap point the game reads once per press — the pointer
// half is what a touch screen has, so taps are recorded exactly like clicks.
// Nothing here knows what the keys mean.

export function attachInput(target) {
  target.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) pressed.add(event.code);
    held.add(event.code);
  });
  target.addEventListener('keyup', (event) => held.delete(event.code));
  target.addEventListener('blur', () => held.clear());
}

export function attachClicks(canvas, toWorld) {
  canvas.addEventListener('pointerdown', (event) => {
    clickTarget = toWorld(event.clientX, event.clientY);
    tapPoint = clickTarget;
  });
}

// The listener state the functions above fill and the ones below read.
const held = new Set();
const pressed = new Set();
let clickTarget = null;
let tapPoint = null;

export function isDown(code) {
  return held.has(code);
}

/** True once per physical press; the game loop consumes the set every frame. */
export function wasPressed(code) {
  return pressed.has(code);
}

export function clearPressed() {
  pressed.clear();
}

export function takeClickTarget() {
  const target = clickTarget;
  clickTarget = null;
  return target;
}

/** Aim the walk at a point the game chose (a station's doorstep, say). */
export function setClickTarget(point) {
  clickTarget = point;
}

/** The most recent tap or click, in world coordinates — read once, then gone. */
export function takeTap() {
  const tap = tapPoint;
  tapPoint = null;
  return tap;
}

export function peekClickTarget() {
  return clickTarget;
}

export function dropClickTarget() {
  clickTarget = null;
}
