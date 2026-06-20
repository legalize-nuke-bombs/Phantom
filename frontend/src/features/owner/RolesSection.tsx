// Roles & users — assign a role to any user, or delete a user. Both are gated on a
// resolved target picked via <UserLookup>.
//
//   POST   /api/owner/change-user-role { targetId, role, ownerKey? } → { message }
//   DELETE /api/owner/delete-user      { targetId, ownerKey? }       → 204
//
// OWNER KEY: a secret base64 key the operator pastes. The backend requires it
// (OWNER_KEY_REQUIRED) only when an OWNER-capable role is involved — assigning OR
// removing owner, or deleting an owner. We detect that case from the resolved
// target's current role + the chosen role and surface a contextual hint, but always
// send whatever key was typed and let the backend be the source of truth.

import { useState } from 'react';
import { Trash2, UserCog } from 'lucide-react';

import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import type { Role, User } from '@/shared/types';
import Button from '@/shared/ui/Button';
import Input from '@/shared/ui/Input';
import UserLookup from '@/shared/ui/UserLookup';
import { ASSIGNABLE_ROLES, ConfirmButton, ErrorLine, ROLE_LABELS, Section, SuccessLine } from './ownerUi';
import { OWNER_KEY_MAX, useChangeRole, useDeleteUser } from './useOwner';

function ChangeRoleCard() {
  const { user: me } = useAuth();
  const changeRole = useChangeRole();

  const [input, setInput] = useState('');
  const [target, setTarget] = useState<User | null>(null);
  const [role, setRole] = useState<Role>('USER');
  const [ownerKey, setOwnerKey] = useState('');

  const sameRole = target != null && target.role === role;

  // The owner key is ALWAYS an optional field; the backend decides if it's actually
  // required (only for actions touching «Владелец») and answers OWNER_KEY_REQUIRED if so.
  const canSubmit =
    target != null && !sameRole && ownerKey.length <= OWNER_KEY_MAX && !changeRole.isPending;

  function submit() {
    if (!canSubmit || target == null) return;
    changeRole.mutate(
      { targetId: target.id, role, ownerKey: ownerKey.trim() || undefined },
      {
        onSuccess: () => {
          setInput('');
          setTarget(null);
          setRole('USER');
          setOwnerKey('');
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <UserLookup
        value={input}
        onChange={setInput}
        onResolve={setTarget}
        excludeId={me?.id}
        excludeMessage="Нельзя изменить свою роль"
        label="Пользователь"
        placeholder="ID или @username"
        linkChip
        disabled={changeRole.isPending}
      />

      {/* role selector */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Новая роль</span>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-edge bg-panel p-1">
          {ASSIGNABLE_ROLES.map((r) => {
            const selected = r === role;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                disabled={changeRole.isPending}
                className={[
                  'rounded-lg px-2 py-2 text-xs font-medium transition-colors disabled:opacity-50',
                  selected ? 'bg-ton-deep text-white' : 'text-muted hover:bg-panel-2 hover:text-fg',
                ].join(' ')}
              >
                {ROLE_LABELS[r]}
              </button>
            );
          })}
        </div>
        {target != null && (
          <span className="text-xs text-muted">
            Текущая роль: {ROLE_LABELS[target.role]}
          </span>
        )}
        {sameRole && <span className="text-xs text-muted">Это уже текущая роль пользователя.</span>}
      </div>

      {/* Owner key — ALWAYS shown, always optional (no jumping). The backend requires it
          only for actions touching «Владелец» and answers OWNER_KEY_REQUIRED if missing. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">
          Ключ владельца <span className="text-muted/70">— только для роли «Владелец»</span>
        </span>
        <Input
          type="password"
          placeholder="Не требуется для обычных ролей"
          value={ownerKey}
          onChange={(e) => setOwnerKey(e.target.value)}
          maxLength={OWNER_KEY_MAX}
          autoComplete="off"
          spellCheck={false}
          disabled={changeRole.isPending}
        />
      </div>

      {changeRole.isError && (
        <ErrorLine message={errorMessage(changeRole.error, 'Не удалось изменить роль')} />
      )}
      {changeRole.isSuccess && <SuccessLine>Роль изменена</SuccessLine>}

      <Button
        type="button"
        onClick={submit}
        loading={changeRole.isPending}
        disabled={!canSubmit}
        className="self-start"
      >
        {!changeRole.isPending && <UserCog size={16} strokeWidth={2} />}
        Изменить роль
      </Button>
    </div>
  );
}

function DeleteUserCard() {
  const { user: me } = useAuth();
  const deleteUser = useDeleteUser();

  const [input, setInput] = useState('');
  const [target, setTarget] = useState<User | null>(null);
  const [ownerKey, setOwnerKey] = useState('');

  // The owner key is ALWAYS optional here too — required server-side only when the target
  // is an owner (→ OWNER_KEY_REQUIRED), surfaced as a plain error if missing.
  const canSubmit =
    target != null && ownerKey.length <= OWNER_KEY_MAX && !deleteUser.isPending;

  function submit() {
    if (!canSubmit || target == null) return;
    deleteUser.mutate(
      { targetId: target.id, ownerKey: ownerKey.trim() || undefined },
      {
        onSuccess: () => {
          setInput('');
          setTarget(null);
          setOwnerKey('');
        },
      },
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-4 border-t border-edge pt-5">
      <div className="flex items-center gap-2 text-lose">
        <Trash2 size={15} strokeWidth={2} />
        <h3 className="text-sm font-semibold">Удалить пользователя</h3>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Безвозвратно удаляет аккаунт и все связанные данные. Действие необратимо.
      </p>

      <UserLookup
        value={input}
        onChange={setInput}
        onResolve={setTarget}
        excludeId={me?.id}
        excludeMessage="Нельзя удалить себя"
        label="Пользователь"
        placeholder="ID или @username"
        linkChip
        disabled={deleteUser.isPending}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">
          Ключ владельца <span className="text-muted/70">— только для удаления владельца</span>
        </span>
        <Input
          type="password"
          placeholder="Не требуется для обычных аккаунтов"
          value={ownerKey}
          onChange={(e) => setOwnerKey(e.target.value)}
          maxLength={OWNER_KEY_MAX}
          autoComplete="off"
          spellCheck={false}
          disabled={deleteUser.isPending}
        />
      </div>

      {deleteUser.isError && (
        <ErrorLine message={errorMessage(deleteUser.error, 'Не удалось удалить пользователя')} />
      )}
      {deleteUser.isSuccess && <SuccessLine>Пользователь удалён</SuccessLine>}

      <ConfirmButton
        onConfirm={submit}
        idleLabel="Удалить пользователя"
        confirmLabel="Точно удалить? Необратимо"
        icon={<Trash2 size={16} strokeWidth={2} />}
        loading={deleteUser.isPending}
        disabled={!canSubmit}
        danger
        className="self-start"
      />
    </div>
  );
}

export default function RolesSection() {
  return (
    <Section
      icon={<UserCog size={16} strokeWidth={2} />}
      title="Роли и пользователи"
      description="Назначение ролей и удаление аккаунтов. Действия, затрагивающие роль «Владелец», требуют секретный ключ владельца."
    >
      <ChangeRoleCard />
      <DeleteUserCard />
    </Section>
  );
}
