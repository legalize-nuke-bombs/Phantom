import type { ReactNode } from 'react';

// Scroll container for the auth pages. The app locks <body> (index.css: overflow hidden) for the
// fixed app-shell, but the auth screens render OUTSIDE that shell, so they need their own scroll —
// otherwise a tall form (the owner sign-up) is clipped with no way to reach it. h-dvh + overflow
// gives a self-contained scroll; the inner min-h-full flex centers the card when it fits and lets
// it scroll when it doesn't.
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh overflow-y-auto bg-ink">
      <div className="flex min-h-full items-center justify-center px-4 py-10">{children}</div>
    </div>
  );
}
