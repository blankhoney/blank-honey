import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setImmediate as settle } from 'node:timers/promises';
import test from 'node:test';

/**
 * The reading surfaces as a contract, in two layers.
 *
 * The first layer reads the generated-page sources and the stylesheet and checks the fixed hooks the
 * client code depends on, the namespace the styles are allowed to occupy, and the tokens they are
 * allowed to use. The second layer mounts the real page markup into jsdom and drives the real client
 * modules with a fake `fetch`, so the filter, pagination, failure and session rules are exercised
 * against the markup that actually ships.
 *
 * This is a DOM and a stubbed network in Node. It is not a browser, a server or an acceptance test:
 * nothing here proves a layout, a real HTTP response or how any of it looks.
 */

/** jsdom ships no type declarations, so it is loaded dynamically and typed for what this file uses. */
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html: string, options?: { url?: string }) => { window: Window & typeof globalThis };
};

const LIST_PAGE = resolve('src/pages/reader/index.astro');
const ITEM_PAGE = resolve('src/pages/reader/item.astro');
const MANAGE_PAGE = resolve('src/pages/reader/manage.astro');
const RSS_PAGE = resolve('src/pages/rss.astro');
const READER_CSS = resolve('src/styles/reader.css');
const SITE_CSS = resolve('src/styles/site.css');

const PAGE_URL = 'https://reader.test/reader/';
const ENTRY_ID = 'a'.repeat(64);

/** The body a page actually renders: everything a layout receives through its slot. */
async function pageBody(file: string, replacements: [string, string][] = []): Promise<string> {
  const source = await readFile(file, 'utf8');
  const start = source.indexOf('>', source.indexOf('<Base'));
  const end = source.lastIndexOf('</Base>');
  let body = source.slice(start + 1, end);
  // Astro expressions cannot be evaluated here, so a test names the value the build would produce.
  for (const [from, to] of replacements) body = body.replace(from, to);
  return body;
}

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: PAGE_URL });

/**
 * jsdom's `AbortSignal.timeout` leaves a live timer behind even after the request it guarded has
 * settled — nothing can clear a timeout signal from outside. The client asks for one per request, so
 * on the Node side the timer is unref'd here: the pending timeout still fires if a test needs it to,
 * but it no longer holds the test process open for its full duration.
 */
Object.defineProperty(dom.window.AbortSignal, 'timeout', {
  configurable: true,
  writable: true,
  value: (milliseconds: number) => {
    const controller = new dom.window.AbortController();
    setTimeout(() => controller.abort(), milliseconds).unref();
    return controller.signal;
  },
});

type Reader = typeof import('../src/client/reader');
type ReaderManager = typeof import('../src/client/reader-manage');

/**
 * The globals both client modules read. `fetch` and the rest are stubbed per test.
 *
 * `AbortController`/`AbortSignal` have to come from jsdom rather than from Node: jsdom validates the
 * `signal` option of `addEventListener` against its own interface, so a Node-realm signal is
 * rejected. jsdom implements `AbortSignal.any` and `AbortSignal.timeout`, which is everything the
 * client modules ask of that class.
 */
const GLOBALS = [
  'window',
  'document',
  'location',
  'navigator',
  'confirm',
  'fetch',
  'AbortController',
  'AbortSignal',
] as const;

function installGlobals(overrides: Partial<Record<(typeof GLOBALS)[number], unknown>> = {}) {
  // Some of these globals (navigator) are accessors on the Node global, so both directions go
  // through property descriptors rather than assignment.
  const saved = GLOBALS.map(
    (key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  const values: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    navigator: dom.window.navigator,
    confirm: () => true,
    fetch: globalThis.fetch,
    AbortController: dom.window.AbortController,
    AbortSignal: dom.window.AbortSignal,
    ...overrides,
  };
  for (const key of GLOBALS) {
    Object.defineProperty(globalThis, key, {
      value: values[key],
      configurable: true,
      writable: true,
      enumerable: true,
    });
  }
  return () => {
    for (const [key, descriptor] of saved) {
      if (descriptor === undefined) delete (globalThis as Record<string, unknown>)[key];
      else Object.defineProperty(globalThis, key, descriptor);
    }
  };
}

// Both modules import the sanitizer, which binds its window at import time, so the DOM must exist
// before they are loaded — exactly the order a browser gives them.
let reader!: Reader;
let manager!: ReaderManager;
{
  const restore = installGlobals();
  try {
    reader = await import('../src/client/reader');
    manager = await import('../src/client/reader-manage');
  } finally {
    restore();
  }
}

/** Drains the microtasks a mount starts its requests on. Never a real wait. */
async function flush(): Promise<void> {
  await settle();
  await settle();
  await settle();
}

type Call = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  /** The signal the client handed `fetch`; the client must be able to cancel this request. */
  signal: AbortSignal | null;
};

type FakeFetch = {
  calls: Call[];
  /** The function itself, which is what replaces `fetch` on the global. */
  stub: typeof fetch;
  /** The newest unanswered request. */
  open: () => {
    call: Call;
    respond: (body: unknown, status?: number) => void;
    fail: (error: unknown) => void;
  };
  /** Every unanswered request, oldest first, so a test can settle them out of order. */
  openAll: () => {
    call: Call;
    respond: (body: unknown, status?: number) => void;
    fail: (error: unknown) => void;
  }[];
  answered: () => number;
};

/** A fetch that answers only when the test says so, so ordering is the test's to control. */
function fakeFetch(): FakeFetch {
  const calls: Call[] = [];
  const pending: {
    call: Call;
    respond: (body: unknown, status?: number) => void;
    fail: (error: unknown) => void;
    done: boolean;
  }[] = [];
  const stub = (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input),
      method: init.method ?? 'GET',
      headers: { ...((init.headers ?? {}) as Record<string, string>) },
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
      signal: init.signal ?? null,
    };
    calls.push(call);
    return new Promise<Response>((resolve, reject) => {
      const entry = {
        call,
        done: false,
        respond: (body: unknown, status = 200) => {
          entry.done = true;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => body,
          } as Response);
        },
        fail: (error: unknown) => {
          entry.done = true;
          reject(error);
        },
      };
      pending.push(entry);
    });
  };
  return {
    calls,
    stub: stub as unknown as typeof fetch,
    open: () => {
      const entry = [...pending].reverse().find((candidate) => !candidate.done);
      assert.ok(entry, 'no request is waiting for an answer');
      return entry;
    },
    openAll: () => pending.filter((entry) => !entry.done),
    answered: () => pending.filter((entry) => entry.done).length,
  };
}

