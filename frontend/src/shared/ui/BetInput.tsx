// BetInput — the shared bet control for every game.
//
// A controlled USD amount field. Validates the amount against the game's
// [min, max] and the signed-in user's balance, and tells the parent whether the
// current value is a valid, playable bet via onValidityChange.
//
// Controlled: the parent owns `value` (the raw string the user typed) and gets
// every change through `onChange`. Keeping the raw string (not a number) lets the
// user type "1." or "" mid-edit without the field fighting them; validity is
// computed from it.

import { useEffect, useMemo, useRef } from 'react';
import clsx from 'clsx';
import { formatUsd, normalizeAmountInput } from '@/shared/lib/money';
import { useWallet } from '@/shared/lib/wallet';
import { SUPPRESS_AUTOFILL } from '@/shared/ui/Input';

export interface BetInputProps {
  /** Raw input string (controlled). Parent stores exactly what the user typed. */
  value: string;
  onChange: (value: string) => void;
  /** Minimum bet (USD). From the game's settings (e.g. minimalBet). */
  min: number;
  /**
   * Maximum bet (USD). Optional — when omitted, the only upper bound is the
   * user's balance.
   */
  max?: number;
  /** Fired whenever validity flips. The parent uses this to enable/disable Play. */
  onValidityChange?: (valid: boolean) => void;
  disabled?: boolean;
  /** Override the error message shown below (e.g. a server-side rejection). */
  error?: string;
  className?: string;
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

  // Notify the parent whenever validity flips. We hold the latest callback in a ref
  // and depend ONLY on `valid` — so an unstable inline callback (a new function each
  // render, e.g. from a parent useReducer that yields a fresh state object) can't
  // retrigger this effect every render and spin into an infinite update loop.
  const onValidityChangeRef = useRef(onValidityChange);
  useEffect(() => {
    onValidityChangeRef.current = onValidityChange;
  });
  useEffect(() => {
    onValidityChangeRef.current?.(valid);
  }, [valid]);

  const shownError = error ?? reason;

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <div
        className={clsx(
          'flex h-12 items-center gap-2 rounded-xl px-3',
          'border bg-panel-2 transition-colors',
          shownError ? 'border-lose' : 'border-edge focus-within:border-ton',
        )}
      >
        <span className="select-none text-muted">$</span>
        <input
          inputMode="decimal"
          // Plain number-ish input; we keep it a text field so the raw string is
          // ours to control (no locale/spinner surprises).
          value={value}
          onChange={(e) => {
            // Accept a comma as the decimal separator (mobile numeric keypads often
            // have only a comma) and keep the controlled string a clean partial decimal.
            const next = normalizeAmountInput(e.target.value);
            if (next !== null) onChange(next);
          }}
          disabled={disabled}
          aria-label="Ставка"
          autoComplete="off"
          {...SUPPRESS_AUTOFILL}
          aria-invalid={shownError ? true : undefined}
          className={clsx(
            'min-w-0 flex-1 bg-transparent text-lg font-medium text-fg',
            'placeholder:text-muted focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
      </div>

      <div className="min-h-[1rem] text-xs">
        {shownError ? (
          <span className="text-lose">{shownError}</span>
        ) : (
          <span className="text-muted">Мин {formatUsd(min)}</span>
        )}
      </div>
    </div>
  );
}
