import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

/**
 * The reader's markup gate, exercised with the real jsdom DOM and the real DOMPurify build the
 * browser gets — not a stub of either. The checks below prove what the sanitizer and the link pass
 * remove, rewrite and keep: tags that request or execute, destinations that disguise themselves,
 * attributes that would let feed markup clobber or restyle the page, and the plain-text excerpt.
 *
 * This is a DOM in Node, never a browser: a green run says the purified fragment holds no dangerous
 * node or destination, not that a real browser rendered anything.
 */

/** jsdom ships no type declarations, so it is loaded dynamically and typed for what this file uses. */
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, options?: { url?: string }) => { window: Window & typeof globalThis };
};

const PAGE_URL = 'https://reader.test/reader/';

/**
 * One document for every case in this file. DOMPurify binds the window it sees when the module is
 * first imported, so the same document must serve the import and every later call.
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: PAGE_URL });

type ReaderContent = typeof import('../src/client/reader-content');

/** The globals the two functions need. DOMPurify reads `window`; both read `document`. */
const DOM_GLOBALS = ['window', 'document'] as const;

/** Installs the document's globals and returns the restore that puts the previous values back. */
function installDom(): () => void {
  const saved = DOM_GLOBALS.map(
    (key) => [key, (globalThis as Record<string, unknown>)[key]] as const,
  );
  for (const key of DOM_GLOBALS) {
    (globalThis as Record<string, unknown>)[key] = dom.window[key as keyof typeof dom.window];
  }
  return () => {
    for (const [key, value] of saved) {
      if (value === undefined) delete (globalThis as Record<string, unknown>)[key];
      else (globalThis as Record<string, unknown>)[key] = value;
    }
  };
}

let content!: ReaderContent;
{
  // The module must be imported while a DOM exists, exactly as a browser would load it.
  const restore = installDom();
  try {
    content = await import('../src/client/reader-content');
  } finally {
    restore();
  }
}

/** Runs one case with the DOM installed and always restores the globals afterwards. */
async function withDom(run: () => void | Promise<void>): Promise<void> {
  const restore = installDom();
  try {
    await run();
  } finally {
    restore();
  }
}

type Purified = {
  /** Serialized markup, for "this node survived" assertions. */
  html: string;
  /** Visible text, for "no script text leaked" assertions. */
  text: string;
  /** Each anchor's resulting destination, null when the link lost its href. */
  hrefs: (string | null)[];
  /** Anchors by attribute, to prove rel/target hardening. */
  anchors: { href: string | null; rel: string | null; target: string | null }[];
  /** The host element, for tag and attribute queries. */
  holder: HTMLElement;
};

/** Purifies one string and hands back everything the assertions need to look at. */
function purified(html: string, baseUrl = PAGE_URL): Purified {
  const fragment = content.safeFeedFragment(html, baseUrl);
  assert.ok(
    fragment instanceof dom.window.DocumentFragment,
    'safeFeedFragment must return a fragment',
  );
  const holder = dom.window.document.createElement('div');
  holder.append(fragment);
  const anchors = [...holder.querySelectorAll('a')].map((anchor) => ({
    href: anchor.getAttribute('href'),
    rel: anchor.getAttribute('rel'),
    target: anchor.getAttribute('target'),
  }));
  return {
    html: holder.innerHTML,
    text: holder.textContent ?? '',
    hrefs: anchors.map((anchor) => anchor.href),
    anchors,
    holder,
  };
}