/** Mounts one page body with a page signal, and cleans the document and the signal afterwards. */
async function withPage(
  body: string,
  run: (context: { page: AbortController; fake: FakeFetch }) => Promise<void>,
  options: {
    path?: string;
    clipboard?: { writeText: (text: string) => Promise<void> } | null;
  } = {},
): Promise<void> {
  dom.window.history.pushState({}, '', options.path ?? '/reader/');
  dom.window.document.body.innerHTML = body;
  const fake = fakeFetch();
  const clipboard =
    options.clipboard === undefined ? { writeText: async () => undefined } : options.clipboard;
  const restore = installGlobals({
    fetch: fake.stub,
    navigator: { clipboard: clipboard ?? undefined },
  });
  // jsdom's controller at runtime, the DOM's type here: the client only ever sees its signal.
  const page = new dom.window.AbortController() as unknown as AbortController;
  try {
    await run({ page, fake });
  } finally {
    page.abort();
    restore();
    dom.window.document.body.innerHTML = '';
  }
}

/* --------------------------------------------------------------------------------------------- */
/* Page sources: the hooks the client code depends on, and the namespaces it must stay inside.    */
/* --------------------------------------------------------------------------------------------- */

test('the list page carries the fixed reading hooks and stays out of the article surfaces', async () => {
  const source = await readFile(LIST_PAGE, 'utf8');
  for (const hook of [
    'id="reader"',
    'data-view="list"',
    'data-reader-filters',
    'data-reader-source',
    'data-reader-query',
    'data-reader-entries',
    'data-reader-more',
    'data-reader-status',
    'data-reader-source-status',
    'href="/rss/"',
    'href="/reader/manage/"',
  ]) {
    assert.ok(source.includes(hook), `the list page must offer ${hook}`);
  }
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /订阅内容来自原作者，每日自动更新/);
  assert.match(source, /type="submit"/, 'the filter form needs its submit control');
  assert.ok(!source.includes('data-pagefind-body'), 'reading is not part of the search index');
  assert.ok(!source.includes('data-article'), 'reading is not an article surface');
});

test('the item page carries the fixed hooks and a way back to the list', async () => {
  const source = await readFile(ITEM_PAGE, 'utf8');
  for (const hook of [
    'id="reader"',
    'data-view="item"',
    'data-reader-detail',
    'data-reader-status',
  ]) {
    assert.ok(source.includes(hook), `the item page must offer ${hook}`);
  }
  assert.match(source, /href="\/reader\/"/);
  assert.match(source, /role="status"/);
  assert.ok(!source.includes('data-pagefind-body'));
  assert.ok(!source.includes('data-article'));
});

test('the administration page ships no data, no credentials and no remote setup entry', async () => {
  const source = await readFile(MANAGE_PAGE, 'utf8');
  for (const hook of [
    'id="reader-manage"',
    'data-reader-login',
    'data-reader-login-password',
    'data-reader-login-submit',
    'data-reader-admin',
    'data-reader-add-url',
    'data-reader-add-title',
    'data-reader-add-submit',
    'data-reader-sources',
    'data-reader-refresh-state',
    'data-reader-logout',
    'data-reader-current-password',
    'data-reader-new-password',
    'data-reader-password-submit',
    'data-reader-unconfigured',
  ]) {
    assert.ok(source.includes(hook), `the manager must offer ${hook}`);
  }
  assert.match(source, /<fieldset>/, 'the panel groups its controls');
  assert.match(source, /管理尚未初始化，请管理员在服务器终端设置密码/);
  assert.match(source, /订阅内容会公开，请勿添加私密或授权受限源/);
  // No static data, no credentials, and no way to establish the first password remotely.
  assert.ok(!source.includes('<script'), 'the page must not ship inline script or data blocks');
  assert.ok(!source.includes('localStorage'));
  assert.ok(!source.includes('sessionStorage'));
  assert.ok(!/feedUrl|csrfToken/.test(source));
  assert.ok(!/注册|重置|set password/i.test(source));
});

test('the subscription page states the absolute feed address and links the XML directly', async () => {
  const source = await readFile(RSS_PAGE, 'utf8');
  assert.ok(source.includes('id="rss-subscription"'));
  assert.ok(source.includes("import { siteUrl } from '../application/destinations';"));
  assert.ok(source.includes("new URL('/rss.xml', siteUrl).href"));
  assert.match(source, /readonly/);
  assert.match(source, /data-rss-url/);
  assert.match(source, /data-rss-copy/);
  assert.match(source, /data-rss-status/);
  assert.match(source, /data-astro-reload/, 'the XML link must leave the client router alone');
  assert.match(source, /只订阅本站原创/);
});

