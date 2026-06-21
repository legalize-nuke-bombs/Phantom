// Owner console (route: /owner). The hub for every OWNER-gated backend capability:
//
//   • Мастер-кошелёк   — view/replace the collection wallet deposits sweep into.
//   • Сбор средств      — schedule (set/replace/disable) the sweep job + its log.
//   • Выводы            — read-only feed of every user's withdrawals.
//   • Роли              — assign roles / delete users (owner-key gated where needed).
//
// (Объявление/broadcast moved to features/moderation — it is gated on
// chatModeratorAccess, not ownerAccess, so moderators reach it too.)
//
// SELF-GATING: the page gates on the OWNER CAPABILITY FLAG (useMyCapabilities → isOwner),
// never on a role name. Non-owners (and signed-out users, after auth settles) get an
// "insufficient rights" state — the nav link is also hidden for them, but the page must
// stand on its own. Every backend handler re-checks ownerAccess too; this is UX, not
// security.
//
// On mount we mark the silent 'owner' notification bucket read (markBucketRead) so the
// "Владелец" nav badge clears the moment the panel opens — the orchestrator populates
// that bucket (new withdrawal / sweep / failed withdrawal / wallet-set / schedule-set)
// and badges the nav item; we only retire it here.

import { useEffect } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { useAuth } from '@/shared/auth/AuthContext';
import { useMyCapabilities } from '@/shared/lib/roles';
import { markBucketRead } from '@/shared/realtime/badges';
import { useConsumesNotifications } from '@/shared/realtime/activeViews';
import { bucketFor } from '@/shared/realtime/store';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';
import MasterWalletSection from './MasterWalletSection';
import SweepSection from './SweepSection';
import WithdrawalsSection from './WithdrawalsSection';
import RolesSection from './RolesSection';

/** Shown to anyone without owner access. */
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
            Эта панель доступна только владельцу платформы.
          </p>
        </div>
      </Card>
    </div>
  );
}

export default function OwnerPage() {
  const { loading } = useAuth();
  const { isOwner } = useMyCapabilities();

  // Opening the panel is the "I've seen it" signal — clear the owner badge. Runs once
  // on mount; markBucketRead is a no-op when the bucket is already empty.
  useEffect(() => {
    void markBucketRead('owner');
  }, []);

  // While the panel is open, owner financial events are read on sight (RealtimeProvider
  // consults this) so they don't badge the nav behind us; the effect above clears the backlog.
  useConsumesNotifications((env) => bucketFor(env) === 'owner');

  // Wait for auth to settle before deciding — otherwise a logged-in owner would
  // flash the "no access" card on first paint while /users/me is in flight.
  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!isOwner) return <NoAccess />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 sm:gap-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Панель владельца
          </h1>
          <p className="text-sm text-muted">Управление платформой 💎</p>
        </div>
      </div>

      <MasterWalletSection />
      <SweepSection />
      <WithdrawalsSection />
      <RolesSection />
    </div>
  );
}
