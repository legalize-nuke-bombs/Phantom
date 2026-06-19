// Role capabilities — the single source of truth for "what can this role do".
//
// Roles are a backend concern that grows over time (today USER / CHAT_MODERATOR /
// OWNER, tomorrow more). NEVER gate UI on a role NAME (`role === 'CHAT_MODERATOR'`)
// — that hardcodes today's roster and breaks the moment the backend adds or renames
// a role. Instead gate on CAPABILITY FLAGS the backend ships per role
// (chatModeratorAccess, ownerAccess), resolved here via useMyCapabilities().
//
// The role table comes from GET /api/users/roles (RoleRepresentation) and changes
// extremely rarely, so we cache it hard (Infinity) and seed from localStorage for
// an instant first paint — mirroring shared/lib/financeColors.

import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/AuthContext';

/**
 * RoleRepresentation — GET /api/users/roles. `name` is the Role enum name; the two
 * flags are the access grants that role carries. Backend ships them as Java Boolean,
 * so tolerate null/missing by coercing to false in capabilitiesOf.
 */
export interface RoleRepresentation {
  name: string;
  chatModeratorAccess: boolean;
  ownerAccess: boolean;
}

/** The capability flags a single role grants, with safe defaults. */
export interface Capabilities {
  isChatModerator: boolean;
  isOwner: boolean;
}

const NO_CAPABILITIES: Capabilities = { isChatModerator: false, isOwner: false };

const STORAGE_KEY = 'phantom.roles';

/** Read the long-term cached role table from localStorage, if it is well-formed. */
function readCache(): RoleRepresentation[] | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.map(normalizeRole);
  } catch {
    return undefined;
  }
}

function writeCache(roles: RoleRepresentation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
  } catch {
    // storage unavailable / quota — non-fatal, we just lose the seed next load.
  }
}

/** Coerce one raw role record into a fully-typed RoleRepresentation (flags → bool). */
function normalizeRole(raw: unknown): RoleRepresentation {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    name: typeof obj.name === 'string' ? obj.name : '',
    chatModeratorAccess: obj.chatModeratorAccess === true,
    ownerAccess: obj.ownerAccess === true,
  };
}

async function fetchRoles(): Promise<RoleRepresentation[]> {
  const dto = await api.get<RoleRepresentation[]>('/users/roles');
  const roles = Array.isArray(dto) ? dto.map(normalizeRole) : [];
  writeCache(roles);
  return roles;
}

/**
 * The role capability table. Cached forever (it almost never changes), seeded from
 * localStorage for instant gating. Always resolves to *some* array (cache → []) so
 * consumers never need a loading branch — an empty table simply grants nothing.
 */
export function useRoles() {
  return useQuery({
    queryKey: ['users', 'roles'],
    queryFn: fetchRoles,
    // NB: initialData + staleTime:Infinity would mark the seed "fresh forever" and
    // never fetch — leaving roles as the empty [] seed (no capabilities ever). We
    // seed for instant gating but stamp it ancient so the query fetches once.
    staleTime: 1000 * 60 * 60, // 1h — roles change rarely
    gcTime: Infinity,
    initialData: () => readCache() ?? [],
    initialDataUpdatedAt: 0,
  });
}

/**
 * Pure lookup: the capability flags for `roleName` within `roles`. Unknown role or
 * empty table → no capabilities. The only place that maps a role name to its flags.
 */
export function capabilitiesOf(
  roles: ReadonlyArray<RoleRepresentation> | undefined,
  roleName: string | null | undefined,
): Capabilities {
  if (!roles || roleName == null) return NO_CAPABILITIES;
  const role = roles.find((r) => r.name === roleName);
  if (!role) return NO_CAPABILITIES;
  return {
    isChatModerator: role.chatModeratorAccess === true,
    isOwner: role.ownerAccess === true,
  };
}

/**
 * The current user's capabilities — the hook ALL role gating should go through.
 * Combines the signed-in user's role (useAuth) with the role table (useRoles).
 * Resolves to all-false while loading, signed out, or for an unknown role, so the
 * safe default is always "no access" — never gate on a role name directly.
 */
export function useMyCapabilities(): Capabilities {
  const { user } = useAuth();
  const { data: roles } = useRoles();
  return capabilitiesOf(roles, user?.role);
}
