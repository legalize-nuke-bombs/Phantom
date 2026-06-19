// The signed-in user's own profile (route: /profile). Thin wrapper over the
// shared ProfileView with isOwn — that component owns all the rendering and the
// settings/logout sections.

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import Spinner from '@/shared/ui/Spinner';
import ProfileView from '@/features/profile/ProfileView';

export default function ProfilePage() {
  const { user, loading } = useAuth();

  // ProtectedRoute already gates on auth, but stay defensive: never render
  // ProfileView without a concrete user id.
  if (loading && !user) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <ProfileView userId={user.id} isOwn />;
}
