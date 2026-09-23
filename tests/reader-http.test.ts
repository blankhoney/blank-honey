/* Targeted tests for the reader HTTP surface (server/reader/http.mjs).
 *
 * The store and the auth layer are the real ones, the password is twelve synthetic characters and
 * every feed comes from an injected fetcher, so no test in here touches the network beyond the
 * loopback socket it opens itself.  The server listens on 127.0.0.1:0 and each fixture closes its
 * own server, service and store in `finally`.
 */
import assert from 'node:assert/strict';
import { request as httpRequest, createServer, type IncomingHttpHeaders } from 'node:http';
import test from 'node:test';
import { createPasswordHash as createPasswordHashModule } from '../server/reader/auth.mjs';
import { createReaderAuth as createAuthModule } from '../server/reader/auth.mjs';
import { createReaderService as createServiceModule } from '../server/reader/service.mjs';
import { createReaderHttp as createHttpModule } from '../server/reader/http.mjs';
import { openReaderStore as openStoreModule } from '../server/reader/store.mjs';
import { ReaderError } from '../server/reader/model.mjs';

type Source = {
  id: string;
  title: string;
  siteUrl: string | null;
  enabled: boolean;
  status: string;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  nextFetchAt: number;
  errorCode: string | null;
  entryCount: number;
  feedUrl: string;
  failureCount: number;
  leaseToken: string | null;
  leaseUntil: number | null;
  etag: string | null;
};

type Store = {
  addSource(input: { feedUrl: string; title?: string | null }, now: number): Source;
  getSource(id: string): Source | null;
  listSources(admin?: boolean): Source[];
  listEntries(options?: { sourceId?: string; q?: string; cursor?: string }): {
    entries: { id: string; title: string }[];
    nextCursor: string | null;
  };
  getEntry(id: string): { contentHtml: string } | null;
  getAdmin(): { passwordHash: string; version: number } | null;
  setAdminPassword(passwordHash: string): number;
  getSession(tokenHash: string, now: number): unknown;
  cleanupSessions(now: number): number;
  close(): void;
};

type Service = {
  idle(): Promise<void>;
  stop(): Promise<void>;
};

type HttpHandler = (request: unknown, response: unknown) => Promise<boolean>;

type Auth = {
  session(request: unknown): unknown;
  requireWrite(request: unknown): unknown;
};

type Fixture = {
  store: Store;
  service: Service;
  auth: Auth;
  clock: { t: number };
  fetches: string[];
  port: number;
  origin: string;
  close(): Promise<void>;
};

const openReaderStore = openStoreModule as unknown as (filename: string) => Store;
const createReaderService = createServiceModule as unknown as (options: {
  store: Store;
  fetchFeed: (url: string, options: unknown) => Promise<unknown>;
  now: () => number;
}) => Service;
const createReaderAuth = createAuthModule as unknown as (options: {
  store: Store;
  allowedOrigin: string;
  now: () => number;
}) => Auth;
const createReaderHttp = createHttpModule as unknown as (options: {
  store: Store;
  service: Service;
  auth: Auth;
  now: () => number;
}) => HttpHandler;
const createPasswordHash = createPasswordHashModule as unknown as (
  password: string,
) => Promise<string>;

const PASSWORD = 'twelve-chars';
const START = 1_700_000_000_000;
const FEED_URL = 'https://feeds.example.net/subscribe.xml';

function feedXml(items: { id: string; title: string; updated: string }[]): string {
  const entries = items
    .map(
      (item) =>
        `    <item><guid isPermaLink="false">${item.id}</guid><title>${item.title}</title>` +
        `<link>https://feeds.example.net/${item.id}</link><pubDate>${item.updated}</pubDate>` +
        `<description>&lt;p&gt;body ${item.id}&lt;/p&gt;</description></item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Field notes</title>
    <link>https://feeds.example.net/</link>
${entries}
  </channel>
</rss>`;
}

const TWO_ITEMS = [
  { id: 'tag:feeds.example.net,2026:1', title: 'First', updated: '2026-09-01T10:00:00Z' },
  { id: 'tag:feeds.example.net,2026:2', title: 'Second', updated: '2026-09-02T10:00:00Z' },
];

type Result = {
  status: number;
  headers: IncomingHttpHeaders;
  text: string;
  json: any; // the parsed body, or null when the response is not JSON
};

/**
 * One request through a fresh socket, so no keep-alive connection outlives a test.  A body always
 * names its length: the client only frames a body by itself for POST, PUT and PATCH.
 */
function request(
  fixture: Fixture,
  options: { method?: string; path: string; headers?: Record<string, string>; body?: string },
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers ?? {}) };
    if (options.body !== undefined && headers['content-length'] === undefined)
      headers['content-length'] = String(Buffer.byteLength(options.body));
    const outgoing = httpRequest(
      {
        host: '127.0.0.1',
        port: fixture.port,
        method: options.method ?? 'GET',
        path: options.path,
        headers,
        agent: false,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json: unknown = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = null;
          }
          resolve({ status: response.statusCode ?? 0, headers: response.headers, text, json });
        });
      },
    );
    outgoing.on('error', reject);
    if (options.body !== undefined) outgoing.write(options.body);
    outgoing.end();
  });
}

