import clsx from 'clsx';
import { formatUsd } from '@/shared/lib/money';
import { amountTier, tierTextClass, useFinanceColors } from '@/shared/lib/financeColors';

interface AmountProps {
  /** USD amount as a decimal string or number (backend decimals are strings). */
  value: string | number | null | undefined;
  className?: string;
}

/**
 * Coloured money. Renders formatUsd(value) tinted by its finance tier (grey → gold
 * by size). This is THE way to show a monetary amount everywhere EXCEPT the wallet
 * balance (which is rendered plainly).
 *
 * Cheap to use anywhere: thresholds come from a forever-cached query, so this does
 * no network work on render.
 */
export default function Amount({ value, className }: AmountProps) {
  const { data: thresholds } = useFinanceColors();
  const n = typeof value === 'number' ? value : Number(value);
  const tier = amountTier(n, thresholds);
  return <span className={clsx(tierTextClass(tier), className)}>{formatUsd(value)}</span>;
}
