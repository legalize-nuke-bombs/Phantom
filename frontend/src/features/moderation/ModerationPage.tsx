// Moderation console (route: /moderation). Surface for the chatModeratorAccess
// capability — today a single tool: broadcasting a global announcement to every
// connected user.
//
// SELF-GATING: gates on the CAPABILITY FLAG (useMyCapabilities → isChatModerator),
// never a role name. Owners carry chatModeratorAccess too, so they keep access. Non-
// moderators (and signed-out users, after auth settles) get an "insufficient rights"
// card — the nav link is hidden for them, but the page must stand on its own. The
// backend re-checks the grant on POST /api/broadcast; this is UX, not security.
//
// The broadcast fans out to ALL online users and cannot be recalled. There is no
// two-step confirm (the prompt asks for none) — it fires directly with a live
// character counter and loading / success / error states.

import { useState } from 'react';
import { Ban, Check, Megaphone, Send, ShieldAlert, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { useMyCapabilities } from '@/shared/lib/roles';
import { formatTime } from '@/shared/lib/time';
import { banExpiry, useBanUser, useUnbanUser, useUserBan } from '@/shared/chat/ban';
import type { User } from '@/shared/types';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Input from '@/shared/ui/Input';
import Spinner from '@/shared/ui/Spinner';
import UserChip from '@/shared/ui/UserChip';
import UserLookup from '@/shared/ui/UserLookup';
import { BROADCAST_MAX, useBroadcast } from './useModeration';

/** Shown to anyone without chat-moderator access. */
function NoAccess() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <Card className="grid place-items-center p-10 text-center">
        <div className="max-w-sm">
          <span className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-edge bg-panel-2 text-lose">
            <ShieldAlert size={24} strokeWidth={2} />
          </span>
          <h1 className="text-lg font-semibold text-fg">Недостаточно прав</h1>
          <p className="mt-1.5 text-sm text-muted">
            Эта панель доступна только модераторам платформы.
          </p>
        </div>
      </Card>
    </div>
  );
}

function BroadcastComposer() {
  const broadcast = useBroadcast();
  const [content, setContent] = useState('');

  const trimmed = content.trim();
  const over = content.length > BROADCAST_MAX;
  const canSubmit = trimmed.length > 0 && !over && !broadcast.isPending;

  function submit() {
    if (!canSubmit) return;
    broadcast.mutate({ content: trimmed }, { onSuccess: () => setContent('') });
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2 text-fg">
        <span className="text-ton">
          <Megaphone size={16} strokeWidth={2} />
        </span>
        <h2 className="text-sm font-semibold">Объявление</h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted">
        Сообщение получат все пользователи онлайн. Отправляется сразу и не может быть
        отозвано — будьте внимательны.
      </p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="broadcast-content" className="text-sm text-muted">
            Текст объявления
          </label>
          <textarea
            id="broadcast-content"
            rows={4}
            placeholder="Например: технические работы в 03:00 МСК…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={broadcast.isPending}
            className={clsx(
              'w-full resize-y rounded-xl px-3 py-2.5 text-sm',
              'bg-panel-2 border border-edge text-fg placeholder:text-muted',
              'transition-colors focus:outline-none focus:ring-2 focus:ring-ton focus:border-ton',
              'disabled:cursor-not-allowed disabled:opacity-50',
              over && 'border-lose focus:ring-lose focus:border-lose',
            )}
          />
          <div className="flex justify-end">
            <span className={clsx('text-xs', over ? 'text-lose' : 'text-muted')}>
              {content.length} / {BROADCAST_MAX}
            </span>
          </div>
        </div>

        {broadcast.isError && (
          <p className="text-sm text-lose">
            {errorMessage(broadcast.error, 'Не удалось отправить объявление')}
          </p>
        )}
        {broadcast.isSuccess && (
          <p className="flex items-center gap-1.5 text-sm text-win">
            <Check size={15} strokeWidth={2} />
            Объявление отправлено
          </p>
        )}

        <Button
          type="button"
          onClick={submit}
          loading={broadcast.isPending}
          disabled={!canSubmit}
          className="self-start"
        >
          {!broadcast.isPending && <Send size={16} strokeWidth={2} />}
          Отправить всем
        </Button>
      </div>
    </Card>
  );
}

/* ── Чёрный список (chat ban) ─────────────────────────────────────────────
   A ban blocks the same set of actions as the chat feature (sending, creating
   chats, adding members) — reading stays allowed. Look up a player, see their
   current ban, then ban (reason + duration) or lift it. Self / fellow-moderator
   bans bounce server-side (CANT_BAN_SELF / CANT_BAN_MODERATOR). */
