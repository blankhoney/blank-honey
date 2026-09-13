import { report } from './log';
import { mergeHosts, type Host, type HostView } from '../domain/probe';
export async function mountProbe(signal: AbortSignal) {
  if (signal.aborted) return;
  const host = document.querySelector<HTMLElement>('#probe')!;
  let last: HostView[] = [],
    busy = false;
  const element = (tag: string, text?: string, className?: string) => {
    const el = document.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  function draw(failed = false) {
    host.replaceChildren();
    const note = element(
      'p',
      failed || last.some((h) => h.stale)
        ? '部分采样已过期，保留最后一次状态。'
        : '当前采样 · 10 秒刷新 · 负载为原值',
      'probe-note',
    );
    note.setAttribute('role', 'status');
    host.append(note);
    for (const h of last) {
      const row = element('section', undefined, 'machine');
      row.dataset.status = h.status;
      const main = element('div', undefined, 'machine-main');
      main.append(element('h2', h.displayName), element('small', h.regionLabel));
      const clock = element('time');
      clock.dataset.zone = h.timeZone;
      main.append(clock);
      main.append(
        element(
          'span',
          h.online === false
            ? 'OFFLINE'
            : failed || h.stale
              ? 'STALE'
              : h.status === 'ok'
                ? 'ONLINE'
                : 'UNAVAILABLE',
          'state',
        ),
      );
      row.append(main);
      const metrics: [string, number | null, string?][] = [
        ['CPU', h.cpuPercent],
        ['MEMORY', h.memoryPercent],
        [
          'SWAP',
          h.swapPercent,
          h.swapState === 'not-configured'
            ? '未配置'
            : h.swapState === 'unavailable'
              ? '采集不可用'
              : undefined,
        ],
        ['DISK', h.diskPercent],
      ];
      for (const [name, value, message] of metrics) {
        const metric = element('div', undefined, 'metric');
        metric.append(element('div', name, 'metric-label'));
        const n = element(
          'div',
          typeof value === 'number' ? value.toFixed(1) : '—',
          'metric-value',
        );
        if (typeof value === 'number') n.append(element('small', ' %'));
        const bar = element('div', undefined, 'metric-bar');
        const fill = element('span');
        fill.style.width = `${typeof value === 'number' ? Math.max(0, Math.min(100, value)) : 0}%`;
        bar.append(fill);
        metric.append(n, bar);
        if (message) metric.append(element('small', message));
        row.append(metric);
      }
      row.append(
        element(
          'div',
          `LOAD  ${[h.load1, h.load5, h.load15].map((v) => (typeof v === 'number' ? v.toFixed(2) : '—')).join(' / ')}    1 / 5 / 15 min`,
          'load',
        ),
      );
      host.append(row);
    }
    clocks();
  }
  function clocks() {
    host.querySelectorAll<HTMLElement>('[data-zone]').forEach((el) => {
      try {
        el.textContent = new Intl.DateTimeFormat('zh-CN', {
          timeZone: el.dataset.zone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date());
      } catch {
        el.textContent = '—';
      }
    });
  }
  async function refresh() {
    if (signal.aborted || document.hidden || busy) return;
    busy = true;
    try {
      const response = await fetch('/api/probe', {
        signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Probe unavailable');
      const data = await response.json();
      const hosts = (Array.isArray(data) ? data : data.hosts) as Host[];
      if (!Array.isArray(hosts)) throw new Error('Invalid projection');
      last = mergeHosts(last, hosts);
      if (!last.length) {
        host.replaceChildren(element('p', '尚未配置主机。', 'empty'));
        return;
      }
      draw();
    } catch (error) {
      if (signal.aborted) return;
      if (last.length) draw(true);
      else {
        host.replaceChildren(element('p', '探针暂不可用，等待下次采样。', 'empty'));
      }
      report('probe', error);
    } finally {
      busy = false;
    }
  }
  const interval = setInterval(refresh, 10000),
    clock = setInterval(() => {
      if (!document.hidden) clocks();
    }, 1000);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (!document.hidden) void refresh();
    },
    { signal },
  );
  signal.addEventListener(
    'abort',
    () => {
      clearInterval(interval);
      clearInterval(clock);
    },
    { once: true },
  );
  await refresh();
}
