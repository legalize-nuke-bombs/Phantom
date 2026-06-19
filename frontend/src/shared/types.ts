// Core DTOs inferred from the backend *Representation classes
// (com.example.phantom.*). Kept minimal — fields the early pages actually need.
// Uncertain / privacy-gated fields are optional.

export type Role = 'USER' | 'CHAT_MODERATOR' | 'OWNER';

export type PrivacySetting = 'EVERYONE' | 'NOBODY';

/** UserFullRepresentation — GET /api/users/me, /api/users/by-id/{id}. */
export interface User {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  registeredAt?: number;
  gameHistoryPrivacySetting?: PrivacySetting;
  gameStatsPrivacySetting?: PrivacySetting;
  experiencePrivacySetting?: PrivacySetting;
  lotteryPrivacySetting?: PrivacySetting;
}

/** UserShortRepresentation — embedded in lists, chat, presents, etc. */
export interface ShortUser {
  id: number;
  displayName: string;
  role: Role;
}

/** WalletRepresentation — GET /api/wallets/me. balance is a decimal string. */
export interface Wallet {
  id: number;
  balance: string;
}

/** The eight ranks, low → high (LevelRepresentation.name is one of these). */
export type LevelName =
  | 'Whisper'
  | 'Echo'
  | 'Shade'
  | 'Wisp'
  | 'Spectre'
  | 'Phantom'
  | 'Revenant'
  | 'Reaper';

/** LevelRepresentation — GET /api/experience/levels. */
export interface Level {
  name: LevelName;
  amount: number;
  features: string[];
}

/** ExperienceRepresentation — GET /api/experience/{userId}. */
export interface Experience {
  id: number;
  level: Level | null;
  amount: number;
  /** XP threshold of the next level, or null at max rank. */
  next: number | null;
}
