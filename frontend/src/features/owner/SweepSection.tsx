// Sweep schedule + history. "Sweep" is the periodic job that drains every user's
// deposit address into the master wallet.
//
//   GET    /api/owner/sweep/schedule        → { seconds }      (SWEEP_SCHEDULE_NOT_FOUND → off)
//   POST   /api/owner/sweep/schedule        { seconds }        → set/replace the interval
//   DELETE /api/owner/sweep/schedule                           → disable sweeping
//   GET    /api/owner/sweep/history?limit&before               → SweepLog[]
//
// The interval is entered as a NUMBER + a UNIT (минуты / часы / дни) and converted to
// seconds for the POST, clamped to the backend bounds [SWEEP_MIN_SECONDS,
// SWEEP_MAX_SECONDS]. Both set and disable fire directly (reversible) with loading +
// success/error; only the irreversible delete-user action elsewhere is confirmed.
//
// NOTE: there is no manual "sweep now" endpoint — the job runs itself on the
// configured interval, so this section only edits the schedule and reviews the log.

import { useState } from 'react';
import { CheckCircle2, History, Power, RefreshCw, Timer } from 'lucide-react';

import { errorMessage } from '@/shared/api/errors';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Input from '@/shared/ui/Input';
import Spinner from '@/shared/ui/Spinner';
import { formatTime } from '@/shared/lib/time';
import { ErrorLine, HistoryList, Section, SuccessLine } from './ownerUi';
import {
  SWEEP_MAX_SECONDS,
  SWEEP_MIN_SECONDS,
  useDeleteSweepSchedule,
  useSetSweepSchedule,
  useSweepHistory,
  useSweepSchedule,
  type SweepLog,
} from './useOwner';

/* ── unit ⇆ seconds ─────────────────────────────────────────────────────────────
 * The operator picks a unit and types a whole number; we multiply to seconds for the
 * POST. Each unit's seconds-per is ≥ SWEEP_MIN_SECONDS, so the smallest valid entry is
 * always "1 <unit>". */
type Unit = 'minutes' | 'hours' | 'days';

const UNIT_SECONDS: Record<Unit, number> = {
  minutes: 60,
  hours: 3600,
  days: 86400,
};

const UNIT_LABELS: Record<Unit, string> = {
  minutes: 'минуты',
  hours: 'часы',
  days: 'дни',
};

const UNIT_ORDER: readonly Unit[] = ['minutes', 'hours', 'days'];

/** Smallest/largest whole count valid for a unit, given the second bounds. */
function unitBounds(unit: Unit): { min: number; max: number } {
  const per = UNIT_SECONDS[unit];
  return { min: Math.ceil(SWEEP_MIN_SECONDS / per), max: Math.floor(SWEEP_MAX_SECONDS / per) };
}

/** Render a second-count as a short human interval ("каждый час" style: "2 ч."). */
function humanInterval(seconds: number): string {
  if (seconds % 86400 === 0) return `${seconds / 86400} дн.`;
  if (seconds % 3600 === 0) return `${seconds / 3600} ч.`;
  if (seconds % 60 === 0) return `${seconds / 60} мин.`;
  return `${seconds} сек.`;
}

