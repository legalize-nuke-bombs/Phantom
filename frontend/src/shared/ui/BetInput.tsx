// BetInput — the shared bet control for every game.
//
// A controlled USD amount field plus quick chips (½, ×2, min, max). Validates the
// amount against the game's [min, max] and the signed-in user's balance, and tells
// the parent whether the current value is a valid, playable bet via onValidityChange.
//
// Controlled: the parent owns `value` (the raw string the user typed) and gets every
// change through `onChange`. Keeping the raw string (not a number) lets the user type
// "1." or "" mid-edit without the field fighting them; validity is computed from it.

import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { formatUsd } from '@/shared/lib/money';
import { useWallet } from '@/shared/lib/wallet';

export interface BetInputProps {
  /** Raw input string (controlled). Parent stores exactly what the user typed. */
  value: string;
  onChange: (value: string) => void;
  /** Minimum bet (USD). From the game's settings (e.g. minimalBet). */
  min: number;
  /**
   * Maximum bet (USD). Optional — when omitted, the only upper bound is the
   * user's balance. The effective cap is min(max, balance).
   */
  max?: number;
  /** Fired whenever validity flips. The parent uses this to enable/disable Play. */
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
  /** Override the error message shown below (e.g. a server-side rejection). */
  error?: string;
  className?: string;
}

/** Round to cents, never below zero. */
function clampCents(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

export default function BetInput({
  value,
  onChange,
  min,
  max,
  onValidityChange,
  disabled,
  error,
  className,
}: BetInputProps) {
  const { data: wallet } = useWallet();
  const balance = wallet ? Number(wallet.balance) : 0;

  // The highest bet the user could actually place: their balance, capped by the
  // game's max if one is set.
  const effectiveMax = useMemo(
    () => (max != null ? Math.min(max, balance) : balance),
    [max, balance],
  );

  const amount = Number(value);
  const parsed = value.trim() !== '' && Number.isFinite(amount) ? amount : NaN;

  // Validation, in priority order, yields both validity and a reason to show.
  const { valid, reason } = useMemo(() => {
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return { valid: false, reason: '' }; // empty / mid-edit: no nag
    }
    if (parsed < min) return { valid: false, reason: `Минимум ${formatUsd(min)}` };
    if (parsed > balance) return { valid: false, reason: 'Недостаточно средств' };
    if (max != null && parsed > max) {
      return { valid: false, reason: `Максимум ${formatUsd(max)}` };
    }
    return { valid: true, reason: '' };
  }, [parsed, min, max, balance]);

  // Notify the parent on every validity change (and on mount).
  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  const set = (n: number) => onChange(String(clampCents(n)));

  const chips: { label: string; apply: () => void; disabled?: boolean }[] = [
    {
      label: '½',
      apply: () => set((Number.isFinite(parsed) ? parsed : min) / 2),
    },
    {
      label: '×2',
      apply: () => set(Math.min((Number.isFinite(parsed) ? parsed : min) * 2, effectiveMax)),
    },
    { label: 'Мин', apply: () => set(min) },
    {
      label: 'Макс',
      apply: () => set(effectiveMax),
      disabled: effectiveMax < min,
    },
  ];

  const shownError = error ?? reason;

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <div
        className={clsx(
          'flex items-center gap-2 rounded-xl px-3 h-12',
          'bg-panel-2 border transition-colors',
          shownError ? 'border-lose' : 'border-edge focus-within:border-ton',
        )}
      >
        <span className="text-muted select-none">$</span>
        <input
          inputMode="decimal"
          // Plain number-ish input; we keep it a text field so the raw string is
          // ours to control (no locale/spinner surprises).
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            // Allow only digits and a single dot — reject stray characters so the
            // controlled string never holds garbage.
            if (next === '' || /^\d*\.?\d*$/.test(next)) onChange(next);
          }}
          disabled={disabled}
          placeholder="0.00"
          aria-label="Ставка"
          aria-invalid={shownError ? true : undefined}
          className={clsx(
            'min-w-0 flex-1 bg-transparent text-fg text-lg font-medium',
            'placeholder:text-muted focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        <div className="flex items-center gap-1">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.apply}
              disabled={disabled || c.disabled}
              className={clsx(
                'h-7 min-w-9 px-2 rounded-lg text-xs font-medium',
                'bg-panel text-muted border border-edge',
                'transition-colors hover:text-fg hover:border-ton/60',
                'disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">
          Баланс: <span className="text-fg">{formatUsd(balance)}</span>
        </span>
        {shownError ? (
          <span className="text-lose">{shownError}</span>
        ) : (
          <span className="text-muted">Мин {formatUsd(min)}</span>
        )}
      </div>
    </div>
  );
}
