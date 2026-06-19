// Progress section shell: a title, a two-tab sub-nav (Лидерборд / Уровни) and the
// active child page below. The tabs are a segmented control styled to the spectral
// theme; the index tab uses `end` so it isn't kept active on the /levels child.

import { NavLink, Outlet } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import clsx from 'clsx';

interface Tab {
  to: string;
  label: string;
  /** Match this route exactly (so the index tab deactivates on child routes). */
  end?: boolean;
}

const TABS: readonly Tab[] = [
  { to: '/progress', label: 'Лидерборд', end: true },
  { to: '/progress/levels', label: 'Уровни' },
];

function TabLink({ tab }: { tab: Tab }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      className={({ isActive }) =>
        clsx(
          'flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ton',
          isActive
            ? 'bg-panel-2 text-fg shadow-sm'
            : 'text-muted hover:text-fg',
        )
      }
    >
      {tab.label}
    </NavLink>
  );
}

export default function ProgressPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header className="flex items-center gap-2.5">
        <Trophy size={22} className="text-ton" strokeWidth={2} />
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Прогресс</h1>
      </header>

      <nav className="flex gap-1 rounded-xl border border-edge bg-panel p-1">
        {TABS.map((tab) => (
          <TabLink key={tab.to} tab={tab} />
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
