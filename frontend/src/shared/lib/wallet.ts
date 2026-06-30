// The balance — single source of truth.
//
// The wallet balance is read in many places (header, game screens, wallet page)
// and must refresh after almost every action (a bet, a win, a deposit). Funnelling
// every read AND every refresh through ONE query key means a single invalidation
// updates every consumer at once — no prop-drilling, no stale copies.
//
//   • read    → useWallet()
//   • refresh → const refresh = useRefreshBalance(); await refresh();

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import type { Wallet } from '@/shared/types';

/** The one query key for the signed-in user's wallet. Invalidate this to refresh. */
export const WALLET_QUERY_KEY = ['wallet', 'me'] as const;

/** The current user's wallet (GET /api/wallets/me). balance is a USD decimal string. */
export function useWallet() {
  return useQuery({
    queryKey: WALLET_QUERY_KEY,
    queryFn: () => api.get<Wallet>('/wallets/me'),
  });
}

/**
 * Returns a stable function that invalidates the wallet query, prompting every
 * useWallet() consumer to refetch. Call it after any action that moves the balance.
 */
export function useRefreshBalance(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: WALLET_QUERY_KEY }),
    [queryClient],
  );
}

/**
 * Returns a stable function that marks the wallet stale WITHOUT refetching it
 * (refetchType: 'none'). The on-screen balance is left untouched, but the cache is
 * flagged so the next refetch trigger picks up the new value.
 *
 * Used by the games: the bet moves the balance the instant /run resolves, yet the
 * outcome animation is still playing — refetching now would show the win/loss on the
 * header balance BEFORE the animation reveals it (a spoiler). So we mark stale on
 * resolve and do the actual refetch when the animation finishes (useRefreshBalance).
 * Marking stale also guarantees eventual correctness: if the player leaves mid-
 * animation, the always-mounted header observer refetches the stale wallet on its
 * next cycle even if the finish callback never fires.
 */
export function useMarkBalanceStale(): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: WALLET_QUERY_KEY,
        refetchType: 'none',
      }),
    [queryClient],
  );
}
