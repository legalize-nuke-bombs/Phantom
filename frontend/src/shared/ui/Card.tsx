import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

type CardProps = HTMLAttributes<HTMLDivElement>;

export default function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx('bg-panel border border-edge rounded-xl', className)}
      {...props}
    >
      {children}
    </div>
  );
}
