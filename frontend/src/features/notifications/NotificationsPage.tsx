import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Gift,
  Trophy,
  PartyPopper,
  ArrowUpCircle,
  Megaphone,
  MessageSquare,
  MessageSquareX,
  UserPlus,
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
import { api } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { formatTime } from '@/shared/lib/time';
import { formatUsd } from '@/shared/lib/money';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';

/**
 * NotificationRepresentation — GET /api/notifications.
 * `payload` is a free-form JSON tree (backend `JsonNode`) whose shape depends on
 * `type`; we treat it as unknown and read fields defensively in the registry.
 */
type NotificationType =
  | 'PRESENT_RECEIVED'
  | 'BANNED'
  | 'UNBANNED'
  | 'YOUR_MESSAGE_DELETED'
  | 'MESSAGE_RECEIVED'
  | 'MESSAGE_DELETED'
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
  type: NotificationType;
  payload: unknown;
}

/* ── Safe payload readers ──────────────────────────────────────────────────
 * Payload is `unknown`; these read a single field without assuming the rest of
 * the shape, so a missing/renamed field degrades to undefined instead of crashing.
 */

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

/** Clamp a free-text snippet so a long broadcast/message never blows up the row. */
function snippet(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/* ── Type registry ─────────────────────────────────────────────────────────
 * Single source of truth for how each notification renders. Adding a type is one
 * entry here; `describe` returns a short, payload-derived line or undefined.
 */

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
  PRESENT_RECEIVED: {
    icon: Gift,
    label: 'Подарок',
    tone: 'text-ton',
    describe: (p) => {
      const from = actor(p, 'sender');
      const amount = num(p, 'amount');
      const sum = amount != null ? formatUsd(amount) : null;
      if (from && sum) return `${from} отправил вам подарок на ${sum}`;
      if (sum) return `Вы получили подарок на ${sum}`;
      if (from) return `${from} отправил вам подарок`;
      return 'Вы получили подарок';
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
  MESSAGE_RECEIVED: {
    icon: MessageSquare,
    label: 'Новое сообщение',
    describe: (p) => {
      const from = actor(p);
      const content = str(p, 'content');
      if (from && content) return `${from}: ${snippet(content, 80)}`;
      if (from) return `Новое сообщение от ${from}`;
      return content ? snippet(content) : undefined;
    },
  },
  NEW_CHAT: {
    icon: UserPlus,
    label: 'Новый чат',
    describe: (p) => {
      const from = actor(p);
      return from ? `${from} начал с вами чат` : undefined;
    },
  },
  MESSAGE_DELETED: {
    icon: MessageSquareX,
    label: 'Сообщение удалено',
    tone: 'text-muted',
    describe: (p) => {
      const from = actor(p);
      return from ? `Сообщение пользователя ${from} удалено` : undefined;
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
      return amount != null
        ? `Вывод ${formatUsd(amount)} не удался`
        : 'Вывод не удался';
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

function NotificationRow({ item }: { item: NotificationItem }) {
  const kind = REGISTRY[item.type];
  const Icon = kind?.icon ?? Bell;
  const label = kind?.label ?? fallbackLabel(item.type);
  const description = kind?.describe?.(item.payload);

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        aria-hidden
        className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 ${
          kind?.tone ?? 'text-ton'
        }`}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium text-fg">{label}</p>
          <time className="shrink-0 text-xs text-muted">
            {formatTime(item.timestamp, 'relative')}
          </time>
        </div>
        {description ? (
          <p className="mt-0.5 text-sm leading-snug text-muted">{description}</p>
        ) : null}
      </div>
    </li>
  );
}

export default function NotificationsPage() {
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationItem[]>('/notifications'),
    staleTime: 15_000,
  });

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
          <Bell size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Уведомления
          </h1>
          <p className="text-sm text-muted">Последние события вашего аккаунта</p>
        </div>
      </div>

      {notifications.isLoading ? (
        <Card className="grid place-items-center p-10">
          <Spinner size={26} />
        </Card>
      ) : notifications.isError ? (
        <Card className="p-6 text-center text-sm text-muted">
          {errorMessage(notifications.error)}
        </Card>
      ) : !notifications.data || notifications.data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          Пока нет уведомлений
        </Card>
      ) : (
        <Card className="divide-y divide-edge overflow-hidden p-0">
          <ul>
            {notifications.data.map((item) => (
              <NotificationRow key={item.id} item={item} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
