/**
 * Feed parsing for the reader worker: RSS 2.0 (`rss.channel`) and Atom 1.0 (`feed`).
 *
 * Pure CPU: no network, DOM or filesystem access. A feed arrives as an untrusted string, so every
 * rejection is a bounded ReaderError and callers only ever handle that one error type.
 *
 * HTML inside a feed is never "sanitized" here — a regex in Node cannot make markup safe. The
 * strings stay untrusted and the browser client runs DOMPurify before rendering them.
 *
 * Error codes:
 * - FEED_TOO_LARGE (413): input exceeds LIMITS.responseBytes.
 * - UNSAFE_XML (422): DOCTYPE/ENTITY declaration; entity expansion can amplify a small document.
 * - INVALID_XML (422): XMLValidator rejected the document, or the argument was not a string.
 * - INVALID_FEED (422): well-formed XML that is not an RSS 2.0 or Atom 1.0 feed, e.g. a web page.
 */
import { createHash } from 'node:crypto';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { LIMITS, ReaderError } from './model.mjs';

const ATOM_NAMESPACE = 'http://www.w3.org/2005/Atom';
const MAX_ID_BYTES = 2048;
const MAX_TITLE_CHARACTERS = 300;
const MAX_AUTHOR_CHARACTERS = 200;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
/** Comments and CDATA are masked before the declaration scan, so literal text inside a body that
 *  mentions "<!DOCTYPE html>" is not mistaken for a document type declaration. */
const MARKUP_BLOCK = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g;
const DECLARATION = /<!(?:DOCTYPE|ENTITY)/i;

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false, // <guid>12345</guid> must stay the string "12345"
  parseAttributeValue: false,
  removeNSPrefix: false, // dc:creator / content:encoded stay addressable
  trimValues: true,
});

/** xhtml content is re-serialized for the client; empty elements become <br/> rather than <br></br>. */
const XHTML_BUILDER = new XMLBuilder({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: false,
  suppressEmptyNode: true,
});
const ORDERED_PARSER = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
});

/**
 * Parse one downloaded feed document.
 * @param {string} xml raw document bytes decoded as UTF-8
 * @param {string} feedUrl the subscription URL, used only as a base for relative links
 * @returns {{title: string, siteUrl: string|null, entries: Array<{
 *   externalId: string, title: string, url: string|null, author: string|null,
 *   publishedAt: number|null, contentKind: 'content'|'summary', contentHtml: string,
 *   summaryHtml: string, truncated: boolean
 * }>}}
 */
export function parseFeed(xml, feedUrl) {
  if (typeof xml !== 'string') throw new ReaderError('INVALID_XML', 422);
  if (Buffer.byteLength(xml, 'utf8') > LIMITS.responseBytes)
    throw new ReaderError('FEED_TOO_LARGE', 413);
  rejectDeclarations(xml);
  if (XMLValidator.validate(xml) !== true) throw new ReaderError('INVALID_XML', 422);

  const root = documentRoot(PARSER.parse(xml));
  if (!root) throw new ReaderError('INVALID_FEED', 422);

  const prefix = prefixOf(root.name);
  const local = localName(root.name);
  const feed =
    local === 'rss' ? rssFeed(root, prefix) : local === 'feed' ? atomFeed(root, prefix) : null;
  if (!feed) throw new ReaderError('INVALID_FEED', 422);

  const base = feedBaseOf(root, feed.element, feedUrl);
  const title = normalizeTitle(textOf(child(feed.element, 'title', prefix)));
  const siteUrl = resolveHttpUrl(feed.siteHref, base);
  const xhtml = local === 'feed' ? orderedXhtml(xml, root.name, prefix, feed.items) : [];
  const built = feed.items.map((node, index) => feed.entry(node, base, xhtml[index]));

  const byExternalId = new Map(); // same id twice in one document: the last record wins
  for (const entry of built) byExternalId.set(entry.externalId, entry);
  const entries = sortByPublishedAt([...byExternalId.values()]).slice(0, LIMITS.feedEntries);
  return { title, siteUrl, entries };
}

