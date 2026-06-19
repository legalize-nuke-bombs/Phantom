import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Home as HomeIcon,
  User as UserIcon,
  Wallet as WalletIcon,
  Gamepad2,
  MessageCircle,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/shared/api/client';
import { formatUsd } from '@/shared/lib/money';
import type { Wallet } from '@/shared/types';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  /** Render the live wallet balance inline next to the label. */
  showBalance?: boolean;
}

/** Full sidebar order. */
const NAV: NavItem[] = [
  { to: '/', label: 'Главная', icon: HomeIcon },
  { to: '/profile', label: 'Профиль', icon: UserIcon },
  { to: '/wallet', label: 'Кошелёк', icon: WalletIcon, showBalance: true },
  { to: '/games', label: 'Игры', icon: Gamepad2, disabled: true },
  { to: '/chat', label: 'Чат', icon: MessageCircle, disabled: true },
  { to: '/notifications', label: 'Уведомления', icon: Bell },
];

/** Bottom tab bar (mobile) — a curated subset of the primary destinations. */
const TABS: NavItem[] = [
  NAV[0], // Главная
  NAV[2], // Кошелёк (balance)
  NAV[5], // Уведомления
  NAV[1], // Профиль
];

/** Plain balance text (no tier colour) shared by both nav surfaces. */
function balanceText(balance: string | undefined): string {
  return balance == null ? '—' : formatUsd(Number(balance));
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl leading-none">💎</span>
      <span className="text-lg font-semibold tracking-wide text-fg">
        Phantom
      </span>
    </div>
  );
}

function useWallet() {
  return useQuery({
    queryKey: ['wallet', 'me'],
    queryFn: () => api.get<Wallet>('/wallets/me'),
    staleTime: 30_000,
  });
}

/* ── Sidebar (md+) ─────────────────────────────────────────────────────── */

function SidebarLink({
  item,
  balance,
}: {
  item: NavItem;
  balance: string | undefined;
}) {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <div className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-muted/60">
        <Icon size={20} />
        <span className="text-sm">{item.label}</span>
        <span className="ml-auto rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          скоро
        </span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
          isActive
            ? 'bg-panel-2 text-fg'
            : 'text-muted hover:bg-panel-2 hover:text-fg',
        )
      }
    >
      <Icon size={20} />
      <span>{item.label}</span>
      {item.showBalance ? (
        <span className="ml-auto text-sm font-medium text-fg">
          {balanceText(balance)}
        </span>
      ) : null}
    </NavLink>
  );
}

function Sidebar({ balance }: { balance: string | undefined }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-edge bg-panel/40 md:flex">
      <div className="flex h-14 items-center px-5">
        <Wordmark />
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => (
          <SidebarLink key={item.to} item={item} balance={balance} />
        ))}
      </nav>
    </aside>
  );
}

/* ── Bottom tab bar (mobile) ───────────────────────────────────────────── */

function BottomTabLink({
  item,
  balance,
}: {
  item: NavItem;
  balance: string | undefined;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        clsx(
          'flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors',
          isActive ? 'text-ton' : 'text-muted',
        )
      }
    >
      <Icon size={20} />
      <span className="text-[10px] leading-tight">
        {item.showBalance ? balanceText(balance) : item.label}
      </span>
    </NavLink>
  );
}

function BottomTabBar({ balance }: { balance: string | undefined }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-edge bg-ink/90 backdrop-blur md:hidden">
      {TABS.map((item) => (
        <BottomTabLink key={item.to} item={item} balance={balance} />
      ))}
    </nav>
  );
}

/* ── Shell ─────────────────────────────────────────────────────────────── */

export default function AppShell() {
  const wallet = useWallet();
  const balance = wallet.data?.balance;

  return (
    <div className="flex min-h-screen">
      <Sidebar balance={balance} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-8 md:pt-6">
          <Outlet />
        </main>
      </div>
      <BottomTabBar balance={balance} />
    </div>
  );
}
