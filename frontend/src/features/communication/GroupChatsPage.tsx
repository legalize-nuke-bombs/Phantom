import type { ComponentType } from 'react';
import { MessagesSquare, UserX } from 'lucide-react';

/* ── Group chats ────────────────────────────────────────────────────────────
   PLACEHOLDER ONLY — no behaviour is wired here. A large central stand-in for
   the future group chat list / conversation, with the secondary actions tucked
   into a small, understated top-right toolbar. The blacklist is a single list
   shared across all group chats. Logic drops into this skeleton later. */

/** A subtle, square ghost icon-button for the corner toolbar (tooltip via title). */
function ToolbarButton({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ size?: number | string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-ton"
    >
      <Icon size={16} />
    </button>
  );
}

export default function GroupChatsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
          Групповые чаты
        </h1>
        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarButton icon={UserX} label="Чёрный список" />
        </div>
      </header>

      <div className="grid min-h-[60vh] place-items-center rounded-xl border border-dashed border-edge bg-panel/40">
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <MessagesSquare size={28} className="text-muted" />
          <p className="text-sm font-medium text-fg">Чат скоро</p>
          <p className="text-xs text-muted">Здесь появятся групповые чаты</p>
        </div>
      </div>
    </div>
  );
}
