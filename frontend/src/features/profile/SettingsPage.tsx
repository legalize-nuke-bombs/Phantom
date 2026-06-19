// Own-profile settings (route: /profile/settings). Lifted out of ProfileView so
// the profile itself stays compact on mobile. Everything here is for the SIGNED-IN
// user only — account edits, security, recovery key, deletion, and logout.
//
// Each block is a collapsible accordion so the page stays short and scannable on a
// phone. Account mutations invalidate ['users','me'] (and the user's experience) so
// the rest of the app picks up the change.

import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Settings,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react';
import clsx from 'clsx';

import { api } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthContext';
import type { PrivacySetting, User } from '@/shared/types';
import Button from '@/shared/ui/Button';
import Input from '@/shared/ui/Input';
import Spinner from '@/shared/ui/Spinner';
import Switch from '@/shared/ui/Switch';

/* ── constraints (mirrored from the backend for inline hints) ───────────── */
const USERNAME_MIN = 4;
const USERNAME_MAX = 20;
const DISPLAY_NAME_MIN = 1;
const DISPLAY_NAME_MAX = 40;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 40;
const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

const PRIVACY_FIELDS: ReadonlyArray<{
  key:
    | 'gameHistoryPrivacySetting'
    | 'gameStatsPrivacySetting'
    | 'experiencePrivacySetting'
    | 'lotteryPrivacySetting';
  label: string;
}> = [
  { key: 'gameHistoryPrivacySetting', label: 'История игр' },
  { key: 'gameStatsPrivacySetting', label: 'Статистика игр' },
  { key: 'experiencePrivacySetting', label: 'Опыт и ранг' },
  { key: 'lotteryPrivacySetting', label: 'Участие в лотерее' },
];

/* ── small shared bits ─────────────────────────────────────────────────── */
function FieldError({ message }: { message: string }) {
  return <p className="text-sm text-lose">{message}</p>;
}

function FieldSuccess({ message }: { message: string }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-sm text-win">
      <Check size={14} strokeWidth={2.5} />
      {message}
    </p>
  );
}

/** Collapsible settings block — keeps the page short on mobile. */
function Accordion({
  icon,
  title,
  danger,
  children,
}: {
  icon: ReactNode;
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-panel border border-edge rounded-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={clsx(
          'flex w-full items-center gap-2.5 rounded-xl px-5 py-4 text-left transition-colors hover:bg-panel-2',
          danger ? 'text-lose' : 'text-fg',
        )}
      >
        <span className={danger ? 'text-lose' : 'text-muted'}>{icon}</span>
        <span className="flex-1 text-sm font-medium">{title}</span>
        <ChevronDown
          size={18}
          className={clsx('shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="border-t border-edge px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={copy}
      aria-label="Скопировать"
      className={clsx('shrink-0 px-3', className)}
    >
      {copied ? <Check size={16} className="text-win" /> : <Copy size={16} />}
      <span className="hidden sm:inline">{copied ? 'Скопировано' : 'Копировать'}</span>
    </Button>
  );
}

/** Password input with a show/hide toggle, built on the shared Input. */
function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        label={label}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
        className="absolute bottom-0 right-0 grid h-11 w-11 place-items-center text-muted hover:text-fg"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/** Aligned label-left / switch-right row used for each privacy toggle. */
function ToggleRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex h-12 items-center justify-between gap-3 rounded-xl bg-panel-2 border border-edge px-3.5">
      <span className="min-w-0 truncate text-sm text-fg">{label}</span>
      <div className="flex shrink-0 items-center gap-2.5">
        <span
          className={clsx('w-20 text-right text-xs tabular-nums', checked ? 'text-ton' : 'text-muted')}
        >
          {checked ? 'Все' : 'Только я'}
        </span>
        <Switch
          checked={checked}
          onChange={onToggle}
          aria-label={`${label}: ${checked ? 'все' : 'только я'}`}
        />
      </div>
    </div>
  );
}

