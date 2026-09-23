/**
 * Feed parsing contract. Every fixture here is synthesized in this file: no real site is contacted
 * and no captured feed body is stored. Each assertion states a rule the reader depends on, so a
 * failing assertion is the finding rather than something to relax.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { LIMITS, ReaderError } from '../server/reader/model.mjs';
import { parseFeed } from '../server/reader/feeds.mjs';

const FEED_URL = 'https://feeds.example.net/subscribe.xml';
const ATOM_NAMESPACE = 'http://www.w3.org/2005/Atom';

type ParsedEntry = {
  externalId: string;
  title: string;
  url: string | null;
  author: string | null;
  publishedAt: number | null;
  contentKind: 'content' | 'summary';
  contentHtml: string;
  summaryHtml: string;
  truncated: boolean;
};
type ParsedFeed = { title: string; siteUrl: string | null; entries: ParsedEntry[] };

function parse(document: string, feedUrl = FEED_URL): ParsedFeed {
  return parseFeed(document, feedUrl) as ParsedFeed;
}

function expectFailure(run: () => unknown, code: string, status: number): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof ReaderError, `expected a ReaderError, received ${String(error)}`);
    const failure = error as { code?: string; status?: number };
    assert.equal(failure.code, code);
    assert.equal(failure.status, status);
    return true;
  });
}

function rssDocument(items: string, channel = ''): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"' +
    ' xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    `<channel><title>Example Feed</title><link>https://example.org/blog/</link>${channel}${items}</channel></rss>`
  );
}

function rssItem(fields: string): string {
  return `<item>${fields}</item>`;
}

function atomDocument(entries: string, feedAttributes = `xmlns="${ATOM_NAMESPACE}"`): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<feed ${feedAttributes}><title>Atom Sample</title>` +
    '<link rel="alternate" type="text/html" href="https://example.org/"/>' +
    `<link rel="self" href="${FEED_URL}"/>${entries}</feed>`
  );
}

/** A feed whose only variable part is an ASCII body of an exact byte length. */
function rssWithBodyBytes(targetBytes: number): string {
  const head =
    '<?xml version="1.0"?><rss version="2.0"><channel><title>T</title><item><title>I</title><description>';
  const tail = '</description></item></channel></rss>';
  const document = head + 'a'.repeat(targetBytes - head.length - tail.length) + tail;
  assert.equal(Buffer.byteLength(document, 'utf8'), targetBytes);
  return document;
}

test('parses an RSS item into the documented entry shape', () => {
  const document = rssDocument(
    rssItem(
      '<title>Second post</title><link>https://example.org/p/2</link>' +
        '<guid isPermaLink="false">tag:example.org,2024:2</guid>' +
        '<dc:creator>Alice</dc:creator>' +
        '<pubDate>Mon, 02 Jan 2006 15:04:05 GMT</pubDate>' +
        '<content:encoded><![CDATA[<p>Body</p>]]></content:encoded>' +
        '<description>Short description</description>',
    ),
  );
  assert.deepEqual(parse(document), {
    title: 'Example Feed',
    siteUrl: 'https://example.org/blog/',
    entries: [
      {
        externalId: 'tag:example.org,2024:2',
        title: 'Second post',
        url: 'https://example.org/p/2',
        author: 'Alice',
        publishedAt: Date.UTC(2006, 0, 2, 15, 4, 5),
        contentKind: 'content',
        contentHtml: '<p>Body</p>',
        summaryHtml: 'Short description',
        truncated: false,
      },
    ],
  });
});

test('treats an empty or attribute-only content:encoded as absent', () => {
  const document = rssDocument(
    rssItem(
      '<title>blank</title><guid>a</guid><content:encoded>   </content:encoded><description>from description</description>',
    ) +
      rssItem(
        '<title>attrs</title><guid>b</guid><content:encoded xmlns:x="urn:x"></content:encoded><description>also description</description>',
      ),
  );
  assert.deepEqual(
    parse(document).entries.map((entry) => [
      entry.externalId,
      entry.contentKind,
      entry.contentHtml,
    ]),
    [
      ['a', 'summary', 'from description'],
      ['b', 'summary', 'also description'],
    ],
  );
});

