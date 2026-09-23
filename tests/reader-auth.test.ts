/* Targeted tests for reader administrator auth (server/reader/auth.mjs).
 *
 * The store is a real in-memory database and the clock is injected; requests and responses are
 * plain objects, so no HTTP server is started. The password is assembled at runtime from fragments
 * so this file never carries a usable credential literal.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  createPasswordHash,
  createReaderAuth,
  validateNewPassword,
} from '../server/reader/auth.mjs';
import { LIMITS, ReaderError } from '../server/reader/model.mjs';
import { openReaderStore } from '../server/reader/store.mjs';

type Failure = { code?: string; status?: number };
type Session = { configured: boolean; authenticated: boolean; csrfToken?: string };
type FakeRequest = { headers: Record<string, string> };
type FakeResponse = {
  setHeader: (name: string, value: string) => void;
  getHeader: (name: string) => string | undefined;
};

const ORIGIN = 'https://blog.example.org';
const HTTP_ORIGIN = 'http://127.0.0.1:4321';
const COOKIE = 'reader_session';
const COOKIE_PATH = '/api/reader/admin';
/** Fragments joined at run time: the file itself holds no usable credential. */
const PASSWORD = ['synthe', 'tic-read', 'er-pass', 'phrase-01'].join('');
const OTHER_PASSWORD = ['repla', 'cement-', 'reader-', 'phrase-02'].join('');
const START = 1_700_000_000_000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createFixture() {
  const store = openReaderStore(':memory:');
  const clock = { at: START };
  const now = () => clock.at;
  const fixture = {
    store,
    now,
    advance(milliseconds: number) {
      clock.at += milliseconds;
    },
    auth: (allowedOrigin = ORIGIN) => createReaderAuth({ store, allowedOrigin, now }),
    async configure(password = PASSWORD) {
      store.setAdminPassword(await createPasswordHash(password));
    },
  };
  return fixture;
}

function request(headers: Record<string, string> = {}): FakeRequest {
  return { headers: { origin: ORIGIN, ...headers } };
}

function response(): FakeResponse {
  const headers = new Map<string, string>();
  return {
    setHeader: (name, value) => void headers.set(name.toLowerCase(), value),
    getHeader: (name) => headers.get(name.toLowerCase()),
  };
}

function cookieOf(fake: FakeResponse): { value: string; attributes: Map<string, string> } {
  const raw = fake.getHeader('Set-Cookie');
  assert.equal(typeof raw, 'string', 'a session cookie must be set');
  const [pair, ...attributes] = String(raw)
    .split(';')
    .map((part) => part.trim());
  const separator = pair.indexOf('=');
  assert.equal(pair.slice(0, separator), COOKIE);
  const parsed = new Map<string, string>();
  for (const attribute of attributes) {
    const split = attribute.indexOf('=');
    if (split === -1) parsed.set(attribute, '');
    else parsed.set(attribute.slice(0, split), attribute.slice(split + 1));
  }
  return { value: pair.slice(separator + 1), attributes: parsed };
}

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

function expectSyncFailure(work: () => unknown, code: string, label = ''): void {
  assert.throws(
    work,
    (error: unknown) => {
      assert.equal((error as Failure).code, code, label);
      return true;
    },
    label,
  );
}

/** Logs in through the real flow and returns the session cookie value. */
async function loginWith(
  auth: ReturnType<typeof createReaderAuth>,
  password = PASSWORD,
): Promise<{ token: string; csrfToken: string; fake: FakeResponse }> {
  const fake = response();
  const session = (await auth.login(request(), fake, password)) as Session;
  assert.equal(session.authenticated, true);
  return { token: cookieOf(fake).value, csrfToken: session.csrfToken ?? '', fake };
}

test('reports an unconfigured administrator without a password check', async () => {
  const fixture = createFixture();
  try {
    const auth = fixture.auth();
    await expectFailure(
      auth.login(request(), response(), PASSWORD),
      'ADMIN_UNCONFIGURED',
      503,
      'unconfigured login',
    );
    assert.deepEqual(auth.session(request()), {
      configured: false,
      authenticated: false,
    });
    await fixture.configure();
    assert.deepEqual(auth.session(request()), {
      configured: true,
      authenticated: false,
    });
  } finally {
    fixture.store.close();
  }
});

