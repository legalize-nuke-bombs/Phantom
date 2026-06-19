// Core DTOs — verified against the backend *Representation / *Request classes
// (com.example.phantom.*). Do NOT trust the generated ENDPOINTS.md for shapes.

export type Role = 'USER' | 'CHAT_MODERATOR' | 'OWNER';

export type PrivacySetting = 'EVERYONE' | 'ONLY_YOU';

/** UserFullRepresentation — GET /api/users/me, /api/users/by-id/{id}, /by-username/{u}. */
export interface User {
  id: number;
  username: string;
  displayName: string;
  registeredAt: number; // epoch seconds
  role: Role;
  gameHistoryPrivacySetting: PrivacySetting;
  gameStatsPrivacySetting: PrivacySetting;
  experiencePrivacySetting: PrivacySetting;
  lotteryPrivacySetting: PrivacySetting;
}

/** UserShortRepresentation — embedded in lists, chat, presents, games, etc. */
export interface ShortUser {
  id: number;
  displayName: string;
  role: Role;
}

/** WalletRepresentation — GET /api/wallets/me. balance is an internal USD decimal string. */
export interface Wallet {
  id: number;
  balance: string;
}

/** The eight ranks, low → high by XP threshold. */
export type LevelName =
  | 'Whisper'
  | 'Echo'
  | 'Shade'
  | 'Wisp'
  | 'Spectre'
  | 'Phantom'
  | 'Revenant'
  | 'Reaper';

/** Ranks in ascending XP order (Level enum declaration order in the backend). */
export const RANKS_ASC: readonly LevelName[] = [
  'Whisper',
  'Echo',
  'Shade',
  'Wisp',
  'Spectre',
  'Phantom',
  'Revenant',
  'Reaper',
];

/** LevelRepresentation — GET /api/experience/levels. */
export interface Level {
  name: LevelName;
  amount: number; // XP threshold
  features: string[];
}

/**
 * ExperienceRepresentation — GET /api/experience/{userId}.
 * IMPORTANT: `level` serializes as the enum NAME (a string), not an object.
 */
export interface Experience {
  id: number;
  level: LevelName | null;
  amount: number; // current XP
  next: number | null; // XP threshold of the next rank, null at max rank
}

/** UserStatRepresentation — GET /api/users/stats (public, no auth). */
export interface UserStats {
  totalUsers: number;
  totalUsers24h: number;
}

/** PlatformGameStatRepresentation — GET /api/games/stats (public, no auth). Decimals are strings. */
export interface PlatformGameStats {
  totalGames: number;
  totalGames24h: number;
  maxWin: string;
  maxWin24h: string;
}

export type GameType = 'CASES' | 'UPGRADER' | 'COINFLIP' | 'FRUITS';

/** GameRepresentation (subset) — GET /api/games/history (requires auth). Decimals are strings. */
export interface GameHistoryEntry {
  id: number;
  user: ShortUser;
  gameType: GameType;
  timestamp: number;
  bet: string;
  result: string;
}
