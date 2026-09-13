import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeHosts, type Host } from '../src/domain/probe';
const time = Date.parse('2026-09-13T00:00:00Z');
const sample = (publicId: string, override: Partial<Host> = {}): Host => ({
  publicId,
  displayName: publicId,
  online: true,
  sampledAt: new Date(time).toISOString(),
  regionLabel: 'test',
  timeZone: 'UTC',
  cpuPercent: 15,
  memoryPercent: 20,
  swapPercent: null,
  swapState: 'not-configured',
  diskPercent: 30,
  load1: 1,
  load5: 1,
  load15: 1,
  status: 'ok',
  ...override,
});
test('one stale host does not freeze healthy or offline siblings', () => {
  const old = mergeHosts(
    [],
    ['a', 'b', 'c'].map((id) => sample(id)),
    time,
  );
  const next = mergeHosts(
    old,
    [
      sample('a', { status: 'unavailable', sampledAt: null, cpuPercent: null }),
      sample('b', { cpuPercent: 50 }),
      sample('c', { online: false, status: 'offline' }),
    ],
    time + 10000,
  );
  assert.equal(next[0].cpuPercent, 15);
  assert.equal(next[0].stale, true);
  assert.equal(next[1].cpuPercent, 50);
  assert.equal(next[1].stale, false);
  assert.equal(next[2].online, false);
  assert.equal(mergeHosts(next, [sample('b', { cpuPercent: 50 })], time + 20000)[0].stale, true);
});