test('falls back to the description for the body when content:encoded is missing', () => {
  const entry = parse(
    rssDocument(
      rssItem(
        '<title>only description</title><guid>a</guid><description>just a description</description>',
      ),
    ),
  ).entries[0];
  assert.equal(entry.contentKind, 'summary');
  assert.equal(entry.contentHtml, 'just a description');
  assert.equal(entry.summaryHtml, 'just a description');
  assert.equal(entry.truncated, false);
});

test('normalizes single and repeated items into one list', () => {
  assert.equal(parse(rssDocument(rssItem('<title>only</title><guid>a</guid>'))).entries.length, 1);
  const two = parse(
    rssDocument(
      rssItem('<title>one</title><guid>a</guid>') + rssItem('<title>two</title><guid>b</guid>'),
    ),
  );
  assert.deepEqual(
    two.entries.map((entry) => entry.externalId),
    ['a', 'b'],
  );
});

test('keeps escaped text and CDATA bodies as untrusted HTML strings', () => {
  const document = rssDocument(
    rssItem(
      '<title>escaped</title><guid>a</guid><description>&lt;p&gt;escaped &amp; text&lt;/p&gt;</description>',
    ) +
      rssItem(
        '<title>cdata</title><guid>b</guid><description><![CDATA[<p>literal & raw</p>]]></description>',
      ),
  );
  const { entries } = parse(document);
  assert.deepEqual(
    entries.map((entry) => [entry.contentKind, entry.contentHtml]),
    [
      ['summary', '<p>escaped & text</p>'],
      ['summary', '<p>literal & raw</p>'],
    ],
  );
});

test('uses 无标题 for missing titles and clamps titles to 300 characters', () => {
  const document = rssDocument(
    rssItem('<title>   </title><guid>a</guid>') +
      rssItem(`<title>${'x'.repeat(400)}</title><guid>b</guid>`) +
      rssItem('<guid>c</guid>') +
      rssItem(`<title>${'😀'.repeat(320)}</title><guid>d</guid>`),
  );
  const { entries } = parse(document);
  assert.equal(entries[0].title, '无标题');
  assert.equal(entries[1].title, 'x'.repeat(300));
  assert.equal(entries[2].title, '无标题');
  assert.equal(entries[3].title, '😀'.repeat(300));
  assert.equal([...entries[3].title].length, 300);
});

test('uses 无标题 when the feed itself has no title', () => {
  const feed = parse(
    '<?xml version="1.0"?><rss version="2.0"><channel><link>https://example.org/</link></channel></rss>',
  );
  assert.equal(feed.title, '无标题');
});

test('reads plain text from a nested #text title and keeps markup out of it', () => {
  const atom = parse(
    atomDocument(
      '<entry><id>e1</id><title type="text">Plain &amp; simple</title><content>c</content></entry>',
    ),
  ).entries[0];
  assert.equal(atom.title, 'Plain & simple');
  const rss = parse(rssDocument(rssItem('<title>A <b>x</b> tail</title><guid>a</guid>')))
    .entries[0];
  // The XML parser merges the text nodes of mixed content; the nested element is not title text.
  assert.equal(rss.title, 'Atail');
  assert.equal(rss.title.includes('<b>'), false);
});

test('reads the RSS author, falls back to dc:creator and clamps long values', () => {
  const document = rssDocument(
    rssItem(
      '<title>a</title><guid>a</guid><author>Rss Author</author><dc:creator>Dc Creator</dc:creator>',
    ) +
      rssItem('<title>b</title><guid>b</guid><dc:creator>Only Creator</dc:creator>') +
      rssItem('<title>c</title><guid>c</guid><author>   </author>') +
      rssItem(`<title>d</title><guid>d</guid><author>${'N'.repeat(250)}</author>`),
  );
  assert.deepEqual(
    parse(document).entries.map((entry) => entry.author),
    ['Rss Author', 'Only Creator', null, 'N'.repeat(200)],
  );
});