test('reader styles stay in their own namespace and use only tokens the site defines', async () => {
  const css = (await readFile(READER_CSS, 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const site = await readFile(SITE_CSS, 'utf8');

  for (const rule of css.matchAll(/([^{}]+)\{/g)) {
    const selector = rule[1].trim();
    if (selector.startsWith('@')) continue;
    for (const part of selector.split(',')) {
      assert.ok(
        part.trim().includes('.reader-'),
        `a reader rule escaped its namespace: ${selector}`,
      );
    }
  }

  assert.doesNotMatch(
    css,
    /(^|[;{\s])--[\w-]+\s*:/,
    'the reader must reuse site tokens instead of declaring its own',
  );
  const declared = new Set([...site.matchAll(/--([\w-]+)\s*:/g)].map((match) => match[1]));
  for (const used of new Set([...css.matchAll(/var\(--([\w-]+)\)/g)].map((match) => match[1]))) {
    assert.ok(declared.has(used), `--${used} is not defined by the site stylesheet`);
  }
  assert.doesNotMatch(css, /--paper|--ink/, 'those tokens do not exist in the site stylesheet');

  // Narrow screens get one column, and controls keep their touch target.
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /overflow-wrap: anywhere/);
});

/* --------------------------------------------------------------------------------------------- */
/* List behaviour, driven through the real page markup and a fake API.                            */
/* --------------------------------------------------------------------------------------------- */

function entry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b'.repeat(64),
    sourceId: 'src-1',
    sourceTitle: '来源甲',
    title: '一篇订阅文章',
    url: 'https://feed.test/post/1',
    author: '作者甲',
    publishedAt: 1_700_000_000_000,
    collectedAt: 1_700_100_000_000,
    updatedAt: 1_700_100_000_000,
    contentKind: 'content',
    summaryHtml: '<p>这是一段摘要。</p>',
    truncated: false,
    ...overrides,
  };
}

/** One source as the public API publishes it, in the healthy state unless a test says otherwise. */
function source(overrides: Record<string, unknown> = {}) {
  return {
    id: 'src-1',
    title: '来源甲',
    siteUrl: 'https://feed.test',
    enabled: true,
    status: 'ok',
    lastAttemptAt: 1_700_200_000_000,
    lastSuccessAt: 1_700_200_000_000,
    nextFetchAt: 1_700_300_000_000,
    errorCode: null,
    entryCount: 1,
    ...overrides,
  };
}

async function mountList(
  run: (context: { page: AbortController; fake: FakeFetch }) => Promise<void>,
) {
  const body = await pageBody(LIST_PAGE);
  await withPage(
    body,
    async (context) => {
      const mounting = reader.mountReader(context.page.signal);
      // Let the mount register its listeners before a test starts answering requests.
      await flush();
      await run(context);
      await mounting;
    },
    { path: '/reader/' },
  );
}

test('the list shows each entry as text, with its own links and nothing from the feed as markup', async () => {
  await mountList(async ({ fake }) => {
    fake
      .open()
      .respond({ sources: [{ id: 'src-1', title: '来源甲', siteUrl: 'https://feed.test' }] });
    await flush();
    fake.open().respond({
      entries: [
        entry({
          summaryHtml: '<p>摘要 <script>alert(1)</script><img src="https://t.test/p.gif"></p>',
        }),
      ],
      nextCursor: null,
    });
    await flush();

    const entries = dom.window.document.querySelectorAll('.reader-entry');
    assert.equal(entries.length, 1);
    const text = entries[0].textContent ?? '';
    assert.match(text, /来源甲/);
    assert.match(text, /一篇订阅文章/);
    assert.match(text, /这是一段摘要。|摘要/);
    assert.equal(entries[0].querySelector('script'), null, 'feed markup never becomes an element');
    assert.equal(entries[0].querySelector('img'), null);
    assert.equal(
      entries[0].querySelector('.reader-entry-title a')?.getAttribute('href'),
      `/reader/item/?id=${'b'.repeat(64)}`,
      'the detail link is the reader’s own route, not the feed’s',
    );
    const original = entries[0].querySelector('.reader-entry-origin');
    assert.equal(original?.getAttribute('href'), 'https://feed.test/post/1');
    assert.equal(original?.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(original?.getAttribute('target'), '_blank');
    // The source dropdown gained the API's source, keeping the built-in "all" option.
    assert.equal(
      dom.window.document.querySelectorAll('select[data-reader-source] option').length,
      2,
    );
    assert.match(dom.window.document.querySelector('[data-reader-status]')?.textContent ?? '', /1/);
  });
});

test('an entry without a usable original link simply does not offer one', async () => {
  await mountList(async ({ fake }) => {
    fake.open().respond({ sources: [] });
    await flush();
    fake.open().respond({
      entries: [entry({ url: 'javascript:alert(1)' })],
      nextCursor: null,
    });
    await flush();
    assert.equal(dom.window.document.querySelector('.reader-entry-origin'), null);
    assert.equal(dom.window.document.querySelectorAll('.reader-entry').length, 1);
  });
});

test('a new filter drops the cursor, and a slower answer from the old filter is discarded', async () => {
  await mountList(async ({ fake }) => {
    fake.open().respond({ sources: [] });
    await flush();
    fake.open().respond({ entries: [entry({ title: '第一页' })], nextCursor: 'cursor-1' });
    await flush();
    const more = dom.window.document.querySelector<HTMLButtonElement>('[data-reader-more]')!;
    assert.equal(more.hidden, false, 'a next cursor means more to load');

    // Load more, then change the filter before that page arrives.
    more.click();
    await flush();
    const appended = fake.open();
    assert.match(appended.call.url, /cursor=cursor-1/);
    assert.equal(
      appended.call.signal?.aborted,
      false,
      'the pagination request is genuinely in flight before the filter changes',
    );
    const query = dom.window.document.querySelector<HTMLInputElement>('[data-reader-query]')!;
    query.value = '新筛选';
    dom.window.document
      .querySelector<HTMLFormElement>('[data-reader-filters]')!
      .dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    const filtered = fake.open();
    assert.ok(!filtered.call.url.includes('cursor='), 'a new filter starts pagination over');
    assert.match(filtered.call.url, /q=/);
    assert.equal(filtered.call.url.includes('q=%E6%96%B0%E7%AD%9B%E9%80%89'), true);
    // Superseding cancels the old request at the network layer, rather than only ignoring its
    // answer: the signal the client handed the abandoned fetch is aborted.
    assert.equal(
      appended.call.signal?.aborted,
      true,
      'the superseded fetch was really aborted, not merely ignored',
    );
    assert.notEqual(appended.call.signal, filtered.call.signal, 'each request owns its own signal');

    // The abandoned page answers last: it must not touch the list.
    appended.respond({ entries: [entry({ title: '迟到的旧结果' })], nextCursor: null });
    await flush();
    assert.doesNotMatch(dom.window.document.body.textContent ?? '', /迟到的旧结果/);

    filtered.respond({ entries: [entry({ title: '筛选后的新结果' })], nextCursor: null });
    await flush();
    const titles = [...dom.window.document.querySelectorAll('.reader-entry-title')].map(
      (node) => node.textContent,
    );
    assert.deepEqual(titles, ['筛选后的新结果']);
  });
});

test('a failed refresh keeps what is on screen and says it may be older', async () => {
  await mountList(async ({ fake }) => {
    fake.open().respond({ sources: [] });
    await flush();
    fake.open().respond({ entries: [entry({ title: '已经显示的' })], nextCursor: null });
    await flush();

    const query = dom.window.document.querySelector<HTMLInputElement>('[data-reader-query]')!;
    query.value = '会失败的筛选';
    dom.window.document
      .querySelector<HTMLFormElement>('[data-reader-filters]')!
      .dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    const failing = fake.open();
    // The entries the reader already had stay on screen while the new filter is in flight.
    assert.equal(dom.window.document.querySelectorAll('.reader-entry').length, 1);

    failing.respond({ error: 'FETCH_FAILED' }, 503);
    await flush();
    const status = dom.window.document.querySelector('[data-reader-status]')!;
    assert.match(status.textContent ?? '', /较早/, 'the reader is told this is older content');
    assert.equal(status.getAttribute('data-reader-tone'), 'error');
    assert.equal(
      dom.window.document.querySelectorAll('.reader-entry').length,
      1,
      'a failed refresh never empties the list',
    );
  });
});

test('an empty list explains itself, and a filtered miss reads differently', async () => {
  await mountList(async ({ fake }) => {
    // A healthy subscription with nothing published yet.
    fake.open().respond({ sources: [source()] });
    await flush();
    fake.open().respond({ entries: [], nextCursor: null });
    await flush();
    assert.equal(
      dom.window.document.querySelector('.reader-empty')?.textContent,
      '还没有可读的文章，稍后再来看看。',
    );
    assert.equal(
      dom.window.document.querySelector<HTMLButtonElement>('[data-reader-more]')!.hidden,
      true,
    );

    const query = dom.window.document.querySelector<HTMLInputElement>('[data-reader-query]')!;
    query.value = '没有结果的关键词';
    dom.window.document
      .querySelector<HTMLFormElement>('[data-reader-filters]')!
      .dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
    await flush();
    fake.open().respond({ entries: [], nextCursor: null });
    await flush();
    assert.equal(
      dom.window.document.querySelector('.reader-empty')?.textContent,
      '没有匹配的文章。',
    );
  });
});

test('load more appends a page and disappears when the cursor runs out', async () => {
  await mountList(async ({ fake }) => {
    fake.open().respond({ sources: [] });
    await flush();
    fake.open().respond({ entries: [entry({ title: '第一篇' })], nextCursor: 'cursor-1' });
    await flush();
    dom.window.document.querySelector<HTMLButtonElement>('[data-reader-more]')!.click();
    await flush();
    fake.open().respond({ entries: [entry({ title: '第二篇' })], nextCursor: null });
    await flush();
    const titles = [...dom.window.document.querySelectorAll('.reader-entry-title')].map(
      (node) => node.textContent,
    );
    assert.deepEqual(titles, ['第一篇', '第二篇']);
    assert.equal(
      dom.window.document.querySelector<HTMLButtonElement>('[data-reader-more]')!.hidden,
      true,
    );
    assert.equal(
      dom.window.document.querySelector('[data-reader-entries]')?.getAttribute('aria-busy'),
      'false',
    );
  });
});

/* --------------------------------------------------------------------------------------------- */
/* The state of the subscriptions themselves, and what "no articles" is allowed to mean.         */
/* --------------------------------------------------------------------------------------------- */

test('an empty list says why it is empty instead of guessing', async () => {
  // Nothing is subscribed yet.
  await mountList(async ({ fake }) => {
    fake.open().respond({ sources: [] });
    await flush();
    fake.open().respond({ entries: [], nextCursor: null });
    await flush();
    assert.equal(
      dom.window.document.querySelector('.reader-empty')?.textContent,
      '尚未添加订阅源。',
    );
    assert.match(
      dom.window.document.querySelector('[data-reader-source-status]')?.textContent ?? '',
      /尚未添加订阅源/,
    );
  });

  // A source exists and is enabled, but its first fetch has not landed.
  await mountList(async ({ fake }) => {
    fake.open().respond({
      sources: [
        source({ status: 'pending', lastSuccessAt: null, lastAttemptAt: null, entryCount: 0 }),
      ],
    });
    await flush();
    fake.open().respond({ entries: [], nextCursor: null });
    await flush();
    assert.equal(
      dom.window.document.querySelector('.reader-empty')?.textContent,
      '正在等待首次抓取。',
    );
  });

  // Every source is switched off, which is not the same as having none.
  await mountList(async ({ fake }) => {
    fake.open().respond({ sources: [source({ enabled: false })] });
    await flush();
    fake.open().respond({ entries: [], nextCursor: null });
    await flush();
    assert.equal(
      dom.window.document.querySelector('.reader-empty')?.textContent,
      '订阅源都已停用。',
    );
  });

  // Healthy sources, nothing published yet: the ordinary case, with no alarming wording.
  await mountList(async ({ fake }) => {
    fake.open().respond({ sources: [source()] });
    await flush();
    fake.open().respond({ entries: [], nextCursor: null });
    await flush();
    assert.equal(
      dom.window.document.querySelector('.reader-empty')?.textContent,
      '还没有可读的文章，稍后再来看看。',
    );
  });
});

test('a source list that could not be read never claims there are no subscriptions', async () => {
  await mountList(async ({ fake }) => {
    fake.open().respond({ error: 'CAPACITY' }, 503);
    await flush();
    fake.open().respond({ entries: [], nextCursor: null });
    await flush();
    assert.equal(
      dom.window.document.querySelector('.reader-empty')?.textContent,
      '暂时无法读取订阅源状态，稍后重试。',
    );
    assert.equal(
      dom.window.document.querySelector('[data-reader-source-status]')?.textContent,
      '暂时无法读取订阅源状态。',
    );
    assert.equal(
      dom.window.document
        .querySelector('[data-reader-source-status]')
        ?.getAttribute('data-reader-tone'),
      'error',
    );
  });
});

test('the source line counts failing subscriptions and warns the list may be older', async () => {
  await mountList(async ({ fake }) => {
    fake.open().respond({
      sources: [
        source(),
        source({ id: 'src-2', title: '来源乙', status: 'error', errorCode: 'FETCH_FAILED' }),
      ],
    });
    await flush();
    fake.open().respond({ entries: [entry()], nextCursor: null });
    await flush();

    const line = dom.window.document.querySelector('[data-reader-source-status]')!;
    assert.match(line.textContent ?? '', /共 2 个订阅源/);
    assert.match(line.textContent ?? '', /1 个抓取异常/);
    assert.match(line.textContent ?? '', /列表可能不是最新的/);
    assert.match(line.textContent ?? '', /最近检查/);
    assert.equal(line.getAttribute('data-reader-tone'), 'error');

    // A healthy set says so in the same place, without the warning.
    await mountList(async ({ fake: healthy }) => {
      healthy.open().respond({ sources: [source()] });
      await flush();
      healthy.open().respond({ entries: [entry()], nextCursor: null });
      await flush();
      const line = dom.window.document.querySelector('[data-reader-source-status]')!;
      assert.match(line.textContent ?? '', /暂无抓取异常/);
      assert.doesNotMatch(line.textContent ?? '', /列表可能不是最新的/);
      assert.equal(line.getAttribute('data-reader-tone'), 'idle');
    });
  });
});

test('choosing one source shows that source’s own check state and time', async () => {
  await mountList(async ({ fake }) => {
    fake.open().respond({
      sources: [
        source(),
        source({
          id: 'src-2',
          title: '来源乙',
          status: 'error',
          errorCode: 'FETCH_FAILED',
          lastAttemptAt: 1_700_400_000_000,
        }),
      ],
    });
    await flush();
    fake.open().respond({ entries: [entry()], nextCursor: null });
    await flush();

    const select = dom.window.document.querySelector<HTMLSelectElement>('[data-reader-source]')!;
    select.value = 'src-2';
    select.dispatchEvent(new dom.window.Event('change'));
    await flush();
    const line = dom.window.document.querySelector('[data-reader-source-status]')!;
    assert.match(line.textContent ?? '', /来源乙/);
    assert.match(line.textContent ?? '', /抓取异常/);
    assert.match(line.textContent ?? '', /暂时无法读取订阅内容/);
    assert.equal(line.getAttribute('data-reader-tone'), 'error');

    // The filtered page is empty, and that reads as a filter miss rather than a missing feed.
    fake.open().respond({ entries: [], nextCursor: null });
    await flush();
    assert.equal(
      dom.window.document.querySelector('.reader-empty')?.textContent,
      '没有匹配的文章。',
    );
  });
});

/* --------------------------------------------------------------------------------------------- */
/* The single entry, the subscription card and the administration panel.                          */
/* --------------------------------------------------------------------------------------------- */

test('the item view renders its metadata, the truncation notice and a purified body', async () => {
  const body = await pageBody(ITEM_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      const mounting = reader.mountReader(page.signal);
      await flush();
      assert.match(fake.open().call.url, new RegExp(`/api/reader/entries/${ENTRY_ID}$`));
      fake.open().respond({
        ...entry({
          author: null,
          publishedAt: null,
          contentKind: 'summary',
          truncated: true,
          url: null,
          contentHtml:
            '<p>正文<a href="/rel">相对链接</a></p><script>alert(1)</script>' +
            '<p onclick="alert(2)">事件</p>',
        }),
      });
      await flush();
      // Without an entry URL the reader asks which site the source belongs to.
      assert.equal(fake.open().call.url, '/api/reader/sources');
      fake.open().respond({ sources: [source({ siteUrl: null })] });
      await flush();
      await mounting;

      const detail = dom.window.document.querySelector('[data-reader-detail]')!;
      assert.equal((detail as HTMLElement).hidden, false);
      const text = detail.textContent ?? '';
      assert.match(text, /一篇订阅文章/);
      assert.match(text, /来源甲/);
      assert.match(text, /未提供/, 'a missing author and an unpublished original say so');
      assert.match(text, /收录日期/);
      assert.match(text, /摘要/, 'the panel names which kind of body it is showing');
      assert.match(text, /截断/);
      assert.equal(
        detail.querySelector('script'),
        null,
        'the body is purified before it is appended',
      );
      const paragraphs = detail.querySelectorAll('.reader-detail-body p');
      assert.ok(paragraphs.length >= 1);
      for (const element of detail.querySelectorAll('*')) {
        for (const attribute of element.attributes) {
          assert.ok(!attribute.name.startsWith('on'), 'no event handler arrives with the body');
        }
      }
      const link = detail.querySelector('.reader-detail-body a');
      // The entry has no URL and its source has no site either, so the reader's own origin is the
      // last resort — and it is still an absolute, hardened link rather than a bare path.
      assert.equal(link?.getAttribute('href'), 'https://reader.test/rel');
      assert.equal(link?.getAttribute('rel'), 'noopener noreferrer');
      assert.equal(detail.querySelector('.reader-detail-origin'), null, 'no URL means no link out');
    },
    { path: `/reader/item/?id=${ENTRY_ID}` },
  );
});

test('a body with no original link resolves its relative links to the source site, not this one', async () => {
  const body = await pageBody(ITEM_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      const mounting = reader.mountReader(page.signal);
      await flush();
      fake.open().respond({
        ...entry({
          url: null,
          contentHtml: '<p><a href="/rel">相对</a><a href="post/2">相邻</a></p>',
        }),
      });
      await flush();
      assert.equal(fake.open().call.url, '/api/reader/sources');
      fake.open().respond({ sources: [source({ siteUrl: 'https://feed.test' })] });
      await flush();
      await mounting;

      const links = [...dom.window.document.querySelectorAll('.reader-detail-body a')].map(
        (anchor) => anchor.getAttribute('href'),
      );
      // Resolving these against the reader's origin would silently point the feed's links at us.
      assert.deepEqual(links, ['https://feed.test/rel', 'https://feed.test/post/2']);
      assert.equal(
        dom.window.document.querySelector('.reader-detail-origin'),
        null,
        'the entry still has no original link to offer',
      );
    },
    { path: `/reader/item/?id=${ENTRY_ID}` },
  );
});

