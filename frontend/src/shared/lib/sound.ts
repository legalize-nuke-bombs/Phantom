// sound.ts — file-based SFX for the casino feel. Plays the .wav set (assets/sounds) via
// Web Audio (decoded into AudioBuffers for low, repeatable latency). A single AudioContext
// is created lazily and resumed on the first user gesture (autoplay policy); every sample is
// preloaded on that first gesture so in-game cues fire instantly. A persisted mute flag
// (localStorage 'phantom.muted') silences everything.
//
// Surface:
//   const h = sfx.startSpin(); … ; h.stop();  // start.wav now, stop.wav on stop
//   sfx.win();                                // a win (coinflip / cases / upgrader)
//   sfx.match(k);                             // a slot pattern match, tiered low→jackpot by k
//   sfx.lose();                               // a loss
//   sfx.notify();                             // a notification
//
// Mute toggle for a header control:
//   const { muted, toggle } = useSound();

import { useCallback, useSyncExternalStore } from 'react';

import loseUrl from '@/assets/sounds/lose.wav';
import matchHighUrl from '@/assets/sounds/match-high.wav';
import matchJackpotUrl from '@/assets/sounds/match-jackpot.wav';
import matchLowUrl from '@/assets/sounds/match-low.wav';
import matchMidUrl from '@/assets/sounds/match-mid.wav';
import notifyUrl from '@/assets/sounds/notify.wav';
import startUrl from '@/assets/sounds/start.wav';
import stopUrl from '@/assets/sounds/stop.wav';
import winUrl from '@/assets/sounds/win.wav';

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

/* ── sample cache (fetch + decode once, replay cheaply) ──────────────────── */

const ALL_URLS = [
  startUrl,
  stopUrl,
  winUrl,
  loseUrl,
  notifyUrl,
  matchLowUrl,
  matchMidUrl,
  matchHighUrl,
  matchJackpotUrl,
];

const buffers = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<AudioBuffer | null>>();

/** Fetch + decode a sample once; cached thereafter. Null on any failure (stays silent). */
function load(c: AudioContext, url: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(url);
  if (cached) return Promise.resolve(cached);
  let p = pending.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((ab) => c.decodeAudioData(ab))
      .then((buf) => {
        buffers.set(url, buf);
        pending.delete(url);
        return buf;
      })
      .catch(() => {
        pending.delete(url);
        return null;
      });
    pending.set(url, p);
  }
  return p;
}

/** Decode every sample up front so the first in-game cue isn't late. */
function preload(): void {
  const c = audio();
  if (!c) return;
  for (const url of ALL_URLS) void load(c, url);
}

// A user gesture is required before audio may start. On the first one we resume the context
// and preload the samples, then stop listening.
if (typeof window !== 'undefined') {
  const onGesture = () => {
    const c = audio();
    if (c && c.state === 'suspended') void c.resume();
    preload();
    window.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
  };
  window.addEventListener('pointerdown', onGesture, { passive: true });
  window.addEventListener('keydown', onGesture, { passive: true });
}

/** Play a one-shot sample (mute-aware, lazy-decoded, fire-and-forget). */
function play(url: string): void {
  if (muted) return;
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  void load(c, url).then((buf) => {
    if (!buf || muted) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start();
  });
}

/* ── public sounds ──────────────────────────────────────────────────────── */

export interface SpinHandle {
  /** Stop the spin — plays the land/stop cue once (idempotent). */
  stop: () => void;
}

/** Spin start cue; the returned handle plays the land/stop cue when stopped. */
function startSpin(): SpinHandle {
  play(startUrl);
  let stopped = false;
  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      play(stopUrl);
    },
  };
}

// A win, escalated by the win/bet RATIO — bigger relative payouts get a bigger cue. With no
// ratio (a flat binary win like coinflip) we play the base win sting. Slot patterns pass
// their per-pattern k (= that pattern's win/bet), upgrader its target multiplier, cases the
// won/cost ratio — all the same scale, so one threshold ladder covers them.
function winUrlFor(ratio: number): string {
  if (ratio >= 20) return matchJackpotUrl;
  if (ratio >= 5) return matchHighUrl;
  if (ratio >= 2) return matchMidUrl;
  return matchLowUrl;
}

/* ── exports ────────────────────────────────────────────────────────────── */

/** The flat SFX surface every page calls. */
export const sfx = {
  startSpin,
  win: (ratio?: number) => play(ratio == null ? winUrl : winUrlFor(ratio)),
  lose: () => play(loseUrl),
  notify: () => play(notifyUrl),
} as const;

export type Sfx = typeof sfx;

/**
 * React binding for the mute control. Re-renders on mute changes so a header toggle stays
 * in sync across the app. `sfx` is the same flat surface as above.
 */
export function useSound() {
  const mutedNow = useSyncExternalStore(subscribeMuted, isMuted, isMuted);
  const set = useCallback((next: boolean) => setMuted(next), []);
  const toggle = useCallback(() => toggleMuted(), []);
  return { muted: mutedNow, setMuted: set, toggle, sfx };
}