const BAN_UNITS = [
  { label: 'минут', seconds: 60 },
  { label: 'часов', seconds: 3600 },
  { label: 'дней', seconds: 86400 },
] as const;

function BanTool({ myId }: { myId: number }) {
  const [lookup, setLookup] = useState('');
  const [target, setTarget] = useState<User | null>(null);
  const [reason, setReason] = useState('');
  const [count, setCount] = useState('1');
  const [unitIdx, setUnitIdx] = useState(2); // дни by default

  const ban = useUserBan(target?.id);
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();

  // Backend wants seconds (Positive). Floor at 60s so a fat-fingered 0 never bans for nothing.
  const durationSeconds = Math.max(60, Math.round(Number(count) || 0) * BAN_UNITS[unitIdx].seconds);
  const current = ban.data; // Ban | null

  function submitBan() {
    if (!target || !reason.trim()) return;
    banUser.mutate(
      { targetId: target.id, reason: reason.trim(), duration: durationSeconds },
      { onSuccess: () => setReason('') },
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2 text-fg">
        <span className="text-lose">
          <Ban size={16} strokeWidth={2} />
        </span>
        <h2 className="text-sm font-semibold">Блокировки</h2>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted">
        Блокировка запрещает писать в чат, создавать чаты и добавлять участников. Читать
        чаты блокировка не мешает.
      </p>

      <div className="flex flex-col gap-4">
        <UserLookup
          value={lookup}
          onChange={setLookup}
          onResolve={setTarget}
          excludeId={myId}
          excludeMessage="Нельзя заблокировать себя"
          placeholder="ID или @username"
        />

        {target == null ? null : ban.isLoading ? (
          <div className="flex justify-center py-2">
            <Spinner size={20} />
          </div>
        ) : current ? (
          // Already banned → show the ban + an unban action.
          <div className="flex flex-col gap-3 rounded-xl border border-lose/40 bg-lose/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-lose">
              <Ban size={14} strokeWidth={2} />
              Заблокирован до {formatTime(banExpiry(current), 'date')}
            </p>
            <p className="text-xs text-muted">
              Причина: <span className="text-fg">{current.reason}</span>
            </p>
            {current.moderator ? (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span>Модератор:</span>
                <UserChip user={current.moderator} size={20} />
              </div>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => unbanUser.mutate(target.id)}
              loading={unbanUser.isPending}
              className="self-start"
            >
              <ShieldCheck size={16} strokeWidth={2} />
              Разблокировать
            </Button>
            {unbanUser.isError ? (
              <p className="text-xs text-lose">{errorMessage(unbanUser.error, 'Не удалось разблокировать')}</p>
            ) : null}
          </div>
        ) : (
          // Not banned → the ban form.
          <div className="flex flex-col gap-3">
            <Input
              label="Причина"
              placeholder="За что блокировка"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex items-end gap-2">
              <div className="w-24">
                <Input
                  label="Срок"
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </div>
              <select
                value={unitIdx}
                onChange={(e) => setUnitIdx(Number(e.target.value))}
                className="h-11 flex-1 rounded-xl border border-edge bg-panel-2 px-3 text-sm text-fg focus:border-ton focus:outline-none"
              >
                {BAN_UNITS.map((u, i) => (
                  <option key={u.label} value={i}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={submitBan}
              loading={banUser.isPending}
              disabled={!reason.trim()}
              className="self-start border-lose/40 text-lose hover:bg-lose/10"
              variant="ghost"
            >
              <Ban size={16} strokeWidth={2} />
              Заблокировать
            </Button>
            {banUser.isError ? (
              <p className="text-xs text-lose">{errorMessage(banUser.error, 'Не удалось заблокировать')}</p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function ModerationPage() {
  const { user, loading } = useAuth();
  const { isChatModerator } = useMyCapabilities();

  // Wait for auth to settle before deciding — otherwise a logged-in moderator would
  // flash the "no access" card on first paint while /users/me is in flight.
  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!isChatModerator) return <NoAccess />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 sm:gap-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
          <Megaphone size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Модерация
          </h1>
          <p className="text-sm text-muted">Инструменты модератора 🛡️</p>
        </div>
      </div>

      <BroadcastComposer />
      <BanTool myId={user?.id ?? 0} />
    </div>
  );
}