test('a missing or malformed entry id fails with an explanation and no request', async () => {
  const body = await pageBody(ITEM_PAGE);
  for (const [path, pattern] of [
    ['/reader/item/', /缺少文章标识/],
    ['/reader/item/?id=not-a-hex-id', /标识无效/],
  ] as const) {
    await withPage(
      body,
      async ({ page, fake }) => {
        await reader.mountReader(page.signal);
        assert.equal(fake.calls.length, 0, 'an unusable id must not reach the API');
        assert.match(
          dom.window.document.querySelector('[data-reader-status]')?.textContent ?? '',
          pattern,
        );
        assert.equal(
          (dom.window.document.querySelector('[data-reader-detail]') as HTMLElement).hidden,
          true,
        );
      },
      { path },
    );
  }
});

test('the copy button reports success, and falls back to selecting the address on failure', async () => {
  const body = await pageBody(RSS_PAGE, [
    ['value={feedUrl}', 'value="https://reader.test/rss.xml"'],
  ]);
  let copied: string | null = null;
  let failures = false;
  await withPage(
    body,
    async ({ page }) => {
      const input = dom.window.document.querySelector<HTMLInputElement>('[data-rss-url]')!;
      const status = dom.window.document.querySelector('[data-rss-status]')!;
      assert.equal(input.readOnly, true, 'the address is shown, never edited');
      await reader.mountRss(page.signal);

      let selected = 0;
      input.select = () => {
        selected += 1;
      };
      dom.window.document.querySelector<HTMLButtonElement>('[data-rss-copy]')!.click();
      await flush();
      assert.equal(status.textContent, '已复制订阅地址。');
      assert.equal(selected, 0);

      // The clipboard can refuse — a permission prompt, an insecure context or no API at all.
      failures = true;
      dom.window.document.querySelector<HTMLButtonElement>('[data-rss-copy]')!.click();
      await flush();
      assert.equal(selected, 1, 'the address is selected so it can be copied by hand');
      assert.equal(status.getAttribute('data-reader-tone'), 'error');
      assert.match(status.textContent ?? '', /复制失败/);
    },
    {
      clipboard: {
        writeText: async (value: string) => {
          if (failures) throw new Error('denied');
          copied = value;
        },
      },
    },
  );
  assert.equal(copied, 'https://reader.test/rss.xml');
});

