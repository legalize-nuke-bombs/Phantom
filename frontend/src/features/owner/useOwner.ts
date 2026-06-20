// Owner-console data layer. Every owner capability the backend exposes gets a
// query/mutation hook here, so each section stays a thin view over a hook.
//
// Backend (verified against source — com.example.phantom.owner.*, broadcast.*):
//   POST   /api/owner/change-user-role      { targetId, role, ownerKey? }   → { message }
//   DELETE /api/owner/delete-user           { targetId, ownerKey? }         → 204
//   GET    /api/owner/withdrawals/history?limit&before                      → Withdrawal[]
//   GET    /api/owner/master-wallets/{coin}                                 → { address, balance }
//   POST   /api/owner/master-wallets/{coin} { mnemonic }                    → { message }
//   GET    /api/owner/sweep/schedule                                        → { seconds }
//   POST   /api/owner/sweep/schedule        { seconds }                     → { message }
//   DELETE /api/owner/sweep/schedule                                        → 204
//   GET    /api/owner/sweep/history?limit&before                           → SweepLog[]
//
// (Broadcast — POST /api/broadcast — lives in features/moderation now: it is gated on
// chatModeratorAccess, not ownerAccess, so it is no longer an owner-console concern.)
//
// Owner KEY: change-user-role / delete-user take an OPTIONAL base64 `ownerKey`. The
// backend demands it (ErrorCode.OWNER_KEY_REQUIRED) only when an OWNER-capable role is
// on either side of the change (target's current role and/or the new role grants owner
// access), or when deleting an owner. We always send it when the operator typed one and
// let the backend decide — see OWNER_KEY_HINT in the sections.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, ApiError } from '@/shared/api/client';
import type { CoinType } from '@/shared/lib/coin';
import type { Role, ShortUser } from '@/shared/types';

/* ── shared backend value objects ──────────────────────────────────────────── */

export type TransferStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

/** WithdrawalRepresentation — owner withdrawals feed (every user's withdrawals). */
export interface OwnerWithdrawal {
  id: number;
  user: ShortUser;
  coin: CoinType;
  timestamp: number;
  receiver: string;
  amount: string; // decimal string
  status: TransferStatus;
  hash: string | null;
}

/** SweepLogRepresentation — one swept wallet → master wallet transfer. */
export interface SweepLog {
  id: number;
  timestamp: number;
  coin: CoinType;
  sender: string;
  amount: string; // decimal string
  receiver: string;
  status: string; // "ok" | "failed"
  hash: string | null;
}

/** MasterWalletRepresentation — the configured collection wallet for a coin. */
export interface MasterWallet {
  address: string;
  balance: string; // decimal string (USD-valued)
}

/** The only coin today; the rail is GRAM, the backend enum value is TON. */
export const OWNER_COIN: CoinType = 'TON';

const HISTORY_LIMIT = 100;

/* sweep schedule bounds, mirrored from SweepConstants (seconds). */
export const SWEEP_MIN_SECONDS = 60;
export const SWEEP_MAX_SECONDS = 60 * 60 * 24 * 365; // 31_536_000

/* validation bounds mirrored from the backend *Request constraints. */
export const MNEMONIC_MAX = 500;
export const OWNER_KEY_MAX = 255;

/* query keys ----------------------------------------------------------------- */
export const ownerKeys = {
  withdrawals: ['owner', 'withdrawals'] as const,
  sweepHistory: ['owner', 'sweep', 'history'] as const,
  sweepSchedule: ['owner', 'sweep', 'schedule'] as const,
  masterWallet: (coin: CoinType) => ['owner', 'master-wallet', coin] as const,
};

/* ── role change ────────────────────────────────────────────────────────────── */

export interface ChangeRoleArgs {
  targetId: number;
  role: Role;
  /** base64 owner key — sent only when the operator provided one. */
  ownerKey?: string;
}

export function useChangeRole() {
  return useMutation<{ message: string }, ApiError, ChangeRoleArgs>({
    mutationFn: ({ targetId, role, ownerKey }) =>
      api.post<{ message: string }>('/owner/change-user-role', {
        targetId,
        role,
        ownerKey: ownerKey && ownerKey.length > 0 ? ownerKey : undefined,
      }),
  });
}

