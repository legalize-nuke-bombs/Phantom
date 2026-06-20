// Public profile of another user (route: /u/:userId). Thin wrapper over the
// shared ProfileView with isOwn=false. If the id resolves to the signed-in user,
// redirect to the canonical own-profile route so they get the editable view.

import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthContext';
import ProfileView from '@/features/profile/ProfileView';

export default function UserProfilePage() {
  const { userId: param } = useParams<{ userId: string }>();
  const { user } = useAuth();

  // The handle is a numeric id OR a @username (mentions deep-link by username). Empty →
  // home. ProfileView resolves it (by-id for digits, by-username otherwise).
  const handle = (param ?? '').trim();
  if (!handle) {
    return <Navigate to="/" replace />;
  }

  // A numeric handle that is me → the editable own-profile page. (A username handle that
  // resolves to me still shows the public view — fine; resolving it here would need a fetch.)
  if (user && /^\d+$/.test(handle) && Number(handle) === user.id) {
    return <Navigate to="/profile" replace />;
  }

  return <ProfileView userId={handle} isOwn={false} />;
}
