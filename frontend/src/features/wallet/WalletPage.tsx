import { ArrowDownToLine, ArrowUpFromLine, Wallet as WalletIcon } from 'lucide-react';
import Card from '@/shared/ui/Card';

export default function WalletPage() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl border border-edge bg-panel-2 text-ton">
          <WalletIcon size={22} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
            Кошелёк
          </h1>
          <p className="text-sm text-muted">Управление балансом</p>
        </div>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-medium text-fg">В разработке</h2>
          <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ton">
            скоро
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Раздел кошелька пока в разработке. Совсем скоро здесь появятся
          пополнение и вывод средств через сеть TON.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-edge bg-panel-2 p-3 opacity-70">
            <span className="grid size-9 place-items-center rounded-lg bg-ink text-ton">
              <ArrowDownToLine size={18} />
            </span>
            <div>
              <p className="text-sm font-medium text-fg">Пополнение</p>
              <p className="text-xs text-muted">Депозит TON — скоро</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-edge bg-panel-2 p-3 opacity-70">
            <span className="grid size-9 place-items-center rounded-lg bg-ink text-ton">
              <ArrowUpFromLine size={18} />
            </span>
            <div>
              <p className="text-sm font-medium text-fg">Вывод</p>
              <p className="text-xs text-muted">Вывод TON — скоро</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