function rejectDeclarations(xml) {
  if (DECLARATION.test(xml.replace(MARKUP_BLOCK, ''))) throw new ReaderError('UNSAFE_XML', 422);
}

function documentRoot(document) {
  for (const [name, value] of Object.entries(document)) {
    if (name.startsWith('?') || name.startsWith('#') || name.startsWith('@_')) continue;
    if (isElement(value)) return { name, value };
  }
  return null;
}

function prefixOf(name) {
  const colon = name.indexOf(':');
  return colon === -1 ? '' : name.slice(0, colon);
}

function localName(name) {
  return name.slice(name.indexOf(':') + 1); // no colon: indexOf is -1 and the whole name is local
}

/**
 * Element lookup under the root's namespace prefix. A document written as <atom:feed> nests
 * <atom:entry>, which must still be found; the unprefixed name stays a fallback so mixed
 * documents keep working. Matching is by exact key, so media:content is never taken for content.
 */
function child(element, name, prefix) {
  const qualified = prefix === '' ? name : `${prefix}:${name}`;
  const value = element[qualified];
  return value === undefined ? element[name] : value;
}

/** RSS 2.0 is defined without a namespace; a channel is what makes the document a feed. */
function rssFeed(root, prefix) {
  const channel = toArray(child(root.value, 'channel', prefix))[0];
  if (!isElement(channel)) return null;
  return {
    element: channel,
    siteHref: hrefOf(child(channel, 'link', prefix)),
    items: toArray(child(channel, 'item', prefix)).filter(isElement),
    entry: (item, base) => makeEntry(rssEntryFields(item, base, prefix)),
  };
}

function atomFeed(root, prefix) {
  // Atom 0.3 declares a different vocabulary (tagline/modified/issued) under its own namespace.
  const declared = declaredNamespace(root.name, root.value);
  if (declared && declared !== ATOM_NAMESPACE) return null;
  return {
    element: root.value,
    siteHref: atomLinkHref(toArray(child(root.value, 'link', prefix))),
    items: toArray(child(root.value, 'entry', prefix)).filter(isElement),
    // An Atom feed without a namespace attribute is accepted: the binding may be declared on an
    // ancestor we never see, and the local element names are unambiguous.
    entry: (node, base, xhtml) => makeEntry(atomEntryFields(node, base, prefix, xhtml)),
  };
}

function rssEntryFields(item, base, prefix) {
  const itemBase = resolveHttpUrl(attribute(item, 'xml:base'), base) ?? base;
  const rawContent = rawString(item['content:encoded']);
  const rawDescription = rawString(child(item, 'description', prefix));
  const bodyHtml = rawContent ?? rawDescription ?? '';
  return {
    rawId: textOf(child(item, 'guid', prefix)) || textOf(child(item, 'id', prefix)),
    rawTitle: child(item, 'title', prefix),
    url: resolveHttpUrl(hrefOf(child(item, 'link', prefix)), itemBase),
    rawAuthor: textOf(child(item, 'author', prefix)) || textOf(item['dc:creator']),
    publishedAt: firstDate(child(item, 'pubDate', prefix), item['dc:date']),
    contentKind: rawContent === null ? 'summary' : 'content',
    bodyHtml,
    summarySource: rawDescription ?? bodyHtml,
  };
}

function atomEntryFields(node, base, prefix, xhtml) {
  const entryBase = resolveHttpUrl(attribute(node, 'xml:base'), base) ?? base;
  const author = toArray(child(node, 'author', prefix)).find(isElement) ?? {};
  const rawContent = atomHtml(child(node, 'content', prefix), xhtml?.content);
  const rawSummary = atomHtml(child(node, 'summary', prefix), xhtml?.summary);
  const bodyHtml = rawContent === '' ? rawSummary : rawContent;
  return {
    rawId: textOf(child(node, 'id', prefix)) || textOf(child(node, 'guid', prefix)),
    rawTitle: child(node, 'title', prefix),
    url: resolveHttpUrl(atomLinkHref(toArray(child(node, 'link', prefix))), entryBase),
    rawAuthor: textOf(child(author, 'name', prefix)),
    publishedAt: firstDate(
      child(node, 'published', prefix),
      child(node, 'updated', prefix),
      node['dc:date'],
    ),
    contentKind: rawContent === '' ? 'summary' : 'content',
    bodyHtml,
    summarySource: rawSummary === '' ? bodyHtml : rawSummary,
  };
}

