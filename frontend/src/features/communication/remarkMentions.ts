// remark plugin: turn @handle inside message text into an internal profile-link node, so
// react-markdown renders it as a router <Link> (see Markdown.tsx). This is the one job the
// old linkify still owned that GFM doesn't cover.
//
// Kept tiny and dependency-free — we walk the mdast ourselves instead of pulling in
// unist-util-visit (and @types/mdast isn't installed, so we model just the few node shapes
// we touch). We rewrite ONLY `text` nodes that aren't already inside a `link` (so a real
// markdown link's label isn't re-parsed); `inlineCode`/`code` are distinct node types with
// no `text` children, so @handles inside code stay literal automatically.

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

// @handle at a word boundary — start of the text node or after whitespace — mirroring the
// old linkify rule, so an e-mail's "user@host" doesn't sprout a phantom @host mention.
const MENTION = /(?<=^|\s)@(\w+)/g;

export default function remarkMentions() {
  return (tree: MdNode): void => walk(tree);
}

function walk(node: MdNode): void {
  const children = node.children;
  if (!children) return;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    // Don't rewrite text that's already a link's label.
    if (child.type === 'link') continue;
    if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('@')) {
      const replacement = splitMentions(child.value);
      if (replacement) {
        children.splice(i, 1, ...replacement);
        i += replacement.length - 1; // skip over what we just inserted
        continue;
      }
    }
    walk(child);
  }
}

// Split a text value into alternating plain-text / mention-link nodes. Returns null when
// there's no real mention, so the caller leaves the original node untouched.
function splitMentions(value: string): MdNode[] | null {
  const out: MdNode[] = [];
  let last = 0;
  let found = false;

  for (const m of value.matchAll(MENTION)) {
    const handle = m[1];
    const start = m.index ?? 0;
    if (start > last) out.push({ type: 'text', value: value.slice(last, start) });
    // /u/:userId resolves either a username or a numeric id (same target linkify used).
    out.push({
      type: 'link',
      url: `/u/${encodeURIComponent(handle)}`,
      children: [{ type: 'text', value: `@${handle}` }],
    });
    last = start + m[0].length;
    found = true;
  }

  if (!found) return null;
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) });
  return out;
}
