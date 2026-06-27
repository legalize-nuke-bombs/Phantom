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
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api/client';
import { solveAuthPow } from '@/shared/auth/pow';
import type { Role, User } from '@/shared/types';

export interface RegisterArgs {
  username: string;
  displayName: string;
  password: string;
  /** Optional referral id appended as ?refId=. Omit when there is no referrer. */
  refId?: number;
  /** Owner-only fields; omit for normal sign-up. */
  ownerKey?: string;
  role?: Role;
}

export interface RecoverArgs {
  recoveryKey: string;
  newUsername?: string;
  newPassword?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  /**
   * Creates the account and returns the ONE-TIME recovery key the backend mints.
   * Does NOT start a session — surface the key, then call login().
   */
  register: (args: RegisterArgs) => Promise<string>;
  /**
   * Recover access with a recovery key (rotating username and/or password).
   * Does NOT start a session — send the user to login afterwards.
   */
  recover: (args: RecoverArgs) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
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
      // Sets the httpOnly `token` cookie; we then hydrate the user via /users/me.
      const pow = await solveAuthPow();
      await api.post<{ token: string }>('/auth/login', { username, password }, pow);
      // Wipe any previous user's cached data (profile, wallet, deposit address, presents,
      // …) before loading this one — same browser must not bleed one account into another.
      queryClient.clear();
      await refresh();
    },
    [refresh, queryClient],
  );

  const register = useCallback(async (args: RegisterArgs): Promise<string> => {
    // refId/ownerKey/role are BODY fields of RegisterRequest — the backend binds them
    // from the JSON body, there is no @RequestParam. Sending refId as ?refId= silently
    // dropped every referral: Spring had nowhere to bind the query param, so the invite
    // registered as a walk-in. Pass the whole args as the body; JSON.stringify omits the
    // undefined optionals, so a plain sign-up still sends just {username,displayName,password}.
    const pow = await solveAuthPow();
    const res = await api.post<{ recoveryKey: string }>('/auth/register', args, pow);
    return res.recoveryKey;
  }, []);

  const recover = useCallback(async (args: RecoverArgs) => {
    const pow = await solveAuthPow();
    await api.post<{ message: string }>('/auth/recover', args, pow);
  }, []);

  const logout = useCallback(async () => {
    // No logout endpoint exists on the backend yet; clearing local state is the
    // source of truth. Best-effort call kept for forward compatibility.
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore — endpoint may not exist
    }
    queryClient.clear(); // drop this user's cached data so it can't bleed into the next
    if (mounted.current) setUser(null);
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, recover, logout, refresh }),
    [user, loading, login, register, recover, logout, refresh],
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
