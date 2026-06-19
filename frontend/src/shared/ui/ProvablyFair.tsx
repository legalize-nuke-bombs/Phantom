// ProvablyFair — the collapsible "Честная игра" panel every game shows.
//
// Two phases, driven purely by what you pass:
//   • Before reveal — pass just `serverHash`: the panel shows the server's
//     commitment so the user can see it was fixed before they played.
//   • After reveal — also pass `serverSeed` + `clientSeed`: the panel reveals both
//     seeds and a verified ✓/✗ badge proving SHA-256(serverSeed) === serverHash.
//
// Verification: pass `verified` if you already have it (useGameRound exposes it) to
// avoid recomputing; otherwise, when both serverSeed and serverHash are present, the
// panel verifies itself via verifyServerHash. This keeps it reusable in a live round
// AND in a static history view.

import { useEffect, useState } from 'react';
import { ShieldCheck, ChevronDown, Check, X, Copy } from 'lucide-react';
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

/** One labelled, monospace, copyable hex row. */
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
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <button
        type="button"
        onClick={copy}
        title="Скопировать"
        className={clsx(
          'group flex items-start gap-2 rounded-lg px-2.5 py-2 text-left',
          'bg-ink border border-edge transition-colors hover:border-ton/60',
        )}
      >
        <code className="min-w-0 flex-1 break-all font-mono text-xs text-fg/90">
          {value}
        </code>
        {copied ? (
          <Check size={14} className="mt-0.5 shrink-0 text-win" aria-hidden />
        ) : (
          <Copy
            size={14}
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
  // material to check (revealed serverSeed + committed serverHash). We stamp the
  // result with the exact seed/hash it was computed for, so a stale result from a
  // previous round reads as "not yet verified" (null) without a synchronous
  // setState in the effect body (which would cascade renders).
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

  if (!serverHash && !revealed) return null;

  return (
    <div className={clsx('rounded-xl border border-edge bg-panel', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <ShieldCheck size={16} className="shrink-0 text-ton" aria-hidden />
        <span className="text-sm font-medium text-fg">Честная игра</span>

        {/* Verified badge — only meaningful after reveal. */}
        {revealed && isVerified != null && (
          <span
            className={clsx(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              isVerified
                ? 'bg-win/10 text-win'
                : 'bg-lose/10 text-lose',
            )}
          >
            {isVerified ? <Check size={12} /> : <X size={12} />}
            {isVerified ? 'Проверено' : 'Не сходится'}
          </span>
        )}

        <ChevronDown
          size={16}
          className={clsx(
            'ml-auto shrink-0 text-muted transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-edge px-3 py-3">
          {serverHash && (
            <SeedRow
              label={revealed ? 'Хеш сервера (коммит)' : 'Хеш сервера'}
              value={serverHash}
            />
          )}
          {revealed && serverSeed && (
            <SeedRow label="Сид сервера" value={serverSeed} />
          )}
          {revealed && clientSeed && (
            <SeedRow label="Сид клиента" value={clientSeed} />
          )}

          <p className="text-xs leading-relaxed text-muted">
            {revealed
              ? 'SHA-256 от сида сервера совпадает с хешем, показанным до игры, — результат был зафиксирован заранее.'
              : 'Хеш сервера зафиксирован до вашей ставки. После игры откроется сид — проверьте, что его SHA-256 равен этому хешу.'}
          </p>
        </div>
      )}
    </div>
  );
}