/**
 * Sends more body than the reader accepts and leaves the request unfinished: the point is the
 * rejection while the bytes are still arriving, not what happens to the rest of them.  A reset
 * after the response is the server's right when it stops reading, so it is not a test failure.
 */
function oversize(
  fixture: Fixture,
  options: { path: string; headers: Record<string, string>; body: string },
): Promise<Result> {
  return new Promise((resolve, reject) => {
    let answered = false;
    const outgoing = httpRequest(
      {
        host: '127.0.0.1',
        port: fixture.port,
        method: 'PATCH',
        path: options.path,
        headers: options.headers,
        agent: false,
      },
      (response) => {
        answered = true;
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          outgoing.destroy();
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            text,
            json: JSON.parse(text),
          });
        });
      },
    );
    outgoing.on('error', (error) => {
      if (!answered) reject(error);
    });
    outgoing.write(options.body);
  });
}

function cookieOf(result: Result): string {
  const header = result.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : String(header ?? '');
  const match = /(?:^|;\s*)reader_session=([A-Za-z0-9_-]*)/.exec(value);
  assert.ok(match, 'the response must carry a reader session cookie');
  return match[1];
}

async function startFixture({ configured = true } = {}): Promise<Fixture> {
  const clock = { t: START };
  const store = openReaderStore(':memory:');
  if (configured) store.setAdminPassword(await createPasswordHash(PASSWORD));
  const fetches: string[] = [];
  const service = createReaderService({
    store,
    fetchFeed: async (url: string) => {
      fetches.push(url);
      return {
        url,
        etag: 'E1',
        lastModified: 'L1',
        notModified: false,
        xml: feedXml(TWO_ITEMS),
      };
    },
    now: () => clock.t,
  });
  let server: ReturnType<typeof createServer>;
  const port: number = await new Promise((resolve, reject) => {
    server = createServer((incoming, outgoing) => {
      Promise.resolve(handle(incoming, outgoing))
        .then((handled) => {
          // The reader answers for its own prefix only; everything else is the outer server's.
          if (!handled && !outgoing.headersSent)
            outgoing.writeHead(410, { 'content-type': 'text/plain' });
          if (!handled) outgoing.end('not the reader');
        })
        .catch(() => {
          if (!outgoing.headersSent)
            outgoing.writeHead(503, { 'content-type': 'application/json' });
          outgoing.end(JSON.stringify({ error: 'READER_UNAVAILABLE' }));
        });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') resolve(address.port);
      else reject(new Error('the test server has no port'));
    });
  });
  const origin = `http://127.0.0.1:${port}`;
  const auth = createReaderAuth({ store, allowedOrigin: origin, now: () => clock.t });
  const handle = createReaderHttp({ store, service, auth, now: () => clock.t });
  async function close() {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(() => resolve(undefined)));
    await service.stop();
    store.close();
  }
  return { store, service, auth, clock, fetches, port, origin, close };
}

