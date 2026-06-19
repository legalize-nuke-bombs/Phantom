import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Error/help text shown below the field; error tints it red. */
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm text-muted">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          'h-11 w-full rounded-xl px-3 text-sm',
          'bg-panel-2 border border-edge text-fg placeholder:text-muted',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-ton focus:border-ton',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-lose focus:ring-lose focus:border-lose',
          className,
        )}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && <span className="text-xs text-lose">{error}</span>}
    </div>
  );
});

export default Input;