function ScheduleEditor() {
  const schedule = useSweepSchedule();
  const setSchedule = useSetSweepSchedule();
  const remove = useDeleteSweepSchedule();

  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<Unit>('hours');

  const count = Number(value);
  const bounds = unitBounds(unit);
  const validCount =
    value.trim() !== '' && Number.isInteger(count) && count >= bounds.min && count <= bounds.max;

  // Convert to seconds and clamp to the backend bounds — belt-and-braces, the count
  // range above already keeps the product in-bounds.
  const seconds = validCount
    ? Math.min(SWEEP_MAX_SECONDS, Math.max(SWEEP_MIN_SECONDS, count * UNIT_SECONDS[unit]))
    : null;
  const canSubmit = seconds != null && !setSchedule.isPending;

  function submit() {
    if (seconds == null || setSchedule.isPending) return;
    setSchedule.mutate(
      { seconds },
      {
        onSuccess: () => setValue(''),
      },
    );
  }

  const active = schedule.data?.seconds != null;

  return (
    <div className="mb-6 flex flex-col gap-4">
      {/* current state */}
      <div className="rounded-xl border border-edge bg-panel-2 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Текущее расписание
        </p>
        {schedule.isLoading ? (
          <div className="flex justify-center py-2">
            <Spinner size={18} />
          </div>
        ) : schedule.isError ? (
          <div className="flex flex-col items-start gap-2">
            <ErrorLine
              message={errorMessage(schedule.error, 'Не удалось загрузить расписание')}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => schedule.refetch()}>
              Повторить
            </Button>
          </div>
        ) : active ? (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-fg">
              <CheckCircle2 size={16} className="text-win" strokeWidth={2} />
              Текущий интервал: каждые {humanInterval(schedule.data!.seconds!)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove.mutate()}
              loading={remove.isPending}
              className="shrink-0 text-lose hover:text-lose"
            >
              {!remove.isPending && <Power size={15} strokeWidth={2} />}
              Отключить
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Сбор средств отключён.</p>
        )}
        {remove.isError && (
          <div className="mt-2">
            <ErrorLine message={errorMessage(remove.error, 'Не удалось отключить')} />
          </div>
        )}
      </div>

      {/* set / replace */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Интервал сбора</span>
          <div className="flex items-stretch gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={bounds.min}
              max={bounds.max}
              step={1}
              placeholder="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={setSchedule.isPending}
              aria-label="Количество"
              className="flex-1"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              disabled={setSchedule.isPending}
              aria-label="Единица времени"
              className="h-11 shrink-0 rounded-xl border border-edge bg-panel-2 px-3 text-sm text-fg transition-colors focus:border-ton focus:outline-none focus:ring-2 focus:ring-ton disabled:cursor-not-allowed disabled:opacity-50"
            >
              {UNIT_ORDER.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
          {value.trim() !== '' && !validCount && (
            <span className="text-xs text-lose">
              От {bounds.min} до {bounds.max} ({UNIT_LABELS[unit]})
            </span>
          )}
        </div>

        {seconds != null && (
          <p className="text-xs text-muted">
            Средства будут собираться каждые {humanInterval(seconds)}.
          </p>
        )}

        {setSchedule.isError && (
          <ErrorLine message={errorMessage(setSchedule.error, 'Не удалось задать расписание')} />
        )}
        {setSchedule.isSuccess && <SuccessLine>Расписание обновлено</SuccessLine>}

        <Button
          type="button"
          onClick={submit}
          loading={setSchedule.isPending}
          disabled={!canSubmit}
          className="self-start"
        >
          {!setSchedule.isPending && <Timer size={16} strokeWidth={2} />}
          {active ? 'Изменить расписание' : 'Включить сбор'}
        </Button>
      </div>
    </div>
  );
}

function SweepRow({ log }: { log: SweepLog }) {
  const ok = log.status === 'ok';
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Amount value={log.amount} className="text-sm font-medium" />
          <span className={`text-[11px] font-medium ${ok ? 'text-win' : 'text-lose'}`}>
            {ok ? 'Успешно' : 'Ошибка'}
          </span>
        </div>
        <p className="truncate font-mono text-[11px] text-muted">{log.sender}</p>
      </div>
      <span className="shrink-0 text-xs text-muted">{formatTime(log.timestamp, 'short')}</span>
    </li>
  );
}

function SweepHistory() {
  const history = useSweepHistory();
  const items = history.data?.pages.flat() ?? [];

  return (
    <div className="border-t border-edge pt-5">
      <div className="mb-3 flex items-center gap-2 text-muted">
        <History size={15} strokeWidth={2} />
        <h3 className="text-xs font-medium uppercase tracking-wide">Журнал сборов</h3>
      </div>
      <HistoryList
        isLoading={history.isLoading}
        isError={history.isError}
        error={history.error}
        items={items}
        emptyText="Сборов ещё не было."
        errorText="Не удалось загрузить журнал"
        hasNextPage={history.hasNextPage}
        isFetchingNextPage={history.isFetchingNextPage}
        fetchNextPage={() => history.fetchNextPage()}
        onRetry={() => history.refetch()}
        renderItem={(log) => <SweepRow key={log.id} log={log} />}
      />
    </div>
  );
}

export default function SweepSection() {
  return (
    <Section
      icon={<RefreshCw size={16} strokeWidth={2} />}
      title="Сбор средств (Sweep)"
      description="Периодический сбор средств со всех депозитных адресов на мастер-кошелёк. Задайте интервал — задание запускается само, ручного запуска нет."
    >
      <ScheduleEditor />
      <SweepHistory />
    </Section>
  );
}
