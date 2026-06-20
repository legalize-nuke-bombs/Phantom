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
import { Check, Megaphone, Send, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';

import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import { useMyCapabilities } from '@/shared/lib/roles';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';
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

export default function ModerationPage() {
  const { loading } = useAuth();
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
    </div>
  );
}
