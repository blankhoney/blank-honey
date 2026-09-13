import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createProbe } from './probe.mjs';
import { createLog, validateError } from './log.mjs';

export function createApp({ probe, writeLog, allowedOrigin, now = Date.now }) {
  let windowStart = 0,
    count = 0;
  const statuses = new Map();
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => {
      response.writeHead(status);
      response.end(JSON.stringify(body));
    };
    try {
      if (request.url === '/api/probe' && request.method === 'GET') {
        const result = await probe();
        for (const host of result.hosts) {
          if (statuses.get(host.publicId) !== host.status) {
            statuses.set(host.publicId, host.status);
            await writeLog({ kind: 'probe', code: host.status, publicId: host.publicId }).catch(
              () => {},
            );
          }
        }
        return send(200, result);
      }
      if (request.url !== '/api/errors') return send(404, { error: 'Not found' });
      if (request.method !== 'POST') return send(405, { error: 'Method not allowed' });
      if (
        request.headers.origin !== allowedOrigin ||
        !allowedOrigin ||
        request.headers['sec-fetch-site'] === 'cross-site'
      )
        return send(403, { error: 'Origin denied' });
      if (request.headers['content-type']?.split(';')[0] !== 'application/json')
        return send(415, { error: 'JSON required' });
      if (now() - windowStart >= 60000) {
        windowStart = now();
        count = 0;
      }
      // ponytail: global 60/minute budget avoids storing visitor identifiers; add per-origin quotas if traffic warrants.
      if (++count > 60) {
        response.setHeader('Retry-After', '60');
        return send(429, { error: 'Rate limited' });
      }
      if (Number(request.headers['content-length']) > 2048)
        return send(413, { error: 'Body too large' });
      let body = '',
        size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 2048) return send(413, { error: 'Body too large' });
        body += chunk.toString('utf8');
      }
      let value;
      try {
        value = validateError(JSON.parse(body));
      } catch {
        return send(400, { error: 'Invalid event' });
      }
      if (!value) return send(400, { error: 'Invalid event' });
      await writeLog(value);
      return send(202, { accepted: true });
    } catch {
      if (!response.headersSent) send(503, { error: 'Unavailable' });
      else response.end();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const hosts = JSON.parse(await readFile(process.env.HOSTS_FILE || 'deploy/hosts.json', 'utf8'));
  const server = createApp({
    probe: createProbe({
      hosts,
      prometheusUrl: process.env.PROMETHEUS_URL || 'http://prometheus:9090',
    }),
    writeLog: createLog(process.env.LOG_DIR || 'logs'),
    allowedOrigin: process.env.ALLOWED_ORIGIN || 'http://localhost:8080',
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.listen(Number(process.env.PORT || 3001), '0.0.0.0');
}