/* ── settings: profile (display name + privacy) ────────────────────────── */
function ProfileSettingsForm({ user }: { user: User }) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [privacy, setPrivacy] = useState<Record<string, PrivacySetting>>({
    gameHistoryPrivacySetting: user.gameHistoryPrivacySetting,
    gameStatsPrivacySetting: user.gameStatsPrivacySetting,
    experiencePrivacySetting: user.experiencePrivacySetting,
    lotteryPrivacySetting: user.lotteryPrivacySetting,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.patch<{ message: string }>('/users/me', {
        displayName: displayName.trim(),
        ...privacy,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'me'] });
      qc.invalidateQueries({ queryKey: ['experience', user.id] });
    },
  });

  const trimmed = displayName.trim();
  const nameInvalid = trimmed.length < DISPLAY_NAME_MIN || trimmed.length > DISPLAY_NAME_MAX;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (nameInvalid || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Input
        label="Отображаемое имя"
        value={displayName}
        onChange={(e) => {
          setDisplayName(e.target.value);
          mutation.reset();
        }}
        maxLength={DISPLAY_NAME_MAX}
        autoComplete="nickname"
        error={
          nameInvalid && trimmed.length === 0
            ? 'Имя не может быть пустым'
            : nameInvalid
              ? `Не длиннее ${DISPLAY_NAME_MAX} символов`
              : undefined
        }
      />

      <div className="flex flex-col gap-2.5">
        <span className="text-sm text-muted">Кто видит мой профиль</span>
        {PRIVACY_FIELDS.map(({ key, label }) => (
          <ToggleRow
            key={key}
            label={label}
            checked={privacy[key] === 'EVERYONE'}
            onToggle={() => {
              setPrivacy((p) => ({
                ...p,
                [key]: p[key] === 'EVERYONE' ? 'ONLY_YOU' : 'EVERYONE',
              }));
              mutation.reset();
            }}
          />
        ))}
      </div>

      {mutation.isError && <FieldError message={errorMessage(mutation.error, 'Не удалось сохранить')} />}
      {mutation.isSuccess && <FieldSuccess message="Профиль сохранён" />}

      <Button type="submit" loading={mutation.isPending} disabled={nameInvalid} className="self-start">
        Сохранить
      </Button>
    </form>
  );
}

/* ── settings: security (current password FIRST, then username / password) ─ */
function SecuritySettingsForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const body: { currentPassword: string; username?: string; password?: string } = {
        currentPassword,
      };
      if (username.trim()) body.username = username.trim();
      if (password) body.password = password;
      return api.patch<{ message: string }>('/users/me/secure', body);
    },
    onSuccess: () => {
      setCurrentPassword('');
      setUsername('');
      setPassword('');
    },
  });

  const u = username.trim();
  const usernameInvalid =
    u.length > 0 && (u.length < USERNAME_MIN || u.length > USERNAME_MAX || !USERNAME_RE.test(u));
  const passwordTooShort = password.length > 0 && password.length < PASSWORD_MIN;
  const nothingToChange = u.length === 0 && password.length === 0;
  const blocked =
    !currentPassword || nothingToChange || usernameInvalid || passwordTooShort || mutation.isPending;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (blocked) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Подтвердите текущим паролем, затем измените имя пользователя и/или пароль.
      </p>

      <PasswordInput
        label="Текущий пароль"
        value={currentPassword}
        onChange={(v) => {
          setCurrentPassword(v);
          mutation.reset();
        }}
        autoComplete="current-password"
      />

      <div className="flex flex-col gap-4 border-t border-edge pt-4">
        <Input
          label="Новое имя пользователя"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            mutation.reset();
          }}
          autoComplete="username"
          placeholder="необязательно"
          maxLength={USERNAME_MAX}
          error={usernameInvalid ? `${USERNAME_MIN}–${USERNAME_MAX}, латиница, цифры, _` : undefined}
        />

        <div>
          <PasswordInput
            label="Новый пароль"
            value={password}
            onChange={(v) => {
              setPassword(v);
              mutation.reset();
            }}
            autoComplete="new-password"
            placeholder="необязательно"
          />
          {passwordTooShort ? (
            <p className="mt-1.5 text-xs text-lose">Минимум {PASSWORD_MIN} символов</p>
          ) : password.length > 0 ? (
            <p className="mt-1.5 text-xs text-muted">
              {PASSWORD_MIN}–{PASSWORD_MAX} символов: заглавная, строчная и цифра
            </p>
          ) : null}
        </div>
      </div>

      {mutation.isError && (
        <FieldError message={errorMessage(mutation.error, 'Не удалось обновить данные')} />
      )}
      {mutation.isSuccess && <FieldSuccess message="Данные обновлены" />}

      <Button type="submit" loading={mutation.isPending} disabled={blocked} className="self-start">
        Обновить
      </Button>
    </form>
  );
}

