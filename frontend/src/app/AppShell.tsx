import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Home as HomeIcon,
  User as UserIcon,
  Gamepad2,
  Wallet as WalletIcon,
  MessageCircle,
  Bell,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/AuthContext';
import type { Experience, Wallet, LevelName } from '@/shared/types';
import RankBadge from '@/shared/ui/RankBadge';

interface NavItem {
  to: string;
  label: string;
  icon: typeof HomeIcon;
  disabled?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Главная', icon: HomeIcon },
  { to: '/profile', label: 'Профиль', icon: UserIcon },
  { to: '/games', label: 'Игры', icon: Gamepad2, disabled: true },
  { to: '/wallet', label: 'Кошелёк', icon: WalletIcon, disabled: true },
  { to: '/chat', label: 'Чат', icon: MessageCircle, disabled: true },
];

function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl leading-none">👻</span>
      <span className="text-lg font-semibold tracking-wide text-fg">
        Phantom
      </span>
    </div>
  );
}

function formatBalance(balance: string | undefined): string {
  if (balance == null) return '—';
  const n = Number(balance);
  if (Number.isNaN(n)) return balance;
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

function useShellData() {
  const wallet = useQuery({
    queryKey: ['wallet', 'me'],
    queryFn: () => api.get<Wallet>('/wallets/me'),
    staleTime: 30_000,
  });
  return { wallet };
}

function BalancePill({ balance }: { balance: string | undefined }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-panel-2 border border-edge px-3 py-1.5">
      <span className="text-sm font-medium text-ton">{formatBalance(balance)}</span>
      <span className="text-xs text-muted">TON</span>
    </div>
  );
}

function TopBar({
  rank,
  balance,
  displayName,
}: {
  rank: LevelName | null;
  balance: string | undefined;
  displayName: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-edge bg-ink/80 px-4 backdrop-blur md:px-6">
      <div className="md:hidden">
        <Wordmark />
      </div>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <BalancePill balance={balance} />
        <button
          type="button"
          aria-label="Уведомления"
          className="grid h-9 w-9 place-items-center rounded-xl border border-edge bg-panel-2 text-muted transition-colors hover:text-fg"
        >
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2">
          {rank && <RankBadge rank={rank} size={32} />}
          <span className="hidden max-w-[10rem] truncate text-sm text-fg sm:inline">
            {displayName}
          </span>
        </div>
      </div>
    </header>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
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
    </NavLink>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-edge bg-panel/40 md:flex">
      <div className="flex h-14 items-center px-5">
        <Wordmark />
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </nav>
    </aside>
  );
}

function BottomTabLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  if (item.disabled) {
    return (
      <div className="flex flex-1 cursor-not-allowed flex-col items-center gap-0.5 py-2 text-muted/50">
        <Icon size={20} />
        <span className="text-[10px]">{item.label}</span>
      </div>
    );
  }
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
      <span className="text-[10px]">{item.label}</span>
    </NavLink>
  );
}

function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-edge bg-ink/90 backdrop-blur md:hidden">
      {NAV.map((item) => (
        <BottomTabLink key={item.to} item={item} />
      ))}
    </nav>
  );
}

export default function AppShell() {
  const { user } = useAuth();
  const { wallet } = useShellData();

  const experience = useQuery({
    queryKey: ['experience', user?.id],
    queryFn: () => api.get<Experience>(`/experience/${user!.id}`),
    enabled: user?.id != null,
    staleTime: 30_000,
  });

  const rank: LevelName | null = experience.data?.level?.name ?? null;
  const displayName = user?.displayName ?? '';

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar rank={rank} balance={wallet.data?.balance} displayName={displayName} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-8">
          <Outlet />
        </main>
      </div>
      <BottomTabBar />
    </div>
  );
}
