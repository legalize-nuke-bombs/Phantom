// ProvablyFair — a tiny, unobtrusive "честная игра" service link.
//
// Collapsed by default it is just a small muted text-link. Expanding it shows a
// compact panel:
//   • Before reveal — the committed serverHash (proof the seed was fixed first).
//   • After reveal  — serverSeed + clientSeed and a ✓/✗ verified badge proving
//     SHA-256(serverSeed) === serverHash.
//
// No headings, no explanatory paragraphs — it stays out of the way. Verification
// uses the `verified` prop when given (useGameRound exposes it); otherwise the
// component verifies itself once both serverSeed and serverHash are present, so it
// also works in a static history view.

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Copy, ShieldCheck, X } from 'lucide-react';
import clsx from 'clsx';
import { verifyServerHash } from '@/shared/lib/provablyFair';

export interface ProvablyFairProps {
  /** Committed SHA-256 of the server seed (hex). Shown in both phases. */
  serverHash: string | null | undefined;
  /** Revealed server seed (hex) — present only after the round resolves. */
  serverSeed?: string | null;
  /** The client seed used for the round — present only after reveal. */
  clientSeed?: string | null;
  /**
   * Pre-computed verification result. Pass useGameRound().verified to skip the
   * local recompute. When omitted, the panel verifies itself once seeds arrive.
   */
  verified?: boolean | null;
  /** Start expanded. Defaults to collapsed to stay out of the way. */
  defaultOpen?: boolean;
  className?: string;
}

/** One labelled, monospace, copyable hex row — compact. */
function SeedRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard blocked (insecure context / permissions) — non-fatal.
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted">{label}</span>
      <button
        type="button"
        onClick={copy}
        title="Скопировать"
        className={clsx(
          'group flex items-start gap-2 rounded-md px-2 py-1.5 text-left',
          'border border-edge bg-ink transition-colors hover:border-ton/60',
        )}
      >
        <code className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-fg/80">
          {value}
        </code>
        {copied ? (
          <Check size={13} className="mt-0.5 shrink-0 text-win" aria-hidden />
        ) : (
          <Copy
            size={13}
            className="mt-0.5 shrink-0 text-muted group-hover:text-fg"
            aria-hidden
          />
        )}
      </button>
    </div>
  );
}

export default function ProvablyFair({
  serverHash,
  serverSeed,
  clientSeed,
  verified,
  defaultOpen = false,
  className,
}: ProvablyFairProps) {
  const [open, setOpen] = useState(defaultOpen);

  const revealed = Boolean(serverSeed && clientSeed);

  // Self-verify only when the caller didn't hand us a result and we have the
  // material to check. We stamp the result with the seed/hash it was computed for
  // so a stale result reads as "not yet verified" (null) without a setState in the
  // effect body cascading renders.
  const needsSelfVerify = verified == null && Boolean(serverSeed && serverHash);
  const verifyKey = needsSelfVerify ? `${serverSeed}:${serverHash}` : null;
  const [selfVerified, setSelfVerified] = useState<{ key: string; ok: boolean } | null>(
    null,
  );
  useEffect(() => {
    if (!verifyKey || !serverSeed || !serverHash) return;
    let alive = true;
    verifyServerHash(serverSeed, serverHash).then((ok) => {
      if (alive) setSelfVerified({ key: verifyKey, ok });
    });
    return () => {
      alive = false;
    };
  }, [verifyKey, serverSeed, serverHash]);

  const isVerified =
    verified != null
      ? verified
      : selfVerified && selfVerified.key === verifyKey
        ? selfVerified.ok
        : null;

  // Always render (stable position): the trigger is present from the first frame and
  // its content just fills in — collapsed line → committed hash → revealed seeds.
  return (
    <div className={clsx('text-[11px]', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-muted/70 transition-colors hover:text-fg"
      >
        <ShieldCheck size={11} className="shrink-0" aria-hidden />
        <span>Честная игра</span>

        {/* Verified badge — only meaningful after reveal. */}
        {revealed && isVerified != null && (
          <span
            className={clsx(
              'inline-flex items-center',
              isVerified ? 'text-win' : 'text-lose',
            )}
            title={isVerified ? 'Проверено' : 'Не сходится'}
          >
            {isVerified ? <Check size={11} /> : <X size={11} />}
          </span>
        )}

        <ChevronDown
          size={10}
          className={clsx('shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-edge bg-panel p-2.5">
          {serverHash && (
            <SeedRow
              label={revealed ? 'Хеш сервера (коммит)' : 'Хеш сервера'}
              value={serverHash}
            />
          )}
          {revealed && serverSeed && <SeedRow label="Сид сервера" value={serverSeed} />}
          {revealed && clientSeed && <SeedRow label="Сид клиента" value={clientSeed} />}
          {!serverHash && !revealed && (
            <span className="text-muted">Хеш сервера зафиксируется в начале игры.</span>
          )}
        </div>
      )}
    </div>
  );
}