test('reads the Atom author name and keeps only the first author', () => {
  const document = atomDocument(
    '<entry><id>e1</id><title>t</title><author><name>Bob</name><email>b@example.org</email></author><content>c</content></entry>' +
      '<entry><id>e2</id><title>t</title><author><name>First</name></author><author><name>Second</name></author><content>c</content></entry>' +
      '<entry><id>e3</id><title>t</title><content>c</content></entry>',
  );
  assert.deepEqual(
    parse(document).entries.map((entry) => entry.author),
    ['Bob', 'First', null],
  );
});

test('parses pubDate into milliseconds and falls back to dc:date', () => {
  const document = rssDocument(
    rssItem(
      '<title>pubDate</title><guid>a</guid><pubDate>Mon, 02 Jan 2006 15:04:05 GMT</pubDate><dc:date>2020-01-01T00:00:00Z</dc:date>',
    ) + rssItem('<title>dc:date</title><guid>b</guid><dc:date>2020-01-01T00:00:00Z</dc:date>'),
  );
  const byId = new Map(parse(document).entries.map((entry) => [entry.externalId, entry]));
  assert.equal(byId.get('a')?.publishedAt, Date.UTC(2006, 0, 2, 15, 4, 5));
  assert.equal(byId.get('b')?.publishedAt, Date.UTC(2020, 0, 1));
});

test('prefers Atom published over updated and accepts updated alone', () => {
  const document = atomDocument(
    '<entry><id>e1</id><title>both</title><published>2024-05-01T10:00:00Z</published><updated>2024-06-01T00:00:00Z</updated><content>c</content></entry>' +
      '<entry><id>e2</id><title>updated only</title><updated>2024-04-01T00:00:00Z</updated><content>c</content></entry>',
  );
  const byId = new Map(parse(document).entries.map((entry) => [entry.externalId, entry]));
  assert.equal(byId.get('e1')?.publishedAt, Date.UTC(2024, 4, 1, 10));
  assert.equal(byId.get('e2')?.publishedAt, Date.UTC(2024, 3, 1));
});

test('returns null for missing or unparsable dates instead of the current time', () => {
  const document = rssDocument(
    rssItem('<title>none</title><guid>a</guid>') +
      rssItem('<title>empty</title><guid>b</guid><pubDate></pubDate>') +
      rssItem('<title>words</title><guid>c</guid><pubDate>not a date</pubDate>') +
      rssItem(
        '<title>impossible</title><guid>d</guid><pubDate>Mon, 32 Foo 9999 99:99:99 GMT</pubDate>',
      ),
  );
  assert.deepEqual(
    parse(document).entries.map((entry) => entry.publishedAt),
    [null, null, null, null],
  );
});

test('sorts dated entries newest first, keeps undated ones in document order and is stable on ties', () => {
  const document = rssDocument(
    rssItem('<title>i1</title><guid>i1</guid><pubDate>2024-01-03T00:00:00Z</pubDate>') +
      rssItem('<title>i2</title><guid>i2</guid>') +
      rssItem('<title>i3</title><guid>i3</guid><pubDate>2024-01-01T00:00:00Z</pubDate>') +
      rssItem('<title>i4</title><guid>i4</guid>') +
      rssItem('<title>i5</title><guid>i5</guid><pubDate>2024-01-02T00:00:00Z</pubDate>') +
      rssItem('<title>i6</title><guid>i6</guid><pubDate>2024-01-02T00:00:00Z</pubDate>'),
  );
  assert.deepEqual(
    parse(document).entries.map((entry) => entry.externalId),
    ['i1', 'i5', 'i6', 'i3', 'i2', 'i4'],
  );
});

