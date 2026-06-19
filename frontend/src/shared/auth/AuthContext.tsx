import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { api, ApiError } from '@/shared/api/client';
import type { Role, User } from '@/shared/types';

export interface RegisterArgs {
  username: string;
  displayName: string;
  password: string;
  /** Optional referral id appended as ?refId=. */
  refId?: number;
  /** Owner-only fields; omit for normal sign-up. */
  ownerKey?: string;
  role?: Role;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  /** Returns the one-time recovery key the backend mints on registration. */
  register: (args: RegisterArgs) => Promise<string>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<User>('/users/me');
      if (mounted.current) setUser(me);
    } catch (e) {
      // 401 (NOT_AUTHENTICATED) simply means no session — not an error.
      if (e instanceof ApiError && e.status === 401) {
        if (mounted.current) setUser(null);
      } else {
        throw e;
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh()
      .catch(() => {
        if (mounted.current) setUser(null);
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const login = useCallback(
    async (username: string, password: string) => {
      await api.post<{ token: string }>('/auth/login', { username, password });
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(async (args: RegisterArgs): Promise<string> => {
    const { refId, ...body } = args;
    const path = refId != null ? `/auth/register?refId=${refId}` : '/auth/register';
    const res = await api.post<{ recoveryKey: string }>(path, body);
    return res.recoveryKey;
  }, []);

  const logout = useCallback(async () => {
    // No logout endpoint exists on the backend yet; clearing local state is
    // the source of truth. Best-effort call kept for forward compatibility.
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore — endpoint may not exist
    }
    if (mounted.current) setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
