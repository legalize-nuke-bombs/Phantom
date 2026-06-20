// The rank ladder — documents every level (RankBadge · name · XP threshold · the
// features it unlocks) AND shows the signed-in user where they stand: ranks already
// reached are "unlocked", higher ones are 🔒 locked with the rank that opens them.
//
// This doubles as a live demo of the feature-lock system: the unlocked/locked split
// is derived from the user's XP against the level thresholds (the same source the
// gates use), so it always matches what actions are actually available.

import { useMemo } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import clsx from 'clsx';

import { useAuth } from '@/shared/auth/AuthContext';
import { useMyExperience } from '@/shared/lib/experience';
import { FEATURE_LABELS, useLevels } from '@/shared/lib/levelFeatures';
import type { LevelFeature } from '@/shared/lib/levelFeatures';
import type { Level } from '@/shared/types';
import Card from '@/shared/ui/Card';
import RankBadge from '@/shared/ui/RankBadge';
import Spinner from '@/shared/ui/Spinner';

function formatXp(n: number): string {
  return n.toLocaleString('ru-RU');
}

/** Keep only the features this frontend knows a label for, in canonical order. */
function knownFeatures(features: ReadonlyArray<string>): LevelFeature[] {
  return (Object.keys(FEATURE_LABELS) as LevelFeature[]).filter((f) =>
    features.includes(f),
  );
}

/* ── one rung of the ladder ───────────────────────────────────────────────── */
function LevelRow({
  level,
  reached,
  current,
}: {
  /** The level to render. */
  level: Level;
  /** Has the user's XP reached this level's threshold? */
  reached: boolean;
  /** Is this the user's current (highest reached) rank? */
  current: boolean;
}) {
  const features = knownFeatures(level.features);

  return (
    <Card
      className={clsx(
        'flex gap-3.5 p-4 transition-colors',
        current
          ? 'border-ton/50 bg-panel-2 ring-1 ring-ton/30'
          : reached
            ? 'border-edge'
            : 'border-edge opacity-65',
      )}
    >
      <RankBadge
        level={level.name}
        size={44}
        className={clsx('shrink-0', !reached && 'grayscale')}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-2 truncate text-base font-semibold text-fg">
            {level.name}
            {current ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-ton-deep/20 px-2 py-0.5 text-[11px] font-medium text-ice">
                <Sparkles size={11} strokeWidth={2.5} />
                Ваш ранг
              </span>
            ) : null}
          </span>
          <span className="shrink-0 font-mono text-sm tabular-nums text-muted">
            {formatXp(level.amount)} XP
          </span>
        </div>

        {/* Features this rank unlocks. Locked rows get a 🔒 + the opening rank. */}
        {features.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {features.map((feature) => (
              <li
                key={feature}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs',
                  reached
                    ? 'border-win/30 bg-win/10 text-win'
                    : 'border-edge bg-panel-2 text-muted',
                )}
              >
                {reached ? (
                  <Sparkles size={12} strokeWidth={2.5} className="shrink-0" />
                ) : (
                  <Lock size={12} strokeWidth={2.5} className="shrink-0" />
                )}
                {FEATURE_LABELS[feature]}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */
export default function LevelsPage() {
  const { user } = useAuth();
  const { data: levels = [], isLoading, isError } = useLevels();
  const { data: experience } = useMyExperience(user?.id);

  // Ladder low → high. The user's current rank is the highest level whose threshold
  // their XP has reached (index into the sorted ladder); -1 while XP is unknown.
  const { ordered, currentIndex } = useMemo(() => {
    const sorted = [...levels].sort((a, b) => a.amount - b.amount);
    const xp = experience?.amount ?? -1;
    let idx = -1;
    sorted.forEach((lvl, i) => {
      if (xp >= lvl.amount) idx = i;
    });
    return { ordered: sorted, currentIndex: idx };
  }, [levels, experience?.amount]);

  // useLevels seeds from cache and always resolves to an array, so a spinner only
  // shows on a true cold start (no cache yet); an empty result after load is "—".
  if (isLoading && ordered.length === 0) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (ordered.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted">
        {isError ? 'Не удалось загрузить уровни' : 'Уровни недоступны'}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Зарабатывайте опыт в играх, чтобы повышать ранг и открывать новые
        возможности.
      </p>

      {ordered.map((level, i) => (
        <LevelRow
          key={level.name}
          level={level}
          reached={currentIndex >= i}
          current={currentIndex === i}
        />
      ))}
    </div>
  );
}
