/** Fixed internal queries. Only the explicit public projection leaves this module. */
export function validateHosts(hosts) {
  if (!Array.isArray(hosts) || hosts.length > 20) throw new Error('Invalid host list');
  const ids = new Set();
  return hosts.map((host) => {
    for (const key of ['publicId', 'displayName', 'regionLabel', 'timeZone', 'instance'])
      if (typeof host[key] !== 'string' || !host[key] || host[key].length > 120)
        throw new Error('Invalid host field');
    if (!/^[a-z0-9-]+$/.test(host.publicId) || ids.has(host.publicId))
      throw new Error('Invalid publicId');
    new Intl.DateTimeFormat('en', { timeZone: host.timeZone });
    ids.add(host.publicId);
    return host;
  });
}

export function createProbe({ hosts, prometheusUrl, fetcher = fetch, now = Date.now }) {
  validateHosts(hosts);
  let cache,
    expires = 0,
    pending;
  async function query(expression) {
    const url = new URL('/api/v1/query', prometheusUrl);
    url.searchParams.set('query', expression);
    const response = await fetcher(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Metrics unavailable');
    const body = await response.json();
    if (body.status !== 'success' || body.data?.resultType !== 'vector')
      throw new Error('Metrics unavailable');
    const sample = body.data.result[0]?.value;
    const value = sample ? Number(sample[1]) : NaN;
    return Number.isFinite(value) ? value : null;
  }
  async function project(host) {
    const { publicId, displayName, regionLabel, timeZone } = host;
    const row = {
      publicId,
      displayName,
      regionLabel,
      timeZone,
      online: null,
      sampledAt: null,
      cpuPercent: null,
      memoryPercent: null,
      swapPercent: null,
      swapState: 'unavailable',
      diskPercent: null,
      load1: null,
      load5: null,
      load15: null,
      status: 'unavailable',
    };
    const selector = `job="node",instance=${JSON.stringify(host.instance)}`;
    const metric = (name, extra = '') => `${name}{${selector}${extra}}`;
    try {
      // Use source timestamps, never query time, to detect a stopped collector.
      const [up, timestamp] = await Promise.all([
        query(metric('up')),
        query(`timestamp(${metric('up')})`),
      ]);
      if (timestamp === null || now() / 1000 - timestamp > 25 || timestamp > now() / 1000 + 5)
        return row;
      row.sampledAt = new Date(timestamp * 1000).toISOString();
      if (up === 0) return { ...row, online: false, status: 'offline' };
      if (up !== 1) return row;
      const expressions = {
        cpuPercent: `100 * (1 - avg(rate(${metric('node_cpu_seconds_total', ',mode="idle"')}[1m])))`,
        memoryPercent: `100 * (1 - ${metric('node_memory_MemAvailable_bytes')} / ${metric('node_memory_MemTotal_bytes')})`,
        swapTotal: metric('node_memory_SwapTotal_bytes'),
        swapPercent: `100 * (1 - ${metric('node_memory_SwapFree_bytes')} / ${metric('node_memory_SwapTotal_bytes')})`,
        diskPercent: `100 * (1 - sum(max by (device) (${metric('node_filesystem_avail_bytes', ',fstype!~"tmpfs|devtmpfs|squashfs|overlay"')})) / sum(max by (device) (${metric('node_filesystem_size_bytes', ',fstype!~"tmpfs|devtmpfs|squashfs|overlay"')})))`,
        load1: metric('node_load1'),
        load5: metric('node_load5'),
        load15: metric('node_load15'),
      };
      const values = Object.fromEntries(
        await Promise.all(
          Object.entries(expressions).map(async ([key, expression]) => [
            key,
            await query(expression),
          ]),
        ),
      );
      for (const key of [
        'cpuPercent',
        'memoryPercent',
        'swapPercent',
        'diskPercent',
        'load1',
        'load5',
        'load15',
      ]) {
        const value = values[key];
        row[key] = value;
        if (value !== null && key.endsWith('Percent')) row[key] = Math.max(0, Math.min(100, value));
      }
      if (values.swapTotal === 0) {
        row.swapState = 'not-configured';
        row.swapPercent = null;
      } else if (values.swapTotal !== null && row.swapPercent !== null) {
        row.swapState = 'available';
      }
      const metricsComplete = [
        'cpuPercent',
        'memoryPercent',
        'diskPercent',
        'load1',
        'load5',
        'load15',
      ].every((key) => row[key] !== null);
      row.online = true;
      if (metricsComplete && row.swapState !== 'unavailable') row.status = 'ok';
      return row;
    } catch {
      return row;
    }
  }
  return async () => {
    if (cache && now() < expires) return cache;
    if (!pending)
      pending = Promise.all(hosts.map(project))
        .then((rows) => {
          cache = { hosts: rows };
          expires = now() + 5000;
          return cache;
        })
        .finally(() => {
          pending = null;
        });
    return pending;
  };
}
