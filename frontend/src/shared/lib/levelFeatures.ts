// Level-feature system — the single source of truth for "which rank unlocks what".
//
// Features (chat, presents, disk) unlock as a user's XP crosses level thresholds,
// and they accumulate: once a feature is granted by some level, every higher level
// keeps it. The level table itself (GET /api/experience/levels) changes extremely
// rarely, so we cache it long-term and seed from localStorage for instant gating —
// mirroring shared/lib/roles and shared/lib/financeColors.
//
// Gate action UIs on a FEATURE, never on a rank name: useMyFeatures().has(feature)
// or useFeatureGate(feature). The rank that unlocks a feature is derived from the
// table, so re-tuning thresholds on the backend needs no frontend change.

import { createElement } from 'react';
import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import clsx from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { useAuth } from '@/shared/auth/AuthContext';
import { useMyExperience } from '@/shared/lib/experience';
import type { Level, LevelName } from '@/shared/types';

/* ── Features ──────────────────────────────────────────────────────────── */

/** The LevelFeature enum (com.example.phantom.experience.LevelFeature). */
export type LevelFeature = 'SEND_MESSAGE' | 'SEND_PRESENT' | 'DISK_BASE' | 'DISK_PLUS';

/** Every feature, for iteration / exhaustiveness. Order = how we'd list them in UI. */
export const LEVEL_FEATURES: readonly LevelFeature[] = [
  'SEND_MESSAGE',
  'SEND_PRESENT',
  'DISK_BASE',
  'DISK_PLUS',
];

/** Human-readable RU label per feature — for "Откроется на ранге X" copy, lists, etc. */
export const FEATURE_LABELS: Record<LevelFeature, string> = {
  SEND_MESSAGE: 'Отправка сообщений',
  SEND_PRESENT: 'Отправка подарков',
  DISK_BASE: 'Облако',
  DISK_PLUS: 'Облако Плюс',
};

const FEATURE_SET = new Set<string>(LEVEL_FEATURES);

/** Type guard: keep only strings that are real LevelFeature enum names. */
function isFeature(value: unknown): value is LevelFeature {
  return typeof value === 'string' && FEATURE_SET.has(value);
}

/* ── Levels table (long-term cache, localStorage-seeded) ───────────────── */

const STORAGE_KEY = 'phantom.levels';

/** Coerce one raw record into a typed Level, dropping any unknown feature strings. */
function normalizeLevel(raw: unknown): Level {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const amount = Number(obj.amount);
  const features = Array.isArray(obj.features) ? obj.features.filter(isFeature) : [];
  return {
    name: obj.name as LevelName,
    amount: Number.isFinite(amount) ? amount : 0,
    features,
  };
}

/** Read the long-term cached level table from localStorage, if it is well-formed. */
function readCache(): Level[] | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed.map(normalizeLevel);
  } catch {
    return undefined;
  }
}

function writeCache(levels: Level[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
  } catch {
    // storage unavailable / quota — non-fatal, we just lose the seed next load.
  }
}

async function fetchLevels(): Promise<Level[]> {
  const dto = await api.get<Level[]>('/experience/levels');
  const levels = Array.isArray(dto) ? dto.map(normalizeLevel) : [];
  writeCache(levels);
  return levels;
}

/**
 * The level/feature table. Cached long-term (it almost never changes), seeded from
 * localStorage for an instant first paint, then refreshed once. Always resolves to
 * *some* array (cache → []) so consumers never need a loading branch — an empty
 * table simply unlocks nothing.
 *
 * Other code (e.g. ProfileView's ad-hoc levels query) can drop its own query and
 * read from here instead.
 */
export function useLevels() {
  return useQuery({
    queryKey: ['experience', 'levels'],
    queryFn: fetchLevels,
    // NB: initialData + staleTime:Infinity would mark the seed "fresh forever" and
    // never fetch — pinning us to whatever happened to be cached. We seed for an
    // instant paint but stamp it ancient (updatedAt:0) so the query fetches once.
    staleTime: 1000 * 60 * 60, // 1h — the level table changes rarely
    gcTime: Infinity,
    initialData: () => readCache() ?? [],
    initialDataUpdatedAt: 0,
  });
}

/* ── Pure lookups ──────────────────────────────────────────────────────── */

/**
 * The LOWEST level (by XP amount) whose features include `feature`, or null if no
 * level grants it (or the table is empty). This is the rank a user must reach to
 * unlock the feature.
 */
