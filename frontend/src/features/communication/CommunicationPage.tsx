import type { ReactNode } from 'react';
import { Globe, MessagesSquare, Search } from 'lucide-react';
import { useMyCapabilities } from '@/shared/lib/roles';
import Card from '@/shared/ui/Card';

/* ── Layout primitives ─────────────────────────────────────────────────────
   STRUCTURE ONLY — no behaviour is wired here. These compose the page into
   scannable, titled sections so the eventual chat/search logic drops into a
   ready-made skeleton. */

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-fg">
        <span className="text-ton">{icon}</span>
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** A titled, empty placeholder slot — the visual stand-in for a future feature. */
function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        {note ? (
          <span className="text-xs text-muted">· {note}</span>
        ) : null}
        <span className="ml-auto rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          скоро
        </span>
      </div>
    </Card>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function CommunicationPage() {
  const { isChatModerator } = useMyCapabilities();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
          Общение
        </h1>
        <p className="text-sm text-muted">Чаты и игроки платформы</p>
      </div>

      <Section icon={<Globe size={16} />} title="Глобальный чат">
        <Placeholder title="Общий чат" />
        <Placeholder title="Лог действий модераторов" note="доступен всем" />
        {isChatModerator ? <Placeholder title="Бан-лист" /> : null}
      </Section>

      <Section icon={<MessagesSquare size={16} />} title="Личные чаты">
        <Placeholder title="Диалоги" />
        <Placeholder title="Чёрный список" />
      </Section>

      <Section icon={<Search size={16} />} title="Поиск игрока по ID">
        <Placeholder title="Найти игрока" />
      </Section>
    </div>
  );
}
