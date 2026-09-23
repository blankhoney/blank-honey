/* Targeted tests for the feed fetcher (server/reader/fetch.mjs).
 *
 * No test opens a socket. DNS is the injected `resolve` and the HTTP exchange is an injected
 * `transport` that returns an EventEmitter request plus a synthetic Readable response; the fake
 * request honors options.signal the way a real ClientRequest does, so the abort and timeout paths
 * run without a network or a listening port. Addresses are plain strings, never contacted.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib';
import test from 'node:test';
import { createFeedFetcher, validateFeedUrl } from '../server/reader/fetch.mjs';
import { LIMITS, ReaderError } from '../server/reader/model.mjs';

type LookupAddress = { address: string; family: number };
/** The fetcher only ever asks DNS for every address: the exact resolver contract it accepts. */
type Resolver = (
  hostname: string,
  options: { all: true; verbatim?: boolean },
) => Promise<LookupAddress[]>;
/** Synthetic response headers mirror IncomingHttpHeaders, where any header may be absent. */
type SyntheticHeaders = Record<string, string | undefined>;
type Planned = {
  statusCode: number;
  headers?: SyntheticHeaders;
  body?: Buffer | Buffer[] | null;
};
type FetchOptions = { signal?: AbortSignal; etag?: string; lastModified?: string };
type FetchResult = {
  url: string;
  etag: string | null;
  lastModified: string | null;
  notModified: boolean;
  xml?: string;
};
type TransportOptions = {
  protocol: string;
  hostname: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  signal?: AbortSignal;
  family?: number;
  servername?: string;
  agent: unknown;
  maxHeaderSize: number;
  rejectUnauthorized: boolean;
  lookup: (
    hostname: string,
    options: { all?: boolean },
    callback: (...args: never[]) => void,
  ) => void;
};
type Failure = { code?: string; status?: number; retryAfterMs?: number };

const FEED_URL = 'https://feeds.example.org/rss.xml';
const FEED_HOST = 'feeds.example.org';
const FEED =
  '<?xml version="1.0"?><rss version="2.0"><channel><title>Example</title></channel></rss>';
/** A public unicast address used only as a string; no socket is ever opened for it. */
const PUBLIC_ADDRESS: LookupAddress = { address: '93.184.216.34', family: 4 };

function synthesizeResponse({ statusCode, headers = {}, body = null }: Planned): Readable {
  const chunks = body === null ? [] : Array.isArray(body) ? body : [body];
  const response = Readable.from(chunks) as Readable & {
    statusCode: number;
    headers: SyntheticHeaders;
  };
  response.statusCode = statusCode;
  response.headers = headers;
  return response;
}

/** An http.ClientRequest stand-in; `end()` starts the exchange, `null` never answers. */
function createTransport(handler: (options: TransportOptions, attempt: number) => Planned | null) {
  const calls: TransportOptions[] = [];
  function transport(options: TransportOptions, callback: (response: Readable) => void) {
    calls.push(options);
    const request = new EventEmitter() as EventEmitter & { end: () => void };
    request.end = () => {
      options.signal?.addEventListener(
        'abort',
        () => request.emit('error', new Error('socket aborted')),
        { once: true },
      );
      queueMicrotask(() => {
        const planned = handler(options, calls.length);
        if (planned !== null) callback(synthesizeResponse(planned));
      });
    };
    return request;
  }
  return { transport, calls };
}

function recordingResolve(result: LookupAddress[] = [PUBLIC_ADDRESS]) {
  const hostnames: string[] = [];
  const resolve: Resolver = async (hostname) => {
    hostnames.push(hostname);
    return result;
  };
  return { resolve, hostnames };
}

/** For answers that deliberately break the resolver contract, such as a malformed DNS reply. */
function scriptedResolve(answer: unknown) {
  const hostnames: string[] = [];
  const resolve = (async (hostname: string) => {
    hostnames.push(hostname);
    return answer;
  }) as Resolver;
  return { resolve, hostnames };
}

/** The fetcher only ever calls the seam as `transport(options, callback)`; the module declares it `Function`. */
type TransportSeam = (
  options: TransportOptions,
  callback: (response: Readable) => void,
) => EventEmitter;

function fetcher({
  transport,
  resolve,
  now,
}: {
  transport: TransportSeam;
  resolve: Resolver;
  now?: () => number;
}) {
  return createFeedFetcher({ transport, resolve, ...(now ? { now } : {}) }) as (
    url: string,
    options?: FetchOptions,
  ) => Promise<FetchResult>;
}

