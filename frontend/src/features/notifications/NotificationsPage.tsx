// The "Уведомления" inbox — a pure consumer of the realtime MISC bucket. It does NOT
// touch REST: the internal notification layer (RealtimeProvider) drains offline-unread,
// reads the websocket, and routes everything that isn't a gift or a chat message into
// the `misc` bucket. This page just snapshots that bucket on entry, shows it, and marks
// it read (markBucketRead does the POST + clears the store), so the sidebar badge drops
// to 0 and new junk accumulates again for the next visit.
//
// So this is deliberately a "recent NEW events" feed, NOT a notifications archive: only
// what arrived since you last looked is ever here, read/old events are not kept, and
// gifts (→ Кошелёк) and chat messages (→ чаты) never reach this bucket. The copy below
// — subtitle + empty state — is written to make that scope feel intentional, not broken.

import { useEffect, useState } from 'react';
import {
  Bell,
  CheckCheck,
  Trophy,
  PartyPopper,
  ArrowUpCircle,
  Megaphone,
  UserPlus,
  MessageSquareX,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  TicketCheck,
  Crown,
  Wallet as WalletIcon,
  CalendarClock,
  ArrowDownToLine,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { formatTime } from '@/shared/lib/time';
import { formatUsd } from '@/shared/lib/money';
import { markBucketRead } from '@/shared/realtime/badges';
import { bucketRows } from '@/shared/realtime/store';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';

/**
 * The misc notification types that land here (gifts → wallet, chat messages → the chat,
 * so neither reaches this inbox). `payload` is a free-form JSON tree whose shape depends
 * on `type`; we read fields defensively in the registry.
 */
type NotificationType =
  | 'BANNED'
  | 'UNBANNED'
  | 'YOUR_MESSAGE_DELETED'
  | 'NEW_CHAT'
  | 'ROLE_CLAIMED'
  | 'WELCOME'
  | 'LEVEL_UP'
  | 'BROADCAST'
  | 'LOTTERY_IS_ENDING'
  | 'LOTTERY_ENDED'
  | 'YOU_WON_LOTTERY'
  | 'MASTER_WALLET_SET'
  | 'SWEEP_SCHEDULE_SET'
  | 'NEW_SWEEP'
  | 'NEW_WITHDRAWAL'
  | 'WITHDRAWAL_FAILED';

interface NotificationItem {
  id: number;
  timestamp: number; // epoch seconds
  type: string;
  payload: unknown;
}

/* ── Safe payload readers (payload is `unknown`) ──────────────────────────── */

function field(payload: unknown, key: string): unknown {
  if (payload && typeof payload === 'object' && key in payload) {
    return (payload as Record<string, unknown>)[key];
  }
  return undefined;
}

function str(payload: unknown, key: string): string | undefined {
  const value = field(payload, key);
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function num(payload: unknown, key: string): number | undefined {
  const value = field(payload, key);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

/** Display name of the actor a payload is about (UserShort-shaped fields). */
function actor(payload: unknown, key = 'user'): string | undefined {
  return str(field(payload, key), 'displayName');
}

/** Clamp a free-text snippet so a long broadcast never blows up the row. */
function snippet(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/* ── Type registry — one entry per misc type ──────────────────────────────── */

interface NotificationKind {
  icon: LucideIcon;
  label: string;
  /** Accent colour token for the icon; defaults to the neutral Gram blue. */
  tone?: string;
  describe?: (payload: unknown) => string | undefined;
}

const REGISTRY: Record<NotificationType, NotificationKind> = {
  WELCOME: {
    icon: PartyPopper,
    label: 'Добро пожаловать',
    tone: 'text-ton',
    describe: () => 'Аккаунт создан — удачной игры!',
  },
  LEVEL_UP: {
    icon: ArrowUpCircle,
    label: 'Новый уровень',
    tone: 'text-win',
    describe: (p) => {
      const level = str(p, 'level');
      return level ? `Вы достигли ранга ${level}` : 'Вы повысили свой ранг';
    },
  },
  YOU_WON_LOTTERY: {
    icon: Trophy,
    label: 'Выигрыш в лотерее',
    tone: 'text-win',
    describe: () => 'Поздравляем — вы выиграли розыгрыш!',
  },
  LOTTERY_IS_ENDING: {
    icon: Ticket,
    label: 'Лотерея заканчивается',
    tone: 'text-warn',
    describe: () => 'Розыгрыш скоро завершится',
  },
  LOTTERY_ENDED: {
    icon: TicketCheck,
    label: 'Лотерея завершена',
    describe: () => 'Розыгрыш подошёл к концу',
  },
  BROADCAST: {
    icon: Megaphone,
    label: 'Объявление',
    tone: 'text-ice',
    describe: (p) => {
      const content = str(p, 'content');
      return content ? snippet(content) : undefined;
    },
  },
  ROLE_CLAIMED: {
    icon: Crown,
    label: 'Новая роль',
    tone: 'text-ton',
    describe: () => 'Вам выдана новая роль',
  },
  NEW_CHAT: {
    icon: UserPlus,
    label: 'Новый чат',
    describe: (p) => {
      const from = actor(p);
      return from ? `${from} начал с вами чат` : undefined;
    },
  },
  YOUR_MESSAGE_DELETED: {
    icon: MessageSquareX,
    label: 'Ваше сообщение удалено',
    tone: 'text-lose',
    describe: () => 'Модератор удалил ваше сообщение',
  },
  BANNED: {
    icon: ShieldAlert,
    label: 'Блокировка',
    tone: 'text-lose',
    describe: () => 'Вы заблокированы в чате',
  },
  UNBANNED: {
    icon: ShieldCheck,
    label: 'Разблокировка',
    tone: 'text-win',
    describe: () => 'Вы снова можете писать в чат',
  },
  MASTER_WALLET_SET: {
    icon: WalletIcon,
    label: 'Мастер-кошелёк',
    describe: (p) => {
      const who = actor(p);
      return who ? `${who} обновил мастер-кошелёк` : undefined;
    },
  },
  SWEEP_SCHEDULE_SET: {
    icon: CalendarClock,
    label: 'Расписание сборов',
    describe: (p) => {
      const who = actor(p);
      return who ? `${who} изменил расписание сборов` : undefined;
    },
  },
  NEW_SWEEP: {
    icon: ArrowDownToLine,
    label: 'Сбор средств',
    describe: (p) => {
      const amount = num(p, 'amount');
      return amount != null ? `Собрано ${formatUsd(amount)}` : undefined;
    },
  },
  NEW_WITHDRAWAL: {
    icon: ArrowDownToLine,
    label: 'Новый вывод',
    describe: (p) => {
      const who = actor(p);
      const amount = num(p, 'amount');
      const sum = amount != null ? formatUsd(amount) : null;
      if (who && sum) return `${who} запросил вывод ${sum}`;
      if (sum) return `Запрошен вывод ${sum}`;
      return who ? `${who} запросил вывод` : undefined;
    },
  },
  WITHDRAWAL_FAILED: {
    icon: AlertTriangle,
    label: 'Ошибка вывода',
    tone: 'text-lose',
    describe: (p) => {
      const amount = num(p, 'amount');
      return amount != null ? `Вывод ${formatUsd(amount)} не удался` : 'Вывод не удался';
    },
  },
};

/** Humanise an unknown future type so the row still renders sensibly. */
function fallbackLabel(type: string): string {
  return type
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// One row, in the GameHistoryRow family: a calm leading icon tile, a primary line, and
// a quiet muted line beneath it. The event's description carries the meaning; the time
// rides at the end of that same muted line as a faint caption, never a second column
// competing with the title. Most rows are one event-type label + one sentence, so we
// keep them airy rather than dense.
function NotificationRow({ item }: { item: NotificationItem }) {
  const kind = REGISTRY[item.type as NotificationType] as NotificationKind | undefined;
  const Icon = kind?.icon ?? Bell;
  const label = kind?.label ?? fallbackLabel(item.type);
  const description = kind?.describe?.(item.payload);
  const time = formatTime(item.timestamp, 'relative');

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden
        className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 ${
          kind?.tone ?? 'text-ton'
        }`}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{label}</p>
        {/* Description · time on one muted line; when there's no description the time
            stands alone, so the row never shows an empty second line. */}
        <p className="mt-0.5 text-xs leading-snug text-muted">
          {description ? `${description} · ${time}` : time}
        </p>
      </div>
    </li>
  );
}

export default function NotificationsPage() {
  // Snapshot the misc bucket ONCE on entry (so we can show what arrived while away),
  // then mark it read + clear via the internal layer. No REST here. null = still loading.
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  useEffect(() => {
    // The store is in-memory (synchronous) now — snapshot the misc bucket directly, then
    // mark it read + clear via the internal layer. No REST, no async.
    const rows = bucketRows('misc');
    rows.reverse(); // newest first
    setItems(rows.map((r) => ({ id: r.id, timestamp: r.timestamp, type: r.type, payload: r.payload })));
    void markBucketRead('misc');
  }, []);

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
          <Bell size={22} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Уведомления
          </h1>
          {/* Honest scope: this is a feed of recent NEW account events, not an archive. */}
          <p className="text-sm text-muted">Недавние новые события аккаунта</p>
        </div>
      </div>

      {items === null ? (
        <Card className="grid place-items-center p-10">
          <Spinner size={26} />
        </Card>
      ) : items.length === 0 ? (
        // The common case — only unread events ever land here, so an empty feed means
        // "вы всё просмотрели", not a broken/empty inbox. Make it read as deliberate:
        // a soft check, one reassuring line, and a quiet note on where the rest lives.
        <Card className="px-6 py-12 text-center">
          <span
            aria-hidden
            className="mx-auto grid size-14 place-items-center rounded-2xl border border-edge bg-panel-2 text-muted"
          >
            <CheckCheck size={26} />
          </span>
          <p className="mt-4 text-sm font-medium text-fg">Вы всё просмотрели</p>
          <p className="mx-auto mt-1 max-w-xs text-sm leading-snug text-muted">
            Здесь появляются новые события аккаунта. Подарки ищите в Кошельке, сообщения —
            в чатах.
          </p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-edge px-4">
              {items.map((item) => (
                <NotificationRow key={item.id} item={item} />
              ))}
            </ul>
          </Card>
          {/* Reinforce the scope below the feed so a partial list never reads as a bug. */}
          <p className="mt-3 px-1 text-xs leading-snug text-muted/70">
            Только новые события — прочитанные не сохраняются. Подарки и сообщения живут в
            Кошельке и чатах.
          </p>
        </>
      )}
    </div>
  );
}
