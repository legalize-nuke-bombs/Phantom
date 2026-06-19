// Public profile of another user (route: /u/:userId). Thin wrapper over the
// shared ProfileView with isOwn=false. If the id resolves to the signed-in user,
// redirect to the canonical own-profile route so they get the editable view.

import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import ProfileView from '@/features/profile/ProfileView';

export default function UserProfilePage() {
  const { userId: param } = useParams<{ userId: string }>();
  const { user } = useAuth();

  const userId = Number(param);
  if (!Number.isInteger(userId) || userId <= 0) {
    return <Navigate to="/" replace />;
  }

  // Looking at yourself → use the own-profile page (settings + logout).
  if (user && user.id === userId) {
    return <Navigate to="/profile" replace />;
  }

  return <ProfileView userId={userId} isOwn={false} />;
}