/** Signs in and returns everything a management request needs. */
async function signIn(fixture: Fixture) {
  const login = await request(fixture, {
    method: 'POST',
    path: '/api/reader/admin/login',
    headers: { origin: fixture.origin, 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert.equal(login.status, 200);
  const cookie = cookieOf(login);
  const csrf = login.json?.csrfToken as string;
  assert.equal(typeof csrf, 'string');
  const headers = {
    origin: fixture.origin,
    'content-type': 'application/json',
    cookie: `reader_session=${cookie}`,
    'x-reader-csrf': csrf,
  };
  return { cookie, csrf, headers, login };
}

test('public reads need no session and expose only the public projection', async () => {
  const fixture = await startFixture({ configured: false });
  try {
    // An unconfigured reader still answers, and hands out no cookie.
    const session = await request(fixture, { path: '/api/reader/admin/session' });
    assert.equal(session.status, 200);
    assert.deepEqual(session.json, { configured: false, authenticated: false });
    assert.equal(session.headers['set-cookie'], undefined);

    const empty = await request(fixture, { path: '/api/reader/sources' });
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.json, { sources: [] });
    assert.equal(empty.headers['cache-control'], 'no-store');
    assert.equal(empty.headers['x-content-type-options'], 'nosniff');
    const entries = await request(fixture, { path: '/api/reader/entries' });
    assert.deepEqual(entries.json, { entries: [], nextCursor: null });

    // Another path belongs to whoever owns the outer server.
    const foreign = await request(fixture, { path: '/api/probe' });
    assert.equal(foreign.status, 410); // the fixture's own answer for a declined path
    assert.deepEqual(fixture.fetches, []); // and no read here reached any feed

    // A configured reader keeps the same public shape, still without a session.
    const configured = await startFixture();
    try {
      await request(configured, {
        method: 'POST',
        path: '/api/reader/admin/login',
        headers: { origin: configured.origin, 'content-type': 'application/json' },
        body: JSON.stringify({ password: PASSWORD }),
      });
      const { headers } = await signIn(configured);
      const created = await request(configured, {
        method: 'POST',
        path: '/api/reader/admin/sources',
        headers,
        body: JSON.stringify({ feedUrl: FEED_URL, title: 'Mine' }),
      });
      assert.equal(created.status, 201);
      await configured.service.idle();

      const publicList = await request(configured, { path: '/api/reader/sources' });
      assert.equal(publicList.status, 200);
      assert.equal(
        Object.keys(publicList.json.sources[0]).join(','),
        'id,title,siteUrl,enabled,status,lastAttemptAt,lastSuccessAt,nextFetchAt,errorCode,entryCount',
      );
      assert.equal(publicList.text.includes('feedUrl'), false);
      assert.equal(publicList.text.includes('lease'), false);
      assert.equal(publicList.text.includes('passwordHash'), false);
      assert.equal(publicList.text.includes('etag'), false);

      const feed = await request(configured, { path: '/api/reader/entries' });
      assert.equal(feed.json.entries.length, 2);
      assert.equal(feed.text.includes('contentHtml'), false); // the list stays lighter than a detail
      assert.equal(typeof feed.json.entries[0].summaryHtml, 'string');
      const detail = await request(configured, {
        path: `/api/reader/entries/${feed.json.entries[0].id}`,
      });
      assert.equal(detail.status, 200);
      assert.equal(typeof detail.json.contentHtml, 'string');
      assert.equal(detail.text.includes('feedUrl'), false);
      assert.equal(
        (await request(configured, { path: '/api/reader/entries/' + 'a'.repeat(64) })).status,
        404,
      );
    } finally {
      await configured.close();
    }
  } finally {
    await fixture.close();
  }
});

test('the admin surface refuses anonymous and cross-site management', async () => {
  const fixture = await startFixture();
  try {
    const anonymousRead = await request(fixture, { path: '/api/reader/admin/sources' });
    assert.equal(anonymousRead.status, 401);
    assert.deepEqual(anonymousRead.json, { error: 'AUTH_REQUIRED' });

    const { cookie, csrf } = await signIn(fixture);
    const authed = { cookie: `reader_session=${cookie}`, 'x-reader-csrf': csrf };
    const write = {
      method: 'POST',
      path: '/api/reader/admin/sources',
      body: JSON.stringify({ feedUrl: FEED_URL }),
      'content-type': 'application/json',
    } as const;

    // No origin at all is refused before anything else.
    const noOrigin = await request(fixture, { ...write, headers: authed });
    assert.equal(noOrigin.status, 403);
    assert.deepEqual(noOrigin.json, { error: 'ORIGIN_DENIED' });
    const crossSite = await request(fixture, {
      ...write,
      headers: { ...authed, origin: fixture.origin, 'sec-fetch-site': 'cross-site' },
    });
    assert.equal(crossSite.status, 403);
    const wrongOrigin = await request(fixture, {
      ...write,
      headers: { ...authed, origin: 'https://evil.example' },
    });
    assert.equal(wrongOrigin.status, 403);

    // With an origin but no session, and with a session but no CSRF token.
    const noSession = await request(fixture, {
      ...write,
      headers: { origin: fixture.origin, 'content-type': 'application/json' },
    });
    assert.equal(noSession.status, 401);
    assert.deepEqual(noSession.json, { error: 'AUTH_REQUIRED' });
    const noCsrf = await request(fixture, {
      ...write,
      headers: {
        origin: fixture.origin,
        'content-type': 'application/json',
        cookie: authed.cookie,
      },
    });
    assert.equal(noCsrf.status, 403);
    assert.deepEqual(noCsrf.json, { error: 'CSRF_DENIED' });
    const wrongCsrf = await request(fixture, {
      ...write,
      headers: {
        ...authed,
        origin: fixture.origin,
        'content-type': 'application/json',
        'x-reader-csrf': 'x'.repeat(43),
      },
    });
    assert.equal(wrongCsrf.status, 403);

    // A forged cookie is not a session either.
    const forged = await request(fixture, {
      ...write,
      headers: {
        origin: fixture.origin,
        'content-type': 'application/json',
        cookie: `reader_session=${'y'.repeat(43)}`,
        'x-reader-csrf': csrf,
      },
    });
    assert.equal(forged.status, 401);
    assert.deepEqual(fixture.fetches, []); // none of these attempts reached a feed
    assert.deepEqual(fixture.store.listEntries({}).entries, []);
  } finally {
    await fixture.close();
  }
});

test('login hands back a cookie and a csrf token, and the reader keeps the token to itself', async () => {
  const fixture = await startFixture({ configured: false });
  try {
    const unconfigured = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/login',
      headers: { origin: fixture.origin, 'content-type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    assert.equal(unconfigured.status, 503);
    assert.deepEqual(unconfigured.json, { error: 'ADMIN_UNCONFIGURED' });

    fixture.store.setAdminPassword(await createPasswordHash(PASSWORD));
    const wrong = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/login',
      headers: { origin: fixture.origin, 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.json, { error: 'INVALID_CREDENTIALS' });
    assert.equal(wrong.text.includes('scrypt'), false); // no hash material travels back
    assert.equal(wrong.headers['set-cookie'], undefined);

    const { login, cookie, csrf, headers } = await signIn(fixture);
    const cookieHeader = String(login.headers['set-cookie']);
    assert.match(cookieHeader, /HttpOnly/);
    assert.match(cookieHeader, /SameSite=Strict/);
    assert.match(cookieHeader, /Path=\/api\/reader\/admin/);
    assert.match(cookieHeader, new RegExp(`Max-Age=${12 * 60 * 60}`));
    assert.equal(login.text.includes(cookie), false); // the raw token never comes back in the body
    assert.equal(cookie.length, 43);
    assert.equal(fixture.store.getSession(cookie, fixture.clock.t), null); // only a hash is stored

    // The session endpoint reports the same state to the signed-in reader.
    const session = await request(fixture, {
      path: '/api/reader/admin/session',
      headers: { cookie: `reader_session=${cookie}` },
    });
    assert.deepEqual(session.json, { configured: true, authenticated: true, csrfToken: csrf });
    const anonymous = await request(fixture, { path: '/api/reader/admin/session' });
    assert.deepEqual(anonymous.json, { configured: true, authenticated: false });

    // Logging out revokes the token unconditionally.
    const logout = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/logout',
      headers,
      body: JSON.stringify({}),
    });
    assert.equal(logout.status, 200);
    assert.deepEqual(logout.json, { ok: true });
    const afterLogout = await request(fixture, {
      path: '/api/reader/admin/session',
      headers: { cookie: `reader_session=${cookie}` },
    });
    assert.deepEqual(afterLogout.json, { configured: true, authenticated: false });
    const reuse = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/sources',
      headers,
      body: JSON.stringify({ feedUrl: FEED_URL }),
    });
    assert.equal(reuse.status, 401);
  } finally {
    await fixture.close();
  }
});

