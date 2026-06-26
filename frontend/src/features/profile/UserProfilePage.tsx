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

  // Reaching my OWN profile by either form of handle → the editable own-profile page. Compare
  // ids as STRINGS (a user id is a Java long; Number() would lose precision past 2^53), and
  // also match my @username so /u/<myUsername> (e.g. a self-mention) doesn't show me the
  // privacy-gated public view of myself.
  if (
    user &&
    ((/^\d+$/.test(handle) && handle === String(user.id)) ||
      handle.toLowerCase() === user.username.toLowerCase())
  ) {
    return <Navigate to="/profile" replace />;
  }

  return <ProfileView userId={handle} isOwn={false} />;
}
