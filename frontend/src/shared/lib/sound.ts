// sound.ts — a tiny, asset-free SFX system for the casino feel.
//
// Everything is synthesized with the Web Audio API (OscillatorNode / GainNode /
// filtered noise) — no audio files to ship or load. A single AudioContext is
// created lazily on first use and resumed on the first user gesture, satisfying
// browser autoplay policy. A persisted mute flag (localStorage 'phantom.muted')
// silences every sound.
//
// Usage:
//   import { sfx } from '@/shared/lib/sound';
//   sfx.click();                 // UI tap
//   sfx.win(); sfx.lose();       // round outcome
//   sfx.reveal();                // a card/segment flips open
//   const spin = sfx.startSpin(); …; spin.stop();   // looping whirr
//
// In components you can also use the hook for the mute toggle:
//   const { muted, setMuted, sfx } = useSound();

import { useCallback, useSyncExternalStore } from 'react';

const MUTE_KEY = 'phantom.muted';

/* ── mute state (module-level, persisted, observable) ───────────────────── */

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

let muted = readMuted();
const muteListeners = new Set<() => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // storage unavailable — keep the in-memory flag, just don't persist.
  }
  for (const l of muteListeners) l();
}

export function toggleMuted(): void {
  setMuted(!muted);
}

function subscribeMuted(cb: () => void): () => void {
  muteListeners.add(cb);
  return () => muteListeners.delete(cb);
}

/* ── audio context (lazy, gesture-resumed) ──────────────────────────────── */

type WebkitWindow = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

let ctx: AudioContext | null = null;

/** Get (or lazily create) the shared AudioContext, or null if unsupported. */
function audio(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (globalThis as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

// A user gesture is required before audio may start. We try to resume on the
// first pointer/key event; once resumed we stop listening.
function resume(): void {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
}

if (typeof window !== 'undefined') {
  const onGesture = () => {
    resume();
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
  };
  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture, { passive: true });
}

/**
 * Run `fn` with a live, non-muted context, or no-op. Centralizes the mute check,
 * the null-guard, and the just-in-time resume so each sound stays a one-liner.
 */
function withAudio(fn: (c: AudioContext, now: number) => void): void {
  if (muted) return;
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  fn(c, c.currentTime);
}

/* ── synthesis primitives ───────────────────────────────────────────────── */

type Wave = OscillatorType;

/**
 * One short enveloped oscillator "blip". Attack is near-instant; release is an
 * exponential fade to silence — the shape that reads as a clean UI tone rather
 * than a click-with-tail.
 */
function blip(
  c: AudioContext,
  start: number,
  opts: {
    freq: number;
    /** Slide to this freq by the end (defaults to a flat tone). */
    toFreq?: number;
    dur: number;
    type?: Wave;
    /** Peak gain (0..1). */
    gain?: number;
    /** Destination — defaults to the context output. Used to route via a filter. */
    dest?: AudioNode;
  },
): void {
  const { freq, toFreq, dur, type = 'sine', gain = 0.18, dest } = opts;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (toFreq != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), start + dur);

  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(g).connect(dest ?? c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/* ── public sounds ──────────────────────────────────────────────────────── */

/** Crisp UI tap — buttons, toggles, selections. */
function click(): void {
  withAudio((c, t) => blip(c, t, { freq: 420, toFreq: 560, dur: 0.05, type: 'triangle', gain: 0.14 }));
}

/** Soft tick — incremental steps (e.g. a value landing, a chip stepping). */
function tick(): void {
  withAudio((c, t) => blip(c, t, { freq: 880, dur: 0.03, type: 'square', gain: 0.07 }));
}

/**
 * The finish flourish — a few quick ascending blips, so even a non-win still gets
 * "several sounds at the end" (per design) with no hiss.
 */
function reveal(): void {
  withAudio((c, t) => {
    [0, 0.07, 0.14].forEach((dt, i) =>
      blip(c, t + dt, { freq: 480 + i * 200, dur: 0.11, type: 'triangle', gain: 0.13 }),
    );
  });
}

/** Bright ascending arpeggio — a win. */
function win(): void {
  withAudio((c, t) => {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) =>
      blip(c, t + i * 0.075, { freq: f, dur: 0.22, type: 'triangle', gain: 0.16 }),
    );
    // a little shimmer on top of the last note
    blip(c, t + notes.length * 0.075, { freq: 1567.98, dur: 0.3, type: 'sine', gain: 0.08 });
  });
}

/** Gentle descending two-note — a non-win. Soft, never harsh (no "buzzer"). */
function lose(): void {
  withAudio((c, t) => {
    blip(c, t, { freq: 392, toFreq: 311, dur: 0.18, type: 'sine', gain: 0.12 }); // G4→Eb4
    blip(c, t + 0.14, { freq: 261.63, dur: 0.26, type: 'sine', gain: 0.1 }); // C4
  });
}

// The win cues are deliberately SHORT (a single quick chime each): they double as
// the per-pattern sounds in Фрукты, played several times ~0.5s apart, so anything
// longer would smear into mush.

/** Modest win — one short bright ding. For low payouts ("немного"). */
function smallWin(): void {
  withAudio((c, t) => blip(c, t, { freq: 784, dur: 0.13, type: 'triangle', gain: 0.15 })); // G5
}

/** Big win — one short, brighter chime with a faint sparkle ("дохуя"). */
function bigWin(): void {
  withAudio((c, t) => {
    blip(c, t, { freq: 1046.5, dur: 0.16, type: 'triangle', gain: 0.16 }); // C6
    blip(c, t + 0.02, { freq: 1568, dur: 0.18, type: 'sine', gain: 0.08 }); // sparkle
  });
}

/** Notification chime — a soft two-note ding, distinct from the game outcomes. */
function notify(): void {
  withAudio((c, t) => {
    blip(c, t, { freq: 880, dur: 0.12, type: 'sine', gain: 0.12 }); // A5
    blip(c, t + 0.1, { freq: 1174.66, dur: 0.2, type: 'sine', gain: 0.12 }); // D6
  });
}

/* ── spin loop ──────────────────────────────────────────────────────────── */

export interface SpinHandle {
  /** Stop the loop (idempotent). */
  stop: () => void;
}

const NO_SPIN: SpinHandle = { stop: () => {} };

/**
 * Spin start cue. The spin itself is silent now (no continuous hiss/whirr) — we play
 * one short "go" blip and return a no-op handle, so existing callers that do
 * `const h = startSpin(); …; h.stop()` keep working unchanged. The finish (reveal /
 * win / lose) carries the "several sounds at the end".
 */
function startSpin(): SpinHandle {
  withAudio((c, t) =>
    blip(c, t, { freq: 300, toFreq: 660, dur: 0.16, type: 'triangle', gain: 0.16 }),
  );
  return NO_SPIN;
}

/* ── exports ────────────────────────────────────────────────────────────── */

/** The flat SFX surface every page calls. */
export const sfx = {
  click,
  tick,
  reveal,
  win,
  lose,
  smallWin,
  bigWin,
  notify,
  startSpin,
} as const;

export type Sfx = typeof sfx;

/**
 * React binding for the mute control. Re-renders on mute changes so a header
 * toggle stays in sync across the app. `sfx` is the same flat surface as above.
 */
export function useSound() {
  const mutedNow = useSyncExternalStore(subscribeMuted, isMuted, isMuted);
  const set = useCallback((next: boolean) => setMuted(next), []);
  const toggle = useCallback(() => toggleMuted(), []);
  return { muted: mutedNow, setMuted: set, toggle, sfx };
}