test('the manager explains an uninitialized server and asks for nothing else', async () => {
  const body = await pageBody(MANAGE_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      const mounting = manager.mountReaderManager(page.signal);
      await flush();
      fake.open().respond({ configured: false, authenticated: false });
      await flush();
      await mounting;

      assert.equal(
        (dom.window.document.querySelector('[data-reader-unconfigured]') as HTMLElement).hidden,
        false,
      );
      assert.equal(
        (dom.window.document.querySelector('form[data-reader-login]') as HTMLElement).hidden,
        true,
      );
      assert.equal(
        (dom.window.document.querySelector('[data-reader-admin]') as HTMLElement).hidden,
        true,
      );
      assert.equal(fake.calls.length, 1, 'an uninitialized server is asked nothing further');
    },
    { path: '/reader/manage/' },
  );
});

test('logging in unlocks the panel and every write carries the session receipt', async () => {
  const body = await pageBody(MANAGE_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      const mounting = manager.mountReaderManager(page.signal);
      await flush();
      const session = fake.open();
      assert.equal(session.call.url, '/api/reader/admin/session');
      assert.equal(session.call.method, 'GET');
      assert.equal(
        session.call.headers['Content-Type'],
        undefined,
        'a read sends no JSON body type',
      );
      session.respond({ configured: true, authenticated: false });
      await flush();

      const login = dom.window.document.querySelector<HTMLFormElement>('form[data-reader-login]')!;
      const password = dom.window.document.querySelector<HTMLInputElement>(
        '[data-reader-login-password]',
      )!;
      assert.equal(login.hidden, false);
      password.value = 'hunter2';
      login.dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
      await flush();
      assert.equal(password.value, '', 'the password is cleared as soon as it is sent');
      const attempt = fake.open();
      assert.equal(attempt.call.method, 'POST');
      assert.deepEqual(attempt.call.body, { password: 'hunter2' });
      assert.equal(
        attempt.call.headers['X-Reader-CSRF'],
        undefined,
        'login is the one call that has no receipt yet',
      );
      attempt.respond({ configured: true, authenticated: true, csrfToken: 'receipt-1' });
      await flush();

      assert.equal(
        (dom.window.document.querySelector('[data-reader-admin]') as HTMLElement).hidden,
        false,
      );
      assert.equal(login.hidden, true);
      const sources = fake.open();
      assert.equal(sources.call.url, '/api/reader/admin/sources');
      assert.equal(sources.call.headers['Content-Type'], undefined);
      sources.respond({
        sources: [
          {
            id: 'src-1',
            title: '来源甲',
            feedUrl: 'https://feed.test/atom.xml',
            siteUrl: 'https://feed.test',
            enabled: true,
            status: 'ok',
            lastAttemptAt: 1_700_000_000_000,
            lastSuccessAt: 1_700_000_000_000,
            nextFetchAt: 1_700_100_000_000,
            errorCode: null,
            entryCount: 12,
            failureCount: 0,
          },
        ],
      });
      await flush();
      await mounting;

      const row = dom.window.document.querySelector('.reader-source')!;
      assert.match(row.textContent ?? '', /来源甲/);
      assert.match(row.textContent ?? '', /https:\/\/feed\.test\/atom\.xml/);
      assert.equal(row.querySelector('[data-source-toggle]')?.textContent, '停用');

      // A write carries the receipt, a JSON body and the same-origin credential mode.
      row.querySelector<HTMLButtonElement>('[data-source-refresh]')!.click();
      await flush();
      const refresh = fake.open();
      assert.equal(refresh.call.method, 'POST');
      assert.equal(refresh.call.headers['X-Reader-CSRF'], 'receipt-1');
      assert.equal(refresh.call.headers['Content-Type'], 'application/json');
      assert.deepEqual(refresh.call.body, {});
      refresh.respond({ queued: true }, 202);
      await flush();
      assert.match(
        dom.window.document.querySelector('[data-reader-status]')?.textContent ?? '',
        /后台/,
      );
    },
    { path: '/reader/manage/' },
  );
});

