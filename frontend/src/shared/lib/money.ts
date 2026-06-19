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
  return (
    '$' +
    n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}