export function featureUnlockLevel(
  levels: ReadonlyArray<Level> | undefined,
  feature: LevelFeature,
): LevelName | null {
  if (!levels || levels.length === 0) return null;
  let best: Level | null = null;
  for (const lvl of levels) {
    if (!lvl.features.includes(feature)) continue;
    if (best === null || lvl.amount < best.amount) best = lvl;
  }
  return best ? best.name : null;
}

/**
 * The set of features unlocked at `currentXp`: the union of features from every
 * level whose threshold is at or below the user's XP (features accumulate as XP
 * grows). A non-finite XP is treated as 0.
 */
export function unlockedFeatures(
  levels: ReadonlyArray<Level> | undefined,
  currentXp: number,
): Set<LevelFeature> {
  const unlocked = new Set<LevelFeature>();
  if (!levels) return unlocked;
  const xp = Number.isFinite(currentXp) ? currentXp : 0;
  for (const lvl of levels) {
    if (lvl.amount > xp) continue;
    // Level.features is typed string[] (it carries raw enum names); keep only the
    // features this frontend knows, so an unrecognised backend feature is ignored
    // rather than leaking through as an unknown gate.
    for (const feature of lvl.features) if (isFeature(feature)) unlocked.add(feature);
  }
  return unlocked;
}

/* ── The current user's features ───────────────────────────────────────── */

export interface MyFeatures {
  /** Has the signed-in user unlocked this feature? False while loading / signed out. */
  has: (feature: LevelFeature) => boolean;
  /** The rank that unlocks this feature, independent of the user (or null). */
  unlockLevel: (feature: LevelFeature) => LevelName | null;
  /** The full level table (already cached) for callers that want to list ranks. */
  levels: Level[];
}

/**
 * The signed-in user's feature access — the hook ALL feature gating should go
 * through. Combines the level table (useLevels) with the user's own XP record
 * (useMyExperience). The safe default is "locked": while the table or the XP is
 * still loading — or the user is signed out / hid their experience — has() returns
 * false, so a gated action stays disabled until we positively know it's unlocked.
 */
export function useMyFeatures(): MyFeatures {
  const { user } = useAuth();
  const { data: levels = [] } = useLevels();
  const { data: experience } = useMyExperience(user?.id);

  const unlocked = unlockedFeatures(levels, experience?.amount ?? 0);

  return {
    has: (feature) => unlocked.has(feature),
    unlockLevel: (feature) => featureUnlockLevel(levels, feature),
    levels,
  };
}

/* ── Composable gate for a single feature ──────────────────────────────── */

export interface FeatureGate {
  /** True when the signed-in user has NOT unlocked the feature (safe default while loading). */
  locked: boolean;
  /** The rank that unlocks it (or null if unknown) — for "Откроется на ранге X" copy. */
  unlockLevel: LevelName | null;
  /** Human RU label for the feature, for convenience. */
  label: string;
}

/**
 * Gate one feature for the current user. Drop into an action component to decide
 * whether to disable it and what to tell the user:
 *
 *   const { locked, unlockLevel } = useFeatureGate('SEND_PRESENT');
 *   <Button disabled={locked}>Подарить</Button>
 *   {locked && <FeatureLock feature="SEND_PRESENT" />}
 */
export function useFeatureGate(feature: LevelFeature): FeatureGate {
  const { has, unlockLevel } = useMyFeatures();
  return {
    locked: !has(feature),
    unlockLevel: unlockLevel(feature),
    label: FEATURE_LABELS[feature],
  };
}

/* ── <FeatureLock> ─────────────────────────────────────────────────────── */
//
// Written with createElement (not JSX) so this lib stays a plain `.ts` module while
// still shipping a ready-to-drop UI hint. It renders NOTHING when the feature is
// already unlocked, so it's safe to mount unconditionally next to a gated action.

export interface FeatureLockProps {
  feature: LevelFeature;
  className?: string;
  /** Override the default "Откроется на ранге X" hint (e.g. for inline phrasing). */
  children?: ReactNode;
}

/**
 * A tiny 🔒 hint shown only while `feature` is locked for the current user:
 * "🔒 Откроется на ранге <rank>". Renders null once unlocked.
 */
export function FeatureLock({ feature, className, children }: FeatureLockProps): ReactNode {
  const { locked, unlockLevel } = useFeatureGate(feature);
  if (!locked) return null;

  const hint =
    children ??
    (unlockLevel ? `Откроется на ранге ${unlockLevel}` : 'Пока недоступно');

  return createElement(
    'span',
    {
      className: clsx('inline-flex items-center gap-1 text-xs text-muted', className),
    },
    createElement(Lock, { size: 12, className: 'shrink-0', 'aria-hidden': true }),
    hint,
  );
}