/** Asserts the designed rejection and returns it, so callers can inspect bounded extras. */
async function expectFailure(
  work: Promise<unknown>,
  code: string,
  status: number,
  label = '',
): Promise<Failure> {
  const error = await work.then(
    () => null,
    (caught: unknown) => caught,
  );
  assert.ok(
    error instanceof ReaderError,
    `${label} expected a ReaderError, received ${String(error)}`,
  );
  const failure = error as Failure;
  assert.equal(failure.code, code, `${label} expected code ${code}`);
  assert.equal(failure.status, status, `${label} expected status ${status}`);
  return failure;
}

/** The settled value or the rejection reason, for asserting exact abort reasons. */
async function settleWith(work: Promise<unknown>): Promise<unknown> {
  return work.then(
    () => null,
    (error: unknown) => error,
  );
}

/** Aborts `controller` after `ms` and waits for `work`, so an abort test cannot outlive itself. */
async function abortAfter(
  controller: AbortController,
  ms: number,
  reason: unknown,
  work: Promise<unknown>,
): Promise<unknown> {
  const timer = setTimeout(() => controller.abort(reason), ms);
  return settleWith(work).finally(() => clearTimeout(timer));
}

function ok(body: Buffer | Buffer[] = Buffer.from(FEED), headers: SyntheticHeaders = {}): Planned {
  return { statusCode: 200, headers, body };
}

test('rejects URLs that are not plain http(s) with a permitted port', () => {
  const rejected = [
    'ftp://feeds.example.org/rss.xml',
    'file:///etc/passwd',
    'data:text/xml,<rss/>',
    'javascript:alert(1)',
    'http://feeds.example.org:8080/rss.xml',
    'https://feeds.example.org:22/rss.xml',
    'http://user:secret@feeds.example.org/rss.xml',
    'http://user@feeds.example.org/rss.xml',
    'http://feeds.example.org@evil.example.net/rss.xml',
    'http://feeds.example.org/rs s.xml',
    'http://feeds.example.org/rss.xml\n',
    'http://feeds.example.org/\u0000',
    `http://feeds.example.org/${'a'.repeat(2048)}`,
    'not a url',
    '//feeds.example.org/rss.xml',
  ];
  for (const value of rejected) {
    assert.throws(
      () => validateFeedUrl(value),
      (error: unknown) => (error as Failure).code === 'INVALID_URL',
      `expected INVALID_URL for ${JSON.stringify(value)}`,
    );
  }
  assert.throws(
    () => validateFeedUrl(undefined as unknown as string),
    (error: unknown) => {
      assert.equal((error as Failure).code, 'INVALID_URL');
      return true;
    },
  );
  // The port rule is a whitelist, not a ban list; the default port is elided by URL normalization.
  assert.equal(
    validateFeedUrl('http://feeds.example.org:80/rss.xml').href,
    'http://feeds.example.org/rss.xml',
  );
  assert.equal(validateFeedUrl('https://feeds.example.org:443/rss.xml').href, FEED_URL);
});

test('strips the fragment from an accepted URL', () => {
  assert.equal(validateFeedUrl('https://feeds.example.org/rss.xml#top').href, FEED_URL);
});

test('refuses an invalid URL before any DNS query or request', async () => {
  const { transport, calls } = createTransport(() => ok());
  const { resolve, hostnames } = recordingResolve();
  await expectFailure(
    fetcher({ transport, resolve })('http://feeds.example.org:8080/rss.xml'),
    'INVALID_URL',
    400,
  );
  assert.deepEqual(hostnames, []);
  assert.deepEqual(calls, []);
});

test('pins the verified address in lookup and keeps Host, SNI and TLS settings', async () => {
  const { transport, calls } = createTransport(() => ok());
  const { resolve, hostnames } = recordingResolve();
  const result = await fetcher({ transport, resolve })(FEED_URL);

  assert.deepEqual(hostnames, [FEED_HOST], 'DNS runs exactly once per hop');
  assert.equal(calls.length, 1);
  const options = calls[0];
  assert.equal(options.protocol, 'https:');
  assert.equal(options.hostname, FEED_HOST, 'Host keeps the site name');
  assert.equal(options.servername, FEED_HOST, 'SNI keeps the site name');
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.method, 'GET');
  assert.equal(options.path, '/rss.xml');

  // The socket must use the verified address, whichever lookup form Node calls.
  const all = await new Promise((resolve2) => {
    options.lookup(FEED_HOST, { all: true }, (_error: unknown, addresses: unknown) =>
      resolve2(addresses),
    );
  });
  assert.deepEqual(all, [PUBLIC_ADDRESS]);
  const single = await new Promise((resolve2) => {
    options.lookup(FEED_HOST, {}, (_error: unknown, address: unknown, family: unknown) =>
      resolve2([address, family]),
    );
  });
  assert.deepEqual(single, [PUBLIC_ADDRESS.address, PUBLIC_ADDRESS.family]);

  assert.equal(result.url, FEED_URL);
  assert.equal(result.notModified, false);
  assert.equal(result.xml, FEED);
});

