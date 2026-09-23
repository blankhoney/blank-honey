import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { PassThrough, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import ipaddr from 'ipaddr.js';
import { LIMITS, ReaderError } from './model.mjs';

export function validateFeedUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\x00-\x1f\x7f]/u.test(value))
    throw new ReaderError('INVALID_URL');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ReaderError('INVALID_URL');
  }
  const authority = value.match(/^https?:\/\/([^/?#]*)/i)?.[1];
  if (
    !authority ||
    authority.includes('@') ||
    url.username ||
    url.password ||
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    (url.port && !['80', '443'].includes(url.port))
  )
    throw new ReaderError('INVALID_URL');
  url.hash = '';
  return url;
}

function publicAddress(address) {
  try {
    const parsed = ipaddr.parse(address);
    return (
      parsed.range() === 'unicast' && !(parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress())
    );
  } catch {
    return false;
  }
}

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

async function resolvePublic(url, resolve, signal) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literal = isIP(hostname);
  const addresses = literal
    ? [{ address: hostname, family: literal }]
    : await abortable(
        Promise.resolve().then(() => resolve(hostname, { all: true, verbatim: true })),
        signal,
      );
  if (
    !Array.isArray(addresses) ||
    !addresses.length ||
    addresses.some(({ address, family }) => !publicAddress(address) || isIP(address) !== family)
  )
    throw new ReaderError('ADDRESS_DENIED', 422);
  signal.throwIfAborted();
  return { hostname, ...addresses[0] };
}

// The verified address is used by the socket itself. Host/SNI still name the original site.
function connect(url, address, headers, signal, transport) {
  return new Promise((resolve, reject) => {
    const options = {
      protocol: url.protocol,
      hostname: address.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers,
      signal,
      agent: false,
      family: address.family,
      maxHeaderSize: 16 * 1024,
      servername: isIP(address.hostname) ? undefined : address.hostname,
      rejectUnauthorized: true,
      lookup(_hostname, options, callback) {
        if (options?.all) callback(null, [{ address: address.address, family: address.family }]);
        else callback(null, address.address, address.family);
      },
    };
    const request = transport(options, resolve);
    request.once('error', reject);
    request.end();
  });
}

function boundedHeader(value) {
  return typeof value === 'string' && value.length <= 1024 && !/[\x00-\x1f\x7f]/.test(value)
    ? value
    : null;
}

function byteLimit() {
  let size = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      size += chunk.length;
      callback(size > LIMITS.responseBytes ? new ReaderError('FEED_TOO_LARGE', 413) : null, chunk);
    },
  });
}

async function readXml(response, signal) {
  const encoding = String(response.headers['content-encoding'] || 'identity')
    .trim()
    .toLowerCase();
  const decoders = {
    identity: () => new PassThrough(),
    gzip: createGunzip,
    deflate: createInflate,
    br: createBrotliDecompress,
  };
  if (!Object.hasOwn(decoders, encoding)) {
    response.destroy();
    throw new ReaderError('UNSUPPORTED_ENCODING', 422);
  }
  if (Number(response.headers['content-length']) > LIMITS.responseBytes) {
    response.destroy();
    throw new ReaderError('FEED_TOO_LARGE', 413);
  }
  // UTF-8 is the first-version feed contract; never guess an encoding and silently corrupt IDs.
  const charset = String(response.headers['content-type'] || '').match(
    /charset\s*=\s*["']?([^\s;"']+)/i,
  )?.[1];
  if (charset && !/^(utf-8|utf8|us-ascii)$/i.test(charset)) {
    response.destroy();
    throw new ReaderError('UNSUPPORTED_ENCODING', 422);
  }
  const chunks = [];
  await pipeline(
    response,
    byteLimit(),
    decoders[encoding](),
    byteLimit(),
    new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    }),
    { signal },
  );
  let xml;
  try {
    xml = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new ReaderError('UNSUPPORTED_ENCODING', 422);
  }
  const declared = xml.match(/^\s*<\?xml\s[^?]*encoding\s*=\s*["']([^"']+)/i)?.[1];
  if (declared && !/^(utf-8|utf8|us-ascii)$/i.test(declared))
    throw new ReaderError('UNSUPPORTED_ENCODING', 422);
  return xml;
}

function retryAfter(value, now) {
  if (typeof value !== 'string' || value.length > 128) return undefined;
  const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now();
  return Number.isFinite(delay) ? Math.min(LIMITS.intervalMs, Math.max(0, delay)) : undefined;
}

/** Injection is for deterministic tests, not a production option to permit private networks.
 * @param {{resolve?: (hostname: string, options: {all: true, verbatim: true}) => Promise<import('node:dns').LookupAddress[]>, transport?: Function, now?: () => number}} options
 */
export function createFeedFetcher({ resolve = lookup, transport, now = Date.now } = {}) {
  return async function fetchFeed(value, { signal, etag, lastModified } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new ReaderError('FETCH_TIMEOUT', 504)),
      LIMITS.timeoutMs,
    );
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    let response;
    try {
      let url = validateFeedUrl(value);
      const initialOrigin = url.origin;
      for (let hop = 0; hop <= 3; hop++) {
        combined.throwIfAborted();
        const address = await resolvePublic(url, resolve, combined);
        const headers = {
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': 'FeedReader/1.0',
        };
        if (url.origin === initialOrigin) {
          if (boundedHeader(etag)) headers['If-None-Match'] = etag;
          if (boundedHeader(lastModified)) headers['If-Modified-Since'] = lastModified;
        }
        response = await connect(
          url,
          address,
          headers,
          combined,
          transport || (url.protocol === 'https:' ? httpsRequest : httpRequest),
        );
        const status = response.statusCode;
        if ([301, 302, 303, 307, 308].includes(status)) {
          const location = response.headers.location;
          response.destroy();
          if (hop === 3) throw new ReaderError('TOO_MANY_REDIRECTS', 422);
          if (typeof location !== 'string' || /[\x00-\x1f\x7f]/.test(location))
            throw new ReaderError('INVALID_URL', 422);
          let target;
          try {
            target = new URL(location, url).href;
          } catch {
            throw new ReaderError('INVALID_URL', 422);
          }
          url = validateFeedUrl(target);
          continue;
        }
        const result = {
          url: url.href,
          etag: boundedHeader(response.headers.etag),
          lastModified: boundedHeader(response.headers['last-modified']),
        };
        if (status === 304) {
          response.destroy();
          // Unsolicited 304 cannot establish a successful empty cache.
          if (
            url.origin !== initialOrigin ||
            (!boundedHeader(etag) && !boundedHeader(lastModified))
          )
            throw new ReaderError('INVALID_NOT_MODIFIED', 422);
          return { ...result, notModified: true };
        }
        if (status !== 200) {
          const error = new ReaderError('UPSTREAM_HTTP', 502);
          error.retryAfterMs = retryAfter(response.headers['retry-after'], now);
          response.destroy();
          throw error;
        }
        return { ...result, notModified: false, xml: await readXml(response, combined) };
      }
      throw new ReaderError('TOO_MANY_REDIRECTS', 422);
    } catch (error) {
      response?.destroy();
      if (combined.aborted) throw combined.reason;
      if (error instanceof ReaderError) throw error;
      throw new ReaderError('FETCH_FAILED', 502);
    } finally {
      clearTimeout(timer);
    }
  };
}
