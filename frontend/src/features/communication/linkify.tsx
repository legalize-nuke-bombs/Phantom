// Turn URLs inside plain message text into real, clickable links — WITHOUT ever
// touching dangerouslySetInnerHTML. The content is user-authored, so we keep it as
// React children (auto-escaped) and only the matched URL spans become <a> elements;
// everything between stays a plain string. This is the XSS-safe way to "render HTML
// links" in chat.

import type { ReactNode } from 'react';

// One regex, two alternatives, the `g` flag so we can walk every match:
//   1. an explicit scheme:  http:// or https:// followed by non-space chars
//   2. a bare host:         www.<something> (we prefix https:// when building href)
// Kept deliberately simple — chat URLs are short and we don't need RFC-grade parsing,
// just "looks like a link → make it one". Trailing sentence punctuation is trimmed off
// the match below so "see https://a.io." doesn't swallow the period into the href.
const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

// Punctuation that commonly follows a URL in prose but isn't part of it. We peel these
// off the end of a match (e.g. the ")" in "(https://x.io)" or the "." ending a sentence).
const TRAILING = /[.,!?;:)\]}'"»]+$/;

/**
 * Split `content` into an array of React nodes: plain strings for ordinary text and
 * <a> elements (styled, target=_blank, rel=noopener noreferrer) for detected URLs.
 * Returns a single-element array ([content]) when there are no links, so callers can
 * always render the result directly.
 */
export function linkify(content: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of content.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;

    // Trim trailing prose punctuation back into the plain-text tail so it's not linked.
    const trailing = TRAILING.exec(raw);
    const url = trailing ? raw.slice(0, raw.length - trailing[0].length) : raw;
    if (url.length === 0) continue; // match was punctuation-only — leave it as text

    // Plain text before this URL.
    if (start > lastIndex) nodes.push(content.slice(lastIndex, start));

    // www.* has no scheme — give the href one so the browser doesn't treat it as a
    // relative path. The visible text stays exactly what the user typed.
    const href = url.startsWith('www.') ? `https://${url}` : url;
    nodes.push(
      <a
        key={`lnk-${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ton underline hover:opacity-80"
      >
        {url}
      </a>,
    );

    lastIndex = start + url.length;
  }

  // Remaining tail after the last URL (or the whole string when there were no links).
  if (lastIndex < content.length) nodes.push(content.slice(lastIndex));

  return nodes.length > 0 ? nodes : [content];
}
