import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import AppShell from '@/app/AppShell';
import Spinner from '@/shared/ui/Spinner';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const RecoverPage = lazy(() => import('@/features/auth/RecoverPage'));
const HomePage = lazy(() => import('@/features/home/HomePage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const UserProfilePage = lazy(() => import('@/features/profile/UserProfilePage'));
const WalletPage = lazy(() => import('@/features/wallet/WalletPage'));
const NotificationsPage = lazy(
  () => import('@/features/notifications/NotificationsPage'),
);
const GamesPage = lazy(() => import('@/features/games/GamesPage'));
const CasesPage = lazy(() => import('@/features/games/CasesPage'));
const CaseOpenPage = lazy(() => import('@/features/games/cases/CaseOpenPage'));
const CoinflipPage = lazy(() => import('@/features/games/CoinflipPage'));
const UpgraderPage = lazy(() => import('@/features/games/UpgraderPage'));
const SlotsPage = lazy(() => import('@/features/games/SlotsPage'));
const LotteryPage = lazy(() => import('@/features/lottery/LotteryPage'));
const GlobalChatPage = lazy(
  () => import('@/features/communication/GlobalChatPage'),
);
const ChatsPage = lazy(() => import('@/features/communication/ChatsPage'));
const ChatConversationPage = lazy(
  () => import('@/features/communication/ChatConversationPage'),
);
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage'));
const LeaderboardPage = lazy(
  () => import('@/features/progress/LeaderboardPage'),
);
const LevelsPage = lazy(() => import('@/features/progress/LevelsPage'));
const SettingsPage = lazy(() => import('@/features/profile/SettingsPage'));
const ReferralPage = lazy(() => import('@/features/referral/ReferralPage'));
const OwnerPage = lazy(() => import('@/features/owner/OwnerPage'));
const DiskPage = lazy(() => import('@/features/disk/DiskPage'));
const ModerationPage = lazy(() => import('@/features/moderation/ModerationPage'));
const GamesAnalyticsPage = lazy(() => import('@/features/games/GamesAnalyticsPage'));
const BlacklistPage = lazy(() => import('@/features/profile/BlacklistPage'));

function PageSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Spinner size={32} />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/** Gate: wait while restoring session, bounce to /login when unauthenticated. */
function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
}

/** Inverse of ProtectedRoute: an already-authenticated user has no business on the auth
 *  pages — bounce them home. Matters when a logged-in user opens a deep link or a
 *  referral /register link. */
function GuestRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestRoute>
        <PageSuspense>
          <LoginPage />
        </PageSuspense>
      </GuestRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestRoute>
        <PageSuspense>
          <RegisterPage />
        </PageSuspense>
      </GuestRoute>
    ),
  },
  {
    path: '/recover',
    element: (
      <GuestRoute>
        <PageSuspense>
          <RecoverPage />
        </PageSuspense>
      </GuestRoute>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: (
          <PageSuspense>
            <HomePage />
          </PageSuspense>
        ),
      },
      {
        path: 'profile',
        element: (
          <PageSuspense>
            <ProfilePage />
          </PageSuspense>
        ),
      },
      {
        path: 'profile/settings',
        element: (
          <PageSuspense>
            <SettingsPage />
          </PageSuspense>
        ),
      },
      {
        path: 'profile/referrals',
        element: (
          <PageSuspense>
            <ReferralPage />
          </PageSuspense>
        ),
      },
      {
        path: 'profile/blacklist',
        element: (
          <PageSuspense>
            <BlacklistPage />
          </PageSuspense>
        ),
      },
      {
        path: 'wallet',
        element: (
          <PageSuspense>
            <WalletPage />
          </PageSuspense>
        ),
      },
      {
        path: 'games',
        element: (
          <PageSuspense>
            <GamesPage />
          </PageSuspense>
        ),
      },
      {
        path: 'games/cases',
        element: (
          <PageSuspense>
            <CasesPage />
          </PageSuspense>
        ),
      },
      {
        path: 'games/cases/:caseName',
        element: (
          <PageSuspense>
            <CaseOpenPage />
          </PageSuspense>
        ),
      },
      {
        path: 'games/coinflip',
        element: (
          <PageSuspense>
            <CoinflipPage />
          </PageSuspense>
        ),
      },
      {
        path: 'games/upgrader',
        element: (
          <PageSuspense>
            <UpgraderPage />
          </PageSuspense>
        ),
      },
      {
        path: 'games/slots',
        element: (
          <PageSuspense>
            <SlotsPage />
          </PageSuspense>
        ),
      },
      {
        path: 'games/lottery',
        element: (
          <PageSuspense>
            <LotteryPage />
          </PageSuspense>
        ),
      },
      {
        path: 'chat/global',
        element: (
          <PageSuspense>
            <GlobalChatPage />
          </PageSuspense>
        ),
      },
      {
        path: 'chat/groups',
        element: (
          <PageSuspense>
            <ChatsPage />
          </PageSuspense>
        ),
      },
      {
        path: 'chat/groups/:chatId',
        element: (
          <PageSuspense>
            <ChatConversationPage />
          </PageSuspense>
        ),
      },
      {
        path: 'progress',
        element: (
          <PageSuspense>
            <ProgressPage />
          </PageSuspense>
        ),
        children: [
          {
            index: true,
            element: (
              <PageSuspense>
                <LeaderboardPage />
              </PageSuspense>
            ),
          },
          {
            path: 'levels',
            element: (
              <PageSuspense>
                <LevelsPage />
              </PageSuspense>
            ),
          },
        ],
      },
      {
        path: 'u/:userId',
        element: (
          <PageSuspense>
            <UserProfilePage />
          </PageSuspense>
        ),
      },
      {
        path: 'notifications',
        element: (
          <PageSuspense>
            <NotificationsPage />
          </PageSuspense>
        ),
      },
      {
        path: 'disk',
        element: (
          <PageSuspense>
            <DiskPage />
          </PageSuspense>
        ),
      },
      {
        path: 'moderation',
        element: (
          <PageSuspense>
            <ModerationPage />
          </PageSuspense>
        ),
      },
      {
        path: 'analytics',
        element: (
          <PageSuspense>
            <GamesAnalyticsPage />
          </PageSuspense>
        ),
      },
      {
        path: 'owner',
        element: (
          <PageSuspense>
            <OwnerPage />
          </PageSuspense>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
