// PageBack — a small, subtle back link for the top of a sub-page.
//
//   <PageBack to="/games" label="К играм" />
//
// Renders a lucide ArrowLeft + label as a muted link that brightens on hover.
// Uses React Router so it participates in client-side navigation.

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

export interface PageBackProps {
  /** Destination route, e.g. "/games". */
  to: string;
  /** Link text, e.g. "К играм". */
  label: string;
  className?: string;
}

export default function PageBack({ to, label, className }: PageBackProps) {
  return (
    <Link
      to={to}
      className={clsx(
        'inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg',
        className,
      )}
    >
      <ArrowLeft size={16} className="shrink-0" aria-hidden />
      <span>{label}</span>
    </Link>
  );
}
