// Finance "tier" colouring — the platform paints monetary amounts by size, from
// grey (tiny) up to gold (huge). The thresholds come from GET /api/finances/colors
// but change extremely rarely, so we cache them hard (Infinity) and seed from
// localStorage for instant first paint, with a hardcoded fallback as last resort.
//
// Consume via <Amount> (shared/ui/Amount.tsx) — don't read these directly in pages.

import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';

/** The six amount-size tiers, low → high. Each maps to a --color-tier-* token. */
export type FinanceTier = 'grey' | 'blue' | 'purple' | 'pink' | 'red' | 'gold';

/** USD lower-bound for each tier. An amount belongs to the highest tier it clears. */
export type Thresholds = Record<FinanceTier, number>;

/** Tiers in ascending threshold order — the order we scan to classify an amount. */
export const TIER_ORDER: readonly FinanceTier[] = [
  'grey',
  'blue',
  'purple',
  'pink',
  'red',
  'gold',
];

/** Tailwind text-colour class for each tier (utilities generated from index.css @theme). */
const TIER_TEXT_CLASS: Record<FinanceTier, string> = {
  grey: 'text-tier-grey',
  blue: 'text-tier-blue',
  purple: 'text-tier-purple',
  pink: 'text-tier-pink',
  red: 'text-tier-red',
  gold: 'text-tier-gold',
};

/** Ultimate fallback if the API has never been reached and nothing is cached. */
const DEFAULT_THRESHOLDS: Thresholds = {
  grey: 0,
  blue: 0.1,
  purple: 1,
  pink: 15,
  red: 100,
  gold: 1000,
};

const STORAGE_KEY = 'phantom.finance-colors';

/** Read the long-term cached thresholds from localStorage, if any are valid. */
function readCache(): Thresholds | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result = {} as Thresholds;
    for (const tier of TIER_ORDER) {
      const n = Number(parsed[tier]);
      if (!Number.isFinite(n)) return undefined;
      result[tier] = n;
    }
    return result;
  } catch {
    return undefined;
  }
}

function writeCache(thresholds: Thresholds): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds));
  } catch {
    // storage unavailable / quota — non-fatal, we just lose the seed next load.
  }
}

/** Backend FinanceColors — BigDecimals may serialize as number OR string. */
type FinanceColorsDto = Record<FinanceTier, number | string>;

async function fetchThresholds(): Promise<Thresholds> {
  const dto = await api.get<FinanceColorsDto>('/finances/colors');
  const result = {} as Thresholds;
  for (const tier of TIER_ORDER) {
    const n = Number(dto[tier]);
    result[tier] = Number.isFinite(n) ? n : DEFAULT_THRESHOLDS[tier];
  }
  writeCache(result);
  return result;
}

/**
 * Thresholds for amount colouring. Cached forever (they almost never change),
 * seeded from localStorage for instant paint. Always resolves to *some* data
 * (cache → default) so consumers never need a loading branch.
 */
export function useFinanceColors() {
  return useQuery({
    queryKey: ['finances', 'colors'],
    queryFn: fetchThresholds,
    // Seed for instant paint but stamp it ancient: initialData + staleTime:Infinity
    // would never fetch (it only "worked" because the defaults matched the server).
    staleTime: 1000 * 60 * 60, // 1h — thresholds change rarely
    gcTime: Infinity,
    initialData: () => readCache() ?? DEFAULT_THRESHOLDS,
    initialDataUpdatedAt: 0,
  });
}

/** Classify an amount into its tier: the highest threshold that is <= amount. */
export function amountTier(amount: number, thresholds: Thresholds): FinanceTier {
  if (!Number.isFinite(amount)) return 'grey';
  let tier: FinanceTier = 'grey';
  for (const candidate of TIER_ORDER) {
    if (amount >= thresholds[candidate]) tier = candidate;
    else break;
  }
  return tier;
}

/** Tailwind text-colour class for a tier, e.g. tierTextClass('gold') → 'text-tier-gold'. */
export function tierTextClass(tier: FinanceTier): string {
  return TIER_TEXT_CLASS[tier];
}