test('rejects a wrong password without issuing a session', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const fake = response();
    await expectFailure(auth.login(request(), fake, `${PASSWORD}x`), 'INVALID_CREDENTIALS', 401);
    assert.equal(fake.getHeader('Set-Cookie'), undefined);
    assert.deepEqual(auth.session(request()), {
      configured: true,
      authenticated: false,
    });
  } finally {
    fixture.store.close();
  }
});

test('reports a malformed stored hash as unavailable rather than as a bad password', async () => {
  const fixture = createFixture();
  try {
    fixture.store.setAdminPassword('not-a-scrypt-hash');
    await expectFailure(
      fixture.auth().login(request(), response(), PASSWORD),
      'AUTH_UNAVAILABLE',
      503,
    );
  } finally {
    fixture.store.close();
  }
});

test('limits attempts to five per window and resets after it', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expectFailure(
        auth.login(request(), response(), `${PASSWORD}x`),
        'INVALID_CREDENTIALS',
        401,
        `attempt ${attempt}`,
      );
    }
    // The sixth attempt is refused even with the right password.
    await expectFailure(auth.login(request(), response(), PASSWORD), 'RATE_LIMITED', 429);
    fixture.advance(60_000);
    const session = (await auth.login(request(), response(), PASSWORD)) as Session;
    assert.equal(session.authenticated, true, 'the window reset allows a login again');
  } finally {
    fixture.store.close();
  }
});

test('runs one password verification at a time', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const first = auth.login(request(), response(), PASSWORD);
    await expectFailure(auth.login(request(), response(), PASSWORD), 'RATE_LIMITED', 429);
    assert.equal(((await first) as Session).authenticated, true);
    // With the first verification finished, the next attempt is allowed again.
    const next = (await auth.login(request(), response(), PASSWORD)) as Session;
    assert.equal(next.authenticated, true);
  } finally {
    fixture.store.close();
  }
});

test('creates a random session stored as a hash with a hardened cookie', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const first = await loginWith(auth);
    const second = await loginWith(auth);

    assert.match(first.token, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(first.token, second.token, 'each login mints a fresh token');

    const stored = fixture.store.getSession(hashToken(first.token), fixture.now());
    assert.ok(stored, 'the session is readable through its hash');
    assert.equal(fixture.store.getSession(first.token, fixture.now()), null, 'never stored raw');
    assert.ok(stored?.expiresAt === START + LIMITS.sessionMs);

    const { attributes } = cookieOf(first.fake);
    assert.equal(attributes.get('Path'), COOKIE_PATH);
    assert.equal(attributes.get('HttpOnly'), '');
    assert.equal(attributes.get('SameSite'), 'Strict');
    assert.equal(attributes.get('Secure'), '', 'an https origin gets Secure');
    assert.equal(Number(attributes.get('Max-Age')), LIMITS.sessionMs / 1000);
  } finally {
    fixture.store.close();
  }
});

test('omits Secure for an http origin and refuses a malformed origin', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth(HTTP_ORIGIN);
    const fake = response();
    await auth.login(request({ origin: HTTP_ORIGIN }), fake, PASSWORD);
    const { attributes } = cookieOf(fake);
    assert.equal(attributes.has('Secure'), false, 'a local http origin cannot use Secure');
    assert.equal(attributes.get('HttpOnly'), '');
    assert.equal(attributes.get('SameSite'), 'Strict');
    assert.equal(attributes.get('Path'), COOKIE_PATH);

    for (const malformed of [`${ORIGIN}/path`, `${ORIGIN}/`, 'ftp://blog.example.org']) {
      assert.throws(
        () => fixture.auth(malformed),
        /Invalid reader origin/,
        `expected a refusal for ${malformed}`,
      );
    }
    // A value that is not a URL at all is refused even earlier, by URL parsing.
    assert.throws(() => fixture.auth('blog.example.org'));
  } finally {
    fixture.store.close();
  }
});

test('requires the exact origin on every entry point', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    await expectFailure(
      auth.login(request({ origin: 'https://evil.example.net' }), response(), PASSWORD),
      'ORIGIN_DENIED',
      403,
    );
    await expectFailure(
      auth.login(request({ 'sec-fetch-site': 'cross-site' }), response(), PASSWORD),
      'ORIGIN_DENIED',
      403,
    );
    expectSyncFailure(
      () => auth.requireOrigin(request({ origin: 'https://evil.example.net' })),
      'ORIGIN_DENIED',
    );
    expectSyncFailure(
      () => auth.requireOrigin(request({ 'sec-fetch-site': 'cross-site' })),
      'ORIGIN_DENIED',
    );
    auth.requireOrigin(request());
    auth.requireOrigin(request({ 'sec-fetch-site': 'same-origin' }));
  } finally {
    fixture.store.close();
  }
});

