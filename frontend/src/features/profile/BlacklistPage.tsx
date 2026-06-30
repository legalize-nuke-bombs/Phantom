// The signed-in user's blacklist (route: /profile/blacklist) — everyone I've blocked, with
// an unblock for each. A block forbids the 1:1 chat in either direction (see
// shared/chat/blacklist), and it's invisible to the blocked person, so this page is the ONLY
// place to review and lift my own blocks. Lifted out of the profile so that surface stays
// compact; the profile's per-user "Заблокировать" feeds this list.
//
// The list is keyset-paginated (id DESC) with a "Показать ещё" button, mirroring the
// leaderboard / profile history. Ranks for the avatars are batched once per page via
// useExperienceBatch (hidden users fall back to the ◇ glyph).

import { useState } from 'react';
import { ShieldOff } from 'lucide-react';

import { errorMessage } from '@/shared/api/errors';
import {
  useMyBlacklist,
  useUnblockUser,
  type BlackRepresentation,
} from '@/shared/chat/blacklist';
import { levelFor, useExperienceBatch } from '@/shared/lib/experience';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import PageBack from '@/shared/ui/PageBack';
import Spinner from '@/shared/ui/Spinner';
import UserChip from '@/shared/ui/UserChip';

/**
 * One blacklist row: the blocked user (the entry's `target`) + a two-step inline unblock.
 * The first click arms a danger-styled "точно?" confirm in place — the same destructive idiom
 * used across the app — so a stray tap can't silently lift a block.
 */
function BlacklistRow({
  entry,
  level,
}: {
  entry: BlackRepresentation;
  level: ReturnType<typeof levelFor>;
}) {
  const unblock = useUnblockUser();
  const [confirm, setConfirm] = useState(false);

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <UserChip user={entry.target} level={level} size={32} className="min-w-0 flex-1 text-sm font-medium" />
        {confirm ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirm(true)}
            className="shrink-0 border-lose/40 text-lose hover:bg-lose/10"
          >
            Разблокировать
          </Button>
        )}
      </div>

      {confirm ? (
        <div className="flex flex-col gap-2 rounded-xl border border-lose/40 bg-lose/5 p-2">
          <p className="px-1 text-xs text-muted">Снять блокировку с этого пользователя?</p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => unblock.mutate(entry.target.id)}
              loading={unblock.isPending}
              className="flex-1 border-lose/40 text-lose hover:bg-lose/10"
            >
              Разблокировать
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirm(false)}
              disabled={unblock.isPending}
              className="flex-1"
            >
              Отмена
            </Button>
          </div>
          {unblock.isError ? (
            <p className="px-1 text-xs text-lose">
              {errorMessage(unblock.error, 'Не удалось разблокировать')}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function BlacklistPage() {
  const {
    data,
    error,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMyBlacklist();

  const entries = data?.pages.flat() ?? [];
  // Batch the blocked users' ranks for their avatars (hidden → fallback glyph).
  const levels = useExperienceBatch(entries.map((e) => e.target.id));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <PageBack to="/profile" label="К профилю" />

      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-muted">
          <ShieldOff size={20} strokeWidth={2} />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-fg">Чёрный список</h1>
      </header>

      {isLoading ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Spinner size={32} />
        </div>
      ) : isError ? (
        <Card className="p-8 text-center text-sm text-lose">
          {errorMessage(error, 'Не удалось загрузить чёрный список')}
        </Card>
      ) : entries.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-10 text-center">
          <ShieldOff size={28} className="text-muted" />
          <p className="text-sm text-muted">В чёрном списке пусто</p>
        </Card>
      ) : (
        <>
          <Card className="divide-y divide-edge overflow-hidden p-0">
            <ul>
              {entries.map((entry) => (
                <BlacklistRow key={entry.id} entry={entry} level={levelFor(levels.data, entry.target.id)} />
              ))}
            </ul>
          </Card>

          {hasNextPage ? (
            <div className="flex justify-center pt-1">
              <Button variant="ghost" loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
                Показать ещё
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
