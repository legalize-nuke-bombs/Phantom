// Small reusable clipboard hook with a transient "copied" flag. Mirrors the local
// helper in WalletPage; lifted here so the owner sections can share it. Falls back
// to execCommand on the (rare) browser without the async clipboard API.

import { useState } from 'react';

export function useCopy(): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);

  function copy(text: string) {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    };
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => setCopied(false));
        return;
      }
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch {
      setCopied(false);
    }
  }

  return { copied, copy };
}