test('an administrator manages sources and the public reader sees each change', async () => {
  const fixture = await startFixture();
  try {
    const { headers } = await signIn(fixture);
    const created = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/sources',
      headers,
      body: JSON.stringify({ feedUrl: FEED_URL, title: 'Mine' }),
    });
    assert.equal(created.status, 201);
    const id = created.json.source.id as string;
    assert.equal(created.json.source.feedUrl, FEED_URL); // the admin view carries the url
    assert.equal(created.json.source.title, 'Mine');
    assert.equal('leaseToken' in created.json.source, false);
    await fixture.service.idle();
    assert.deepEqual(fixture.fetches, [FEED_URL]); // exactly the subscribed url, nothing else

    const adminList = await request(fixture, { path: '/api/reader/admin/sources', headers });
    assert.equal(adminList.status, 200);
    assert.equal(adminList.json.sources.length, 1);
    const publicList = await request(fixture, { path: '/api/reader/sources' });
    assert.equal(publicList.json.sources[0].entryCount, 2);

    const paused = await request(fixture, {
      method: 'PATCH',
      path: `/api/reader/admin/sources/${id}`,
      headers,
      body: JSON.stringify({ enabled: false }),
    });
    assert.equal(paused.status, 200);
    assert.equal(paused.json.source.enabled, false);
    assert.equal(paused.json.source.status, 'paused');
    assert.equal(
      (await request(fixture, { path: '/api/reader/sources' })).json.sources[0].enabled,
      false,
    );

    const resumed = await request(fixture, {
      method: 'PATCH',
      path: `/api/reader/admin/sources/${id}`,
      headers,
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(resumed.json.source.enabled, true);
    assert.equal(resumed.json.source.status, 'pending');

    const refresh = await request(fixture, {
      method: 'POST',
      path: `/api/reader/admin/sources/${id}/refresh`,
      headers,
      body: JSON.stringify({}),
    });
    assert.equal(refresh.status, 202);
    assert.deepEqual(refresh.json, { queued: true });
    await fixture.service.idle();

    const cleared = await request(fixture, {
      method: 'DELETE',
      path: `/api/reader/admin/sources/${id}/entries`,
      headers,
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(cleared.status, 200);
    assert.deepEqual(cleared.json, { ok: true });
    await fixture.service.idle(); // the clear queued its own refetch
    const rebuilt = fixture.store.listEntries({}).entries;
    assert.deepEqual(
      rebuilt.map((item) => item.title).sort(),
      ['First', 'Second'], // the cache was dropped and rebuilt, and the source stayed
    );
    assert.equal(fixture.store.getSource(id)?.etag, 'E1');

    const removed = await request(fixture, {
      method: 'DELETE',
      path: `/api/reader/admin/sources/${id}`,
      headers,
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.json, { ok: true });
    assert.deepEqual((await request(fixture, { path: '/api/reader/sources' })).json.sources, []);
    assert.deepEqual(fixture.store.listEntries({}).entries, []);
  } finally {
    await fixture.close();
  }
});

test('a management write is refused when the session is revoked while its body is in flight', async () => {
  const fixture = await startFixture();
  try {
    const { headers } = await signIn(fixture);
    const checks: string[] = [];
    let seenFirst = () => {};
    const firstCheck = new Promise<void>((resolve) => {
      seenFirst = resolve;
    });
    // A recorder around the real auth, so the test can see both checks of one request.
    const recorder = {
      ...fixture.auth,
      requireWrite(request: unknown) {
        checks.push('write');
        seenFirst();
        return fixture.auth.requireWrite(request);
      },
    };
    const handler = createReaderHttp({
      store: fixture.store,
      service: fixture.service,
      auth: recorder,
      now: () => fixture.clock.t,
    });
    // The fixture's server keeps using its own handler; this one is called directly, so the same
    // double check is exercised without a second socket.
    const gateway = createServer((incoming, outgoing) => {
      Promise.resolve(handler(incoming, outgoing)).then((handled) => {
        if (!handled && !outgoing.headersSent) outgoing.writeHead(410).end();
      });
    });
    const port: number = await new Promise((resolve) => {
      gateway.listen(0, '127.0.0.1', () => resolve((gateway.address() as { port: number }).port));
    });

    const body = JSON.stringify({ feedUrl: 'https://feeds.example.net/late.xml' });
    const half = Math.floor(body.length / 2);
    const pending = new Promise<Result>((resolve, reject) => {
      const outgoing = httpRequest(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: '/api/reader/admin/sources',
          headers: {
            ...headers,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
          },
          agent: false,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              text,
              json: JSON.parse(text),
            });
          });
        },
      );
      outgoing.on('error', reject);
      outgoing.write(body.slice(0, half));
      // The first check has run, so the request is accepted and waiting for the rest of its body.
      firstCheck.then(() => {
        fixture.store.setAdminPassword(fixture.store.getAdmin()!.passwordHash); // revokes every session
        outgoing.write(body.slice(half));
        outgoing.end();
      });
    });

    const result = await pending;
    assert.equal(result.status, 401);
    assert.deepEqual(result.json, { error: 'AUTH_REQUIRED' });
    assert.equal(checks.length, 2); // once before the body, once after parsing it
    assert.deepEqual(fixture.store.listSources(true), []); // and nothing was created
    assert.deepEqual(fixture.fetches, []); // nor was any feed requested
    assert.equal(result.headers['set-cookie'], undefined);

    gateway.closeAllConnections?.();
    await new Promise((resolve) => gateway.close(() => resolve(undefined)));
  } finally {
    await fixture.close();
  }
});

