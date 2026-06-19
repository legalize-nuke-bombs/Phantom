// Typed wrappers over the four game-round endpoints under /api/games/{game}.
// Verified against com.example.phantom.game.GameController + GameService:
//
//   GET    /api/games/{game}        → GameSettings   (game-specific; marker iface)
//   POST   /api/games/{game}/init   { data }         → { serverHash, data? }
//   POST   /api/games/{game}/run    { clientSeed }   → GameRepresentation
//   DELETE /api/games/{game}                          → 204 (cancel pending round)
//
// {game} is the lowercase GameType enum name ("cases", "coinflip", …). The backend
// does GameType.valueOf(game.toUpperCase()), so we lowercase here once.

import { api } from '@/shared/api/client';
import type { GameType, ShortUser } from '@/shared/types';

/** The {game} path segment: a GameType, lowercased (e.g. "coinflip"). */
export function gamePath(game: GameType): string {
  return game.toLowerCase();
}

/**
 * GameSettings is a marker interface on the backend — each game returns its own
 * shape (CaseSettings, CoinFlipSettings, …). Callers narrow it to their own typed
 * settings; we model it as an open record here.
 */
export type GameSettings = Record<string, unknown>;

/** GameInitRepresentation — the server's commitment for a freshly-opened round. */
export interface InitResult {
  /** SHA-256 of the raw serverSeed bytes, hex. Verify after reveal. */
  serverHash: string;
  /** Optional server-computed extras (e.g. coinflip "possibleResult"). */
  data?: Record<string, unknown>;
}

/**
 * GameRepresentation — the resolved round returned by /run.
 * bet/result are BigDecimal on the backend; we keep them as strings to match the
 * rest of shared/types (money is always a decimal string here). data is the
 * per-game result map (e.g. cases → caseName; fruits → data + patternMatches).
 */
export interface GameResult {
  id: number;
  user: ShortUser;
  gameType: GameType;
  timestamp: number;
  bet: string;
  result: string;
  serverSeed: string;
  clientSeed: string;
  data: Record<string, unknown>;
}

/** GET /api/games/{game} — game-specific settings (narrow at the call site). */
export function getGameSettings<T = GameSettings>(game: GameType): Promise<T> {
  return api.get<T>(`/games/${gamePath(game)}`);
}

/**
 * POST /api/games/{game}/init — open a round and commit the serverHash.
 * `data` is the per-game init map (all string values), e.g. { bet, side } for
 * coinflip or { caseName } for cases.
 */
export function initRound(
  game: GameType,
  data: Record<string, string>,
): Promise<InitResult> {
  return api.post<InitResult>(`/games/${gamePath(game)}/init`, { data });
}

/**
 * POST /api/games/{game}/run — resolve the pending round with our client seed.
 * `clientSeed` must be 64 hex chars (see generateClientSeed). Moves the balance.
 */
export function runRound(game: GameType, clientSeed: string): Promise<GameResult> {
  return api.post<GameResult>(`/games/${gamePath(game)}/run`, { clientSeed });
}

/** DELETE /api/games/{game} — cancel the pending round (no body, 204). */
export function cancelRound(game: GameType): Promise<void> {
  return api.del<void>(`/games/${gamePath(game)}`);
}