test('destructive actions ask first, and a lost session returns the panel to login', async () => {
  const body = await pageBody(MANAGE_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      const source = {
        id: 'src-1',
        title: '来源甲',
        feedUrl: 'https://feed.test/atom.xml',
        siteUrl: 'https://feed.test',
        enabled: true,
        status: 'ok',
        lastAttemptAt: null,
        lastSuccessAt: null,
        nextFetchAt: 1_700_100_000_000,
        errorCode: null,
        entryCount: 3,
        failureCount: 0,
      };
      const mounting = manager.mountReaderManager(page.signal);
      await flush();
      fake.open().respond({ configured: true, authenticated: true, csrfToken: 'receipt-1' });
      await flush();
      fake.open().respond({ sources: [source] });
      await flush();

      // A refused confirmation makes no request at all.
      (globalThis as Record<string, unknown>).confirm = () => false;
      const before = fake.calls.length;
      dom.window.document.querySelector<HTMLButtonElement>('[data-source-delete]')!.click();
      await flush();
      assert.equal(fake.calls.length, before, 'a declined confirmation sends nothing');
      assert.equal(dom.window.document.querySelectorAll('.reader-source').length, 1);

      (globalThis as Record<string, unknown>).confirm = () => true;
      dom.window.document.querySelector<HTMLButtonElement>('[data-source-clear]')!.click();
      await flush();
      const clear = fake.open();
      assert.equal(clear.call.method, 'DELETE');
      assert.match(clear.call.url, /\/api\/reader\/admin\/sources\/src-1\/entries$/);
      assert.deepEqual(clear.call.body, { confirm: true }, 'the server needs the confirmation too');
      assert.equal(clear.call.headers['X-Reader-CSRF'], 'receipt-1');
      // Anything after this point may answer with a dead session.
      clear.respond({ error: 'AUTH_REQUIRED' }, 401);
      await flush();

      assert.equal(
        (dom.window.document.querySelector('[data-reader-admin]') as HTMLElement).hidden,
        true,
      );
      assert.equal(
        (dom.window.document.querySelector('form[data-reader-login]') as HTMLElement).hidden,
        false,
      );
      assert.equal(dom.window.document.querySelectorAll('.reader-source').length, 0);
      assert.match(
        dom.window.document.querySelector('[data-reader-status]')?.textContent ?? '',
        /重新登录/,
      );
      // The mount promise settles once the lost session has returned the panel to login.
      await mounting;
    },
    { path: '/reader/manage/' },
  );
});

/** Opens the managed panel through a real login, so later tests start from a live session. */
async function signIn(page: AbortController, fake: FakeFetch): Promise<void> {
  const mounting = manager.mountReaderManager(page.signal);
  await flush();
  fake.open().respond({ configured: true, authenticated: true, csrfToken: 'receipt-1' });
  await flush();
  fake.open().respond({ sources: [source()] });
  await flush();
  return mounting;
}