test('without a DOM the sanitizer refuses to pass markup through', async () => {
  const root = await mkdtemp(join(tmpdir(), 'reader-content-'));
  try {
    const script = join(root, 'no-dom.mjs');
    // A fresh process with no window: DOMPurify would return the dirty string untouched here, which
    // is exactly the outcome the module promises never to hand a caller. The file is a plain ES
    // module outside the repository, so it has to carry its own module type; the `.ts` module under
    // test still loads through the same tsx loader the test run uses.
    await writeFile(
      script,
      [
        "import assert from 'node:assert/strict';",
        "assert.equal(typeof globalThis.window, 'undefined', 'the child must have no DOM');",
        `const { safeFeedFragment, feedExcerpt } = await import(${JSON.stringify(resolve('src/client/reader-content.ts'))});`,
        'const cases = [',
        "  () => safeFeedFragment('<script>alert(1)</script>', 'https://reader.test/'),",
        "  () => feedExcerpt('<p>hello</p>', 'https://reader.test/'),",
        '];',
        'for (const attempt of cases) assert.throws(attempt, /DOM/);',
        "console.log('refused');",
      ].join('\n'),
    );
    const result = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), script], {
      cwd: resolve('.'),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /refused/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('script, event handlers and every requesting or interactive tag are gone', async () => {
  await withDom(() => {
    const result = purified(`
      <script>alert('xss')</script>
      <p onclick="alert(1)" onmouseover="alert(2)">kept</p>
      <img src="https://tracker.test/pixel.gif" onerror="alert(3)">
      <picture><source srcset="https://tracker.test/s.png"></picture>
      <iframe src="https://evil.test/frame"></iframe>
      <form action="https://evil.test/post" method="post"><input name="secret"><button>go</button></form>
      <audio src="https://evil.test/a.mp3" autoplay></audio>
      <video src="https://evil.test/v.mp4" autoplay></video>
      <object data="https://evil.test/o.swf"></object>
      <embed src="https://evil.test/e.swf">
      <style>body { display: none }</style>
      <svg><circle r="1" /></svg>
      <math><mi>x</mi></math>
      <base href="https://evil.test/">
      <link rel="stylesheet" href="https://evil.test/s.css">
      <meta http-equiv="refresh" content="0;url=https://evil.test/">
    `);
    for (const tag of [
      'script',
      'img',
      'picture',
      'source',
      'iframe',
      'form',
      'input',
      'button',
      'audio',
      'video',
      'object',
      'embed',
      'style',
      'svg',
      'math',
      'base',
      'link',
      'meta',
    ]) {
      assert.equal(result.holder.querySelector(tag), null, `${tag} must not survive`);
    }
    // Nothing may arrive with a live event handler, whatever else survived.
    for (const element of result.holder.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        assert.ok(
          !attribute.name.startsWith('on'),
          `${element.tagName} kept event attribute ${attribute.name}`,
        );
      }
    }
    assert.match(result.text, /kept/);
    assert.doesNotMatch(result.text, /xss/, 'script text never becomes visible text');
  });
});

test('every disguised javascript or non-HTTP destination loses its href', async () => {
  await withDom(() => {
    const cases = [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      '  javascript:alert(1)',
      'java\tscript:alert(1)',
      '&#106;avascript:alert(1)',
      '&#x6a;avascript&#x3a;alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
      'mailto:someone@example.com',
      'tel:+10000000000',
      'file:///etc/passwd',
      'blob:https://reader.test/abc',
      'http://user:pass@evil.test/x',
      'https://user@evil.test/x',
      'https://ok.test/\u0001control',
    ];
    for (const href of cases) {
      const result = purified(`<a href="${href}">link</a>`);
      assert.equal(result.hrefs[0], null, `href must be removed: ${JSON.stringify(href)}`);
      assert.match(result.text, /link/, 'the link text itself is harmless and stays');
    }
  });
});

test('relative destinations resolve against the entry base and open without reach-back', async () => {
  await withDom(() => {
    const base = 'https://reader.test/feed/post/';
    const result = purified(
      '<a href="/root">root</a><a href="sibling">sibling</a><a href="../up">up</a>' +
        '<a href="//other.test/path">protocol relative</a>' +
        '<a href="https://absolute.test/x">absolute</a>',
      base,
    );
    assert.deepEqual(result.hrefs, [
      'https://reader.test/root',
      'https://reader.test/feed/post/sibling',
      'https://reader.test/feed/up',
      'https://other.test/path',
      'https://absolute.test/x',
    ]);
    for (const anchor of result.anchors) {
      assert.equal(anchor.rel, 'noopener noreferrer');
      assert.equal(anchor.target, '_blank');
    }
  });
});

test('a damaged base strips relative links but keeps absolute ones intact', async () => {
  await withDom(() => {
    const result = purified(
      '<a href="/relative">relative</a><a href="https://absolute.test/x">absolute</a>',
      'not a base url',
    );
    assert.equal(result.hrefs[0], null);
    assert.equal(result.hrefs[1], 'https://absolute.test/x');
  });
});

test('attributes that clobber, restyle or relabel the page are stripped', async () => {
  await withDom(() => {
    const result = purified(
      '<div id="document" name="cookie" class="prose" style="position:fixed;inset:0" ' +
        'data-reader-entries="1" aria-label="trusted" role="status" tabindex="0">text</div>' +
        '<form id="location"><input name="href"></form>',
    );
    assert.equal(result.html, '<div>text</div>');
    for (const element of result.holder.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        assert.ok(
          attribute.name === 'href' || attribute.name === 'title',
          `${element.tagName} kept attribute ${attribute.name}`,
        );
      }
    }
  });
});