/**
 * Atom content/summary are typed. Text (the RFC 4287 default) is escaped into HTML, html is passed
 * through for the client to sanitize, and xhtml is re-serialized from the parsed tree.
 */
function atomHtml(node, xhtml = '') {
  const element = toArray(node).find(
    (candidate) => typeof candidate === 'string' || isElement(candidate),
  );
  if (element === undefined) return '';
  if (typeof element === 'string') return escapeHtml(element);
  const type = attribute(element, 'type')?.toLowerCase() ?? 'text';
  if (type === 'html') return textOf(element);
  if (type === 'xhtml') return xhtml;
  return escapeHtml(textOf(element)); // media types we cannot render stay inert text
}

/** Object-mode XML merges mixed text and moves it around inline elements. Only Atom XHTML
 * needs an ordered pass; ordinary RSS/escaped HTML keeps the cheaper single parse. */
function orderedXhtml(xml, rootName, prefix, items) {
  const fields = ['content', 'summary'];
  if (
    !items.some((item) =>
      fields.some(
        (field) => attribute(child(item, field, prefix), 'type')?.toLowerCase() === 'xhtml',
      ),
    )
  )
    return [];
  const root = ORDERED_PARSER.parse(xml).find((node) => Object.hasOwn(node, rootName));
  const entryKey = prefix ? `${prefix}:entry` : 'entry';
  return root[rootName]
    .filter((node) => Object.hasOwn(node, entryKey) || Object.hasOwn(node, 'entry'))
    .filter(
      (node) =>
        node[':@'] ||
        (node[entryKey] ?? node.entry).some((part) =>
          Object.keys(part).some((key) => key !== '#text'),
        ),
    )
    .map((node) => {
      const children = node[entryKey] ?? node.entry;
      return Object.fromEntries(
        fields.map((field) => {
          const key = prefix ? `${prefix}:${field}` : field;
          const part = children.find(
            (candidate) => Object.hasOwn(candidate, key) || Object.hasOwn(candidate, field),
          );
          return [field, part ? XHTML_BUILDER.build(part[key] ?? part[field]) : ''];
        }),
      );
    });
}

function makeEntry({
  rawId,
  rawTitle,
  url,
  rawAuthor,
  publishedAt,
  contentKind,
  bodyHtml,
  summarySource,
}) {
  const title = normalizeTitle(textOf(rawTitle));
  const content = truncateUtf8(bodyHtml, LIMITS.contentBytes);
  const summary = truncateUtf8(summarySource, LIMITS.summaryBytes);
  return {
    externalId: makeExternalId(rawId, url, title, publishedAt),
    title,
    url,
    author: normalizeAuthor(rawAuthor),
    publishedAt,
    contentKind,
    contentHtml: content.value,
    summaryHtml: summary.value,
    truncated: content.truncated, // a clipped summary preview is not a clipped body
  };
}

