// Referral program (route: /profile/referrals). Own invite link, earnings, claim,
// and the list of invited users.
//
// Backend (com.example.phantom.ref):
//   • GET  /api/ref                       → { id, amount, total }   (decimals as strings)
//       amount = доступно к выводу, total = всего заработано
//   • POST /api/ref/claim                 → updated { id, amount, total }
//       moves `amount` into the wallet and zeroes it
//   • GET  /api/ref/members?limit&before  → ShortUser[], ordered by id DESC
//       cursor-paginated: pass the LAST (smallest) id as `before` for the next page;
//       a short page (< limit) means there are no more members.
//
// The invite link is just our register URL with ?refId=<currentUserId>, matching
// what RegisterPage reads from the query string.

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, Gift, Link2, Users, Wallet } from 'lucide-react';

import { api } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import { useRefreshBalance } from '@/shared/lib/wallet';
import type { ShortUser } from '@/shared/types';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';
import UserChip from '@/shared/ui/UserChip';

const MEMBERS_PAGE_SIZE = 100;
const REF_QUERY_KEY = ['ref'] as const;

interface RefStorage {
  id: number;
  amount: string; // доступно к выводу (USD decimal string)
  total: string; // всего заработано
}

/* ── invite link ───────────────────────────────────────────────────────── */
function InviteCard({ userId }: { userId: number }) {
  const link = `${window.location.origin}/register?refId=${userId}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const ta = document.createElement('textarea');
        ta.value = link;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-muted">
        <Link2 size={16} strokeWidth={2} />
        <h2 className="text-sm font-medium">Ваша ссылка</h2>
      </div>
      <p className="mb-3 text-sm leading-relaxed text-muted">
        Приглашайте друзей по ссылке и получайте процент с их ставок.
      </p>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 truncate rounded-xl bg-panel-2 border border-edge px-3 py-2.5 font-mono text-sm text-fg">
          {link}
        </code>
        <Button
          type="button"
          variant="ghost"
          onClick={copy}
          aria-label="Скопировать ссылку"
          className="shrink-0 px-3"
        >
          {copied ? <Check size={16} className="text-win" /> : <Copy size={16} />}
          <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Копировать'}</span>
        </Button>
      </div>
    </Card>
  );
}

/* ── earnings + claim ──────────────────────────────────────────────────── */
function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-panel-2 border border-edge px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function EarningsCard() {
  const qc = useQueryClient();
  const refreshBalance = useRefreshBalance();
  const query = useQuery<RefStorage>({
    queryKey: REF_QUERY_KEY,
    queryFn: () => api.get<RefStorage>('/ref'),
  });

  const claim = useMutation({
    mutationFn: () => api.post<RefStorage>('/ref/claim'),
    onSuccess: async (data) => {
      // The claim returns the updated storage — seed it so the UI is instant —
      // then refresh the wallet and re-fetch ref state.
      qc.setQueryData(REF_QUERY_KEY, data);
      await refreshBalance();
      qc.invalidateQueries({ queryKey: REF_QUERY_KEY });
    },
  });

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-muted">
        <Wallet size={16} strokeWidth={2} />
        <h2 className="text-sm font-medium">Заработок</h2>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-2">
          <Spinner size={20} />
        </div>
      ) : query.isError || !query.data ? (
        <p className="text-sm text-lose">
          {errorMessage(query.error, 'Не удалось загрузить заработок')}
        </p>
      ) : (
        <ClaimSection
          storage={query.data}
          onClaim={() => claim.mutate()}
          pending={claim.isPending}
          error={claim.isError ? errorMessage(claim.error, 'Не удалось забрать') : null}
        />
      )}
    </Card>
  );
}

function ClaimSection({
  storage,
  onClaim,
  pending,
  error,
}: {
  storage: RefStorage;
  onClaim: () => void;
  pending: boolean;
  error: string | null;
}) {
  const available = Number(storage.amount);
  const nothingToClaim = !Number.isFinite(available) || available <= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Доступно к выводу" value={<Amount value={storage.amount} />} />
        <StatTile label="Всего заработано" value={<Amount value={storage.total} />} />
      </div>

      {error && <p className="text-sm text-lose">{error}</p>}

      <Button
        type="button"
        onClick={onClaim}
        loading={pending}
        disabled={nothingToClaim}
        className="self-start"
      >
        <Gift size={16} strokeWidth={2} />
        Забрать
      </Button>
    </div>
  );
}

/* ── members list (cursor-paginated) ───────────────────────────────────── */
/**
 * Invited users, oldest-cursor pagination. The backend orders by id DESC and
 * filters `id < before`, so the cursor for the next page is the LAST id on the
 * current page; a page shorter than the limit means there are no more.
 */
function useRefMembers() {
  return useInfiniteQuery({
    queryKey: ['ref', 'members'],
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: String(MEMBERS_PAGE_SIZE) });
      if (pageParam != null) qs.set('before', String(pageParam));
      return api.get<ShortUser[]>(`/ref/members?${qs.toString()}`);
    },
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < MEMBERS_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].id,
  });
}

function MembersList() {
  const query = useRefMembers();
  const members = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);

  // ONE batch request for every loaded member's level (hidden users are omitted).
  const ids = useMemo(() => members.map((m) => m.id), [members]);
  const levels = useExperienceBatch(ids);

  let body: ReactNode;
  if (query.isLoading) {
    body = (
      <div className="flex justify-center py-2">
        <Spinner size={20} />
      </div>
    );
  } else if (query.isError && members.length === 0) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-lose">{errorMessage(query.error, 'Не удалось загрузить список')}</p>
        <Button type="button" variant="ghost" onClick={() => query.refetch()}>
          Повторить
        </Button>
      </div>
    );
  } else if (members.length === 0) {
    body = (
      <div className="flex items-center gap-2 py-1 text-sm text-muted">
        <Users size={15} strokeWidth={2} />
        Пока никого не приглашено
      </div>
    );
  } else {
    body = (
      <>
        <ul className="divide-y divide-edge">
          {members.map((m) => (
            <li key={m.id} className="py-3">
              <UserChip user={m} level={levelFor(levels.data, m.id)} size={32} />
            </li>
          ))}
        </ul>

        {query.isError && (
          <p className="mt-3 text-sm text-lose">
            {errorMessage(query.error, 'Не удалось загрузить ещё')}
          </p>
        )}

        {query.hasNextPage && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => query.fetchNextPage()}
            loading={query.isFetchingNextPage}
            className="mt-4 w-full"
          >
            Показать ещё
          </Button>
        )}
      </>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-muted">
        <Users size={16} strokeWidth={2} />
        <h2 className="text-sm font-medium">Приглашённые</h2>
      </div>
      {body}
    </Card>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */
export default function ReferralPage() {
  const { user } = useAuth();
  // ProtectedRoute guarantees a user; memo keeps the invite link stable.
  const userId = useMemo(() => user?.id ?? null, [user]);

  if (userId == null) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div>
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Профиль
        </Link>
        <div className="mt-3 flex items-center gap-2 text-fg">
          <Gift size={20} strokeWidth={2} />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Рефералы</h1>
        </div>
      </div>

      <InviteCard userId={userId} />
      <EarningsCard />
      <MembersList />
    </div>
  );
}