test('article markup, Chinese text and entities survive as their plain meaning', async () => {
  await withDom(() => {
    const result = purified(
      '<h2>标题</h2><p>正文 <strong>加粗</strong> <em>斜体</em> <del>删除</del></p>' +
        '<ul><li>一</li><li>二</li></ul>' +
        '<blockquote><p>引用</p></blockquote>' +
        '<pre><code>const x = 1 &lt; 2;</code></pre>' +
        '<table><caption>表</caption><thead><tr><th>头</th></tr></thead>' +
        '<tbody><tr><td>值</td></tr></tbody></table><hr>' +
        '<p><a href="https://example.com/a" title="提示">链接</a></p>' +
        '<p>&lt;script&gt;alert(1)&lt;/script&gt; &#20013;&#25991;</p>',
    );
    for (const tag of [
      'h2',
      'p',
      'strong',
      'em',
      'del',
      'ul',
      'li',
      'blockquote',
      'pre',
      'code',
      'table',
      'caption',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'hr',
      'a',
    ]) {
      assert.ok(result.holder.querySelector(tag) !== null, `${tag} must survive`);
    }
    assert.equal(result.holder.querySelector('a')?.getAttribute('title'), '提示');
    assert.equal(result.holder.querySelector('a')?.getAttribute('href'), 'https://example.com/a');
    assert.match(result.text, /标题/);
    assert.match(result.text, /加粗/);
    assert.match(result.text, /const x = 1 < 2;/);
    // Escaped markup stays escaped text instead of becoming a script element.
    assert.match(result.text, /<script>alert\(1\)<\/script>/);
    assert.match(result.text, /中文/);
    assert.equal(result.holder.querySelector('script'), null);
  });
});

test('feedExcerpt is plain text, collapses whitespace, and stays within its limit', async () => {
  await withDom(() => {
    const short = content.feedExcerpt('<p>  一段\n\n摘要  </p>', PAGE_URL);
    assert.equal(short, '一段 摘要', 'no markup, no runs of whitespace');

    const long = content.feedExcerpt(`<p>${'汉'.repeat(500)}</p>`, PAGE_URL);
    assert.equal(Array.from(long).length, 180, 'the limit counts the ellipsis too');
    assert.ok(long.endsWith('…'));
    assert.ok(!long.includes('<'), 'an excerpt is text, never markup');

    const exact = content.feedExcerpt(`<p>${'字'.repeat(180)}</p>`, PAGE_URL);
    assert.equal(Array.from(exact).length, 180);
    assert.ok(!exact.endsWith('…'), 'text that already fits is not marked truncated');

    const custom = content.feedExcerpt(`<p>${'a'.repeat(50)}</p>`, PAGE_URL, 10);
    assert.equal(Array.from(custom).length, 10);

    // Astral characters are not cut through the middle of a code point.
    const emoji = content.feedExcerpt(`<p>${'🙂'.repeat(50)}</p>`, PAGE_URL, 7);
    assert.equal(Array.from(emoji).length, 7);
    assert.ok(!/[\uD800-\uDBFF]$/.test(emoji), 'no lone surrogate is left behind');
  });
});

test('an excerpt never carries hidden destinations, handlers or script text', async () => {
  await withDom(() => {
    const excerpt = content.feedExcerpt(
      '<p>正文开始</p><a href="https://evil.test/track?id=1">点这里</a>' +
        '<img src="https://evil.test/p.gif" onerror="alert(1)">' +
        '<script>alert(2)</script><style>.x{}</style>',
      PAGE_URL,
    );
    assert.match(excerpt, /正文开始/);
    assert.match(excerpt, /点这里/);
    assert.doesNotMatch(excerpt, /evil\.test/, 'a destination is not text');
    assert.doesNotMatch(excerpt, /alert/);
    assert.doesNotMatch(excerpt, /[<>]/, 'no angle bracket survives into an excerpt');
  });
});
