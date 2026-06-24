// Master wallet — the collection wallet every user's deposits are swept into.
//
//   GET  /api/owner/master-wallets/{coin} → { address, balance }   (MASTER_WALLET_NOT_SET → not configured)
//   POST /api/owner/master-wallets/{coin} { mnemonic }             → derives & stores the wallet
//
// Setting it replaces where ALL swept funds land. The action fires directly (it is
// reversible — set another wallet to change it back) with loading + success/error
// states; the mnemonic field is masked and never persists in state longer than
// needed (cleared on success). A "refresh balance" button re-fetches the GET so the
// operator never has to F5 (a reload needlessly retriggers the whole websocket sync).

import { useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, RefreshCw, Wallet } from 'lucide-react';
import clsx from 'clsx';

import { errorMessage } from '@/shared/api/errors';
import { coinName } from '@/shared/lib/coin';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Input, { SUPPRESS_AUTOFILL } from '@/shared/ui/Input';
import Spinner from '@/shared/ui/Spinner';
import { useCopy } from './useCopy';
import { ErrorLine, Section, SuccessLine } from './ownerUi';
import { MNEMONIC_MAX, OWNER_COIN, useMasterWallet, useSetMasterWallet } from './useOwner';

export default function MasterWalletSection() {
  const current = useMasterWallet(OWNER_COIN);
  const setWallet = useSetMasterWallet(OWNER_COIN);
  const { copied, copy } = useCopy();

  const [mnemonic, setMnemonic] = useState('');
  const [reveal, setReveal] = useState(false);

  const trimmed = mnemonic.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MNEMONIC_MAX && !setWallet.isPending;

  function submit() {
    if (!canSubmit) return;
    setWallet.mutate(
      { mnemonic: trimmed },
      {
        onSuccess: () => {
          setMnemonic('');
          setReveal(false);
        },
      },
    );
  }

  return (
    <Section
      icon={<Wallet size={16} strokeWidth={2} />}
      title="Мастер-кошелёк"
      description={`Кошелёк ${coinName()}, на который собираются (sweep) средства со всех депозитных адресов. Задаётся seed-фразой — она используется для вывода средств, храните её в секрете.`}
    >
      {/* current configuration */}
      <div className="mb-5 rounded-xl border border-edge bg-panel-2 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Текущий кошелёк
          </p>
          {/* Re-fetch the wallet (balance) without an F5 — F5 needlessly retriggers
              the whole websocket resync. Disabled while already fetching. */}
          <button
            type="button"
            onClick={() => current.refetch()}
            disabled={current.isFetching}
            aria-label="Обновить баланс"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={13} strokeWidth={2} className={clsx(current.isFetching && 'animate-spin')} />
            Обновить
          </button>
        </div>
        {current.isLoading ? (
          <div className="flex justify-center py-2">
            <Spinner size={18} />
          </div>
        ) : current.isError ? (
          <div className="flex flex-col items-start gap-2">
            <ErrorLine message={errorMessage(current.error, 'Не удалось загрузить кошелёк')} />
            <Button type="button" variant="ghost" size="sm" onClick={() => current.refetch()}>
              Повторить
            </Button>
          </div>
        ) : current.data == null ? (
          <p className="text-sm text-muted">Мастер-кошелёк ещё не задан.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted">Баланс</span>
              <Amount value={current.data.balance} className="text-sm font-semibold" />
            </div>
            <div>
              <span className="mb-1 block text-sm text-muted">Адрес</span>
              <div className="flex items-stretch gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg border border-edge bg-panel px-3 py-2 font-mono text-xs text-fg">
                  {current.data.address}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => copy(current.data!.address)}
                  aria-label="Скопировать адрес"
                  className="shrink-0 px-3"
                >
                  {copied ? <Check size={16} className="text-win" /> : <Copy size={16} />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* set / replace */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="master-mnemonic" className="text-sm text-muted">
            Seed-фраза нового кошелька
          </label>
          <div className="relative">
            <Input
              id="master-mnemonic"
              type={reveal ? 'text' : 'password'}
              placeholder="word1 word2 word3 …"
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              maxLength={MNEMONIC_MAX}
              autoComplete="off"
              {...SUPPRESS_AUTOFILL}
              spellCheck={false}
              disabled={setWallet.isPending}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Скрыть' : 'Показать'}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-fg"
            >
              {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <span className="text-xs text-muted">До {MNEMONIC_MAX} символов.</span>
        </div>

        {setWallet.isError && (
          <ErrorLine message={errorMessage(setWallet.error, 'Не удалось задать кошелёк')} />
        )}
        {setWallet.isSuccess && <SuccessLine>Мастер-кошелёк обновлён</SuccessLine>}

        <Button
          type="button"
          onClick={submit}
          loading={setWallet.isPending}
          disabled={!canSubmit}
          className="self-start"
        >
          {!setWallet.isPending && <KeyRound size={16} strokeWidth={2} />}
          {current.data == null ? 'Задать кошелёк' : 'Заменить кошелёк'}
        </Button>
      </div>
    </Section>
  );
}