test('does not send a literal IP through DNS and does not use it as SNI', async () => {
  const { transport, calls } = createTransport(() => ok());
  const { resolve, hostnames } = recordingResolve();
  await fetcher({ transport, resolve })('http://93.184.216.34:80/rss.xml');
  assert.deepEqual(hostnames, []);
  assert.equal(calls[0].hostname, PUBLIC_ADDRESS.address);
  assert.equal(calls[0].servername, undefined);
});

test('denies every non-public address form without issuing a request', async () => {
  const literalHosts = [
    '127.0.0.1',
    '::1',
    '10.0.0.1',
    '172.16.5.4',
    '192.168.0.1',
    '100.64.0.1',
    '169.254.169.254',
    '240.0.0.1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    'fe80::1',
    '0.0.0.0',
  ];
  for (const host of literalHosts) {
    const { transport, calls } = createTransport(() => ok());
    const { resolve } = recordingResolve();
    const url = host.includes(':') ? `http://[${host}]/rss.xml` : `http://${host}/rss.xml`;
    await expectFailure(fetcher({ transport, resolve })(url), 'ADDRESS_DENIED', 422);
    assert.deepEqual(calls, [], `no request for ${host}`);
  }

  const resolved: Array<[string, unknown]> = [
    ['localhost', [{ address: '127.0.0.1', family: 4 }]],
    ['a private answer', [{ address: '192.168.1.10', family: 4 }]],
    ['a CGNAT answer', [{ address: '100.64.0.1', family: 4 }]],
    ['a link-local answer', [{ address: '169.254.169.254', family: 4 }]],
    ['a reserved answer', [{ address: '240.0.0.1', family: 4 }]],
    ['a documentation answer', [{ address: '2001:db8::1', family: 6 }]],
    ['a mapped answer', [{ address: '::ffff:127.0.0.1', family: 6 }]],
    [
      'a mixed answer',
      [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
    ],
    ['a family mismatch', [{ address: '93.184.216.34', family: 6 }]],
    ['an empty answer', []],
    ['a malformed answer', 'not-a-list'],
  ];
  for (const [label, answer] of resolved) {
    const { transport, calls } = createTransport(() => ok());
    const { resolve } = scriptedResolve(answer);
    await expectFailure(fetcher({ transport, resolve })(FEED_URL), 'ADDRESS_DENIED', 422, label);
    assert.deepEqual(calls, [], `no request for ${label}`);
  }
});

test('accepts a public IPv4 and IPv6 answer', async () => {
  const answers: LookupAddress[][] = [
    [{ address: '93.184.216.34', family: 4 }],
    [{ address: '2606:4700::1111', family: 6 }],
  ];
  for (const answer of answers) {
    const { transport, calls } = createTransport(() => ok());
    const { resolve } = recordingResolve(answer);
    const result = await fetcher({ transport, resolve })(FEED_URL);
    assert.equal(result.xml, FEED);
    assert.equal(calls[0].family, answer[0].family);
  }
});

test('re-validates every redirect target before requesting it', async () => {
  const { transport, calls } = createTransport(() => ({
    statusCode: 302,
    headers: { location: 'http://169.254.169.254/latest/meta-data/' },
  }));
  const { resolve } = recordingResolve();
  await expectFailure(fetcher({ transport, resolve })(FEED_URL), 'ADDRESS_DENIED', 422);
  assert.equal(calls.length, 1, 'the denied target is never requested');

  const control = createTransport(() => ({ statusCode: 301, headers: { location: '/a\tb' } }));
  await expectFailure(
    fetcher({ transport: control.transport, resolve })(FEED_URL),
    'INVALID_URL',
    422,
  );

  const scheme = createTransport(() => ({
    statusCode: 303,
    headers: { location: 'ftp://feeds.example.org/rss.xml' },
  }));
  await expectFailure(
    fetcher({ transport: scheme.transport, resolve })(FEED_URL),
    'INVALID_URL',
    400,
  );

  const missing = createTransport(() => ({ statusCode: 307, headers: {} }));
  await expectFailure(
    fetcher({ transport: missing.transport, resolve })(FEED_URL),
    'INVALID_URL',
    422,
  );
});

test('resolves a relative redirect against the current URL and follows up to three hops', async () => {
  const relative = createTransport((options) =>
    options.path === '/start' ? { statusCode: 301, headers: { location: 'nested/next' } } : ok(),
  );
  const { resolve } = recordingResolve();
  const result = await fetcher({ transport: relative.transport, resolve })(
    'https://feeds.example.org/start',
  );
  assert.equal(result.url, 'https://feeds.example.org/nested/next');
  assert.deepEqual(
    relative.calls.map((call) => call.path),
    ['/start', '/nested/next'],
  );

  const three = createTransport((_options, attempt) =>
    attempt <= 3 ? { statusCode: 307, headers: { location: `/hop${attempt}` } } : ok(),
  );
  await fetcher({ transport: three.transport, resolve })('https://feeds.example.org/hop0');
  assert.equal(three.calls.length, 4, 'three redirects plus the final request');

  const four = createTransport(() => ({ statusCode: 308, headers: { location: '/loop' } }));
  await expectFailure(
    fetcher({ transport: four.transport, resolve })('https://feeds.example.org/loop'),
    'TOO_MANY_REDIRECTS',
    422,
  );
  assert.equal(four.calls.length, 4);
});

test('does not forward conditional validators across origins', async () => {
  const { transport, calls } = createTransport((_options, attempt) => {
    if (attempt === 1)
      return { statusCode: 301, headers: { location: 'https://feeds.example.org/moved' } };
    if (attempt === 2)
      return { statusCode: 302, headers: { location: 'https://other.example.net/rss.xml' } };
    return ok();
  });
  const { resolve, hostnames } = recordingResolve();
  await fetcher({ transport, resolve })(FEED_URL, {
    etag: 'W/"cached"',
    lastModified: 'Mon, 02 Jan 2006 15:04:05 GMT',
  });
  assert.deepEqual(hostnames, [FEED_HOST, FEED_HOST, 'other.example.net']);
  assert.equal(calls[0].headers['If-None-Match'], 'W/"cached"');
  assert.equal(calls[0].headers['If-Modified-Since'], 'Mon, 02 Jan 2006 15:04:05 GMT');
  assert.equal(calls[1].headers['If-None-Match'], 'W/"cached"', 'same origin keeps the validator');
  assert.equal(calls[2].headers['If-None-Match'], undefined, 'another origin must not see it');
  assert.equal(calls[2].headers['If-Modified-Since'], undefined);
});

test('decompresses gzip, deflate and br bodies', async () => {
  const encodings: Array<[string, Buffer]> = [
    ['gzip', gzipSync(Buffer.from(FEED))],
    ['deflate', deflateSync(Buffer.from(FEED))],
    ['br', brotliCompressSync(Buffer.from(FEED))],
  ];
  for (const [encoding, body] of encodings) {
    const { transport } = createTransport(() => ok(body, { 'content-encoding': encoding }));
    const { resolve } = recordingResolve();
    const result = await fetcher({ transport, resolve })(FEED_URL);
    assert.equal(result.xml, FEED, `${encoding} body decodes`);
  }
});

test('rejects a decompression bomb that exceeds the response budget', async () => {
  const bomb = gzipSync(Buffer.alloc(LIMITS.responseBytes + 1024 * 1024, 0x61));
  assert.ok(bomb.length < LIMITS.responseBytes, 'the compressed body is itself small');
  const { transport } = createTransport(() => ok(bomb, { 'content-encoding': 'gzip' }));
  const { resolve } = recordingResolve();
  await expectFailure(fetcher({ transport, resolve })(FEED_URL), 'FEED_TOO_LARGE', 413);
});

test('rejects an oversized content-length and an oversized stream without one', async () => {
  const declared = createTransport(() =>
    ok(Buffer.from(FEED), { 'content-length': String(LIMITS.responseBytes + 1) }),
  );
  const { resolve } = recordingResolve();
  await expectFailure(
    fetcher({ transport: declared.transport, resolve })(FEED_URL),
    'FEED_TOO_LARGE',
    413,
  );

  const chunk = Buffer.alloc(1024 * 1024, 0x61);
  const streamed = createTransport(() => ok([chunk, chunk, chunk]));
  await expectFailure(
    fetcher({ transport: streamed.transport, resolve })(FEED_URL),
    'FEED_TOO_LARGE',
    413,
  );

  // Exactly at the budget is still accepted.
  const exact = createTransport(() =>
    ok(Buffer.from('a'.repeat(LIMITS.responseBytes - FEED.length) + FEED)),
  );
  const result = await fetcher({ transport: exact.transport, resolve })(FEED_URL);
  assert.equal(result.xml?.length, LIMITS.responseBytes);
});

test('rejects an unsupported encoding, charset or non-UTF-8 body', async () => {
  const { resolve } = recordingResolve();
  const cases: Array<[string, Planned]> = [
    ['content-encoding', ok(Buffer.from(FEED), { 'content-encoding': 'zstd' })],
    ['content-encoding compress', ok(Buffer.from(FEED), { 'content-encoding': 'compress' })],
    ['charset', ok(Buffer.from(FEED), { 'content-type': 'text/xml; charset=gbk' })],
    ['invalid UTF-8', ok(Buffer.from([0x3c, 0x72, 0x73, 0x73, 0xff, 0xfe, 0x3e]))],
    ['declared encoding', ok(Buffer.from('<?xml version="1.0" encoding="iso-8859-1"?><rss/>'))],
  ];
  for (const [label, planned] of cases) {
    const { transport } = createTransport(() => planned);
    await expectFailure(
      fetcher({ transport, resolve })(FEED_URL),
      'UNSUPPORTED_ENCODING',
      422,
      label,
    );
  }
  // UTF-8 spelled either way is accepted.
  for (const contentType of ['application/rss+xml; charset=utf-8', 'text/xml; charset=UTF8']) {
    const { transport } = createTransport(() =>
      ok(Buffer.from(FEED), { 'content-type': contentType }),
    );
    const result = await fetcher({ transport, resolve })(FEED_URL);
    assert.equal(result.xml, FEED);
  }
});

test('returns bounded validators only', async () => {
  const { transport } = createTransport(() =>
    ok(Buffer.from(FEED), {
      etag: 'W/"kept"',
      'last-modified': 'Mon, 02 Jan 2006 15:04:05 GMT',
    }),
  );
  const { resolve } = recordingResolve();
  assert.deepEqual(
    await fetcher({ transport, resolve })(FEED_URL).then((result) => ({
      etag: result.etag,
      lastModified: result.lastModified,
    })),
    { etag: 'W/"kept"', lastModified: 'Mon, 02 Jan 2006 15:04:05 GMT' },
  );

  const oversized = createTransport(() =>
    ok(Buffer.from(FEED), {
      etag: `W/"${'x'.repeat(1024)}"`,
      'last-modified': `Mon, 02 Jan 2006 15:04:05 GMT${'y'.repeat(1024)}`,
    }),
  );
  const result = await fetcher({ transport: oversized.transport, resolve })(FEED_URL);
  assert.equal(result.etag, null);
  assert.equal(result.lastModified, null);

  const hostile = createTransport(() => ok(Buffer.from(FEED), { etag: 'W/"a\r\nInjected: 1"' }));
  assert.equal((await fetcher({ transport: hostile.transport, resolve })(FEED_URL)).etag, null);
});

test('answers a conditional 304 and reports it as not modified', async () => {
  const { transport, calls } = createTransport(() => ({
    statusCode: 304,
    headers: { etag: 'W/"cached"', 'last-modified': 'Mon, 02 Jan 2006 15:04:05 GMT' },
  }));
  const { resolve } = recordingResolve();
  const result = await fetcher({ transport, resolve })(FEED_URL, { etag: 'W/"cached"' });
  assert.deepEqual(result, {
    url: FEED_URL,
    etag: 'W/"cached"',
    lastModified: 'Mon, 02 Jan 2006 15:04:05 GMT',
    notModified: true,
  });
  assert.equal(calls[0].headers['If-None-Match'], 'W/"cached"');
});

test('refuses an unsolicited or cross-origin 304', async () => {
  const { resolve } = recordingResolve();
  const unsolicited = createTransport(() => ({ statusCode: 304, headers: {} }));
  await expectFailure(
    fetcher({ transport: unsolicited.transport, resolve })(FEED_URL),
    'INVALID_NOT_MODIFIED',
    422,
  );

  const crossOrigin = createTransport((options) =>
    options.hostname === FEED_HOST
      ? { statusCode: 301, headers: { location: 'https://other.example.net/rss.xml' } }
      : { statusCode: 304, headers: { etag: 'W/"cached"' } },
  );
  await expectFailure(
    fetcher({ transport: crossOrigin.transport, resolve })(FEED_URL, { etag: 'W/"cached"' }),
    'INVALID_NOT_MODIFIED',
    422,
  );
});

test('reports upstream HTTP failures with a bounded Retry-After', async () => {
  const now = () => 1_700_000_000_000;
  const { resolve } = recordingResolve();

  const plain = createTransport(() => ({ statusCode: 500, headers: {} }));
  const failure = await expectFailure(
    fetcher({ transport: plain.transport, resolve, now })(FEED_URL),
    'UPSTREAM_HTTP',
    502,
  );
  assert.equal(failure.retryAfterMs, undefined);

  const seconds = createTransport(() => ({ statusCode: 503, headers: { 'retry-after': '30' } }));
  assert.equal(
    (
      await expectFailure(
        fetcher({ transport: seconds.transport, resolve, now })(FEED_URL),
        'UPSTREAM_HTTP',
        502,
      )
    ).retryAfterMs,
    30_000,
  );

  const date = createTransport(() => ({
    statusCode: 429,
    headers: { 'retry-after': new Date(now() + 5_000).toUTCString() },
  }));
  assert.equal(
    (
      await expectFailure(
        fetcher({ transport: date.transport, resolve, now })(FEED_URL),
        'UPSTREAM_HTTP',
        502,
      )
    ).retryAfterMs,
    5_000,
  );

  const past = createTransport(() => ({
    statusCode: 502,
    headers: { 'retry-after': new Date(now() - 5_000).toUTCString() },
  }));
  assert.equal(
    (
      await expectFailure(
        fetcher({ transport: past.transport, resolve, now })(FEED_URL),
        'UPSTREAM_HTTP',
        502,
      )
    ).retryAfterMs,
    0,
  );

  for (const header of ['999999999', 'x'.repeat(200), 'soon']) {
    const capped = createTransport(() => ({ statusCode: 503, headers: { 'retry-after': header } }));
    const bounded = (
      await expectFailure(
        fetcher({ transport: capped.transport, resolve, now })(FEED_URL),
        'UPSTREAM_HTTP',
        502,
      )
    ).retryAfterMs;
    if (bounded !== undefined) assert.ok(bounded <= LIMITS.intervalMs, `${header} stays bounded`);
  }
});

test('settles immediately when the caller aborts during DNS or a stream', async () => {
  const reason = new Error('caller cancelled');

  const dns = new AbortController();
  const neverResolves: Resolver = () => new Promise<LookupAddress[]>(() => {});
  const hangingDns = createFeedFetcher({
    resolve: neverResolves,
    transport: createTransport(() => ok()).transport,
  }) as (url: string, options?: FetchOptions) => Promise<FetchResult>;
  const dnsOutcome = await abortAfter(
    dns,
    20,
    reason,
    hangingDns(FEED_URL, { signal: dns.signal }),
  );
  assert.equal(dnsOutcome, reason, 'the exact abort reason reaches the caller');

  const stream = new AbortController();
  const slow = new Readable({ read() {} }) as Readable & {
    statusCode: number;
    headers: SyntheticHeaders;
  };
  slow.statusCode = 200;
  slow.headers = { 'content-type': 'application/rss+xml' };
  const transport = (options: TransportOptions, callback: (response: Readable) => void) => {
    const request = new EventEmitter() as EventEmitter & { end: () => void };
    request.end = () => {
      options.signal?.addEventListener(
        'abort',
        () => request.emit('error', new Error('socket aborted')),
        { once: true },
      );
      queueMicrotask(() => {
        slow.push(Buffer.from(FEED.slice(0, 20)));
        callback(slow);
      });
    };
    return request;
  };
  const { resolve } = recordingResolve();
  const streamOutcome = await abortAfter(
    stream,
    20,
    reason,
    fetcher({ transport, resolve })(FEED_URL, { signal: stream.signal }),
  );
  assert.equal(streamOutcome, reason);
  assert.equal(slow.destroyed, true, 'the response stream is torn down');
});

test('stops after the fetch budget', { timeout: 20_000 }, async () => {
  // The budget is a real 12 s timer and cannot be injected; this is the one slow test.
  const never = createTransport(() => null);
  const { resolve } = recordingResolve();
  const started = Date.now();
  await expectFailure(
    fetcher({ transport: never.transport, resolve })(FEED_URL),
    'FETCH_TIMEOUT',
    504,
  );
  assert.ok(Date.now() - started >= LIMITS.timeoutMs - 50);
});
