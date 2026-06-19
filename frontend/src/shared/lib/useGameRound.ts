// useGameRound — the one orchestration hook every game screen drives the round
// through, so the provably-fair handshake lives in exactly one place.
//
// The round is a small state machine:
//
//   idle ──commit()──▶ committing ──▶ ready ──reveal()──▶ revealing ──▶ done
//     ▲                    │            │                    │            │
//     └──────────── reset()/error ◀─────┴────────────────────┴────────────┘
//
//   • commit(data)  → POST /init, store the committed serverHash         (→ ready)
//   • reveal()      → POST /run with a fresh clientSeed, verify the hash  (→ done)
//   • play(data)    → commit then reveal in one shot; returns the result
//
// Games that reveal instantly (cases, coinflip, fruits) just call play(data).
// Games that want to show the serverHash first (e.g. an upgrader "armed" state)
// call commit(data), let the user see round.serverHash, then call reveal().
//
// On a result we re-derive the serverSeed's hash (verifyServerHash) into `verified`
// and refresh the wallet, since the balance moved.

import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useRefreshBalance } from '@/shared/lib/wallet';
import { generateClientSeed, verifyServerHash } from '@/shared/lib/provablyFair';
import { initRound, runRound } from '@/shared/lib/gameApi';
import type { GameResult } from '@/shared/lib/gameApi';
import type { GameType } from '@/shared/types';

/** Where the round currently is. */
export type RoundStatus =
  | 'idle'
  | 'committing'
  | 'ready'
  | 'revealing'
  | 'done'
  | 'error';

export interface GameRound {
  status: RoundStatus;
  /** Committed serverHash from /init — present from `ready` onward. */
  serverHash: string | null;
  /** Server-computed init extras (e.g. coinflip possibleResult), if any. */
  initData?: Record<string, unknown>;
  /** The resolved round — present once `done`. */
  result: GameResult | null;
  /**
   * Whether the revealed serverSeed hashes to the committed serverHash.
   * null until verification completes. Resolved alongside `done`.
   */
  verified: boolean | null;
  /** User-facing error message (status `error`), already localized. */
  error: string | null;
}

/** Convenience flags + state, mirroring the machine for ergonomic rendering. */
export interface UseGameRound extends GameRound {
  /** init → ready (commit the serverHash without revealing). Returns serverHash. */
  commit: (data: Record<string, string>) => Promise<string>;
  /** run → done (reveal with a fresh clientSeed). Must be called after commit. */
  reveal: () => Promise<GameResult>;
  /** commit + reveal in one shot. The simplest path for instant-result games. */
  play: (data: Record<string, string>) => Promise<GameResult>;
  /** Back to idle, clearing the previous round. */
  reset: () => void;
  /** true during committing/revealing — wire to your play button's loading. */
  busy: boolean;
}

const INITIAL: GameRound = {
  status: 'idle',
  serverHash: null,
  initData: undefined,
  result: null,
  verified: null,
  error: null,
};

export function useGameRound(game: GameType): UseGameRound {
  const [round, setRound] = useState<GameRound>(INITIAL);
  const refreshBalance = useRefreshBalance();

  // The committed serverHash, held in a ref so reveal() can verify against it
  // without depending on a state value (avoids a stale-closure read).
  const serverHashRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    serverHashRef.current = null;
    setRound(INITIAL);
  }, []);

  const fail = useCallback((e: unknown): never => {
    setRound((r) => ({ ...r, status: 'error', error: errorMessage(e) }));
    // Re-throw only ApiError-shaped failures so callers can branch if they want;
    // everything else is already surfaced via state.
    throw e instanceof ApiError ? e : new Error(errorMessage(e));
  }, []);

  const commit = useCallback(
    async (data: Record<string, string>): Promise<string> => {
      setRound({ ...INITIAL, status: 'committing' });
      serverHashRef.current = null;
      try {
        const init = await initRound(game, data);
        serverHashRef.current = init.serverHash;
        setRound({
          status: 'ready',
          serverHash: init.serverHash,
          initData: init.data,
          result: null,
          verified: null,
          error: null,
        });
        return init.serverHash;
      } catch (e) {
        return fail(e);
      }
    },
    [game, fail],
  );

  const reveal = useCallback(async (): Promise<GameResult> => {
    const committed = serverHashRef.current;
    setRound((r) => ({ ...r, status: 'revealing', error: null }));
    try {
      const clientSeed = generateClientSeed();
      const result = await runRound(game, clientSeed);
      // Balance moved — refresh every wallet consumer.
      await refreshBalance();
      // Re-derive the committed hash from the now-revealed serverSeed. Without a
      // committed hash there is nothing to check against, so it's unverified.
      const verified = committed
        ? await verifyServerHash(result.serverSeed, committed)
        : false;
      setRound((r) => ({
        ...r,
        status: 'done',
        result,
        verified,
        error: null,
      }));
      return result;
    } catch (e) {
      return fail(e);
    }
  }, [game, refreshBalance, fail]);

  const play = useCallback(
    async (data: Record<string, string>): Promise<GameResult> => {
      await commit(data);
      return reveal();
    },
    [commit, reveal],
  );

  const busy = round.status === 'committing' || round.status === 'revealing';

  return { ...round, commit, reveal, play, reset, busy };
}
