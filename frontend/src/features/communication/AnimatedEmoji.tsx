// Telegram-style big animated emoji for emoji-only messages. We render Google's Noto animated
// emoji as Lottie, lazy-loaded per-codepoint straight from the gstatic CDN — zero bundled
// assets (CC-BY/Apache licensed). Not every codepoint exists in the animated set, so a load
// error falls back to the plain system emoji at the same size — nothing ever renders blank.

import { useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Count the emoji in an "emoji-only" message. Returns 0 if the text contains ANY non-emoji,
 * non-whitespace character, so ordinary text is never mistaken for emoji.
 */
export function emojiOnlyCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  let count = 0;
  for (const { segment } of segmenter.segment(trimmed)) {
    if (/^\s+$/u.test(segment)) continue;
    if (!/\p{Extended_Pictographic}/u.test(segment)) return 0;
    count++;
  }
  return count;
}

/** Split a (trimmed) string into its individual emoji graphemes, dropping whitespace. */
export function splitEmojis(text: string): string[] {
  return [...segmenter.segment(text.trim())]
    .map((s) => s.segment)
    .filter((s) => !/^\s+$/u.test(s));
}

// Noto names its assets by codepoint(s) — lowercase hex joined with '_', and it OMITS the VS16
// (U+FE0F) variation selector. Multi-codepoint graphemes (flags, skin tones, ZWJ sequences) may
// be missing from the animated set; the loadError fallback covers those.
function notoCodepoints(emoji: string): string {
  return [...emoji]
    .map((ch) => ch.codePointAt(0) ?? 0)
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
    .join('_');
}

export function AnimatedEmoji({ emoji, size }: { emoji: string; size: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span role="img" aria-label={emoji} style={{ fontSize: size * 0.85, lineHeight: 1 }}>
        {emoji}
      </span>
    );
  }

  const src = `https://fonts.gstatic.com/s/e/notoemoji/latest/${notoCodepoints(emoji)}/lottie.json`;
  return (
    <DotLottieReact
      src={src}
      autoplay
      loop
      aria-label={emoji}
      style={{ width: size, height: size }}
      dotLottieRefCallback={(dl) => dl?.addEventListener('loadError', () => setFailed(true))}
    />
  );
}
