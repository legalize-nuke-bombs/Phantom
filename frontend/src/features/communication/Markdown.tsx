// Render a user-authored chat message as Markdown — SAFE by construction. There is NO
// rehype-raw, so any literal HTML a user types stays inert text and never becomes nodes;
// react-markdown's default urlTransform also strips javascript:/data: hrefs. GFM gives
// **bold** / _italic_ / `code` / fenced blocks / lists / quotes / ~~strike~~ / tables;
// remark-breaks makes a single newline a <br> (chat users press Enter for a line break,
// they don't leave a blank line); remarkMentions keeps @handle → profile link.
//
// Styling note: Tailwind's preflight zeroes margins and list styles, so every block element
// we care about is styled explicitly below; the wrapper's `space-y-2` provides the gap
// between blocks (a single-paragraph message — the common case — gets no stray spacing).

import { memo } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

import remarkMentions from './remarkMentions';

const remarkPlugins = [remarkGfm, remarkBreaks, remarkMentions];

// One compact style for every heading level — a full-size <h1> inside a chat bubble reads
// as broken layout, so h1–h6 all collapse to a slightly-emphasised line.
function Heading({ children }: { children?: ReactNode }) {
  return <h3 className="mt-1 text-[0.95rem] font-semibold leading-snug">{children}</h3>;
}

const components: Components = {
  a({ href, children }) {
    const to = href ?? '';
    // App-relative paths (including @mention → /u/…) navigate via the SPA router; everything
    // else is external and opens isolated in a new tab.
    if (to.startsWith('/')) {
      return (
        <Link to={to} className="font-medium text-ton hover:underline">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-all text-ton underline hover:opacity-80"
      >
        {children}
      </a>
    );
  },
  // External markdown images are NOT auto-loaded — an off-platform <img> leaks the viewer's
  // IP and can blow out the bubble. Render the source as a plain link instead; in-chat image
  // sharing already has its own safe path (attachments).
  img({ src, alt }) {
    const href = typeof src === 'string' ? src : '';
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-all text-ton underline hover:opacity-80"
      >
        {alt || href}
      </a>
    );
  },
  code({ children }) {
    return <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>;
  },
  // The fenced-code container. The nested <code> is reset (transparent, no padding, inherit
  // size) so the inline-code styling above doesn't double up inside the block.
  pre({ children }) {
    return (
      <pre className="my-1 overflow-x-auto rounded-lg bg-black/40 p-2.5 text-xs [&>code]:block [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[length:inherit]">
        {children}
      </pre>
    );
  },
  ul({ children }) {
    return <ul className="list-disc space-y-0.5 pl-5 marker:text-muted">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal space-y-0.5 pl-5 marker:text-muted">{children}</ol>;
  },
  blockquote({ children }) {
    return <blockquote className="border-l-2 border-edge pl-3 italic text-muted">{children}</blockquote>;
  },
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
  del({ children }) {
    return <del className="line-through opacity-80">{children}</del>;
  },
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  hr() {
    return <hr className="my-2 border-edge" />;
  },
  table({ children }) {
    return (
      <div className="my-1 overflow-x-auto">
        <table className="w-full border-collapse text-xs">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return <th className="border border-edge px-2 py-1 text-left font-semibold">{children}</th>;
  },
  td({ children }) {
    return <td className="border border-edge px-2 py-1">{children}</td>;
  },
};

function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Memoised: a chat renders many bubbles and re-renders often (new messages, cache merges);
// the markdown parse only needs to re-run when this bubble's own content changes.
export default memo(MessageMarkdown);
