import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ghost } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/client';
import Card from '@/shared/ui/Card';
import Input from '@/shared/ui/Input';
import Button from '@/shared/ui/Button';

const DEFAULT_REF_ID = 1;

export default function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [refCode, setRefCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    setError(null);
    setPending(true);
    try {
      const parsedRef = Number.parseInt(refCode.trim(), 10);
      const refId = Number.isFinite(parsedRef) ? parsedRef : DEFAULT_REF_ID;

      await register({
        username: username.trim(),
        displayName: displayName.trim(),
        password,
        refId,
      });
      // Registration does not set a session cookie — sign in to land on home.
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Не удалось создать аккаунт';
      setError(message);
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-4 py-10">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-panel-2 text-ton">
            <Ghost size={26} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Phantom</h1>
          <p className="text-sm text-muted">Создайте аккаунт</p>
        </div>

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
            label="Реферальный код"
            value={refCode}
            onChange={(e) => setRefCode(e.target.value)}
            placeholder="Необязательно"
            inputMode="numeric"
            disabled={pending}
          />

          {error && (
            <p className="text-sm text-lose" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
            {pending ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-ton hover:text-ice transition-colors">
            Войти
          </Link>
        </p>
      </Card>
    </div>
  );
}
