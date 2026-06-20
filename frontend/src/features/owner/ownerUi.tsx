// Shared building blocks for the owner console: a titled section card, a two-step
// confirm button (now reserved for the single irreversible action — delete-user),
// a transient success line, and a generic cursor-paginated history list. Kept here
// so every section stays focused on its own form logic.

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';

import { errorMessage } from '@/shared/api/errors';
import type { Role } from '@/shared/types';
import Button from '@/shared/ui/Button';
import Card from '@/shared/ui/Card';
import Spinner from '@/shared/ui/Spinner';

/** Russian labels for the role enum, reused across the role section. */
export const ROLE_LABELS: Record<Role, string> = {
  USER: 'Игрок',
  CHAT_MODERATOR: 'Модератор чата',
  OWNER: 'Владелец',
};

/** The roles assignable from the console, low → high privilege. */
export const ASSIGNABLE_ROLES: readonly Role[] = ['USER', 'CHAT_MODERATOR', 'OWNER'];

/** A titled card section — the visual unit of the console. */
export function Section({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={clsx('p-5 sm:p-6', className)}>
      <div className={clsx('flex items-center gap-2 text-fg', description ? 'mb-1' : 'mb-4')}>
        <span className="text-ton">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {description ? (
        <p className="mb-4 text-xs leading-relaxed text-muted">{description}</p>
      ) : null}
      {children}
    </Card>
  );
}

/** A short red error line. */
export function ErrorLine({ message }: { message: string }) {
  return <p className="text-sm text-lose">{message}</p>;
}

/** A short green success line with a check; pass any node as the message. */
export function SuccessLine({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-win">
      <Check size={15} strokeWidth={2} />
      {children}
    </p>
  );
}

/**
 * A submit/action button that requires TWO clicks: the first click arms it (label
 * switches to a confirm prompt for `confirmMs`), the second within the window
 * actually fires. Reserved for the one IRREVERSIBLE owner action — deleting a user
 * — guarding it against a single mis-click without a modal. Every other owner action
 * fires directly (it is reversible) and uses a plain Button.
 */
export function ConfirmButton({
  onConfirm,
  idleLabel,
  confirmLabel,
  icon,
  loading,
  disabled,
  danger,
  confirmMs = 3500,
  className,
}: {
  onConfirm: () => void;
  idleLabel: ReactNode;
  confirmLabel: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Tint the armed state red (delete/irreversible). */
  danger?: boolean;
  confirmMs?: number;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    },
    [],
  );

  // Disarm whenever the button goes disabled (e.g. the form became invalid).
  useEffect(() => {
    if (disabled && armed) setArmed(false);
  }, [disabled, armed]);

  function disarm() {
    setArmed(false);
    if (timer.current !== undefined) window.clearTimeout(timer.current);
  }

  function handleClick() {
    if (loading || disabled) return;
    if (!armed) {
      setArmed(true);
      timer.current = window.setTimeout(() => setArmed(false), confirmMs);
      return;
    }
    disarm();
    onConfirm();
  }

  return (
    <Button
      type="button"
      onClick={handleClick}
      loading={loading}
      disabled={disabled}
      className={clsx(
        armed && danger && 'bg-lose text-white hover:bg-lose',
        armed && !danger && 'bg-ton text-white hover:bg-ton',
        className,
      )}
    >
      {!loading && icon}
      {armed ? confirmLabel : idleLabel}
    </Button>
  );
}

/* ── generic history list (cursor-paginated) ──────────────────────────────────── */

interface HistoryListProps<T> {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  items: T[];
  emptyText: string;
  errorText: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onRetry: () => void;
  renderItem: (item: T) => ReactNode;
}

/** A loading/error/empty/list+more shell for the two owner history feeds. */
export function HistoryList<T>({
  isLoading,
  isError,
  error,
  items,
  emptyText,
  errorText,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onRetry,
  renderItem,
}: HistoryListProps<T>) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Spinner size={20} />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorLine message={errorMessage(error, errorText)} />
        <Button type="button" variant="ghost" size="sm" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="text-sm text-muted">{emptyText}</p>;
  }
  return (
    <>
      <ul className="divide-y divide-edge rounded-xl border border-edge bg-panel-2">
        {items.map((item) => renderItem(item))}
      </ul>
      {hasNextPage ? (
        <div className="mt-2 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={isFetchingNextPage}
            onClick={fetchNextPage}
          >
            Показать ещё
          </Button>
        </div>
      ) : null}
    </>
  );
}