test('keeps guid text as externalId and hashes ids over the byte budget without collisions', () => {
  const overBudget = 'g'.repeat(2049);
  const document = rssDocument(
    rssItem(`<title>at budget</title><guid>${'g'.repeat(2048)}</guid>`) +
      rssItem(`<title>over budget</title><guid>${overBudget}</guid>`) +
      rssItem(`<title>other</title><guid>${'h'.repeat(2049)}</guid>`) +
      rssItem(`<title>wide</title><guid>${'中'.repeat(700)}</guid>`),
  );
  const { entries } = parse(document);
  assert.equal(entries[0].externalId, 'g'.repeat(2048));
  assert.equal(
    entries[1].externalId,
    `sha256:${createHash('sha256').update(overBudget, 'utf8').digest('hex')}`,
  );
  // Digesting the whole value instead of a 2048-byte prefix is what keeps distinct ids distinct.
  assert.notEqual(
    entries[1].externalId,
    `sha256:${createHash('sha256').update('g'.repeat(2048), 'utf8').digest('hex')}`,
  );
  assert.notEqual(entries[1].externalId, entries[2].externalId);
  // 700 characters but 2100 bytes: the budget is measured in bytes.
  assert.match(entries[3].externalId, /^sha256:[0-9a-f]{64}$/);
});

test('builds a stable fallback id from url, title and publishedAt', () => {
  const item = rssItem(
    '<title>No id</title><link>https://example.org/n</link><pubDate>2024-02-02T00:00:00Z</pubDate><description>body</description>',
  );
  const first = parse(rssDocument(item)).entries[0];
  const second = parse(rssDocument(item)).entries[0];
  assert.match(first.externalId, /^fallback:[0-9a-f]{64}$/);
  assert.equal(first.externalId, second.externalId);

  // The same link with another title must not collapse into one link-only identity.
  const shared = parse(
    rssDocument(
      item +
        rssItem(
          '<title>Another</title><link>https://example.org/n</link><pubDate>2024-02-02T00:00:00Z</pubDate>',
        ),
    ),
  ).entries;
  assert.equal(shared.length, 2);
  assert.notEqual(shared[0].externalId, shared[1].externalId);
});

test('keeps the last record when one document repeats an externalId', () => {
  const document = rssDocument(
    rssItem('<title>First</title><guid>same</guid><description>first body</description>') +
      rssItem('<title>Last</title><guid>same</guid><description>last body</description>'),
  );
  const { entries } = parse(document);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'Last');
  assert.equal(entries[0].contentHtml, 'last body');
});

test('keeps two entries that share a link but differ in guid', () => {
  const document = rssDocument(
    rssItem('<title>One</title><link>https://example.org/same</link><guid>g1</guid>') +
      rssItem('<title>Two</title><link>https://example.org/same</link><guid>g2</guid>'),
  );
  const { entries } = parse(document);
  assert.deepEqual(
    entries.map((entry) => [entry.externalId, entry.url]),
    [
      ['g1', 'https://example.org/same'],
      ['g2', 'https://example.org/same'],
    ],
  );
});

test('never uses a guid as a link and never exposes the subscription URL', () => {
  const document = rssDocument(
    rssItem(
      '<title>permalink</title><guid isPermaLink="true">https://example.org/from-guid</guid>',
    ) +
      rssItem(
        '<title>not a permalink</title><guid isPermaLink="false">tag:example.org,2024:1</guid>',
      ) +
      rssItem('<title>no link</title><guid>plain-id</guid>'),
  );
  const { entries } = parse(document);
  assert.deepEqual(
    entries.map((entry) => entry.url),
    [null, null, null],
  );
  assert.equal(
    entries.some((entry) => entry.url === FEED_URL),
    false,
  );
});

