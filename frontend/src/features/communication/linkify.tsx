// Turn URLs and @mentions inside plain message text into real, clickable links — WITHOUT
// ever touching dangerouslySetInnerHTML. The content is user-authored, so we keep it as
// React children (auto-escaped) and only the matched spans become elements; everything
// between stays a plain string. This is the XSS-safe way to "render links" in chat.
//
//   • http(s)://… or www.… → external <a target=_blank>.
//   • @handle              → internal <Link> to /u/{handle}; the profile route resolves a
//                            username, or a numeric id when the handle is all digits.

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// One regex, three alternatives, the `g` flag so we walk every match:
//   1. explicit scheme  http:// | https:// followed by non-space chars
//   2. bare host        www.<something> (we prefix https:// when building the href)
//   3. @mention         @handle, but only at a word boundary (start-of-string or after
//      whitespace) so an email's "user@host" doesn't get a phantom @host mention.
// Deliberately simple — chat tokens are short and we don't need RFC-grade parsing.
const TOKEN_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+|(?<=^|\s)@\w+)/gi;

// Punctuation that commonly trails a token in prose but isn't part of it — peeled off the
// end of a match (the ")" in "(@bob)" or the "." ending "see https://a.io.").
const TRAILING = /[.,!?;:)\]}'"»]+$/;

/**
 * Split `content` into React nodes: plain strings for ordinary text, <a> for external
 * URLs, and <Link> for @mentions. Returns [content] when there's nothing to linkify, so
 * callers can always render the result directly.
 */
export function linkify(content: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of content.matchAll(TOKEN_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;

    // Trim trailing prose punctuation back into the plain-text tail so it isn't linked.
    const trailing = TRAILING.exec(raw);
    const token = trailing ? raw.slice(0, raw.length - trailing[0].length) : raw;
    if (token.length === 0) continue; // punctuation-only — leave as text
    // A lone "@" (no handle after trimming) is just text.
    if (token === '@') continue;

    // Plain text before this token.
    if (start > lastIndex) nodes.push(content.slice(lastIndex, start));

    if (token.startsWith('@')) {
      // @mention → internal profile link. /u/:userId resolves a username or a numeric id.
      const handle = token.slice(1);
      nodes.push(
        <Link
          key={`m-${key++}`}
          to={`/u/${encodeURIComponent(handle)}`}
          className="font-medium text-ton hover:underline"
        >
          {token}
        </Link>,
      );
    } else {
      // www.* has no scheme — give the href one so the browser doesn't treat it as a
      // relative path. The visible text stays exactly what the user typed.
      const href = token.startsWith('www.') ? `https://${token}` : token;
      nodes.push(
        <a
          key={`l-${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ton underline hover:opacity-80"
        >
          {token}
        </a>,
      );
    }

    lastIndex = start + token.length;
  }

  // Remaining tail after the last token (or the whole string when there were none).
  if (lastIndex < content.length) nodes.push(content.slice(lastIndex));

  return nodes.length > 0 ? nodes : [content];
}
