// Experience / rank lookups. Two access patterns:
//   • useMyExperience(userId)  — one user's full XP record (profile, own card).
//   • useExperienceBatch(ids)  — many users' levels at once (feeds, lists, chat).
//
// Both are privacy-gated server-side: a user who hid their experience yields 403
// on the single endpoint, and is simply OMITTED from the batch map. Callers must
// therefore treat "no level" as a valid state (RankBadge shows a fallback glyph).

import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/shared/api/client';
import type { Experience, LevelName } from '@/shared/types';

/**
 * One user's experience record. Tolerates a hidden profile: a 403 resolves to
 * null (the user opted out) rather than throwing, so callers get a clean
 * "unknown level" instead of an error to handle.
 */
export function useMyExperience(userId: number | null | undefined) {
  return useQuery<Experience | null>({
    queryKey: ['experience', userId],
    enabled: userId != null,
    queryFn: async () => {
      try {
        return await api.get<Experience>(`/experience/${userId}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) return null;
        throw err;
      }
    },
  });
}

/** A map of userId → Experience. Users who hid their experience are absent. */
export type ExperienceMap = Record<number, Experience>;

/**
 * Levels for many users in one request. Ids are de-duplicated and sorted so the
 * query key is stable regardless of input order; an empty list skips the request.
 * The backend omits hidden users, so a missing id means "unknown level".
 */
export function useExperienceBatch(ids: ReadonlyArray<number>) {
  const unique = Array.from(new Set(ids)).sort((a, b) => a - b);
  const key = unique.join(',');
  return useQuery<ExperienceMap>({
    queryKey: ['experience', 'batch', key],
    enabled: unique.length > 0,
    queryFn: () => api.get<ExperienceMap>('/experience/batch?ids=' + key),
  });
}

/**
 * Read a user's level out of a batch map, or null if absent/unknown. Map keys
 * arrive as strings over JSON, so we index by the stringified id.
 */
export function levelFor(map: ExperienceMap | undefined, id: number): LevelName | null {
  if (!map) return null;
  const entry = map[id] ?? (map as Record<string, Experience>)[String(id)];
  return entry?.level ?? null;
}