test('resolves relative links against item xml:base, then feed xml:base, then the feed URL', () => {
  const document =
    '<?xml version="1.0"?><rss version="2.0" xml:base="https://inherited.example.org/root/">' +
    '<channel xml:base="https://channel.example.org/base/"><title>Bases</title><link>blog/</link>' +
    '<item xml:base="https://item.example.org/i/"><title>item</title><guid>a</guid><link>post/1</link></item>' +
    '<item><title>channel</title><guid>b</guid><link>post/2</link></item>' +
    '</channel></rss>';
  const { entries, siteUrl } = parse(document);
  assert.equal(siteUrl, 'https://channel.example.org/base/blog/');
  assert.deepEqual(
    entries.map((entry) => entry.url),
    ['https://item.example.org/i/post/1', 'https://channel.example.org/base/post/2'],
  );

  const rootBase =
    '<?xml version="1.0"?><rss version="2.0" xml:base="https://root.example.org/r/"><channel><title>B</title>' +
    '<item><title>t</title><guid>d</guid><link>post/3</link></item></channel></rss>';
  assert.equal(parse(rootBase).entries[0].url, 'https://root.example.org/r/post/3');

  const plain =
    '<?xml version="1.0"?><rss version="2.0"><channel><title>B</title>' +
    '<item><title>t</title><guid>e</guid><link>/post/4</link></item></channel></rss>';
  assert.equal(parse(plain).entries[0].url, 'https://feeds.example.net/post/4');
});

test('rejects links that are not plain http(s), carry credentials or contain control characters', () => {
  const links = [
    'javascript:alert(1)',
    'data:text/html,&lt;x&gt;',
    'file:///etc/passwd',
    'ftp://example.org/file',
    'http://user:secret@example.org/private',
    'http://user@example.org/private',
    'http://example.org/a\tb',
  ];
  const document = rssDocument(
    links
      .map((link, index) =>
        rssItem(`<title>l${index}</title><guid>g${index}</guid><link>${link}</link>`),
      )
      .join(''),
  );
  assert.deepEqual(
    parse(document).entries.map((entry) => entry.url),
    links.map(() => null),
  );
  // A legal link with parameters is kept: only the subscription URL must stay private.
  const fine = parse(
    rssDocument(
      rssItem('<title>ok</title><guid>ok</guid><link>https://example.org/fine?q=1</link>'),
    ),
  );
  assert.equal(fine.entries[0].url, 'https://example.org/fine?q=1');
});

test('resolves absolute links even when the subscription URL is unusable', () => {
  const document = rssDocument(
    rssItem('<title>absolute</title><guid>a</guid><link>https://example.org/abs</link>') +
      rssItem('<title>relative</title><guid>b</guid><link>rel/path</link>'),
  );
  const { entries } = parse(document, 'not a url');
  assert.equal(entries[0].url, 'https://example.org/abs');
  assert.equal(entries[1].url, null);
});

test('prefers Atom rel=alternate links, ignores rel=self and accepts a link without rel', () => {
  const document = atomDocument(
    '<entry><id>e1</id><title>many</title>' +
      '<link rel="self" href="https://example.org/self"/>' +
      '<link rel="alternate" type="application/json" href="https://example.org/json"/>' +
      '<link rel="alternate" type="text/html" href="https://example.org/html"/>' +
      '<content>c</content></entry>' +
      '<entry><id>e2</id><title>no rel</title><link type="text/html" href="https://example.org/norel"/><content>c</content></entry>' +
      '<entry><id>e3</id><title>only self</title><link rel="self" href="https://example.org/self2"/><content>c</content></entry>' +
      '<entry><id>e4</id><title>uppercase</title><link rel="ALTERNATE" href="https://example.org/upper"/><content>c</content></entry>',
  );
  assert.deepEqual(
    parse(document).entries.map((entry) => entry.url),
    ['https://example.org/html', 'https://example.org/norel', null, 'https://example.org/upper'],
  );
});

test('reads the feed siteUrl and returns null when it is missing or invalid', () => {
  assert.equal(parse(atomDocument('')).siteUrl, 'https://example.org/');
  const invalid = parse(
    '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>javascript:alert(1)</link></channel></rss>',
  );
  assert.equal(invalid.siteUrl, null);
  const missing = parse(
    '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>',
  );
  assert.equal(missing.siteUrl, null);
});

