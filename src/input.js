// Keyboard and mouse input: held keys for walking, edge-triggered presses for actions,
// and a click-to-walk target for the mouse. Nothing here knows what the keys mean.

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
  });
}

// The listener state the functions above fill and the ones below read.
const held = new Set();
const pressed = new Set();
let clickTarget = null;

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

export function peekClickTarget() {
  return clickTarget;
}

export function dropClickTarget() {
  clickTarget = null;
}
