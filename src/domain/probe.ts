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