test('the write surface bounds bodies, keys, confirmations and rate', async () => {
  const fixture = await startFixture();
  try {
    const { headers } = await signIn(fixture);
    const source = fixture.store.addSource({ feedUrl: FEED_URL }, fixture.clock.t);
    const original = fixture.store.getSource(source.id)!;
    const base = `/api/reader/admin/sources/${source.id}`;

    const noJson = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/sources',
      headers: { ...headers, 'content-type': 'text/plain' },
      body: '{}',
    });
    assert.equal(noJson.status, 415);
    assert.deepEqual(noJson.json, { error: 'JSON_REQUIRED' });

    const broken = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/sources',
      headers,
      body: '{not json',
    });
    assert.equal(broken.status, 400);
    assert.deepEqual(broken.json, { error: 'INVALID_BODY' });

    const oversizedBody = JSON.stringify({ title: 'x'.repeat(5000) });
    const oversized = await oversize(fixture, {
      path: base,
      headers: { ...headers, 'content-length': String(Buffer.byteLength(oversizedBody)) },
      body: oversizedBody,
    });
    assert.equal(oversized.status, 413); // the declared length is checked before any body is read
    assert.deepEqual(oversized.json, { error: 'BODY_TOO_LARGE' });

    const unknownKey = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/sources',
      headers,
      body: JSON.stringify({ feedUrl: FEED_URL, admin: true }),
    });
    assert.equal(unknownKey.status, 400);
    assert.deepEqual(unknownKey.json, { error: 'INVALID_BODY' });

    const emptyPatch = await request(fixture, { method: 'PATCH', path: base, headers, body: '{}' });
    assert.equal(emptyPatch.status, 400);
    assert.deepEqual(emptyPatch.json, { error: 'INVALID_SOURCE' });
    const wrongType = await request(fixture, {
      method: 'PATCH',
      path: base,
      headers,
      body: JSON.stringify({ enabled: 'yes' }),
    });
    assert.equal(wrongType.status, 400);

    const noConfirm = await request(fixture, {
      method: 'DELETE',
      path: base,
      headers,
      body: JSON.stringify({ confirm: 'true' }),
    });
    assert.equal(noConfirm.status, 400);
    assert.deepEqual(noConfirm.json, { error: 'CONFIRM_REQUIRED' });
    const extraKey = await request(fixture, {
      method: 'DELETE',
      path: base,
      headers,
      body: JSON.stringify({ confirm: true, also: 1 }),
    });
    assert.equal(extraKey.status, 400);

    const badId = await request(fixture, {
      method: 'DELETE',
      path: '/api/reader/admin/sources/not-a-uuid',
      headers,
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(badId.status, 404);
    const wrongMethod = await request(fixture, { method: 'PUT', path: base, headers, body: '{}' });
    assert.equal(wrongMethod.status, 405);
    const queryOnWrite = await request(fixture, {
      method: 'PATCH',
      path: `${base}?confirm=1`,
      headers,
      body: JSON.stringify({ title: 'x' }),
    });
    assert.equal(queryOnWrite.status, 400);
    assert.deepEqual(queryOnWrite.json, { error: 'INVALID_QUERY' });
    assert.equal(fixture.store.getSource(source.id)?.title, original.title); // nothing above applied
  } finally {
    await fixture.close();
  }
});

