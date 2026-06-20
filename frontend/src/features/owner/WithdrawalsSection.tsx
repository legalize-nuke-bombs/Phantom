// Platform withdrawals — a read-only owner feed of EVERY user's withdrawals, newest
// first. Useful for oversight (who is cashing out, how much, to where, status).
//
//   GET /api/owner/withdrawals/history?limit&before → WithdrawalRepresentation[]

import { Banknote } from 'lucide-react';

import Amount from '@/shared/ui/Amount';
import UserChip from '@/shared/ui/UserChip';
import { formatTime } from '@/shared/lib/time';
import { HistoryList, Section } from './ownerUi';
import { useWithdrawalHistory, type OwnerWithdrawal, type TransferStatus } from './useOwner';

const STATUS: Record<TransferStatus, { label: string; tone: string }> = {
  PENDING: { label: 'В обработке', tone: 'text-warn' },
  CONFIRMED: { label: 'Подтверждён', tone: 'text-win' },
  REJECTED: { label: 'Отклонён', tone: 'text-lose' },
};

function WithdrawalRow({ w }: { w: OwnerWithdrawal }) {
  const status = STATUS[w.status];
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Amount value={w.amount} className="text-sm font-medium" />
          <span className={`text-[11px] font-medium ${status?.tone ?? 'text-muted'}`}>
            {status?.label ?? w.status}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <UserChip user={w.user} size={18} className="text-xs" />
        </div>
        <p className="mt-0.5 truncate font-mono text-[11px] text-muted">{w.receiver}</p>
      </div>
      <span className="shrink-0 text-xs text-muted">{formatTime(w.timestamp, 'short')}</span>
    </li>
  );
}

export default function WithdrawalsSection() {
  const history = useWithdrawalHistory();
  const items = history.data?.pages.flat() ?? [];

  return (
    <Section
      icon={<Banknote size={16} strokeWidth={2} />}
      title="Выводы пользователей"
      description="История выводов всех игроков платформы, новые сверху."
    >
      <HistoryList
        isLoading={history.isLoading}
        isError={history.isError}
        error={history.error}
        items={items}
        emptyText="Выводов пока нет."
        errorText="Не удалось загрузить историю выводов"
        hasNextPage={history.hasNextPage}
        isFetchingNextPage={history.isFetchingNextPage}
        fetchNextPage={() => history.fetchNextPage()}
        onRetry={() => history.refetch()}
        renderItem={(w) => <WithdrawalRow key={w.id} w={w} />}
      />
    </Section>
  );
}
