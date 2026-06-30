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
//   • settle()      → refresh the wallet (call when the outcome animation ENDS)
//
// Games that reveal instantly (cases, coinflip, fruits) just call play(data).
// Games that want to show the serverHash first (e.g. an upgrader "armed" state)
// call commit(data), let the user see round.serverHash, then call reveal().
//
// On a result we re-derive the serverSeed's hash (verifyServerHash) into `verified`.
//
// Balance, and why it's a TWO-STEP refresh: the bet moves the balance the instant
// /run resolves, but every game then plays an outcome animation (the coin settles,
// the reels decelerate, the cursor lands). Refreshing the wallet on resolve would
// flash the win/loss on the header balance BEFORE the animation reveals it — a
// spoiler. So reveal() only MARKS the wallet stale (no refetch, balance unchanged),
// and the game calls settle() when its animation finishes to do the actual refetch,
// keeping the balance in lockstep with the reveal. settle() is idempotent (guarded),
// so a game can also call it from unmount cleanup: if the player leaves mid-
// animation it fires immediately; and even if it never fires, the stale mark means
// the always-mounted header refetches the wallet on its next cycle anyway.

import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useMarkBalanceStale, useRefreshBalance } from '@/shared/lib/wallet';
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
  /**
   * Refresh the wallet now — call the MOMENT the outcome animation finishes (e.g. in
   * an onSettled callback or after the settle timer), NOT on play()/reveal(), so the
   * balance updates in lockstep with the reveal instead of spoiling it. Idempotent
   * per round (safe to also call from unmount cleanup); a no-op once already settled
   * or before any round has resolved.
   */
  settle: () => void;
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
  const markBalanceStale = useMarkBalanceStale();

  // The committed serverHash, held in a ref so reveal() can verify against it
  // without depending on a state value (avoids a stale-closure read).
  const serverHashRef = useRef<string | null>(null);

  // Has settle() already refreshed the wallet for the current round? Guards against
  // a double refetch when a game calls settle() both on animation-end and on unmount.
  // Armed by reveal() (a fresh round is pending a settle), disarmed once settled.
  const pendingSettleRef = useRef(false);

  const reset = useCallback(() => {
    serverHashRef.current = null;
    pendingSettleRef.current = false;
    setRound(INITIAL);
  }, []);

  // Refresh the wallet, once per resolved round. Called by the game when its outcome
  // animation finishes, so the balance updates in step with the reveal — never before.
  const settle = useCallback(() => {
    if (!pendingSettleRef.current) return;
    pendingSettleRef.current = false;
    refreshBalance().catch(() => {});
  }, [refreshBalance]);

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

    // Only the run itself is allowed to fail the round. Once it resolves, the bet
    // is placed and the outcome is decided — so verification and the balance
    // refresh are strictly best-effort and can NEVER throw the round into `error`
    // (that was the bug: crypto.subtle is absent over http → verify threw → every
    // game "broke" right after a successful run).
    let result: GameResult;
    try {
      const clientSeed = generateClientSeed();
      result = await runRound(game, clientSeed);
    } catch (e) {
      return fail(e);
    }

    let verified: boolean | null = null;
    try {
      verified = committed ? await verifyServerHash(result.serverSeed, committed) : null;
    } catch {
      verified = null;
    }

    setRound((r) => ({ ...r, status: 'done', result, verified, error: null }));

    // The bet moved the balance, but the outcome animation hasn't played yet. Mark the
    // wallet stale WITHOUT refetching (so the shown balance doesn't reveal the result
    // early) and arm settle(): the game refreshes for real when the animation ends. The
    // stale mark also backstops the unmount case — the header refetches it regardless.
    pendingSettleRef.current = true;
    markBalanceStale().catch(() => {});

    return result;
  }, [game, markBalanceStale, fail]);

  const play = useCallback(
    async (data: Record<string, string>): Promise<GameResult> => {
      await commit(data);
      return reveal();
    },
    [commit, reveal],
  );

  const busy = round.status === 'committing' || round.status === 'revealing';

  return { ...round, commit, reveal, play, settle, reset, busy };
}