test('a streaming body over the limit is cut off and the connection is closed', async () => {
  const fixture = await startFixture();
  try {
    const { headers } = await signIn(fixture);
    // Chunked, with no content-length, so only the streamed size can stop it.  The first two
    // writes already carry more than the reader accepts.
    const payload = JSON.stringify({ title: 'x'.repeat(6000) });
    const result = await oversize(fixture, {
      path: `/api/reader/admin/sources/${'a'.repeat(8)}-${'b'.repeat(4)}-${'c'.repeat(4)}-${'d'.repeat(4)}-${'e'.repeat(12)}`,
      headers: { ...headers, 'content-type': 'application/json' },
      body: payload.slice(0, 5000),
    });
    assert.equal(result.status, 413);
    assert.deepEqual(result.json, { error: 'BODY_TOO_LARGE' });
    assert.equal(result.headers.connection, 'close');
  } finally {
    await fixture.close();
  }
});

test('sixty writes a minute are allowed and the next one is asked to wait', async () => {
  const fixture = await startFixture();
  try {
    const { headers } = await signIn(fixture); // the login itself already used one write
    const path = `/api/reader/admin/sources/${'0'.repeat(8)}-0000-0000-0000-${'0'.repeat(12)}`;
    for (let attempt = 1; attempt <= 59; attempt += 1) {
      const result = await request(fixture, {
        method: 'DELETE',
        path,
        headers,
        body: JSON.stringify({ confirm: false }),
      });
      assert.equal(result.status, 400, `write ${attempt}`);
    }
    const limited = await request(fixture, {
      method: 'DELETE',
      path,
      headers,
      body: JSON.stringify({ confirm: false }),
    });
    assert.equal(limited.status, 429);
    assert.deepEqual(limited.json, { error: 'RATE_LIMITED' });
    assert.equal(limited.headers['retry-after'], '60');

    // The window rolls a minute later.
    fixture.clock.t += 60_000;
    const after = await request(fixture, {
      method: 'DELETE',
      path,
      headers,
      body: JSON.stringify({ confirm: false }),
    });
    assert.equal(after.status, 400);
  } finally {
    await fixture.close();
  }
});

