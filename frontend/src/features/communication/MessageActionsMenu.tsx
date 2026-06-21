// The per-message actions popover (Telegram-style). Lives next to MessageBubble; the
// bubble owns *when* it opens (hover trigger, right-click, long-press) and *what* the
// action does (the delete mutation) — this file owns the popover chrome and the two-step
// "Удалить → Точно удалить?" confirm so a stray tap can't nuke a message.
//
// Pattern mirrors Composer's attach menu: an absolutely-positioned panel plus a fixed,
// full-screen click-away catcher below it. Positioning is relative to the row, so it rides
// the scrolling message list and isn't clipped by it. `align` flips the panel under the
// trigger ('left', own messages) or above-right of the bubble ('right', context/long-press).

import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';

/** Where the panel anchors relative to its positioned parent. */
export type MenuAnchor = { side: 'top' | 'bottom'; align: 'left' | 'right' };

export default function MessageActionsMenu({
  anchor,
  onDelete,
  deleting,
  onClose,
}: {
  // Anchor the panel near whatever opened it (the trigger button vs. the bubble itself).
  anchor: MenuAnchor;
  // Fire the actual delete. The parent owns the mutation; we only gate it behind a confirm.
  onDelete: () => void;
  // Disable the buttons while the delete is in flight (parent's mutation isPending).
  deleting: boolean;
  onClose: () => void;
}) {
  // Two-step confirm inside the menu: first "Удалить", then "Точно удалить?".
  const [confirming, setConfirming] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Esc closes; focus the panel on open so keyboard users land inside it (and so the very
  // first item is reachable via Tab). Re-runs only on open.
  useEffect(() => {
    panelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Click-away catcher under the menu (same trick as Composer's attach menu). Also
          swallows a right-click outside — a second context-menu gesture dismisses rather
          than popping the browser's native one through the open menu. */}
      <div
        className="fixed inset-0 z-10"
        aria-hidden
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
        // A scroll gesture (touch-drag / wheel) DISMISSES the menu rather than being swallowed
        // by this catcher — otherwise, on mobile, the chat list couldn't be scrolled while the
        // menu was open (the full-screen catcher ate the touch).
        onTouchMove={onClose}
        onWheel={onClose}
      />

      <div
        ref={panelRef}
        role="menu"
        aria-label="Действия с сообщением"
        tabIndex={-1}
        className={clsx(
          'absolute z-20 min-w-[10rem] overflow-hidden rounded-xl border border-edge bg-panel shadow-xl outline-none',
          anchor.side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
          anchor.align === 'right' ? 'right-0' : 'left-0',
        )}
      >
        {confirming ? (
          // Step two: an explicit confirm row. "Точно удалить?" + a destructive confirm,
          // and a way back out. Both targets are full-width rows so they're touch-friendly.
          <>
            <p className="px-3 pb-1 pt-2.5 text-xs text-muted">Точно удалить?</p>
            <button
              type="button"
              role="menuitem"
              onClick={onDelete}
              disabled={deleting}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-lose transition-colors hover:bg-lose/10 focus:outline-none focus-visible:bg-lose/10 disabled:opacity-50"
            >
              <Trash2 size={16} strokeWidth={2} />
              {deleting ? 'Удаление…' : 'Точно удалить'}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="flex w-full items-center gap-2.5 border-t border-edge px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-panel-2 hover:text-fg focus:outline-none focus-visible:bg-panel-2 disabled:opacity-50"
            >
              Отмена
            </button>
          </>
        ) : (
          // Step one: the destructive entry point. Tapping it only arms the confirm above.
          <button
            type="button"
            role="menuitem"
            onClick={() => setConfirming(true)}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-lose transition-colors hover:bg-lose/10 focus:outline-none focus-visible:bg-lose/10"
          >
            <Trash2 size={16} strokeWidth={2} />
            Удалить
          </button>
        )}
      </div>
    </>
  );
}