/* ── settings: new recovery key ────────────────────────────────────────── */
function RecoveryKeyForm() {
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post<{ recoveryKey: string }>('/users/me/new-recovery-key', { password }),
    onSuccess: () => setPassword(''),
  });

  const key = mutation.data?.recoveryKey;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || mutation.isPending) return;
    mutation.mutate();
  }

  if (key) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-xl bg-warn/10 border border-warn/40 px-3 py-2.5 text-warn">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" strokeWidth={2} />
          <p className="text-xs leading-relaxed">
            Сохраните ключ — он показывается <span className="font-semibold">один раз</span>. Старый
            ключ восстановления больше не действует.
          </p>
        </div>
        <div className="flex items-stretch gap-2">
          <code className="min-w-0 flex-1 break-all rounded-xl bg-panel-2 border border-edge px-3 py-2.5 font-mono text-sm text-fg">
            {key}
          </code>
          <CopyButton value={key} />
        </div>
        <Button type="button" variant="ghost" onClick={() => mutation.reset()} className="self-start">
          Готово
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Сгенерируйте новый ключ восстановления. Подтвердите паролем — прежний ключ перестанет
        работать.
      </p>
      <PasswordInput
        label="Текущий пароль"
        value={password}
        onChange={(v) => {
          setPassword(v);
          mutation.reset();
        }}
        autoComplete="current-password"
      />
      {mutation.isError && <FieldError message={errorMessage(mutation.error, 'Не удалось создать ключ')} />}
      <Button type="submit" loading={mutation.isPending} disabled={!password} className="self-start">
        Сгенерировать ключ
      </Button>
    </form>
  );
}

/* ── settings: delete account (password shown inline) ──────────────────── */
function DeleteAccountForm() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.del<void>('/users/me', { password }),
    onSuccess: async () => {
      await logout();
      navigate('/login');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-xl bg-lose/10 border border-lose/40 px-3 py-2.5 text-lose">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" strokeWidth={2} />
        <p className="text-xs leading-relaxed">
          Аккаунт и весь прогресс будут удалены безвозвратно. Подтвердите паролем — восстановить
          аккаунт после этого будет невозможно.
        </p>
      </div>
      <PasswordInput
        label="Пароль для подтверждения"
        value={password}
        onChange={(v) => {
          setPassword(v);
          mutation.reset();
        }}
        autoComplete="current-password"
      />
      {mutation.isError && (
        <FieldError message={errorMessage(mutation.error, 'Не удалось удалить аккаунт')} />
      )}
      <Button
        type="submit"
        loading={mutation.isPending}
        disabled={!password}
        className="self-start bg-lose text-white hover:bg-lose/90 active:bg-lose"
      >
        <Trash2 size={16} strokeWidth={2} />
        Удалить навсегда
      </Button>
    </form>
  );
}

/* ── logout ────────────────────────────────────────────────────────────── */
function LogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  }

  return (
    <Button
      variant="ghost"
      size="lg"
      onClick={handleLogout}
      loading={loggingOut}
      className="w-full text-lose hover:bg-lose/10 hover:border-lose/50"
    >
      <LogOut size={18} strokeWidth={2} />
      Выйти из аккаунта
    </Button>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const { user, loading } = useAuth();

  if (loading && !user) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div>
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          Профиль
        </Link>
        <div className="mt-3 flex items-center gap-2 text-fg">
          <Settings size={20} strokeWidth={2} />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Настройки</h1>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Accordion icon={<UserCog size={18} strokeWidth={2} />} title="Профиль">
          <ProfileSettingsForm user={user} />
        </Accordion>

        <Accordion icon={<ShieldCheck size={18} strokeWidth={2} />} title="Безопасность">
          <SecuritySettingsForm />
        </Accordion>

        <Accordion icon={<KeyRound size={18} strokeWidth={2} />} title="Ключ восстановления">
          <RecoveryKeyForm />
        </Accordion>

        <Accordion icon={<Trash2 size={18} strokeWidth={2} />} title="Удаление аккаунта" danger>
          <DeleteAccountForm />
        </Accordion>
      </div>

      <LogoutButton />
    </div>
  );
}