test('parses Atom content by type: html passes through while other types are escaped', () => {
  const document = atomDocument(
    '<entry><id>html</id><title>h</title><content type="html">&lt;p&gt;raw &amp; untrusted&lt;/p&gt;</content></entry>' +
      '<entry><id>text</id><title>t</title><content type="text">a &amp; b &lt;c&gt;</content></entry>' +
      '<entry><id>default</id><title>d</title><content>plain &amp; only</content></entry>' +
      '<entry><id>unknown</id><title>u</title><content type="application/xml">&lt;script&gt;x&lt;/script&gt;</content></entry>',
  );
  assert.deepEqual(
    parse(document).entries.map((entry) => [entry.contentKind, entry.contentHtml]),
    [
      ['content', '<p>raw & untrusted</p>'],
      ['content', 'a &amp; b &lt;c&gt;'],
      ['content', 'plain &amp; only'],
      ['content', '&lt;script&gt;x&lt;/script&gt;'],
    ],
  );
});

test('re-serializes xhtml content without the outer Atom namespace', () => {
  const document = atomDocument(
    '<entry><id>e1</id><title>x</title>' +
      '<content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>hi &amp; bye</p><br/><a href="/x">link</a></div></content>' +
      '</entry>' +
      `<entry><id>e2</id><title>wrapped</title><content type="xhtml" xmlns="${ATOM_NAMESPACE}"><div><p>wrapped</p></div></content></entry>`,
  );
  const { entries } = parse(document);
  const built = entries[0];
  assert.equal(built.contentKind, 'content');
  assert.equal(built.contentHtml.includes(ATOM_NAMESPACE), false);
  assert.equal(built.contentHtml.includes('type="xhtml"'), false);
  assert.match(built.contentHtml, /^<div/);
  assert.equal(built.contentHtml.includes('<p>hi &amp; bye</p>'), true);
  assert.equal(built.contentHtml.includes('<a href="/x">link</a>'), true);
  assert.equal(entries[1].contentHtml.includes(ATOM_NAMESPACE), false);
  assert.equal(entries[1].contentHtml.includes('<p>wrapped</p>'), true);
});

test('parses a fully prefixed Atom feed', () => {
  const document =
    `<?xml version="1.0"?><atom:feed xmlns:atom="${ATOM_NAMESPACE}">` +
    '<atom:title>Prefixed</atom:title><atom:link rel="alternate" href="https://prefixed.example.org/"/>' +
    '<atom:entry><atom:id>urn:uuid:p1</atom:id><atom:title>One</atom:title>' +
    '<atom:link href="https://prefixed.example.org/one"/><atom:author><atom:name>Zed</atom:name></atom:author>' +
    '<atom:updated>2024-03-03T00:00:00Z</atom:updated><atom:content type="text">t &amp; u</atom:content></atom:entry>' +
    '</atom:feed>';
  assert.deepEqual(parse(document), {
    title: 'Prefixed',
    siteUrl: 'https://prefixed.example.org/',
    entries: [
      {
        externalId: 'urn:uuid:p1',
        title: 'One',
        url: 'https://prefixed.example.org/one',
        author: 'Zed',
        publishedAt: Date.UTC(2024, 2, 3),
        contentKind: 'content',
        contentHtml: 't &amp; u',
        summaryHtml: 't &amp; u',
        truncated: false,
      },
    ],
  });
});

test('does not mistake media:content for Atom content', () => {
  const document =
    `<?xml version="1.0"?><feed xmlns="${ATOM_NAMESPACE}" xmlns:media="http://search.yahoo.com/mrss/">` +
    '<title>M</title><entry><id>i1</id><title>T</title><link href="https://media.example.org/1"/>' +
    '<media:content url="https://media.example.org/i.png" type="image/png"/>' +
    '<summary>from summary</summary></entry></feed>';
  const entry = parse(document).entries[0];
  assert.equal(entry.contentKind, 'summary');
  assert.equal(entry.contentHtml, 'from summary');
});

