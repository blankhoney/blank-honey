import { report } from './log';
import { mergeHosts, metricLevel, hostHealth, type Host, type HostView } from '../domain/probe';
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
        : '每 10 秒刷新 · 占用 ≥75% 提醒，≥90% 高占用 · LOAD 为原始负载',
      'probe-note',
    );
    note.setAttribute('role', 'status');
    host.append(note);
    for (const sample of last) {
      const health = hostHealth(sample, failed);
      const card = element('section', undefined, 'probe-card');
      card.dataset.level = health.level;
      const header = element('header', undefined, 'probe-card-header');
      const identity = element('div');
      identity.append(element('h2', sample.displayName));
      header.append(identity, element('span', health.label, 'probe-state'));
      card.append(header);

      const metrics: [string, string, number | null, string?][] = [
        ['CPU', '处理器', sample.cpuPercent],
        ['MEMORY', '内存', sample.memoryPercent],
        ['DISK', '磁盘', sample.diskPercent],
        [
          'SWAP',
          '交换空间',
          sample.swapPercent,
          sample.swapState === 'not-configured' ? '未配置' : undefined,
        ],
      ];
      const table = element('dl', undefined, 'probe-metrics');
      for (const [name, label, value, message] of metrics) {
        const metric = element('div', undefined, 'probe-metric');
        const level = metricLevel(value);
        metric.dataset.level = failed || sample.stale || sample.online !== true ? 'unknown' : level;
        const heading = element('dt');
        heading.append(element('span', name), element('small', label));
        const reading = element('dd');
        const number = element(
          'span',
          level === 'unknown' ? '—' : value!.toFixed(1),
          'metric-value',
        );
        if (level !== 'unknown') number.append(element('small', ' %'));
        const bar = element('div', undefined, 'metric-bar');
        bar.setAttribute('aria-hidden', 'true');
        const fill = element('span');
        fill.style.width = `${level === 'unknown' ? 0 : value}%`;
        bar.append(fill);
        const levelLabels = {
          normal: '正常',
          warning: '偏高',
          critical: '过高',
          unknown: '无数据',
        };
        let caption = message ?? levelLabels[level];
        if (failed || sample.stale) caption = '最后采样';
        else if (sample.online === false) caption = '离线';
        reading.append(number, bar, element('small', caption, 'probe-metric-state'));
        metric.append(heading, reading);
        table.append(metric);
      }
      card.append(table);
      const load = element('div', undefined, 'probe-load');
      load.append(element('span', 'LOAD AVG', 'probe-label'));
      for (const [index, value] of [sample.load1, sample.load5, sample.load15].entries()) {
        const entry = element('span');
        entry.append(
          element('strong', typeof value === 'number' ? value.toFixed(2) : '—'),
          element('small', `${[1, 5, 15][index]} min`),
        );
        load.append(entry);
      }
      card.append(load);
      const footer = element('footer', undefined, 'probe-card-footer');
      const clock = element('time');
      clock.dataset.zone = sample.timeZone;
      clock.title = '主机所在时区的当前时间';
      const location = element('span', sample.regionLabel || '位置未标注', 'probe-region');
      footer.append(location, clock);
      card.append(footer);
      host.append(card);
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
