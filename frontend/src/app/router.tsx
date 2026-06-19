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

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PageSuspense>
        <LoginPage />
      </PageSuspense>
    ),
  },
  {
    path: '/register',
    element: (
      <PageSuspense>
        <RegisterPage />
      </PageSuspense>
    ),
  },
  {
    path: '/recover',
    element: (
      <PageSuspense>
        <RecoverPage />
      </PageSuspense>
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
        path: 'wallet',
        element: (
          <PageSuspense>
            <WalletPage />
          </PageSuspense>
        ),
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
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
