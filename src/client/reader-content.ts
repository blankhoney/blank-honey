/**
 * The only path from a stored feed string to live DOM nodes.
 *
 * Subscribed feeds are written by other people and never reviewed before they are stored, so the
 * reader treats every stored fragment as hostile markup. Two layers stand between it and the page:
 * DOMPurify's allowlist removes everything the reader can execute or request, and the link pass
 * below re-derives every surviving destination from the raw attribute so that credentials, non-HTTP
 * schemes and control characters cannot ride along in an otherwise allowed `<a>`.
 *
 * Nothing here returns markup. `safeFeedFragment` hands back a fragment that callers append, and
 * `feedExcerpt` returns plain text, so no caller ever needs to choose between convenience and
 * safety — the unsafe variants simply do not exist.
 */
import DOMPurify from 'dompurify';

/** Exactly the structural tags the reader renders. Request and interaction tags are absent. */
const ALLOWED_TAGS = [
  'a',
  'b',
  'strong',
  'i',
  'em',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
  'caption',
  'del',
  's',
  'span',
  'div',
];

/**
 * Only `href` and `title` survive. `id`/`name` would let a feed clobber DOM globals, `class`/`style`
 * would let it restyle or hide reader chrome, and event attributes would execute. `data-*` and
 * `aria-*` are absent from the allowlist too, but DOMPurify permits them by default, so the config
 * below switches them off explicitly rather than trusting the allowlist alone.
 */
const ALLOWED_ATTR = ['href', 'title'];

/** C0 controls and DEL: a URL may not carry them, however well the URL parser tolerates them. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

type SanitizeConfig = Parameters<typeof DOMPurify.sanitize>[1];

/**
 * The markup contract shared by every entry in this module. Exported nowhere: it is a private
 * constant so a caller cannot widen it by accident.
 */
const MARKUP_CONFIG = {
  RETURN_DOM_FRAGMENT: true,
  // Blocks DOM clobbering through crafted `id`/`name` values on nodes that survive the allowlist.
  SANITIZE_DOM: true,
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  // Only the HTML namespace: SVG and MathML nodes never get the chance to carry script.
  ALLOWED_NAMESPACES: ['http://www.w3.org/1999/xhtml'],
} as const satisfies SanitizeConfig;

/**
 * Fails loudly where DOMPurify would fail silently. Without a document its `sanitize` returns the
 * input untouched, so proving support is present is what keeps un-purified feed markup from being
 * published as if it had been cleaned. Every entry point calls this before it touches the document.
 */
function requireDom(): typeof DOMPurify {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    DOMPurify.isSupported !== true
  ) {
    throw new Error('reader-content requires a DOM and a DOMPurify build with sanitize support');
  }
  return DOMPurify;
}

/**
 * Re-derives one destination from the raw attribute. Absolute URLs are parsed on their own so a
 * damaged `baseUrl` can never turn a legitimate link into a relative one; everything else resolves
 * against `baseUrl`. Returns null for every destination the reader refuses to navigate to.
 */
function resolveHref(raw: string | null, baseUrl: string): string | null {
  if (!raw || raw.trim() === '' || CONTROL_CHARACTERS.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    try {
      url = new URL(raw, baseUrl);
    } catch {
      return null;
    }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  // Credentials in a link both leak the feed's secrets and disguise the real destination.
  if (url.username !== '' || url.password !== '') return null;
  return url.href;
}

/**
 * Makes every surviving anchor absolute and explicit: no `opener` handle, no referrer, and a new
 * tab so a feed can never navigate the reader away from what it is reading.
 */
function hardenLinks(fragment: DocumentFragment, baseUrl: string): void {
  for (const anchor of fragment.querySelectorAll('a')) {
    const href = resolveHref(anchor.getAttribute('href'), baseUrl);
    if (href === null) {
      anchor.removeAttribute('href');
      continue;
    }
    anchor.setAttribute('href', href);
    anchor.setAttribute('rel', 'noopener noreferrer');
    anchor.setAttribute('target', '_blank');
  }
}

/**
 * Purifies feed markup and returns it as an owned fragment. The caller appends this; the raw string
 * never reaches `innerHTML`. `baseUrl` is where relative links in the feed should land — the entry's
 * own URL, its site, or the reader origin — and is never the private feed URL.
 */
export function safeFeedFragment(html: string, baseUrl: string): DocumentFragment {
  const purifier = requireDom();
  const fragment = purifier.sanitize(html, MARKUP_CONFIG);
  // `RETURN_DOM_FRAGMENT` guarantees a fragment on a supported build; this keeps a future change in
  // DOMPurify's return type from smuggling a raw string through the reader's only safe path.
  if (typeof fragment === 'string') {
    throw new Error('reader-content refused a string result from DOMPurify');
  }
  hardenLinks(fragment, baseUrl);
  return fragment;
}

/**
 * Plain-text excerpt of feed markup, for list rows where markup has no place. Whitespace collapses
 * to single spaces and the result is at most `maxLength` characters, ellipsis included, counted in
 * code points so CJK text and emoji are never cut through the middle of a character.
 */
export function feedExcerpt(html: string, baseUrl: string, maxLength = 180): string {
  // Checked before the holder is built, so a DOM-less build gets this error and not a ReferenceError.
  requireDom();
  const holder = document.createElement('div');
  holder.append(safeFeedFragment(html, baseUrl));
  const text = (holder.textContent ?? '').replace(/\s+/g, ' ').trim();
  const characters = Array.from(text);
  if (characters.length <= maxLength) return text;
  if (maxLength <= 0) return '';
  return `${characters.slice(0, maxLength - 1).join('')}…`;
}