test('uses the summary when Atom content is absent or empty', () => {
  const document = atomDocument(
    '<entry><id>e1</id><title>summary only</title><summary>only a summary</summary></entry>' +
      '<entry><id>e2</id><title>empty content</title><content type="text"></content><summary>fallback</summary></entry>',
  );
  assert.deepEqual(
    parse(document).entries.map((entry) => [
      entry.contentKind,
      entry.contentHtml,
      entry.summaryHtml,
    ]),
    [
      ['summary', 'only a summary', 'only a summary'],
      ['summary', 'fallback', 'fallback'],
    ],
  );

  const bare = parse(atomDocument('<entry><id>e3</id><title>bare</title></entry>')).entries[0];
  assert.equal(bare.contentKind, 'summary');
  assert.equal(bare.contentHtml, '');
  assert.equal(bare.summaryHtml, '');
});

test('accepts an Atom feed that declares no namespace', () => {
  const document =
    '<?xml version="1.0"?><feed><title>No namespace</title><entry><id>e1</id><title>t</title><content>c</content></entry></feed>';
  assert.equal(parse(document).entries[0].externalId, 'e1');
});

test('keeps an empty but valid RSS feed', () => {
  assert.deepEqual(parse(rssDocument('')), {
    title: 'Example Feed',
    siteUrl: 'https://example.org/blog/',
    entries: [],
  });
});

test('keeps an empty but valid Atom feed', () => {
  const feed = parse(atomDocument(''));
  assert.equal(feed.title, 'Atom Sample');
  assert.equal(feed.siteUrl, 'https://example.org/');
  assert.deepEqual(feed.entries, []);
});

test('rejects a DOCTYPE with entity declarations instead of expanding entities', () => {
  const internal =
    '<?xml version="1.0"?><!DOCTYPE rss [<!ENTITY boom "EXPANDED">]>' +
    '<rss version="2.0"><channel><title>&boom;</title></channel></rss>';
  expectFailure(() => parse(internal), 'UNSAFE_XML', 422);

  const external =
    '<?xml version="1.0"?><!DOCTYPE rss SYSTEM "https://evil.example.org/x.dtd"><rss version="2.0"><channel><title>t</title></channel></rss>';
  expectFailure(() => parse(external), 'UNSAFE_XML', 422);

  const lowercase =
    '<?xml version="1.0"?><!doctype rss><rss version="2.0"><channel><title>t</title></channel></rss>';
  expectFailure(() => parse(lowercase), 'UNSAFE_XML', 422);
});

test('rejects a bare ENTITY declaration', () => {
  const document =
    '<?xml version="1.0"?><rss version="2.0"><!ENTITY boom "x"><channel><title>t</title></channel></rss>';
  expectFailure(() => parse(document), 'UNSAFE_XML', 422);
});

test('accepts documents that merely mention a doctype inside CDATA or a comment', () => {
  const document = rssDocument(
    rssItem(
      '<title>body</title><guid>a</guid><description><![CDATA[<!DOCTYPE html><html><body>kept</body></html>]]></description>',
    ),
    '<!-- <!DOCTYPE rss> -->',
  );
  assert.equal(
    parse(document).entries[0].contentHtml,
    '<!DOCTYPE html><html><body>kept</body></html>',
  );
});

test('rejects malformed XML and non-XML documents as INVALID_XML', () => {
  expectFailure(() => parse('<rss><channel><title>t</channel></rss>'), 'INVALID_XML', 422);
  expectFailure(() => parse('hello world'), 'INVALID_XML', 422);
  expectFailure(() => parse('{"title":"json"}'), 'INVALID_XML', 422);
});

test('rejects a well-formed web page as INVALID_FEED instead of returning an empty feed', () => {
  expectFailure(() => parse('<html><body><p>hi</p></body></html>'), 'INVALID_FEED', 422);
});

test('rejects RSS without a channel, RSS 1.0 and Atom 0.3 as INVALID_FEED', () => {
  expectFailure(
    () => parse('<?xml version="1.0"?><rss version="2.0"><title>t</title></rss>'),
    'INVALID_FEED',
    422,
  );
  const rss10 =
    '<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel><title>t</title></channel></rdf:RDF>';
  expectFailure(() => parse(rss10), 'INVALID_FEED', 422);
  expectFailure(
    () =>
      parse('<?xml version="1.0"?><feed xmlns="http://purl.org/atom/ns#"><title>t</title></feed>'),
    'INVALID_FEED',
    422,
  );
});

