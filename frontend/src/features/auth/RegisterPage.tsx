import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Copy } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthContext';
import { errorMessage } from '@/shared/api/errors';
import Card from '@/shared/ui/Card';
import Input from '@/shared/ui/Input';
import Button from '@/shared/ui/Button';

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

export default function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // refId comes from the invite link (?refId=). No param → no referrer is sent.
  const rawRefId = searchParams.get('refId');
  const parsedRefId = rawRefId != null ? Number.parseInt(rawRefId, 10) : NaN;
  const refId = Number.isFinite(parsedRefId) ? parsedRefId : undefined;

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Catch typos: the confirm field must match before we let the form submit.
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  // Set once registration succeeds — gates the one-time recovery-key step.
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setError(null);
    setPending(true);
    try {
      const key = await register({
        username: username.trim(),
        displayName: displayName.trim(),
        password,
        ...(refId != null ? { refId } : {}),
      });
      setRecoveryKey(key);
    } catch (err) {
      setError(errorMessage(err, 'Не удалось создать аккаунт'));
    } finally {
      setPending(false);
    }
  }

  async function handleCopy() {
    if (!recoveryKey) return;
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable — the key stays visible for manual copy.
    }
  }

  async function handleContinue() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      // Registration does not start a session — sign in to land on home.
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err, 'Не удалось войти. Попробуйте позже'));
      setPending(false);
    }
  }

  if (recoveryKey) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink px-4 py-10">
        <Card className="w-full max-w-sm p-6 sm:p-8">
          <BrandMark />

          <h2 className="text-center text-lg font-semibold text-fg">
            Сохраните ключ восстановления
          </h2>
          <p className="mt-2 text-center text-sm text-muted">
            Это единственный способ восстановить доступ, если вы забудете пароль.
          </p>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 p-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-xs leading-relaxed text-warn">
              Ключ показывается <b>только один раз</b>. Сохраните его в надёжном
              месте — повторно его увидеть нельзя.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-edge bg-panel-2 p-3">
            <code className="min-w-0 flex-1 break-all font-mono text-sm text-ice">
              {recoveryKey}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Скопировать ключ"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-edge bg-ink text-muted transition-colors hover:text-fg"
            >
              {copied ? (
                <Check size={16} className="text-win" />
              ) : (
                <Copy size={16} />
              )}
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-lose" role="alert">
              {error}
            </p>
          )}

          <Button
            type="button"
            size="lg"
            loading={pending}
            onClick={handleContinue}
            className="mt-5 w-full"
          >
            Я сохранил — продолжить
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-4 py-10">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <BrandMark />
        <p className="-mt-4 mb-6 text-center text-sm text-muted">Создайте аккаунт</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            minLength={4}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            required
            disabled={pending}
          />
          <Input
            label="Отображаемое имя"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Как вас называть"
            autoComplete="nickname"
            maxLength={40}
            required
            disabled={pending}
          />
          <Input
            label="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={8}
            maxLength={40}
            required
            disabled={pending}
          />
          <Input
            label="Повторите пароль"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            minLength={8}
            maxLength={40}
            required
            disabled={pending}
            error={passwordMismatch ? 'Пароли не совпадают' : undefined}
          />

          {refId != null && (
            <div className="rounded-xl border border-edge bg-panel-2 px-3 py-2.5 text-sm text-muted">
              Вы приглашены{' '}
              <span className="font-medium text-ton">(refId {refId})</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-lose" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            loading={pending}
            disabled={passwordMismatch}
            className="mt-1 w-full"
          >
            {pending ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-ton transition-colors hover:text-ice">
            Войти
          </Link>
        </p>
      </Card>
    </div>
  );
}
