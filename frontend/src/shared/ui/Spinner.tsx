import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface SpinnerProps {
  className?: string;
  /** Pixel size of the icon. Defaults to 24. */
  size?: number;
}

export default function Spinner({ className, size = 24 }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Загрузка"
      className={clsx('inline-flex items-center justify-center text-ton', className)}
    >
      <Loader2 className="animate-spin" size={size} />
    </span>
  );
}
