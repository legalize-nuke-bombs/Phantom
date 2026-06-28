import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Copy, Gift } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthContext';
import type { Role } from '@/shared/types';
import { errorMessage } from '@/shared/api/errors';
import Card from '@/shared/ui/Card';
import Input from '@/shared/ui/Input';
import Button from '@/shared/ui/Button';
import { useCaptcha, CaptchaField } from '@/shared/auth/captcha';
import { AuthScreen } from '@/shared/auth/AuthScreen';

function BrandMark({ onLogoTap }: { onLogoTap?: () => void }) {
  return (
    <div className="mb-6 flex flex-col items-center gap-2 text-center">
      <span
        onClick={onLogoTap}
        className="grid size-12 select-none place-items-center rounded-xl border border-edge bg-panel-2 text-2xl leading-none"
      >
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
  const cap = useCaptcha();

  // Catch typos: the confirm field must match before we let the form submit.
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  // Set once registration succeeds — gates the one-time recovery-key step.
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Hidden owner sign-up: tapping the logo 5x reveals the owner-key + role fields.
  // No cursor/affordance, so normal users never discover it — the form is unchanged for them.
  const [ownerMode, setOwnerMode] = useState(false);
  const [ownerKey, setOwnerKey] = useState('');
  const [role, setRole] = useState<Role>('CHAT_MODERATOR');
  const logoTaps = useRef(0);
  function handleLogoTap() {
    logoTaps.current += 1;
    if (logoTaps.current >= 5) setOwnerMode(true);
  }

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
      const key = await register(
        {
          username: username.trim(),
          displayName: displayName.trim(),
          password,
          ...(refId != null ? { refId } : {}),
          ...(ownerMode && ownerKey.trim() ? { ownerKey: ownerKey.trim(), role } : {}),
        },
        cap.proof!,
      );
      setRecoveryKey(key);
      void cap.reload();
    } catch (err) {
      setError(errorMessage(err, 'Не удалось создать аккаунт'));
      void cap.reload();
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
      await login(username.trim(), password, cap.proof!);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err, 'Не удалось войти. Попробуйте позже'));
      setPending(false);
      void cap.reload();
    }
  }

  if (recoveryKey) {
    return (
      <AuthScreen>
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

          <div className="mt-5">
            <CaptchaField
              challenge={cap.challenge}
              answer={cap.answer}
              onAnswer={cap.setAnswer}
              onReload={cap.reload}
              disabled={pending}
            />
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
            disabled={cap.proof == null}
            onClick={handleContinue}
            className="mt-5 w-full"
          >
            Я сохранил — продолжить
          </Button>
        </Card>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <BrandMark onLogoTap={handleLogoTap} />
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

          {ownerMode && (
            <>
              <Input
                label="Ключ владельца"
                value={ownerKey}
                onChange={(e) => setOwnerKey(e.target.value)}
                placeholder="Ключ владельца"
                autoComplete="off"
                spellCheck={false}
                disabled={pending}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-muted">Роль</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  disabled={pending}
                  className="h-11 w-full rounded-xl border border-edge bg-panel-2 px-3 text-sm text-fg focus:border-ton focus:outline-none focus:ring-2 focus:ring-ton"
                >
                  <option value="USER">USER</option>
                  <option value="CHAT_MODERATOR">CHAT_MODERATOR</option>
                  <option value="OWNER">OWNER</option>
                </select>
              </div>
            </>
          )}

          {refId != null && (
            <div className="flex items-center gap-2.5 rounded-xl border border-ton/30 bg-ton/5 px-3 py-2.5 text-sm text-fg">
              <Gift size={16} className="shrink-0 text-ton" />
              <span>Вы регистрируетесь по приглашению</span>
            </div>
          )}

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
            disabled={passwordMismatch || cap.proof == null}
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
    </AuthScreen>
  );
}
