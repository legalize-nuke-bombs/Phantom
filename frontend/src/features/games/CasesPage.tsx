// CasesPage — the CASES picker (/games/cases).
//
// An adaptive grid of case cards (1 column on mobile, 2 on sm+). Each card shows
// the case name + a blue ton price pill, then one full-width tier-tinted row per
// prize (cheapest → priciest) with its drop chance, and a full-width "Открыть"
// button that navigates to the dedicated open screen (/games/cases/:caseName).
// The model + the tier-row rendering live in ./cases/caseModel.
//
// Backend (com.example.phantom.game.cases.*): GET /api/games/cases →
// CaseSettings { cases: [{ name, cost, size, data }] }; `data` maps prizeAmount →
// weight; `cost` is the server-computed price. No "max prize" headline anywhere.

import { useNavigate } from 'react-router-dom';
import { errorMessage } from '@/shared/api/errors';
import { GAME_META } from '@/shared/lib/games';
import Amount from '@/shared/ui/Amount';
import Button from '@/shared/ui/Button';
import Spinner from '@/shared/ui/Spinner';
import PageBack from '@/shared/ui/PageBack';
import { ContentsRows, useCases } from './cases/caseModel';
import type { CaseView } from './cases/caseModel';

/** One case as a card: name + price pill, prize rows, full-width open button. */
function CaseCard({ caseView }: { caseView: CaseView }) {
  const navigate = useNavigate();

  const onOpen = () => {
    navigate(`/games/cases/${encodeURIComponent(caseView.name)}`);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-edge bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-semibold tracking-tight text-fg">
          {caseView.name}
        </span>
        <span className="shrink-0 rounded-full border border-ton/50 bg-ton/10 px-3 py-1 text-sm font-semibold tabular-nums text-ton">
          <Amount value={caseView.cost} />
        </span>
      </div>

      <ContentsRows prizes={caseView.prizes} />

      <Button className="mt-auto w-full" onClick={onOpen}>
        Открыть
      </Button>
    </div>
  );
}

export default function CasesPage() {
  const { data: cases, isLoading, isError, error, refetch } = useCases();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <PageBack to="/games" label="К играм" />

      <header className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-2xl">
          {GAME_META.CASES.emoji}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            {GAME_META.CASES.name}
          </h1>
          <p className="text-sm text-muted">Выбери ящик и открой его</p>
        </div>
      </header>

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
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cases?.map((c) => (
            <CaseCard key={c.name} caseView={c} />
          ))}
        </div>
      )}
    </div>
  );
}