test('public queries are bounded and a public read never reaches a feed', async () => {
  const fixture = await startFixture();
  try {
    const { headers } = await signIn(fixture);
    await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/sources',
      headers,
      body: JSON.stringify({ feedUrl: FEED_URL }),
    });
    await fixture.service.idle();
    const fetchesAfterCreate = fixture.fetches.length;
    assert.equal(fetchesAfterCreate, 1);

    const tooLong = await request(fixture, { path: `/api/reader/entries?q=${'x'.repeat(101)}` });
    assert.equal(tooLong.status, 400);
    assert.deepEqual(tooLong.json, { error: 'INVALID_QUERY' });
    const unknownKey = await request(fixture, {
      path: '/api/reader/entries?url=https://internal.example',
    });
    assert.equal(unknownKey.status, 400);
    assert.deepEqual(unknownKey.json, { error: 'INVALID_QUERY' });
    const twice = await request(fixture, { path: '/api/reader/entries?q=a&q=b' });
    assert.equal(twice.status, 400);

    for (const cursor of [
      'not-a-cursor',
      '*',
      'eyJhIjoxfQ',
      Buffer.from('[]').toString('base64url'),
    ]) {
      const bad = await request(fixture, {
        path: `/api/reader/entries?cursor=${encodeURIComponent(cursor)}`,
      });
      assert.equal(bad.status, 400, cursor);
      assert.deepEqual(bad.json, { error: 'INVALID_CURSOR' });
    }

    const escaped = await request(fixture, { path: '/api/reader/entries?q=%25' }); // a literal percent
    assert.equal(escaped.status, 200);
    assert.deepEqual(escaped.json, { entries: [], nextCursor: null });
    const filtered = await request(fixture, { path: '/api/reader/entries?source=missing&q=First' });
    assert.deepEqual(filtered.json, { entries: [], nextCursor: null });
    const found = await request(fixture, { path: '/api/reader/entries?q=First' });
    assert.equal(found.json.entries.length, 1);
    assert.equal(found.json.entries[0].title, 'First');
    // No public read, however malformed, asked for a feed or changed the reader.
    assert.equal(fixture.fetches.length, fetchesAfterCreate);
    assert.equal(fixture.store.listSources()[0].entryCount, 2);
  } finally {
    await fixture.close();
  }
});