test('requires the session CSRF token for writes', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const { token, csrfToken, fake } = await loginWith(auth);

    assert.match(csrfToken, /^[A-Za-z0-9_-]{43}$/);
    const cookieHeader = `${COOKIE}=${token}`;
    expectSyncFailure(() => auth.requireWrite(request({ cookie: cookieHeader })), 'CSRF_DENIED');
    expectSyncFailure(
      () => auth.requireWrite(request({ cookie: cookieHeader, 'x-reader-csrf': `${csrfToken}x` })),
      'CSRF_DENIED',
    );
    assert.equal(
      (
        auth.requireWrite(request({ cookie: cookieHeader, 'x-reader-csrf': csrfToken })) as {
          token: string;
        }
      ).token,
      token,
    );

    // The session projection exposes the same token the write path expects.
    const projected = auth.session(request({ cookie: cookieHeader })) as Session;
    assert.equal(projected.csrfToken, csrfToken);

    auth.logout(request({ cookie: cookieHeader, 'x-reader-csrf': csrfToken }), fake);
    assert.equal(fixture.store.getSession(hashToken(token), fixture.now()), null);
    const cleared = cookieOf(fake);
    assert.equal(cleared.value, '');
    assert.equal(cleared.attributes.get('Max-Age'), '0');
    assert.equal(cleared.attributes.get('Path'), COOKIE_PATH);
  } finally {
    fixture.store.close();
  }
});

test('ignores duplicate or malformed session cookies', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const { token } = await loginWith(auth);
    const cookieHeader = `${COOKIE}=${token}`;

    for (const header of [
      `${cookieHeader}; ${cookieHeader}`,
      `${COOKIE}=short`,
      `${COOKIE}=${token}x`,
      `${COOKIE}=${'a'.repeat(42)}`,
      'other=value',
      '',
    ]) {
      // The session projection reports an unauthenticated caller rather than throwing.
      assert.deepEqual(
        auth.session(request({ cookie: header })),
        { configured: true, authenticated: false },
        `cookie ${JSON.stringify(header)}`,
      );
      expectSyncFailure(
        () => auth.requireWrite(request({ cookie: header, 'x-reader-csrf': 'x' })),
        'AUTH_REQUIRED',
      );
    }
    assert.equal(auth.session(request({ cookie: cookieHeader })).authenticated, true);
  } finally {
    fixture.store.close();
  }
});

test('expires a session at the configured lifetime', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const { token, csrfToken } = await loginWith(auth);
    const headers = { cookie: `${COOKIE}=${token}`, 'x-reader-csrf': csrfToken };

    fixture.advance(LIMITS.sessionMs - 1);
    assert.equal(auth.session(request(headers)).authenticated, true);
    fixture.advance(1);
    assert.deepEqual(auth.session(request(headers)), {
      configured: true,
      authenticated: false,
    });
    expectSyncFailure(() => auth.requireWrite(request(headers)), 'AUTH_REQUIRED');
  } finally {
    fixture.store.close();
  }
});

test('logout revokes only the session that was presented', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const first = await loginWith(auth);
    const second = await loginWith(auth);

    auth.logout(
      request({ cookie: `${COOKIE}=${first.token}`, 'x-reader-csrf': first.csrfToken }),
      response(),
    );
    assert.equal(fixture.store.getSession(hashToken(first.token), fixture.now()), null);
    assert.equal(
      auth.session(request({ cookie: `${COOKIE}=${second.token}` })).authenticated,
      true,
    );
  } finally {
    fixture.store.close();
  }
});

test('changing the password revokes every session and swaps the credential', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const { token, csrfToken, fake } = await loginWith(auth);

    await auth.changePassword(
      request({ cookie: `${COOKIE}=${token}`, 'x-reader-csrf': csrfToken }),
      fake,
      PASSWORD,
      OTHER_PASSWORD,
    );
    assert.equal(fixture.store.getSession(hashToken(token), fixture.now()), null);
    assert.equal(cookieOf(fake).attributes.get('Max-Age'), '0');
    assert.deepEqual(auth.session(request({ cookie: `${COOKIE}=${token}` })), {
      configured: true,
      authenticated: false,
    });

    await expectFailure(
      auth.login(request(), response(), PASSWORD),
      'INVALID_CREDENTIALS',
      401,
      'the old password',
    );
    const rotated = await loginWith(auth, OTHER_PASSWORD);
    assert.match(rotated.token, /^[A-Za-z0-9_-]{43}$/);
  } finally {
    fixture.store.close();
  }
});