test('every form holds its own submit control, and sets the password free at once', async () => {
  const body = await pageBody(MANAGE_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      await signIn(page, fake);
      const addForm = dom.window.document.querySelector<HTMLFormElement>('form[data-reader-add]')!;
      const addSubmit = dom.window.document.querySelector<HTMLButtonElement>(
        '[data-reader-add-submit]',
      )!;
      const addUrlInput =
        dom.window.document.querySelector<HTMLInputElement>('[data-reader-add-url]')!;
      const passwordForm = dom.window.document.querySelector<HTMLFormElement>(
        'form[data-reader-password]',
      )!;
      const passwordSubmit = dom.window.document.querySelector<HTMLButtonElement>(
        '[data-reader-password-submit]',
      )!;
      const currentInput = dom.window.document.querySelector<HTMLInputElement>(
        '[data-reader-current-password]',
      )!;
      const newInput = dom.window.document.querySelector<HTMLInputElement>(
        '[data-reader-new-password]',
      )!;

      // Adding a source.
      addUrlInput.value = 'https://new.test/feed.xml';
      addForm.dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
      await flush();
      assert.equal(addSubmit.disabled, true, 'the add form is held while its own request runs');
      const add = fake.open();
      assert.equal(add.call.method, 'POST');
      assert.deepEqual(add.call.body, { feedUrl: 'https://new.test/feed.xml' });
      add.respond({ source: source({ id: 'src-9', title: '新来源' }) }, 201);
      await flush();
      fake.open().respond({ sources: [source()] });
      await flush();
      assert.equal(addSubmit.disabled, false, 'and released once it is answered');

      // Changing the password.
      currentInput.value = 'old-secret';
      newInput.value = 'new-secret';
      passwordForm.dispatchEvent(
        new dom.window.Event('submit', { cancelable: true, bubbles: true }),
      );
      assert.equal(currentInput.value, '', 'the password leaves the form the moment it is sent');
      assert.equal(newInput.value, '');
      assert.equal(passwordSubmit.disabled, true);
      const change = fake.open();
      assert.deepEqual(change.call.body, {
        currentPassword: 'old-secret',
        newPassword: 'new-secret',
      });
      change.respond({ ok: true });
      await flush();
      assert.equal(passwordSubmit.disabled, false);
      assert.equal(
        (dom.window.document.querySelector('[data-reader-admin]') as HTMLElement).hidden,
        true,
        'a changed password revokes this login',
      );
    },
    { path: '/reader/manage/' },
  );
});

test('a slower older source list cannot replace the newer one', async () => {
  const body = await pageBody(MANAGE_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      await signIn(page, fake);
      // Clearing the cache starts a reload of its own, which is left unanswered.
      dom.window.document.querySelector<HTMLButtonElement>('[data-source-clear]')!.click();
      await flush();
      fake.open().respond({ ok: true });
      await flush();
      const older = fake.openAll()[0]!;
      assert.equal(older.call.url, '/api/reader/admin/sources');

      // A newer reload starts before the first one answers.
      dom.window.document.querySelector<HTMLButtonElement>('[data-reader-refresh-state]')!.click();
      await flush();
      const newer = fake.openAll().at(-1)!;
      assert.notEqual(newer.call, older.call, 'the second reload is a new request');

      newer.respond({ sources: [source({ id: 'src-new', title: '新的列表' })] });
      await flush();
      assert.match(
        dom.window.document.querySelector('.reader-source')?.textContent ?? '',
        /新的列表/,
      );

      // The older reply arrives last and must be dropped.
      older.respond({ sources: [source({ id: 'src-old', title: '过期的列表' })] });
      await flush();
      assert.match(
        dom.window.document.querySelector('.reader-source')?.textContent ?? '',
        /新的列表/,
      );
      assert.doesNotMatch(dom.window.document.body.textContent ?? '', /过期的列表/);
    },
    { path: '/reader/manage/' },
  );
});

test('a source list from a finished session cannot overwrite the new session', async () => {
  const body = await pageBody(MANAGE_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      await signIn(page, fake);
      // The first session asks for its list, which is deliberately left in flight.
      dom.window.document.querySelector<HTMLButtonElement>('[data-reader-refresh-state]')!.click();
      await flush();
      const staleList = fake.openAll()[0]!;
      assert.equal(staleList.call.url, '/api/reader/admin/sources');

      // Logging out ends that session and moves the epoch.
      dom.window.document.querySelector<HTMLButtonElement>('[data-reader-logout]')!.click();
      await flush();
      fake.open().respond({ ok: true });
      await flush();
      assert.equal(
        (dom.window.document.querySelector('form[data-reader-login]') as HTMLElement).hidden,
        false,
      );

      // The second session logs in and loads its own list.
      const login = dom.window.document.querySelector<HTMLFormElement>('form[data-reader-login]')!;
      dom.window.document.querySelector<HTMLInputElement>('[data-reader-login-password]')!.value =
        'hunter2';
      login.dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
      await flush();
      fake.open().respond({ configured: true, authenticated: true, csrfToken: 'receipt-2' });
      await flush();
      fake.open().respond({ sources: [source({ id: 'src-b', title: '第二个会话的列表' })] });
      await flush();
      assert.match(
        dom.window.document.querySelector('.reader-source')?.textContent ?? '',
        /第二个会话的列表/,
      );

      // The dead session's list lands afterwards and must find nothing to write to.
      staleList.respond({ sources: [source({ id: 'src-a', title: '上一个会话的列表' })] });
      await flush();
      assert.match(
        dom.window.document.querySelector('.reader-source')?.textContent ?? '',
        /第二个会话的列表/,
      );
      assert.doesNotMatch(dom.window.document.body.textContent ?? '', /上一个会话的列表/);
    },
    { path: '/reader/manage/' },
  );
});

test('a session read that lands after a newer login cannot end that login', async () => {
  const body = await pageBody(MANAGE_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      const mounting = manager.mountReaderManager(page.signal);
      await flush();
      // The bootstrap session read is deliberately left in flight while the reader logs in.
      const bootstrap = fake.open();
      assert.equal(bootstrap.call.url, '/api/reader/admin/session');
      assert.equal(bootstrap.call.method, 'GET');

      const login = dom.window.document.querySelector<HTMLFormElement>('form[data-reader-login]')!;
      dom.window.document.querySelector<HTMLInputElement>('[data-reader-login-password]')!.value =
        'hunter2';
      login.dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
      await flush();
      fake.open().respond({ configured: true, authenticated: true, csrfToken: 'receipt-1' });
      await flush();
      fake.open().respond({ sources: [source({ id: 'src-new', title: '新会话的列表' })] });
      await flush();
      assert.match(
        dom.window.document.querySelector('.reader-source')?.textContent ?? '',
        /新会话的列表/,
      );

      // The bootstrap read finally answers, describing the session the page had before the login.
      bootstrap.respond({ configured: true, authenticated: false });
      await flush();

      assert.equal(
        (dom.window.document.querySelector('[data-reader-admin]') as HTMLElement).hidden,
        false,
        'the login that finished later is still the live one',
      );
      assert.equal(
        (dom.window.document.querySelector('form[data-reader-login]') as HTMLElement).hidden,
        true,
      );
      assert.match(
        dom.window.document.querySelector('.reader-source')?.textContent ?? '',
        /新会话的列表/,
        'and its list survives the older answer',
      );
      assert.doesNotMatch(
        dom.window.document.querySelector('[data-reader-status]')?.textContent ?? '',
        /重新登录|过期/,
      );

      // The receipt the login returned is still the one writes carry.
      dom.window.document.querySelector<HTMLButtonElement>('[data-source-refresh]')!.click();
      await flush();
      const refresh = fake.open();
      assert.equal(refresh.call.headers['X-Reader-CSRF'], 'receipt-1');
      refresh.respond({ queued: true }, 202);
      await flush();
      await mounting;
    },
    { path: '/reader/manage/' },
  );
});