test('rejects a non-string argument', () => {
  expectFailure(() => parseFeed(null as unknown as string, FEED_URL), 'INVALID_XML', 422);
  expectFailure(
    () => parseFeed(Buffer.from('<rss version="2.0"/>') as unknown as string, FEED_URL),
    'INVALID_XML',
    422,
  );
});

test('rejects a document above the response budget and accepts one exactly at it', () => {
  const atBudget = parse(rssWithBodyBytes(LIMITS.responseBytes)).entries[0];
  assert.equal(atBudget.truncated, true);
  assert.equal(Buffer.byteLength(atBudget.contentHtml, 'utf8'), LIMITS.contentBytes);
  expectFailure(() => parse(rssWithBodyBytes(LIMITS.responseBytes + 1)), 'FEED_TOO_LARGE', 413);
});

test('clips content on a codepoint boundary at the 64 KiB budget', () => {
  const threeByte = parse(
    rssDocument(
      rssItem(`<title>t</title><guid>g</guid><description>${'中'.repeat(21846)}</description>`),
    ),
  ).entries[0];
  assert.equal(threeByte.truncated, true);
  assert.equal(Buffer.byteLength(threeByte.contentHtml, 'utf8'), LIMITS.contentBytes - 1);
  assert.equal([...threeByte.contentHtml].length, 21845);
  assert.equal(threeByte.contentHtml.endsWith('中'), true);
  assert.equal(threeByte.contentHtml.includes('�'), false);

  const fourByte = parse(
    rssDocument(
      rssItem(`<title>t</title><guid>g</guid><description>${'😀'.repeat(16384)}</description>`),
    ),
  ).entries[0];
  assert.equal(fourByte.truncated, false);
  assert.equal(Buffer.byteLength(fourByte.contentHtml, 'utf8'), LIMITS.contentBytes);
  assert.equal(
    [...fourByte.contentHtml].every((character) => character === '😀'),
    true,
  );
});

test('clips summaryHtml to its own budget without flagging the body as truncated', () => {
  const atBudget = parse(
    rssDocument(
      rssItem(`<title>t</title><guid>g</guid><description>${'é'.repeat(1024)}</description>`),
    ),
  ).entries[0];
  assert.equal(Buffer.byteLength(atBudget.summaryHtml, 'utf8'), LIMITS.summaryBytes);
  assert.equal(atBudget.truncated, false);

  const clipped = parse(
    rssDocument(
      rssItem(`<title>t</title><guid>g</guid><description>${'中'.repeat(683)}</description>`),
    ),
  ).entries[0];
  assert.equal(Buffer.byteLength(clipped.summaryHtml, 'utf8'), LIMITS.summaryBytes - 2);
  assert.equal(clipped.summaryHtml.endsWith('中'), true);
  assert.equal(Buffer.byteLength(clipped.contentHtml, 'utf8'), 2049);
  assert.equal(clipped.summaryHtml === clipped.contentHtml, false);
  assert.equal(clipped.truncated, false);
});

test('keeps at most LIMITS.feedEntries entries, newest first', () => {
  const items = Array.from({ length: LIMITS.feedEntries + 5 }, (_, index) =>
    rssItem(
      `<title>Post ${index + 1}</title><link>https://example.org/p/${index + 1}</link><guid>g${index + 1}</guid>` +
        `<pubDate>${new Date(Date.UTC(2024, 0, 1 + index)).toISOString()}</pubDate>`,
    ),
  ).join('');
  const { entries } = parse(rssDocument(items));
  assert.equal(entries.length, LIMITS.feedEntries);
  assert.equal(entries[0].externalId, 'g205');
  assert.equal(entries[LIMITS.feedEntries - 1].externalId, 'g6');
  assert.equal(
    entries.some((entry) => entry.externalId === 'g5'),
    false,
  );
});
