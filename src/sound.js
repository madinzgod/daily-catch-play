// Tiny synthesized sounds — a chop thock, a fryer sizzle tick, the service bell — made
// with WebAudio oscillators so the game ships no audio files. Silent until the first
// user gesture, and silent forever in screenshot mode.

/** The whole sound set, one tiny synth voice per thing that happens in the kitchen. */
export const sfx = {
  pickup() { tone(520, 0.06, 'triangle', 0.12); },
  place() { tone(340, 0.07, 'triangle', 0.12); },
  chop() { tone(180, 0.05, 'square', 0.1, 90); },
  ready() { tone(880, 0.12, 'sine', 0.14); tone(1320, 0.16, 'sine', 0.1); },
  serve() { tone(1174, 0.1, 'sine', 0.14); setTimeout(() => tone(1568, 0.18, 'sine', 0.12), 70); },
  error() { tone(140, 0.12, 'sawtooth', 0.08, 110); },
  walkout() { tone(300, 0.25, 'sine', 0.1, 160); },
};

let ctx = null;
let enabled = false;

export function enableSound() {
  enabled = true;
}

function tone(freq, seconds, type, gain, slideTo) {
  if (!enabled) return;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  } catch {
    // No audio on this machine: the game plays on without it.
  }
}
