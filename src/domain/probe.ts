export type Host = {
  publicId: string;
  displayName: string;
  online: boolean | null;
  sampledAt: string | null;
  regionLabel: string;
  timeZone: string;
  cpuPercent: number | null;
  memoryPercent: number | null;
  swapPercent: number | null;
  swapState: string;
  diskPercent: number | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  status: string;
};
export type HostView = Host & { stale: boolean; missed: number };
/** Merge each host independently: one failing collector must not freeze its siblings. */
export function mergeHosts(previous: HostView[], samples: Host[], now = Date.now()): HostView[] {
  return samples.map((sample) => {
    const old = previous.find((h) => h.publicId === sample.publicId);
    const missed = old?.sampledAt === sample.sampledAt ? old.missed + 1 : 0;
    const age = sample.sampledAt ? now - Date.parse(sample.sampledAt) : Infinity;
    const stale =
      sample.status === 'unavailable' || !Number.isFinite(age) || age > 25000 || missed >= 2;
    if (sample.online === false && sample.status === 'offline') return { ...sample, stale, missed };
    return { ...(stale && old ? old : sample), stale, missed };
  });
}

export type MetricLevel = 'normal' | 'warning' | 'critical' | 'unknown';
/** Display thresholds, not an incident detector: a single high sample is not an outage. */
export function metricLevel(value: number | null): MetricLevel {
  if (value === null || !Number.isFinite(value) || value < 0 || value > 100) return 'unknown';
  if (value >= 90) return 'critical';
  if (value >= 75) return 'warning';
  return 'normal';
}

export function hostHealth(host: HostView, failed = false) {
  if (!host.sampledAt || !Number.isFinite(Date.parse(host.sampledAt)))
    return { level: 'unknown', label: '无数据' };
  if (failed || host.stale) return { level: 'unknown', label: '采样过期' };
  if (host.online === false) return { level: 'critical', label: '离线' };
  if (host.online !== true || host.status !== 'ok') return { level: 'unknown', label: '无数据' };
  const levels = [host.cpuPercent, host.memoryPercent, host.diskPercent].map(metricLevel);
  if (host.swapState !== 'not-configured') levels.push(metricLevel(host.swapPercent));
  if (levels.includes('critical')) return { level: 'critical', label: '占用过高' };
  if (levels.includes('warning')) return { level: 'warning', label: '占用偏高' };
  if (levels.includes('unknown')) return { level: 'unknown', label: '指标不完整' };
  return { level: 'normal', label: '运行正常' };
}
