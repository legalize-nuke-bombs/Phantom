import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '@/shared/api/client';
import Input from '@/shared/ui/Input';

export interface CaptchaChallenge {
  id: string;
  image: string;
}

export interface CaptchaProof {
  id: string;
  answer: string;
}

export const CAPTCHA_ANSWER_MAX = 16;

function fetchCaptcha(): Promise<CaptchaChallenge> {
  return api.get<CaptchaChallenge>('/captcha/challenge');
}

/**
 * Holds a captcha challenge + the user's answer. Fetches a fresh one on mount, exposes
 * `reload` to swap in a new one (each challenge is single-use on the backend, so a failed
 * auth attempt must reload before retrying), and `proof` — null until there's an answer.
 */
export function useCaptcha() {
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [answer, setAnswer] = useState('');

  const reload = useCallback(async () => {
    setAnswer('');
    setChallenge(null);
    try {
      setChallenge(await fetchCaptcha());
    } catch {
      setChallenge(null);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const proof: CaptchaProof | null =
    challenge && answer.trim() ? { id: challenge.id, answer: answer.trim() } : null;

  return { challenge, answer, setAnswer, reload, proof };
}

export function CaptchaField({
  challenge,
  answer,
  onAnswer,
  onReload,
  disabled,
}: {
  challenge: CaptchaChallenge | null;
  answer: string;
  onAnswer: (value: string) => void;
  onReload: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-muted">Введите код с картинки</span>
      <div className="flex items-center gap-2">
        <div className="grid h-[68px] flex-1 place-items-center overflow-hidden rounded-xl border border-edge bg-panel-2">
          {challenge ? (
            <img src={challenge.image} alt="Проверочный код" className="h-full w-full object-contain" />
          ) : (
            <span className="text-xs text-muted">Загрузка…</span>
          )}
        </div>
        <button
          type="button"
          onClick={onReload}
          disabled={disabled}
          aria-label="Обновить код"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-edge bg-panel-2 text-muted transition-colors hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton disabled:opacity-50"
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <Input
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder="Код с картинки"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={CAPTCHA_ANSWER_MAX}
        disabled={disabled}
      />
    </div>
  );
}
