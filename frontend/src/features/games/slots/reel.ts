// Reel mechanics for the FRUITS slot — a genuinely spinning vertical reel.
//
// Each of the 5 columns is a tall strip of symbol art that scrolls upward. While
// spinning, the strip translates continuously (driven by a RAF loop in the page).
// To stop, the column decelerates (ease-out) onto its final 3 symbols. We model a
// column's strip as: [ ...filler (random spin-fodder)..., final[0], final[1], final[2] ]
// and animate the vertical offset up to the rest point where the last 3 cells fill
// the visible window. Columns stop staggered L→R.
//
// IMPORTANT: only the four real backend symbols exist (plum, grape, seven, wild) —
// FruitSlots registers exactly those. No cherry/strawberry/etc., so the spin-fodder
// is drawn from the real four too (anything else would render a phantom symbol).

import grape from '@/assets/symbols/grape.png';
import plum from '@/assets/symbols/plum.png';
import seven from '@/assets/symbols/seven.png';
import wild from '@/assets/symbols/wild.png';

export const ROWS = 3;
export const COLS = 5;

/** Slot art by backend slot name. WILD substitutes for any symbol. */
export const SYMBOL_ART: Record<string, string> = { plum, grape, seven, wild };

/**
 * Spin-fodder that whizzes past mid-spin — ONLY real symbols, roughly weighted like
 * the real reel (plum/grape common, seven/wild rare).
 */
export const SPIN_POOL = [plum, grape, plum, grape, seven, plum, grape, wild];

/** Resolve a backend slot name to its art (fallback to a real symbol, never invent one). */
export function artOf(name: string): string {
  return SYMBOL_ART[name] ?? plum;
}

/** A tall random run of spin-fodder art used as the scrolling filler. */
export function randomFiller(length: number): string[] {
  return Array.from(
    { length },
    () => SPIN_POOL[Math.floor(Math.random() * SPIN_POOL.length)],
  );
}

/** Pull column `x` (top→bottom) out of a row-major grid. */
export function column<T>(grid: T[][], x: number): T[] {
  return grid.map((row) => row[x]);
}

/** Pleasant resting face before the first spin. */
export const IDLE_GRID: string[][] = Array.from({ length: ROWS }, () => [
  'plum',
  'grape',
  'seven',
  'grape',
  'plum',
]);

// ── Timing ──────────────────────────────────────────────────────────────────
/** How many filler frames each column scrolls through before its final 3. */
export const FILLER_LEN = 40;
/** First column's total deceleration time (ms) once the result is in. */
export const BASE_SPIN_MS = 2400;
/** Extra deceleration time per column → clatter stops left→right. */
export const STAGGER_MS = 520;
/**
 * Free-scroll speed while waiting for the server (px per ms), expressed against a
 * cell height. Lower = slower, more readable whirl.
 */
export const FREE_SCROLL_PX_PER_MS_PER_CELL = 1 / 95;

/** Total ms from spin start until the LAST column has come to rest. */
export function settleMs(): number {
  return BASE_SPIN_MS + (COLS - 1) * STAGGER_MS + 80;
}

/** Spin duration for column `index`. */
export function columnSpinMs(index: number): number {
  return BASE_SPIN_MS + index * STAGGER_MS;
}

/** Ease-out so the reel rushes then glides to a precise stop. */
export function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}