test('rejects a wrong current password during a change', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const { token, csrfToken } = await loginWith(auth);
    await expectFailure(
      auth.changePassword(
        request({ cookie: `${COOKIE}=${token}`, 'x-reader-csrf': csrfToken }),
        response(),
        `${PASSWORD}x`,
        OTHER_PASSWORD,
      ),
      'INVALID_CREDENTIALS',
      401,
    );
    // The session and the old password both still work.
    assert.equal(auth.session(request({ cookie: `${COOKIE}=${token}` })).authenticated, true);
    const session = (await auth.login(request(), response(), PASSWORD)) as Session;
    assert.equal(session.authenticated, true);
  } finally {
    fixture.store.close();
  }
});

test('rejects a new password outside the accepted length', async () => {
  expectSyncFailure(() => validateNewPassword('short'), 'INVALID_PASSWORD');
  expectSyncFailure(() => validateNewPassword('x'.repeat(11)), 'INVALID_PASSWORD');
  expectSyncFailure(() => validateNewPassword('x'.repeat(1025)), 'INVALID_PASSWORD');
  expectSyncFailure(() => validateNewPassword(undefined as unknown as string), 'INVALID_PASSWORD');
  validateNewPassword('x'.repeat(12));
  validateNewPassword('密'.repeat(12));
  // 12 characters but more than 1024 bytes is still refused.
  expectSyncFailure(() => validateNewPassword('密'.repeat(400)), 'INVALID_PASSWORD');
  await expectFailure(createPasswordHash('short'), 'INVALID_PASSWORD', 400);

  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const { token, csrfToken } = await loginWith(auth);
    const refused = response();
    await expectFailure(
      auth.changePassword(
        request({ cookie: `${COOKIE}=${token}`, 'x-reader-csrf': csrfToken }),
        refused,
        PASSWORD,
        'too-short',
      ),
      'INVALID_PASSWORD',
      400,
    );
    // A refused change leaves the session, the cookie and the credential untouched.
    assert.equal(auth.session(request({ cookie: `${COOKIE}=${token}` })).authenticated, true);
    assert.equal(refused.getHeader('Set-Cookie'), undefined);
    assert.equal(
      ((await auth.login(request(), response(), PASSWORD)) as Session).authenticated,
      true,
    );
  } finally {
    fixture.store.close();
  }
});

test('a reset during verification cannot mint a session from the old password', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const replacement = await createPasswordHash(OTHER_PASSWORD);
    const auth = fixture.auth();
    const fake = response();

    // Starts scrypt with the current admin version, then the credential changes under it.
    const pending = auth.login(request(), fake, PASSWORD);
    fixture.store.setAdminPassword(replacement);
    await expectFailure(pending, 'AUTH_REQUIRED', 401);
    assert.equal(fake.getHeader('Set-Cookie'), undefined, 'no session cookie was issued');
    assert.equal(
      ((await auth.login(request(), response(), OTHER_PASSWORD)) as Session).authenticated,
      true,
    );
  } finally {
    fixture.store.close();
  }
});

test('a logout during verification aborts the password change', async () => {
  const fixture = createFixture();
  try {
    await fixture.configure();
    const auth = fixture.auth();
    const { token, csrfToken } = await loginWith(auth);
    const headers = { cookie: `${COOKIE}=${token}`, 'x-reader-csrf': csrfToken };

    // The session is revoked while scrypt runs, so the change must not be applied.
    const pending = auth.changePassword(request(headers), response(), PASSWORD, OTHER_PASSWORD);
    fixture.store.deleteSession(hashToken(token));
    await expectFailure(pending, 'AUTH_REQUIRED', 401);

    const second = fixture.auth();
    await expectFailure(
      second.login(request(), response(), OTHER_PASSWORD),
      'INVALID_CREDENTIALS',
      401,
      'the new password must not have been stored',
    );
    assert.equal(
      ((await second.login(request(), response(), PASSWORD)) as Session).authenticated,
      true,
    );
  } finally {
    fixture.store.close();
  }
});
