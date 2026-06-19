import clsx from 'clsx';

export interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}

/**
 * Minimal accessible on/off switch. Track 44×24, thumb 20, inline-flow thumb
 * centred via items-center (no absolute positioning → no overflow). Reuse this
 * everywhere a toggle is needed.
 */
export default function Switch({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onChange}
      className={clsx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50',
        checked ? 'bg-ton-deep border-ton-deep' : 'bg-panel-2 border-edge',
      )}
    >
      <span
        className={clsx(
          'inline-block size-5 rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
