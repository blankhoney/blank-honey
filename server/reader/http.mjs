import { ReaderError } from './model.mjs';

const PREFIX = '/api/reader/';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SOURCE_ROUTE = new RegExp(`^/api/reader/admin/sources/(${UUID})(/refresh|/entries)?$`);
const BODY_BYTES = 4096;

function exactObject(body, allowed, required = allowed) {
  if (
    !body ||
    Array.isArray(body) ||
    typeof body !== 'object' ||
    Object.keys(body).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(body, key))
  )
    throw new ReaderError('INVALID_BODY');
  return body;
}

async function readJson(request) {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new ReaderError('JSON_REQUIRED', 415);
  if (Number(request.headers['content-length']) > BODY_BYTES)
    throw new ReaderError('BODY_TOO_LARGE', 413);
  const bytes = await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const cleanup = () => {
      request.off('data', data);
      request.off('end', end);
      request.off('error', failed);
      request.off('aborted', failed);
    };
    const failed = () => {
      cleanup();
      reject(new ReaderError('INVALID_BODY'));
    };
    const data = (chunk) => {
      size += chunk.length;
      if (size > BODY_BYTES) {
        cleanup();
        request.pause();
        reject(new ReaderError('BODY_TOO_LARGE', 413));
      } else chunks.push(chunk);
    };
    const end = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    request.on('data', data);
    request.once('end', end);
    request.once('error', failed);
    request.once('aborted', failed);
  });
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ReaderError('INVALID_BODY');
  }
}

function sourceInput(body, patch = false) {
  exactObject(body, patch ? ['title', 'enabled'] : ['feedUrl', 'title'], patch ? [] : ['feedUrl']);
  if (
    !Object.keys(body).length ||
    (Object.hasOwn(body, 'title') && (typeof body.title !== 'string' || body.title.length > 120)) ||
    (Object.hasOwn(body, 'enabled') && typeof body.enabled !== 'boolean') ||
    (!patch && typeof body.feedUrl !== 'string')
  )
    throw new ReaderError('INVALID_SOURCE');
  return body;
}

export function createReaderHttp({ store, service, auth, now = Date.now }) {
  let writeWindow = 0;
  let writes = 0;
  const adminSource = (id) => store.listSources(true).find((source) => source.id === id);

  return async function readerHttp(request, response) {
    if (!request.url?.startsWith(PREFIX)) return false;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => {
      response.writeHead(status);
      response.end(JSON.stringify(body));
    };
    try {
      const url = new URL(request.url, 'http://reader.invalid');
      const path = url.pathname;
      const method = request.method;
      if (method === 'GET') {
        if (path === `${PREFIX}sources`) send(200, { sources: store.listSources() });
        else if (path === `${PREFIX}entries`) {
          if (
            [...url.searchParams.keys()].some((key) => !['source', 'q', 'cursor'].includes(key)) ||
            [...new Set(url.searchParams.keys())].some(
              (key) => url.searchParams.getAll(key).length > 1,
            )
          )
            throw new ReaderError('INVALID_QUERY');
          send(
            200,
            store.listEntries({
              sourceId: url.searchParams.get('source') || undefined,
              q: url.searchParams.get('q') || undefined,
              cursor: url.searchParams.get('cursor') || undefined,
            }),
          );
        } else if (/^\/api\/reader\/entries\/[0-9a-f]{64}$/.test(path)) {
          const entry = store.getEntry(path.slice(path.lastIndexOf('/') + 1));
          if (!entry) throw new ReaderError('NOT_FOUND', 404);
          send(200, entry);
        } else if (path === `${PREFIX}admin/session`) send(200, auth.session(request));
        else if (path === `${PREFIX}admin/sources`) {
          auth.authenticate(request);
          send(200, { sources: store.listSources(true) });
        } else throw new ReaderError('NOT_FOUND', 404);
        return true;
      }
      if (!path.startsWith(`${PREFIX}admin/`)) throw new ReaderError('METHOD_NOT_ALLOWED', 405);
      auth.requireOrigin(request);
      const login = path === `${PREFIX}admin/login` && method === 'POST';
      if (!login) auth.requireWrite(request);
      if (now() >= writeWindow) {
        writeWindow = now() + 60_000;
        writes = 0;
      }
      if (++writes > 60) throw new ReaderError('RATE_LIMITED', 429);
      if (url.search) throw new ReaderError('INVALID_QUERY');
      const body = await readJson(request);
      // A session may expire or be revoked while a slow client is sending its body.
      if (!login) auth.requireWrite(request);
      if (login) {
        exactObject(body, ['password']);
        send(200, await auth.login(request, response, body.password));
      } else if (path === `${PREFIX}admin/logout` && method === 'POST') {
        exactObject(body, []);
        auth.logout(request, response);
        send(200, { ok: true });
      } else if (path === `${PREFIX}admin/password` && method === 'POST') {
        exactObject(body, ['currentPassword', 'newPassword']);
        await auth.changePassword(request, response, body.currentPassword, body.newPassword);
        send(200, { ok: true });
      } else if (path === `${PREFIX}admin/sources` && method === 'POST') {
        const id = service.addSource(sourceInput(body));
        send(201, { source: adminSource(id) });
      } else {
        const match = SOURCE_ROUTE.exec(path);
        if (!match) throw new ReaderError('NOT_FOUND', 404);
        const [, id, action] = match;
        if (!action && method === 'PATCH') {
          service.updateSource(id, sourceInput(body, true));
          send(200, { source: adminSource(id) });
        } else if (!action && method === 'DELETE') {
          exactObject(body, ['confirm']);
          if (body.confirm !== true) throw new ReaderError('CONFIRM_REQUIRED');
          service.deleteSource(id);
          send(200, { ok: true });
        } else if (action === '/refresh' && method === 'POST') {
          exactObject(body, []);
          service.refresh(id);
          send(202, { queued: true });
        } else if (action === '/entries' && method === 'DELETE') {
          exactObject(body, ['confirm']);
          if (body.confirm !== true) throw new ReaderError('CONFIRM_REQUIRED');
          service.clearEntries(id);
          send(200, { ok: true });
        } else throw new ReaderError('METHOD_NOT_ALLOWED', 405);
      }
    } catch (error) {
      const known = error instanceof ReaderError;
      if (!response.headersSent) {
        if (known && error.status === 429) response.setHeader('Retry-After', '60');
        // Rejected/oversized bodies are not drained indefinitely on a reusable connection.
        if (!request.readableEnded) response.setHeader('Connection', 'close');
        send(known ? error.status : 503, { error: known ? error.code : 'READER_UNAVAILABLE' });
      } else response.end();
    }
    return true;
  };
}
