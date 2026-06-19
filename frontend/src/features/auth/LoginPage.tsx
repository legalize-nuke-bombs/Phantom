import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ghost } from 'lucide-react';
import { useAuth } from '@/shared/auth/AuthContext';
import { ApiError } from '@/shared/api/client';
import Card from '@/shared/ui/Card';
import Input from '@/shared/ui/Input';
import Button from '@/shared/ui/Button';

function Wordmark() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-xl bg-panel-2 border border-edge text-ice">
        <Ghost size={28} strokeWidth={1.75} />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Phantom</h1>
        <p className="mt-1 text-sm text-muted">Войдите в свой аккаунт</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !pending;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setPending(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? 'Неверный логин или пароль'
          : err instanceof ApiError
            ? err.message
            : 'Не удалось войти. Попробуйте ещё раз';
      setError(message);
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Wordmark />

        <Card className="mt-8 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <Input
              label="Имя пользователя"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={pending}
            />

            <Input
              label="Пароль"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
            />

            {error && (
              <p role="alert" className="text-sm text-lose">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={pending} disabled={!canSubmit} className="w-full">
              Войти
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-muted">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-ton transition-colors hover:text-ice">
            Регистрация
          </Link>
        </p>
      </div>
    </main>
  );
}
