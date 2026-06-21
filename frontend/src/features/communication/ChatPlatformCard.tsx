// ChatPlatformCard — a promotional home-page widget showing PLATFORM-WIDE chat totals
// (every message + every chat ever, across all users), from GET /api/chat/stats/platform.
// This is global all-time statistics, NOT a personal unread count — the copy ("за всё время",
// "на платформе") is written so the number can't be mistaken for notifications. Clicking it
// drops you into the global chat (/chat/global). Styled to match the cloud/lottery widgets.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MessagesSquare, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';

interface PlatformChatStats {
  chats: number;
  messages: number;
}

const ru = (n: number): string => n.toLocaleString('ru-RU');

/** Russian count agreement: forms = [one, few, many] (1 / 2-4 / 5-0, with the teens exception). */
function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

function ChatCardInner({ chats, messages }: PlatformChatStats) {
  return (
    <Link
      to="/chat/global"
      className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-edge bg-panel p-4 transition-colors hover:border-ton/50 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ton/60"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-ton/10 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />
      <span
        aria-hidden
        className="relative grid size-12 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 text-ton"
      >
        <MessagesSquare size={24} strokeWidth={2} />
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted">
          <Send size={12} strokeWidth={2} />
          Общение на платформе
        </p>
        <p className="mt-0.5 truncate text-xl font-bold tracking-tight text-fg">
          {ru(messages)} {plural(messages, ['сообщение', 'сообщения', 'сообщений'])}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted">
          за всё время · в {ru(chats)} {plural(chats, ['чате', 'чатах', 'чатах'])}
        </p>
      </div>
      <ArrowUpRight
        size={16}
        aria-hidden
        className="relative shrink-0 text-muted transition-colors group-hover:text-ton"
      />
    </Link>
  );
}

/** The "Чаты платформы" home section: heading + the all-time totals card (soft fallbacks). */
export default function ChatPlatformCard() {
  const query = useQuery({
    queryKey: ['chat', 'stats', 'platform'],
    queryFn: () => api.get<PlatformChatStats>('/chat/stats/platform'),
    staleTime: 60_000,
  });

  let body: ReactNode;
  if (query.isPending) {
    body = (
      <Card className="flex items-center gap-3 p-4 text-sm text-muted">
        <Spinner size={20} />
        Загружаем статистику…
      </Card>
    );
  } else if (query.isError) {
    body = (
      <Link
        to="/chat/global"
        className="group flex items-center gap-3 rounded-xl border border-edge bg-panel p-4 transition-colors hover:border-ton/50 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ton/60"
      >
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 text-ton"
        >
          <MessagesSquare size={20} strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 text-sm text-muted">
          {errorMessage(query.error, 'Загляните в глобальный чат')}
        </span>
        <ArrowUpRight
          size={16}
          aria-hidden
          className="shrink-0 text-muted transition-colors group-hover:text-ton"
        />
      </Link>
    );
  } else {
    body = <ChatCardInner chats={query.data.chats} messages={query.data.messages} />;
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted">
        <MessagesSquare size={14} strokeWidth={2} />
        Чаты платформы
      </h2>
      {body}
    </section>
  );
}
