// CaseOpenPage — the open screen for one case (/games/cases/:caseName).
//
// The case is resolved from useCases() (cache is instant after the picker), by the
// :caseName URL param. The reel spins on open, decelerates onto the won amount, then
// shows the winnings ("Ваш выигрыш", 0 if nothing — never a loss/minus) plus the
// case contents and the provably-fair panel. One button opens and replays.
//
// Sound: sfx.startSpin() on open; on landing pick the outcome by the won amount
// relative to the case price — 0 → lose, up to ~2× cost → small win, more → big win.

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useParams } from 'react-router-dom';
import { useGameRound } from '@/shared/lib/useGameRound';
import { errorMessage } from '@/shared/api/errors';
import { sfx } from '@/shared/lib/sound';
import type { SpinHandle } from '@/shared/lib/sound';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Spinner from '@/shared/ui/Spinner';
import ProvablyFair from '@/shared/ui/ProvablyFair';
import PageBack from '@/shared/ui/PageBack';
import { ContentsRows, Reel, useCases } from './caseModel';
import type { CaseView } from './caseModel';

/** Win ≥ this multiple of the case price counts as a "big" win for the sound. */
const BIG_WIN_MULTIPLE = 2;

type Phase = 'ready' | 'spinning' | 'revealed';

function OpenInner({ caseView }: { caseView: CaseView }) {
  const round = useGameRound('CASES');

  // Phase is separate from the round status so the result waits for the reel to
  // *finish* (the round resolves well before the animation ends).
  const [phase, setPhase] = useState<Phase>('ready');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const spinSound = useRef<SpinHandle | null>(null);

  // Stop the start sound if we leave mid-spin.
  useEffect(
    () => () => {
      spinSound.current?.stop();
      spinSound.current = null;
    },
    [],
  );

  const open = useCallback(async () => {
    if (phase === 'spinning') return;
    setErrMsg(null);
    // One-click replay: if we're showing a result, clear it before the new round so
    // there's no dead intermediate screen needing a second click.
    round.reset();
    setPhase('spinning');
    spinSound.current = sfx.startSpin();
    try {
      await round.play({ caseName: caseView.name });
      // Result is in; the reel keeps spinning until onSettled flips to 'revealed'.
    } catch (e) {
      spinSound.current?.stop();
      spinSound.current = null;
      setPhase('ready');
      setErrMsg(errorMessage(e));
    }
  }, [round, caseView.name, phase]);

  const onSettled = useCallback(() => {
    spinSound.current?.stop();
    spinSound.current = null;
    setPhase('revealed');
    // Outcome sound, chosen by the won amount relative to the case price.
    const wonValue = round.result ? Number(round.result.result) : 0;
    const cost = Number(caseView.cost);
    if (wonValue <= 0) {
      sfx.lose();
    } else if (cost > 0 && wonValue >= cost * BIG_WIN_MULTIPLE) {
      sfx.bigWin();
    } else {
      sfx.smallWin();
    }
  }, [round.result, caseView.cost]);

  const result = round.result;
  const reelResult = phase === 'spinning' || phase === 'revealed' ? result : null;
  const revealed = phase === 'revealed' && !!result;
  const won = revealed ? Number(result.result) > 0 : false;
  const busy = round.busy || phase === 'spinning';

  return (
    <div className="space-y-4">
      <Reel
        caseView={caseView}
        result={reelResult}
        spinning={phase === 'spinning'}
        onSettled={onSettled}
      />

      {/* Outcome — always framed as winnings; 0 (and grey) if nothing, never a loss. */}
      {revealed && (
        <div
          className={clsx(
            'overflow-hidden rounded-xl border bg-panel p-4 text-center',
            won ? 'border-win/40' : 'border-edge',
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Ваш выигрыш
          </p>
          <div className="mt-1 text-3xl font-bold tracking-tight">
            <Amount value={result.result} />
          </div>
        </div>
      )}

      {/* Single persistent action — one click opens, and one click replays. */}
      <Button size="lg" className="w-full" onClick={open} loading={busy} disabled={busy}>
        {busy ? 'Открываем…' : revealed ? 'Открыть ещё раз' : 'Открыть кейс'}
      </Button>

      {errMsg && <p className="text-center text-sm text-lose">{errMsg}</p>}

      {/* What's inside — full-width tier plates, worst → best, with drop chances. */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Содержимое
        </p>
        <ContentsRows prizes={caseView.prizes} />
      </div>

      <ProvablyFair
        serverHash={round.serverHash}
        serverSeed={result?.serverSeed}
        clientSeed={result?.clientSeed}
        verified={round.verified}
      />
    </div>
  );
}

export default function CaseOpenPage() {
  const { caseName } = useParams<{ caseName: string }>();
  const { data: cases, isLoading, isError, error, refetch } = useCases();

  const decoded = caseName ? decodeURIComponent(caseName) : '';
  const caseView = cases?.find((c) => c.name === decoded);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <PageBack to="/games/cases" label="К ящикам" />

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner size={28} />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-edge bg-panel p-6 text-center">
          <p className="text-sm text-muted">{errorMessage(error)}</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => refetch()}>
            Повторить
          </Button>
        </div>
      ) : !caseView ? (
        <div className="rounded-xl border border-edge bg-panel p-6 text-center">
          <p className="text-sm text-muted">Ящик не найден.</p>
        </div>
      ) : (
        <>
          <header className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
              {caseView.name}
            </h1>
            <span className="shrink-0 rounded-full border border-ton/50 bg-ton/10 px-3 py-1 text-sm font-semibold tabular-nums text-ton">
              <Amount value={caseView.cost} />
            </span>
          </header>

          <OpenInner caseView={caseView} />
        </>
      )}
    </div>
  );
}