/* ── delete user ──────────────────────────────────────────────────────────────── */

export interface DeleteUserArgs {
  targetId: number;
  ownerKey?: string;
}

export function useDeleteUser() {
  return useMutation<void, ApiError, DeleteUserArgs>({
    mutationFn: ({ targetId, ownerKey }) =>
      api.del<void>('/owner/delete-user', {
        targetId,
        ownerKey: ownerKey && ownerKey.length > 0 ? ownerKey : undefined,
      }),
  });
}

/* ── master wallet ────────────────────────────────────────────────────────────── */

/**
 * The currently configured master wallet for a coin. A 400 (MASTER_WALLET_NOT_SET)
 * is the expected "not configured yet" answer, not an error — collapse it to null so
 * the view shows a neutral "not set" state instead of an error banner.
 */
export function useMasterWallet(coin: CoinType = OWNER_COIN) {
  return useQuery<MasterWallet | null, ApiError>({
    queryKey: ownerKeys.masterWallet(coin),
    queryFn: async () => {
      try {
        return await api.get<MasterWallet>(`/owner/master-wallets/${coin}`);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'MASTER_WALLET_NOT_SET') return null;
        throw err;
      }
    },
    retry: false,
  });
}

export function useSetMasterWallet(coin: CoinType = OWNER_COIN) {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, { mnemonic: string }>({
    mutationFn: ({ mnemonic }) =>
      api.post<{ message: string }>(`/owner/master-wallets/${coin}`, { mnemonic }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ownerKeys.masterWallet(coin) });
    },
  });
}

/* ── sweep schedule ───────────────────────────────────────────────────────────── */

export interface SweepSchedule {
  /** Configured interval in seconds, or null when no schedule is set. */
  seconds: number | null;
}

/**
 * The sweep schedule. The backend answers 404 (SWEEP_SCHEDULE_NOT_FOUND) when no
 * schedule exists — the expected "disabled" state, mapped to { seconds: null }.
 */
export function useSweepSchedule() {
  return useQuery<SweepSchedule, ApiError>({
    queryKey: ownerKeys.sweepSchedule,
    queryFn: async () => {
      try {
        const res = await api.get<{ seconds: string }>('/owner/sweep/schedule');
        const n = Number(res.seconds);
        return { seconds: Number.isFinite(n) ? n : null };
      } catch (err) {
        if (err instanceof ApiError && err.code === 'SWEEP_SCHEDULE_NOT_FOUND') {
          return { seconds: null };
        }
        throw err;
      }
    },
    retry: false,
  });
}

export function useSetSweepSchedule() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, { seconds: number }>({
    mutationFn: ({ seconds }) =>
      api.post<{ message: string }>('/owner/sweep/schedule', { seconds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ownerKeys.sweepSchedule });
    },
  });
}

export function useDeleteSweepSchedule() {
  const qc = useQueryClient();
  return useMutation<void, ApiError, void>({
    mutationFn: () => api.del<void>('/owner/sweep/schedule'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ownerKeys.sweepSchedule });
    },
  });
}

/* ── histories (cursor-paginated by id, descending) ───────────────────────────── */

export function useSweepHistory() {
  return useInfiniteQuery({
    queryKey: ownerKeys.sweepHistory,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(HISTORY_LIMIT) });
      if (pageParam !== undefined) params.set('before', String(pageParam));
      return api.get<SweepLog[]>(`/owner/sweep/history?${params}`);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) =>
      last.length < HISTORY_LIMIT ? undefined : last[last.length - 1].id,
  });
}

export function useWithdrawalHistory() {
  return useInfiniteQuery({
    queryKey: ownerKeys.withdrawals,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(HISTORY_LIMIT) });
      if (pageParam !== undefined) params.set('before', String(pageParam));
      return api.get<OwnerWithdrawal[]>(`/owner/withdrawals/history?${params}`);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) =>
      last.length < HISTORY_LIMIT ? undefined : last[last.length - 1].id,
  });
}