/** A guid/id is an identifier, never a link: only <link>/<atom:link> can produce an entry URL. */
function makeExternalId(rawId, url, title, publishedAt) {
  const id = textOf(rawId);
  if (id !== '') {
    // Over-long ids are hashed rather than truncated, so distinct ids cannot collide.
    return Buffer.byteLength(id, 'utf8') <= MAX_ID_BYTES ? id : `sha256:${sha256(id)}`;
  }
  return `fallback:${sha256(JSON.stringify([url, title, publishedAt]))}`;
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Newest first for dated entries, undated ones keep their document order; both are stable. */
function sortByPublishedAt(entries) {
  const dated = [];
  const undated = [];
  entries.forEach((entry, index) =>
    (entry.publishedAt === null ? undated : dated).push({ entry, index }),
  );
  dated.sort((a, b) => b.entry.publishedAt - a.entry.publishedAt || a.index - b.index);
  return [...dated, ...undated].map(({ entry }) => entry);
}

function firstDate(...values) {
  for (const value of values) {
    const text = textOf(value).trim();
    if (text === '') continue;
    const milliseconds = Date.parse(text);
    if (Number.isFinite(milliseconds)) return milliseconds; // an unparsable date stays null
  }
  return null;
}

/**
 * Resolve one link against the document's bases: item xml:base, then feed xml:base, then the
 * subscription URL. Anything but a plain http(s) URL without credentials or control characters is
 * dropped, and the subscription URL itself is never returned as a link.
 */
function resolveHttpUrl(raw, base) {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (value === '' || CONTROL_CHARACTERS.test(value)) return null;
  const url = parseHttpUrl(value, base);
  if (url === null) return null;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (CONTROL_CHARACTERS.test(url.href)) return null;
  return url.href;
}

/** An unusable base (a malformed subscription URL) must not discard an otherwise absolute link. */
function parseHttpUrl(value, base) {
  for (const candidate of base === undefined ? [undefined] : [base, undefined]) {
    try {
      return new URL(value, candidate);
    } catch {
      // a relative value without a usable base is not resolvable; try the next candidate
    }
  }
  return null;
}

function feedBaseOf(root, element, feedUrl) {
  const rootBase = resolveHttpUrl(attribute(root.value, 'xml:base'), feedUrl) ?? feedUrl;
  return element === root.value
    ? rootBase
    : (resolveHttpUrl(attribute(element, 'xml:base'), rootBase) ?? rootBase);
}

/** RSS <link> holds text; some feeds wrap it as <link href="..."/> or an atom:link style element. */
function hrefOf(node) {
  const element = toArray(node)[0];
  if (typeof element === 'string') return element;
  if (!isElement(element)) return '';
  return attribute(element, 'href') ?? textOf(element);
}

/** Atom prefers rel="alternate", then a link with no rel at all; rel="self"/"enclosure" are not entry links. */
function atomLinkHref(links) {
  const candidates = links.filter(isElement);
  const alternate = candidates.filter(
    (link) => (attribute(link, 'rel') ?? '').toLowerCase() === 'alternate',
  );
  const noRel = candidates.filter((link) => attribute(link, 'rel') === null);
  const preferred = alternate.length > 0 ? alternate : noRel;
  const html = preferred.find((link) => isHtmlLinkType(attribute(link, 'type')));
  return attribute(html ?? preferred[0], 'href') ?? '';
}

function isHtmlLinkType(type) {
  return type === null || type.toLowerCase() === 'text/html';
}

/**
 * Snip a string to a byte budget without splitting a codepoint: continuation bytes (10xxxxxx) are
 * walked back over, which also excludes the lead byte they belong to.
 */
function truncateUtf8(text, maxBytes) {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length <= maxBytes) return { value: text, truncated: false };
  let end = maxBytes;
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return { value: bytes.subarray(0, end).toString('utf8'), truncated: true };
}

function normalizeTitle(rawTitle) {
  const title = textOf(rawTitle).trim();
  return title === '' ? '无标题' : clampCharacters(title, MAX_TITLE_CHARACTERS);
}

function normalizeAuthor(rawAuthor) {
  const author = textOf(rawAuthor).trim();
  return author === '' ? null : clampCharacters(author, MAX_AUTHOR_CHARACTERS);
}

function clampCharacters(text, max) {
  const characters = Array.from(text); // split by codepoint so surrogate pairs stay intact
  return characters.length <= max ? text : characters.slice(0, max).join('');
}

/** Node-side escaping of Atom text content, not HTML sanitizing: the client still sanitizes. */
function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Text of an element, including the nested #text the parser produces for mixed content. */
function textOf(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.length > 0 ? textOf(node[0]) : '';
  if (isElement(node) && '#text' in node) return textOf(node['#text']);
  return '';
}

function rawString(node) {
  const text = textOf(node);
  return text.trim() === '' ? null : text;
}

function attribute(node, name) {
  if (!isElement(node)) return null;
  const value = node[`@_${name}`];
  return typeof value === 'string' ? value : null;
}

function declaredNamespace(name, node) {
  const colon = name.indexOf(':');
  return attribute(node, colon === -1 ? 'xmlns' : `xmlns:${name.slice(0, colon)}`);
}

function isElement(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
