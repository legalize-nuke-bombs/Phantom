// UserLookup — a player picker. Type an ID or an @username and get a live preview
// chip of the resolved user. Pure digits → GET /users/by-id/{id}; anything else →
// GET /users/by-username/{username}. The resolved user (or null) is reported via
// onResolve so the parent can enable an action (send a gift) or navigate (search).
//
// Extracted from the wallet's gift-receiver field and reused for player search.

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useMyExperience } from '@/shared/lib/experience';
import type { LevelName, User } from '@/shared/types';
import Input, { SUPPRESS_AUTOFILL } from '@/shared/ui/Input';
import Spinner from '@/shared/ui/Spinner';
import UserChip from '@/shared/ui/UserChip';

export interface UserLookupProps {
  /** Controlled raw input (the parent stores exactly what was typed). */
  value: string;
  onChange: (value: string) => void;
  /**
   * Called with the resolved user, or null while empty / loading / not-found /
   * excluded. The parent gates its action on this (e.g. enable "send", navigate).
   */
  onResolve?: (user: User | null) => void;
  /** Exclude this id (e.g. yourself) — surfaced as an inline note, resolves to null. */
  excludeId?: number;
  excludeMessage?: string;
  notFoundMessage?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Make the preview chip a link to the player's profile (default false). */
  linkChip?: boolean;
}

const USERNAME_MIN = 3;
/** A pure-digits entry is treated as a numeric user id; everything else a username. */
const looksLikeId = (s: string): boolean => /^\d+$/.test(s);

export default function UserLookup({
  value,
  onChange,
  onResolve,
  excludeId,
  excludeMessage = 'Это вы',
  notFoundMessage = 'Игрок не найден',
  label,
  placeholder = 'ID или @username',
  disabled,
  linkChip = false,
}: UserLookupProps) {
  // Allow a leading @ on usernames; normalise it away before deciding id vs username.
  const raw = value.trim().replace(/^@+/, '');
  const mode: 'id' | 'username' = looksLikeId(raw) ? 'id' : 'username';
  const enabled =
    raw.length > 0 && (mode === 'id' ? Number(raw) > 0 : raw.length >= USERNAME_MIN);

  const query = useQuery<User>({
    queryKey: ['user-lookup', mode, raw],
    enabled,
    retry: false, // a not-found is an expected answer, not something to hammer
    queryFn: () =>
      api.get<User>(
        mode === 'id'
          ? `/users/by-id/${raw}`
          : `/users/by-username/${encodeURIComponent(raw)}`,
      ),
  });

  const found = enabled ? query.data ?? null : null;
  const excluded = found != null && excludeId != null && found.id === excludeId;
  const resolved = excluded ? null : found;

  const exp = useMyExperience(resolved?.id);
  const level: LevelName | null = exp.data?.level ?? null;

  // Report the resolved user up. The callback is held in a ref and the effect keys
  // ONLY on the resolved value, so an unstable inline onResolve from the parent
  // can't retrigger every render and spin into an update loop.
  const onResolveRef = useRef(onResolve);
  useEffect(() => {
    onResolveRef.current = onResolve;
  });
  useEffect(() => {
    onResolveRef.current?.(resolved);
  }, [resolved, excluded]);

  return (
    <div>
      <Input
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        // "@username" placeholder makes password managers offer a login — opt them out.
        autoComplete="off"
        {...SUPPRESS_AUTOFILL}
        spellCheck={false}
      />
      {enabled && (
        <div className="mt-2">
          {query.isLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Spinner size={14} />
              Ищем игрока…
            </p>
          ) : excluded ? (
            <p className="text-xs text-lose">{excludeMessage}</p>
          ) : query.isError ? (
            <p className="text-xs text-lose">{errorMessage(query.error, notFoundMessage)}</p>
          ) : resolved ? (
            <div className="flex items-center gap-2 rounded-lg border border-edge bg-panel-2 px-2.5 py-2">
              <UserChip user={resolved} level={level} size={24} link={linkChip} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
