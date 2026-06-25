import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Home as HomeIcon,
  User as UserIcon,
  Wallet as WalletIcon,
  Gamepad2,
  Globe,
  MessagesSquare,
  HardDrive,
  Megaphone,
  ShieldCheck,
  Trophy,
  Bell,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { useWallet } from '@/shared/lib/wallet';
import { formatUsd } from '@/shared/lib/money';
import { useAuth } from '@/shared/auth/AuthContext';
import { useUnreadCount, usePersonalChatsUnread } from '@/shared/realtime/badges';
import { useMyCapabilities } from '@/shared/lib/roles';
import type { Bucket } from '@/shared/realtime/store';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Render the live wallet balance inline next to the label. */
  showBalance?: boolean;
  /** Show a live unread-count badge (from the realtime store) for this bucket. */
  badge?: Bucket;
  /** Aggregate unread across all personal chats (every chat:* bucket except global). */
  aggregateChats?: boolean;
  /** Only show this item to owners (capability-gated, never role-name-gated). */
  ownerOnly?: boolean;
  /** Only show this item to chat moderators (owners carry the flag too). */
  modOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Главная', icon: HomeIcon },
  { to: '/profile', label: 'Профиль', icon: UserIcon },
  { to: '/wallet', label: 'Кошелёк', icon: WalletIcon, showBalance: true, badge: 'gift' },
  { to: '/games', label: 'Игры', icon: Gamepad2 },
  { to: '/chat/global', label: 'Глобальный чат', icon: Globe, badge: 'chat:1' },
  { to: '/chat/groups', label: 'Чаты', icon: MessagesSquare, aggregateChats: true },
  { to: '/disk', label: 'Облако', icon: HardDrive },
  { to: '/progress', label: 'Прогресс', icon: Trophy },
  { to: '/notifications', label: 'События', icon: Bell, badge: 'misc' },
  { to: '/moderation', label: 'Модерация', icon: Megaphone, modOnly: true },
  { to: '/owner', label: 'Владелец', icon: ShieldCheck, ownerOnly: true, badge: 'owner' },
];

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl leading-none">💎</span>
      <span className="text-lg font-semibold tracking-wide text-fg">Phantom</span>
    </div>
  );
}

/** A small unread-count pill; renders nothing at zero. */
function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-ton-deep px-1.5 text-[11px] font-bold leading-none text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function SidebarLink({
  item,
  balance,
  onNavigate,
}: {
  item: NavItem;
  balance: string | undefined;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const bucketCount = useUnreadCount(item.badge ?? null);
  const personalChatsCount = usePersonalChatsUnread();
  const badgeCount = item.aggregateChats ? personalChatsCount : bucketCount;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
          isActive ? 'bg-panel-2 text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg',
        )
      }
    >
      <Icon size={20} />
      <span>{item.label}</span>
      <NavBadge count={badgeCount} />
      {item.showBalance ? (
        <span className="ml-auto text-sm font-medium text-ton">{formatUsd(balance)}</span>
      ) : null}
    </NavLink>
  );
}

/**
 * One left bar for both breakpoints. Desktop (md+): static, always visible.
 * Mobile: a slide-in drawer (off-screen by default) toggled by the hamburger,
 * dimming the page behind it — same navigation, adapted.
 */
function Sidebar({
  balance,
  open,
  onClose,
}: {
  balance: string | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isOwner, isChatModerator } = useMyCapabilities();

  async function handleLogout() {
    onClose();
    await logout();
    navigate('/login');
  }

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-edge bg-panel transition-transform duration-200',
        'md:static md:z-auto md:w-60 md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex h-14 items-center justify-between px-5">
        <Wordmark />
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть меню"
          className="text-muted transition-colors hover:text-fg md:hidden"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {NAV.filter(
          (item) => (!item.ownerOnly || isOwner) && (!item.modOnly || isChatModerator),
        ).map((item) => (
          <SidebarLink key={item.to} item={item} balance={balance} onNavigate={onClose} />
        ))}
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-lose transition-colors hover:bg-lose/10"
        >
          <LogOut size={20} />
          <span>Выйти</span>
        </button>
      </nav>
    </aside>
  );
}

export default function AppShell() {
  const wallet = useWallet();
  const balance = wallet.data?.balance;
  const [open, setOpen] = useState(false);

  return (
    // Fixed to the viewport (h-dvh) so the shell never grows with content and the BODY never
    // scrolls — `main` is the single scroll container for normal pages, while full-height
    // pages (the chat) fill it exactly and scroll INSIDE themselves, keeping the composer and
    // panel footers pinned. This is the app-shell layout every messenger uses.
    <div className="flex h-dvh overflow-hidden">
      {/* Mobile: hamburger trigger (no global top bar — just a floating button) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Меню"
        className="fixed left-3 top-3 z-30 grid h-10 w-10 place-items-center rounded-xl border border-edge bg-panel/90 text-fg backdrop-blur md:hidden"
      >
        <Menu size={20} />
      </button>
      {/* Mobile: backdrop when the drawer is open */}
      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}

      <Sidebar balance={balance} open={open} onClose={() => setOpen(false)} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Full-width content area — pages that want a readable column self-center with their
            own `mx-auto max-w-*`; full-width pages (the chat) fill it edge-to-edge. */}
        <main className="w-full min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-16 md:px-6 md:pb-8 md:pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
