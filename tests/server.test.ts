import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProbe, validateHosts } from '../server/probe.mjs';
import { createApp, loadProbeHosts } from '../server/index.mjs';
import { createLog } from '../server/log.mjs';

const hosts = [
  {
    publicId: 'local',
    displayName: 'Docker',
    regionLabel: 'Local',
    timeZone: 'UTC',
    instance: 'secret-host:9100',
  },
];
test('remote inventory extends local hosts and rejects ambiguous or duplicate identities', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blank-honey-hosts-'));
  const localFile = join(directory, 'local.json');
  const remoteFile = join(directory, 'remote.json');
  const labels = {
    publicId: 'remote',
    displayName: 'Remote',
    regionLabel: 'Test',
    timeZone: 'UTC',
  };
  try {
    await writeFile(localFile, JSON.stringify(hosts));
    await writeFile(remoteFile, JSON.stringify([{ targets: ['remote:19100'], labels }]));
    assert.deepEqual(await loadProbeHosts(localFile), hosts);
    assert.deepEqual(await loadProbeHosts(localFile, remoteFile), [
      ...hosts,
      { ...labels, instance: 'remote:19100' },
    ]);
    await writeFile(remoteFile, JSON.stringify([{ targets: ['a:19100', 'b:19100'], labels }]));
    await assert.rejects(loadProbeHosts(localFile, remoteFile), /exactly one/);
    await writeFile(
      remoteFile,
      JSON.stringify([{ targets: ['remote:19100'], labels: { ...labels, publicId: 'local' } }]),
    );
    await assert.rejects(loadProbeHosts(localFile, remoteFile), /publicId/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('one unavailable remote host does not hide healthy hosts or expose scrape targets', async () => {
  const remote = { ...hosts[0], publicId: 'remote', instance: 'remote-private:19100' };
  const probe = createProbe({
    hosts: [...hosts, remote],
    prometheusUrl: 'http://private:9090',
    now: () => 100000,
    fetcher: async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const expression = url.searchParams.get('query')!;
      if (expression.includes(remote.instance)) throw new Error('unreachable private target');
      const value = expression.startsWith('timestamp')
        ? 100
        : expression.startsWith('up{')
          ? 1
          : expression.startsWith('node_memory_SwapTotal')
            ? 0
            : 42;
      return Response.json({
        status: 'success',
        data: { resultType: 'vector', result: [{ value: [100, String(value)] }] },
      });
    },
  });
  const result = await probe();
  assert.deepEqual(
    result.hosts.map((host: { status: string }) => host.status),
    ['ok', 'unavailable'],
  );
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(JSON.stringify(result).includes('secret-host'), false);
});

test('probe projects private metrics, caches queries, distinguishes down from failure and stale', async () => {
  let time = 100000,
    calls = 0,
    up = 1,
    fail = false,
    timestamp = 100;
  const probe = createProbe({
    hosts,
    prometheusUrl: 'http://private:9090',
    now: () => time,
    fetcher: async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      calls++;
      if (fail) throw new Error('private-host:9090 failed');
      const q = url.searchParams.get('query')!;
      const value = q.startsWith('timestamp')
        ? timestamp
        : q.startsWith('up{')
          ? up
          : q.startsWith('node_memory_SwapTotal')
            ? 0
            : 42;
      return new Response(
        JSON.stringify({
          status: 'success',
          data: {
            resultType: 'vector',
            result: [{ metric: { instance: 'secret' }, value: [time / 1000, String(value)] }],
          },
        }),
      );
    },
  });
  let result = await probe();
  assert.equal(result.hosts[0].status, 'ok');
  assert.equal(result.hosts[0].swapState, 'not-configured');
  assert.equal(result.hosts[0].swapPercent, null);
  assert.equal(result.hosts[0].load1, 42);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  const count = calls;
  await Promise.all([probe(), probe()]);
  assert.equal(calls, count);
  time += 6000;
  up = 0;
  assert.equal((await probe()).hosts[0].status, 'offline');
  time += 6000;
  fail = true;
  result = await probe();
  assert.equal(result.hosts[0].status, 'unavailable');
  assert.equal(result.hosts[0].online, null);
  time += 30000;
  fail = false;
  up = 1;
  assert.equal((await probe()).hosts[0].sampledAt, null);
  assert.throws(() => validateHosts([...hosts, ...hosts]));
});

test('error endpoint bounds input, rejects cross origin and unknown fields, rotates local logs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blank-honey-log-'));
  const app = createApp({
    probe: async () => ({ hosts: [] }),
    writeLog: createLog(directory, 300),
    allowedOrigin: 'http://localhost:8080',
  });
  await new Promise<void>((resolve) => app.listen(0, '127.0.0.1', resolve));
  const address = app.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/errors`;
  const event = { kind: 'audio', code: 'Error', path: '/articles/' };
  const post = (body = event, origin = 'http://localhost:8080') =>
    fetch(url, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await post(event, 'http://localhost:8081')).status, 403);
    assert.equal((await post({ ...event, extra: 'secret' } as typeof event)).status, 400);
    assert.equal((await post({ ...event, path: '/?token=secret' })).status, 400);
    assert.equal((await post({ ...event, code: 'x'.repeat(3000) })).status, 413);
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(url.replace('errors', 'probe?query=up'))).status, 404);
    for (let i = 0; i < 5; i++) assert.equal((await post()).status, 202);
    const files = await readdir(directory);
    assert.deepEqual(files.sort(), ['site.jsonl', 'site.jsonl.1']);
    const contents = await readFile(join(directory, 'site.jsonl'), 'utf8');
    assert.equal(contents.includes('secret'), false);
    assert.equal(JSON.parse(contents.trim().split('\n')[0]).kind, 'audio');
    let limited = false;
    for (let i = 0; i < 61; i++) if ((await post()).status === 429) limited = true;
    assert.equal(limited, true);
  } finally {
    await new Promise<void>((resolve) => app.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
