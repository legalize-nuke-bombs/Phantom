// Game presentation — the single source of truth for each game's emoji and label.
//
// Every place that shows a game (nav, history rows, stat cards, badges) pulls its
// emoji and Russian name from here, so the look stays consistent and one edit
// updates the whole app. Resolve via gameMeta(type) — it falls back gracefully for
// any game type the backend adds before the frontend knows about it.

import type { GameType } from '@/shared/types';

/** What we render for a game: its emoji and its Russian display name. */
export interface GameMeta {
  emoji: string;
  name: string;
}

/**
 * Emoji + label per GameType.
 * NOTE: CASES uses a BOX 📦 on purpose — NOT a gift 🎁. Gifts ("presents") are a
 * separate backend feature, and a gift glyph here would conflate the two.
 */
export const GAME_META: Record<GameType, GameMeta> = {
  CASES: { emoji: '📦', name: 'Ящики' },
  FRUITS: { emoji: '🍇', name: 'Фрукты' },
  COINFLIP: { emoji: '🪙', name: 'Монетка' },
  UPGRADER: { emoji: '📈', name: 'Upgrader' },
};

/**
 * Meta for a game type, falling back to the raw enum name as the label (and a
 * neutral 🎮 glyph) for any type not yet in GAME_META — so new backend games still
 * render something sensible instead of crashing.
 */
export function gameMeta(type: GameType | string): GameMeta {
  return GAME_META[type as GameType] ?? { emoji: '🎮', name: String(type) };
}

/**
 * Lottery presentation. Kept SEPARATE from GAME_META because the lottery is not a
 * GameType on the backend — it is its own feature with its own endpoints.
 */
export const LOTTERY_META: GameMeta = { emoji: '🎟️', name: 'Лотерея' };
