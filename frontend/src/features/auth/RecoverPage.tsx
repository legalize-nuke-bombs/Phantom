import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import Card from '@/shared/ui/Card';
import Input from '@/shared/ui/Input';
import Button from '@/shared/ui/Button';
import { useCaptcha, CaptchaField } from '@/shared/auth/captcha';
import { AuthScreen } from '@/shared/auth/AuthScreen';

function BrandMark() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2 text-center">
      <span className="grid size-12 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl leading-none">
        💎
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Phantom</h1>
    </div>
  );
}

export default function RecoverPage() {
  const { recover } = useAuth();
  const navigate = useNavigate();

  const [recoveryKey, setRecoveryKey] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const cap = useCaptcha();

  // Mirror the backend: a recovery key plus at least one field to change.
  const hasKey = recoveryKey.trim().length > 0;
  const hasChange = newUsername.trim().length > 0 || newPassword.length > 0;
  // The confirm field only matters when a new password is actually being set.
  const passwordMismatch = newPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit = hasKey && hasChange && !passwordMismatch && cap.proof != null && !pending;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    if (!hasChange) {
      setError('Измените хотя бы одно поле — имя или пароль');
      return;
    }
    if (newPassword.length > 0 && newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setError(null);
    setPending(true);
    try {
      await recover(
        {
          recoveryKey: recoveryKey.trim(),
          ...(newUsername.trim() ? { newUsername: newUsername.trim() } : {}),
          ...(newPassword ? { newPassword } : {}),
        },
        cap.proof!,
      );
      // Recovery does not start a session — send the user to login.
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, 'Не удалось восстановить доступ'));
      setPending(false);
      void cap.reload();
    }
  }

  if (done) {
    return (
      <AuthScreen>
        <Card className="w-full max-w-sm p-6 text-center sm:p-8">
          <span className="mx-auto grid size-12 place-items-center rounded-xl border border-win/40 bg-win/10 text-win">
            <CheckCircle2 size={26} />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-fg">Доступ восстановлен</h1>
          <p className="mt-2 text-sm text-muted">
            Войдите с новыми данными, чтобы продолжить.
          </p>
          <Button
            type="button"
            size="lg"
            onClick={() => navigate('/login')}
            className="mt-6 w-full"
          >
            Перейти ко входу
          </Button>
        </Card>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <BrandMark />
        <p className="-mt-4 mb-2 text-center text-sm text-muted">
          Восстановление доступа
        </p>
        <p className="mb-6 text-center text-xs text-muted">
          Введите ключ восстановления и задайте новое имя пользователя и/или
          пароль.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Ключ восстановления"
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            placeholder="Ваш ключ восстановления"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            disabled={pending}
          />
          <Input
            label="Новое имя пользователя"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Необязательно"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            minLength={4}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            disabled={pending}
          />
          <Input
            label="Новый пароль"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Необязательно"
            autoComplete="new-password"
            minLength={8}
            maxLength={40}
            disabled={pending}
          />
          <Input
            label="Повторите пароль"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Повторите новый пароль"
            autoComplete="new-password"
            maxLength={40}
            disabled={pending}
            error={passwordMismatch ? 'Пароли не совпадают' : undefined}
          />

          <CaptchaField
            challenge={cap.challenge}
            answer={cap.answer}
            onAnswer={cap.setAnswer}
            onReload={cap.reload}
            disabled={pending}
          />

          {error && (
            <p className="text-sm text-lose" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            loading={pending}
            disabled={!canSubmit}
            className="mt-1 w-full"
          >
            Восстановить доступ
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Вспомнили пароль?{' '}
          <Link to="/login" className="text-ton transition-colors hover:text-ice">
            Войти
          </Link>
        </p>
      </Card>
    </AuthScreen>
  );
}