test('an action and a list read from a dead session cannot touch the one that replaced it', async () => {
  const body = await pageBody(MANAGE_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      await signIn(page, fake);

      // Session one leaves a write and a list read in flight.
      dom.window.document.querySelector<HTMLButtonElement>('[data-source-refresh]')!.click();
      await flush();
      const deadAction = fake.open();
      assert.equal(deadAction.call.method, 'POST');
      assert.match(deadAction.call.url, /\/refresh$/);
      assert.equal(deadAction.call.headers['X-Reader-CSRF'], 'receipt-1');
      dom.window.document.querySelector<HTMLButtonElement>('[data-reader-refresh-state]')!.click();
      await flush();
      const deadList = fake.open();
      assert.equal(deadList.call.url, '/api/reader/admin/sources');

      // Session one ends; session two logs in with its own receipt and its own list.
      dom.window.document.querySelector<HTMLButtonElement>('[data-reader-logout]')!.click();
      await flush();
      fake.open().respond({ ok: true });
      await flush();
      const login = dom.window.document.querySelector<HTMLFormElement>('form[data-reader-login]')!;
      dom.window.document.querySelector<HTMLInputElement>('[data-reader-login-password]')!.value =
        'hunter2';
      login.dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
      await flush();
      fake.open().respond({ configured: true, authenticated: true, csrfToken: 'receipt-2' });
      await flush();
      fake.open().respond({ sources: [source({ id: 'src-b', title: '第二个会话的列表' })] });
      await flush();
      assert.match(
        dom.window.document.querySelector('.reader-source')?.textContent ?? '',
        /第二个会话的列表/,
      );

      // The dead session's write is refused, long after that session ended.
      deadAction.respond({ error: 'AUTH_REQUIRED' }, 401);
      await flush();

      assert.equal(
        (dom.window.document.querySelector('[data-reader-admin]') as HTMLElement).hidden,
        false,
        'a stale 401 must not end the live session',
      );
      assert.doesNotMatch(
        dom.window.document.querySelector('[data-reader-status]')?.textContent ?? '',
        /重新登录|过期/,
        'nor show the old failure on the new session',
      );

      // The dead session's list lands too, and finds nothing to replace.
      deadList.respond({ sources: [source({ id: 'src-a', title: '上一个会话的列表' })] });
      await flush();
      assert.match(
        dom.window.document.querySelector('.reader-source')?.textContent ?? '',
        /第二个会话的列表/,
      );
      assert.doesNotMatch(dom.window.document.body.textContent ?? '', /上一个会话的列表/);

      // The live receipt is the one writes still carry.
      dom.window.document.querySelector<HTMLButtonElement>('[data-source-refresh]')!.click();
      await flush();
      const refresh = fake.open();
      assert.equal(
        refresh.call.headers['X-Reader-CSRF'],
        'receipt-2',
        'the dead session must not have cleared the new receipt',
      );
      refresh.respond({ queued: true }, 202);
      await flush();
    },
    { path: '/reader/manage/' },
  );
});

test('a wrong password reads as a wrong password, not as a lost session', async () => {
  const body = await pageBody(MANAGE_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      const mounting = manager.mountReaderManager(page.signal);
      await flush();
      fake.open().respond({ configured: true, authenticated: false });
      await flush();

      const login = dom.window.document.querySelector<HTMLFormElement>('form[data-reader-login]')!;
      assert.equal(login.hidden, false);
      dom.window.document.querySelector<HTMLInputElement>('[data-reader-login-password]')!.value =
        '错误密码';
      login.dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
      await flush();
      const attempt = fake.open();
      assert.equal(attempt.call.method, 'POST');
      attempt.respond({ error: 'INVALID_CREDENTIALS' }, 401);
      await flush();
      await mounting;

      const status = dom.window.document.querySelector<HTMLElement>('[data-reader-status]')!;
      assert.equal(status.textContent, '密码不正确。');
      assert.equal(status.dataset.readerTone, 'error');
      assert.doesNotMatch(
        status.textContent ?? '',
        /重新登录|过期/,
        'a refused password is not an expired session',
      );
      assert.equal(login.hidden, false, 'a refused password leaves the form where it was');
      assert.equal(
        (dom.window.document.querySelector('[data-reader-admin]') as HTMLElement).hidden,
        true,
      );
      assert.equal(fake.calls.length, 2, 'a refused login asks for nothing else');
    },
    { path: '/reader/manage/' },
  );
});

test('an action that outlives its session writes nothing and starts no follow-up', async () => {
  const body = await pageBody(MANAGE_PAGE);
  await withPage(
    body,
    async ({ page, fake }) => {
      await signIn(page, fake);
      dom.window.document.querySelector<HTMLButtonElement>('[data-source-clear]')!.click();
      await flush();
      const clear = fake.open();
      assert.equal(clear.call.method, 'DELETE');

      // The session ends while that request is still in flight.
      dom.window.document.querySelector<HTMLButtonElement>('[data-reader-logout]')!.click();
      await flush();
      fake.open().respond({ ok: true });
      await flush();
      const afterLogout = fake.calls.length;
      assert.match(
        dom.window.document.querySelector('[data-reader-status]')?.textContent ?? '',
        /已退出登录/,
      );

      // The clear now finishes, in a session that no longer exists.
      clear.respond({ ok: true });
      await flush();
      assert.equal(
        fake.calls.length,
        afterLogout,
        'a stale action must not reload the list for the session that took over',
      );
      assert.match(
        dom.window.document.querySelector('[data-reader-status]')?.textContent ?? '',
        /已退出登录/,
        'and must not overwrite the status the live session owns',
      );
      assert.equal(dom.window.document.querySelectorAll('.reader-source').length, 0);
    },
    { path: '/reader/manage/' },
  );
});
