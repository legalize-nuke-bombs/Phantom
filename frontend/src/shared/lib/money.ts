// Platform balances are an internal USD amount. Crypto (TON, …) is only a
// deposit/withdrawal rail that converts to/from this balance — so balances are
// rendered as dollars everywhere, never in a specific coin.

/**
 * Format an internal balance (decimal string or number) as USD.
 * Dot decimal separator, comma thousands grouping (en-US): "$1,234.50".
 * @example formatUsd('80.4') // "$80.40"
 */
export function formatUsd(
  amount: string | number | null | undefined,
  decimals = 2,
): string {
  if (amount == null || amount === '') return '—';
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  // Truncate toward zero at `decimals` — NEVER round up. The backend balance can be
  // e.g. 77.299999; rounding that to 77.30 would let the user key in more than they
  // actually hold and get rejected by the backend. The tiny epsilon only absorbs binary
  // float error (so 0.29 doesn't display as 0.28); it can't lift a genuine sub-cent
  // shortfall up a whole cent.
  const factor = 10 ** decimals;
  const floored = (Math.sign(n) * Math.floor(Math.abs(n) * factor + 1e-6)) / factor;
  // Any tiny negative truncates to -0, which toLocaleString renders as "-$0.00"; normalize it.
  const value = floored === 0 ? 0 : floored;
  return (
    '$' +
    value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

/**
 * Normalize a money amount string as the user types it. Folds a comma to a dot so the
 * comma works as a decimal separator (mobile numeric keypads often have only a comma,
 * no dot), and accepts only a valid partial decimal — digits with at most one dot.
 * Returns the cleaned, dot-canonical string, or null when the keystroke isn't a valid
 * (partial) amount so the caller can ignore it and leave the field unchanged.
 */
export function normalizeAmountInput(raw: string): string | null {
  const dotted = raw.replace(/,/g, '.');
  if (dotted === '' || /^\d*\.?\d*$/.test(dotted)) return dotted;
  return null;
}
