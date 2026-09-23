import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { LIMITS, ReaderError } from './model.mjs';

const derive = promisify(scrypt);
const COST = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };
const COOKIE = 'reader_session';
const COOKIE_PATH = '/api/reader/admin';
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const csrfToken = (token) =>
  createHmac('sha256', token).update('reader-csrf-v1').digest('base64url');

function equal(a, b) {
  return (
    typeof a === 'string' &&
    typeof b === 'string' &&
    a.length === b.length &&
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}

export function validateNewPassword(password) {
  if (
    typeof password !== 'string' ||
    [...password].length < 12 ||
    Buffer.byteLength(password) > 1024
  )
    throw new ReaderError('INVALID_PASSWORD');
}

export async function createPasswordHash(password) {
  validateNewPassword(password);
  const salt = randomBytes(16);
  const key = await derive(password, salt, 64, COST);
  return `scrypt:16384:8:1:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || Buffer.byteLength(password) > 1024) return false;
  const parts = /^scrypt:16384:8:1:([A-Za-z0-9_-]{22}):([A-Za-z0-9_-]{86})$/.exec(encoded);
  if (!parts) throw new ReaderError('AUTH_UNAVAILABLE', 503);
  const key = await derive(password, Buffer.from(parts[1], 'base64url'), 64, COST);
  return timingSafeEqual(key, Buffer.from(parts[2], 'base64url'));
}

function sessionToken(request) {
  const cookies = String(request.headers.cookie || '')
    .split(';')
    .map((part) => part.trim());
  const matches = cookies.filter((part) => part.startsWith(`${COOKIE}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

export function createReaderAuth({ store, allowedOrigin, now = Date.now }) {
  const origin = new URL(allowedOrigin).origin;
  if (origin !== allowedOrigin || !/^https?:/.test(origin))
    throw new Error('Invalid reader origin');
  const secure = origin.startsWith('https:');
  let verifying = false;
  let attempts = 0;
  let retryAt = 0;

  function cookie(response, token, seconds) {
    response.setHeader(
      'Set-Cookie',
      `${COOKIE}=${token}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${seconds}${secure ? '; Secure' : ''}`,
    );
  }

  function requireOrigin(request) {
    if (request.headers.origin !== origin || request.headers['sec-fetch-site'] === 'cross-site')
      throw new ReaderError('ORIGIN_DENIED', 403);
  }

  function authenticate(request) {
    const token = sessionToken(request);
    const session = token && store.getSession(tokenHash(token), now());
    if (!session) throw new ReaderError('AUTH_REQUIRED', 401);
    return { token, session };
  }

  function requireWrite(request) {
    requireOrigin(request);
    const authenticated = authenticate(request);
    if (!equal(request.headers['x-reader-csrf'], csrfToken(authenticated.token)))
      throw new ReaderError('CSRF_DENIED', 403);
    return authenticated;
  }

  function session(request) {
    const configured = Boolean(store.getAdmin());
    try {
      const { token } = authenticate(request);
      return { configured, authenticated: true, csrfToken: csrfToken(token) };
    } catch (error) {
      if (error instanceof ReaderError && error.code === 'AUTH_REQUIRED')
        return { configured, authenticated: false };
      throw error;
    }
  }

  // A single scrypt at a time fits the worker's memory budget; no unbounded password queue.
  async function passwordWork(operation) {
    if (now() >= retryAt) {
      attempts = 0;
      retryAt = now() + 60_000;
    }
    if (++attempts > 5 || verifying) throw new ReaderError('RATE_LIMITED', 429);
    verifying = true;
    try {
      return await operation();
    } finally {
      verifying = false;
    }
  }

  async function login(request, response, password) {
    requireOrigin(request);
    const admin = store.getAdmin();
    if (!admin) throw new ReaderError('ADMIN_UNCONFIGURED', 503);
    return passwordWork(async () => {
      if (!(await verifyPassword(password, admin.passwordHash)))
        throw new ReaderError('INVALID_CREDENTIALS', 401);
      if (store.getAdmin()?.version !== admin.version) throw new ReaderError('AUTH_REQUIRED', 401);
      const token = randomBytes(32).toString('base64url');
      const at = now();
      store.createSession({ tokenHash: tokenHash(token), expiresAt: at + LIMITS.sessionMs }, at);
      cookie(response, token, LIMITS.sessionMs / 1000);
      return { configured: true, authenticated: true, csrfToken: csrfToken(token) };
    });
  }

  function logout(request, response) {
    const { session } = requireWrite(request);
    store.deleteSession(session.tokenHash);
    cookie(response, '', 0);
  }

  async function changePassword(request, response, currentPassword, newPassword) {
    const { token, session } = requireWrite(request);
    validateNewPassword(newPassword);
    return passwordWork(async () => {
      const admin = store.getAdmin();
      if (!admin || !(await verifyPassword(currentPassword, admin.passwordHash)))
        throw new ReaderError('INVALID_CREDENTIALS', 401);
      const hash = await createPasswordHash(newPassword);
      // Logout, expiry or a CLI reset while scrypt ran must invalidate this operation too.
      if (
        !store.getSession(tokenHash(token), now()) ||
        store.getAdmin()?.version !== session.adminVersion
      )
        throw new ReaderError('AUTH_REQUIRED', 401);
      store.setAdminPassword(hash);
      cookie(response, '', 0);
    });
  }

  return { requireOrigin, authenticate, requireWrite, session, login, logout, changePassword };
}