test('an unexpected failure becomes a bounded 503 and never leaks the raw error', async () => {
  const fixture = await startFixture();
  try {
    const { headers } = await signIn(fixture);
    const exploding = createReaderHttp({
      store: fixture.store,
      service: {
        idle: async () => {},
        stop: async () => {},
        addSource() {
          throw new Error('boom: http://internal.example/secret?token=raw');
        },
      } as unknown as Service,
      auth: fixture.auth,
      now: () => fixture.clock.t,
    });
    const gateway = createServer((incoming, outgoing) => {
      Promise.resolve(exploding(incoming, outgoing)).then((handled) => {
        if (!handled && !outgoing.headersSent) outgoing.writeHead(410).end();
      });
    });
    const port: number = await new Promise((resolve) => {
      gateway.listen(0, '127.0.0.1', () => resolve((gateway.address() as { port: number }).port));
    });
    try {
      const result = await new Promise<Result>((resolve, reject) => {
        const outgoing = httpRequest(
          {
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: '/api/reader/admin/sources',
            headers: { ...headers, 'content-type': 'application/json' },
            agent: false,
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () =>
              resolve({
                status: response.statusCode ?? 0,
                headers: response.headers,
                text: Buffer.concat(chunks).toString('utf8'),
                json: null,
              }),
            );
          },
        );
        outgoing.on('error', reject);
        outgoing.end(JSON.stringify({ feedUrl: FEED_URL }));
      });
      assert.equal(result.status, 503);
      assert.deepEqual(JSON.parse(result.text), { error: 'READER_UNAVAILABLE' });
      for (const leak of ['boom', 'internal.example', 'secret', 'raw', 'Error'])
        assert.equal(result.text.includes(leak), false, leak);

      // A known ReaderError keeps its own bounded code and status, still without its message.
      const limit = new ReaderError('SOURCE_LIMIT', 409);
      limit.message = 'the fifty-first feed https://internal.example was refused';
      const known = createReaderHttp({
        store: fixture.store,
        service: {
          idle: async () => {},
          stop: async () => {},
          addSource() {
            throw limit;
          },
        } as unknown as Service,
        auth: fixture.auth,
        now: () => fixture.clock.t,
      });
      const second = createServer((incoming, outgoing) => {
        Promise.resolve(known(incoming, outgoing)).then((handled) => {
          if (!handled && !outgoing.headersSent) outgoing.writeHead(410).end();
        });
      });
      const secondPort: number = await new Promise((resolve) => {
        second.listen(0, '127.0.0.1', () => resolve((second.address() as { port: number }).port));
      });
      const knownResult = await new Promise<Result>((resolve, reject) => {
        const outgoing = httpRequest(
          {
            host: '127.0.0.1',
            port: secondPort,
            method: 'POST',
            path: '/api/reader/admin/sources',
            headers: { ...headers, 'content-type': 'application/json' },
            agent: false,
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on('data', (chunk: Buffer) => chunks.push(chunk));
            response.on('end', () =>
              resolve({
                status: response.statusCode ?? 0,
                headers: response.headers,
                text: Buffer.concat(chunks).toString('utf8'),
                json: null,
              }),
            );
          },
        );
        outgoing.on('error', reject);
        outgoing.end(JSON.stringify({ feedUrl: FEED_URL }));
      });
      assert.equal(knownResult.status, 409);
      assert.deepEqual(JSON.parse(knownResult.text), { error: 'SOURCE_LIMIT' });
      assert.equal(knownResult.text.includes('internal.example'), false);
      second.closeAllConnections?.();
      await new Promise((resolve) => second.close(() => resolve(undefined)));
    } finally {
      gateway.closeAllConnections?.();
      await new Promise((resolve) => gateway.close(() => resolve(undefined)));
    }
  } finally {
    await fixture.close();
  }
});

test('changing the password demands a strong one and revokes the session that asked', async () => {
  const fixture = await startFixture();
  try {
    const { headers } = await signIn(fixture);
    const short = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/password',
      headers,
      body: JSON.stringify({ currentPassword: PASSWORD, newPassword: 'too-short' }),
    });
    assert.equal(short.status, 400);
    assert.deepEqual(short.json, { error: 'INVALID_PASSWORD' });
    const wrongCurrent = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/password',
      headers,
      body: JSON.stringify({
        currentPassword: 'not-the-password',
        newPassword: 'a-perfectly-fine-one',
      }),
    });
    assert.equal(wrongCurrent.status, 401);
    assert.deepEqual(wrongCurrent.json, { error: 'INVALID_CREDENTIALS' });

    const changed = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/password',
      headers,
      body: JSON.stringify({ currentPassword: PASSWORD, newPassword: 'a-perfectly-fine-one' }),
    });
    assert.equal(changed.status, 200);
    assert.deepEqual(changed.json, { ok: true });
    assert.match(String(changed.headers['set-cookie']), /Max-Age=0/); // the client is logged out

    const reuse = await request(fixture, {
      method: 'GET',
      path: '/api/reader/admin/sources',
      headers,
    });
    assert.equal(reuse.status, 401); // the session died with the password it belonged to
    assert.equal(fixture.store.getAdmin()?.version, 2);

    const relogin = await request(fixture, {
      method: 'POST',
      path: '/api/reader/admin/login',
      headers: { origin: fixture.origin, 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'a-perfectly-fine-one' }),
    });
    assert.equal(relogin.status, 200);
  } finally {
    await fixture.close();
  }
});
