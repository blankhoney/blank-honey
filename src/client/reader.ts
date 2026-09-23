/**
 * Mounts the public reading surfaces: the entry list, the single-entry view, and the RSS address
 * card. The main application dispatches here per container id, and every mount receives the page's
 * abort signal, so nothing survives a navigation.
 *
 * Two rules shape the list. A filter change is a new generation: the previous request is aborted,
 * the pagination cursor is dropped, and a late answer from the old generation is discarded without
 * touching the DOM — a slow reply must never overwrite a newer filter's result. And a failed refresh
 * never empties the page: whatever was already rendered stays, and the status line says it is older
 * than the reader wanted.
 *
 * Feed markup is never built here. `safeFeedFragment` and `feedExcerpt` from `./reader-content` are
 * the only producers of feed-derived nodes and text.
 */
import type { ReaderDetail, ReaderEntries, ReaderEntry, ReaderSource } from '../domain/reader';
import { feedExcerpt, safeFeedFragment } from './reader-content';

/** Matches the server's own request budget; a request that outlives it is already useless. */
const REQUEST_TIMEOUT_MS = 12_000;

/** Every hex64 id the detail endpoint accepts. Anything else cannot name an entry. */
const ENTRY_ID = /^[0-9a-f]{64}$/;

/** Bounded server codes and the only sentences the reader will show for them. */
const READ_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: '这个请求需要管理权限。',
  RATE_LIMITED: '请求过于频繁，请稍后重试。',
  CAPACITY: '服务器暂时无法处理更多请求。',
  FETCH_FAILED: '暂时无法读取订阅内容。',
  INVALID_URL: '订阅地址无效。',
  NOT_FOUND: '没有找到这篇文章。',
  SOURCE_LIMIT: '订阅源数量已达上限。',
  SOURCE_EXISTS: '这个订阅源已经存在。',
};

/** How each published source state reads on the public page. */
const SOURCE_STATE: Record<ReaderSource['status'], string> = {
  pending: '待抓取',
  fetching: '抓取中',
  ok: '正常',
  error: '抓取异常',
  paused: '已暂停',
};

const GENERIC_FAILURE = '加载失败，请稍后重试。';
const STALE_NOTICE = '暂时无法更新，以下为较早加载的内容。';

/** A refused response, reduced to the bounded code the server is allowed to publish. */
class ReaderRequestError extends Error {
  constructor(
    readonly code: string | null,
    readonly status: number,
  ) {
    super(code ?? `HTTP_${status}`);
    this.name = 'ReaderRequestError';
  }
}

/** Turns a failure into one of the fixed sentences above, never into server text. */
function messageFor(error: unknown): string {
  if (error instanceof ReaderRequestError && error.code !== null) {
    return READ_MESSAGES[error.code] ?? GENERIC_FAILURE;
  }
  return GENERIC_FAILURE;
}

/** Reads the bounded `error` code from a failed response, tolerating a body that is not JSON. */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (body === null || typeof body !== 'object' || !('error' in body)) return null;
    const code = (body as { error?: unknown }).error;
    if (typeof code === 'string' && code.length > 0 && code.length <= 64) return code;
  } catch {
    // A body that is not JSON carries no code this client is allowed to trust.
  }
  return null;
}

/**
 * One GET under the three signals the reader promises: the caller's lifetime signal (the page, and
 * for a list request also the generation that owns it), this request's own abort handle, and a hard
 * timeout. Aborting the handle cancels the fetch in flight; the timer behind `AbortSignal.timeout`
 * is created by the platform and has no clear interface, so it simply expires unused once the
 * request is over.
 */
async function requestJson<T>(url: string, callerSignal: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const signal = AbortSignal.any([
    callerSignal,
    controller.signal,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  ]);
  try {
    const response = await fetch(url, {
      signal,
      credentials: 'same-origin',
      // A read carries no body, so it carries no JSON content type either.
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new ReaderRequestError(await readErrorCode(response), response.status);
    return (await response.json()) as T;
  } finally {
    // Released here so a settled request stops observing the caller's signal.
    controller.abort();
  }
}

/** Local-time stamp for display. The machine-readable value lives in `<time datetime>`. */
function formatDate(at: number): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** A check that may never have happened says so rather than showing no time at all. */
function formatCheckedAt(at: number | null): string {
  return at === null ? '未检查' : formatDate(at);
}

/**
 * A feed-supplied destination made safe to link, or null when the reader refuses to navigate to it.
 * The entry URL arrives inside the feed, so it is checked exactly like a link inside feed markup.
 */
function externalHref(raw: string | null): string | null {
  if (!raw) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  return url.href;
}

/** Where relative links inside one entry's markup should land. Never the private feed URL. */
function baseUrlFor(entry: ReaderEntry, sources: Map<string, ReaderSource>): string {
  return entry.url ?? sources.get(entry.sourceId)?.siteUrl ?? location.origin;
}

/**
 * The subscribed sources, or null when the request failed. Callers must tell those apart: "no
 * sources yet" and "the source list could not be read" lead to different sentences, and only one of
 * them is true.
 */
async function loadSources(pageSignal: AbortSignal): Promise<ReaderSource[] | null> {
  try {
    const payload = await requestJson<{ sources: ReaderSource[] }>(
      '/api/reader/sources',
      pageSignal,
    );
    return Array.isArray(payload.sources) ? payload.sources : null;
  } catch {
    // A missing source list never blocks the entries themselves; it only costs the labels.
    return null;
  }
}

export async function mountReader(signal: AbortSignal): Promise<void> {
  const root = document.querySelector<HTMLElement>('#reader');
  if (!root) return;
  if (root.dataset.view === 'list') await mountList(root, signal);
  else if (root.dataset.view === 'item') await mountItem(root, signal);
}

async function mountList(root: HTMLElement, pageSignal: AbortSignal): Promise<void> {
  const filterForm = root.querySelector<HTMLFormElement>('form[data-reader-filters]');
  const sourceSelect = root.querySelector<HTMLSelectElement>('select[data-reader-source]');
  const queryInput = root.querySelector<HTMLInputElement>('input[data-reader-query]');
  const statusNode = root.querySelector<HTMLElement>('[data-reader-status]');
  const sourceStatusNode = root.querySelector<HTMLElement>('[data-reader-source-status]');
  const entriesNode = root.querySelector<HTMLElement>('[data-reader-entries]');
  const moreButton = root.querySelector<HTMLButtonElement>('button[data-reader-more]');
  if (
    !filterForm ||
    !sourceSelect ||
    !queryInput ||
    !statusNode ||
    !sourceStatusNode ||
    !entriesNode ||
    !moreButton
  )
    return;
  // `renderPage` and `load` below are hoisted, so they are analysed before this guard narrows the
  // queries above. Binding the nodes they reach for gives them the types the guard just proved.
  const list = entriesNode;
  const sourceField = sourceSelect;
  const queryField = queryInput;
  const sourceStatus = sourceStatusNode;
  const more = moreButton;

  const sources = new Map<string, ReaderSource>();
  /** False until a source list actually arrives, so an empty map is never read as "none exist". */
  let sourcesKnown = false;
  let nextCursor: string | null = null;
  let generation = 0;
  let inFlight: AbortController | null = null;

  const setStatus = (message: string, tone: 'idle' | 'error' | 'busy' = 'idle') => {
    statusNode.textContent = message;
    statusNode.dataset.readerTone = tone;
  };

  const setBusy = (busy: boolean) => {
    list.setAttribute('aria-busy', busy ? 'true' : 'false');
    more.disabled = busy || nextCursor === null;
  };

  function renderEntry(entry: ReaderEntry): HTMLLIElement {
    const item = document.createElement('li');
    item.className = 'reader-entry';

    const meta = document.createElement('p');
    meta.className = 'reader-entry-meta';
    const source = document.createElement('span');
    source.className = 'reader-entry-source';
    // Identity from the feed is text, never markup.
    source.textContent = entry.sourceTitle;
    const at = entry.publishedAt ?? entry.collectedAt;
    const time = document.createElement('time');
    time.className = 'reader-entry-date';
    time.dateTime = new Date(at).toISOString();
    time.textContent =
      entry.publishedAt === null ? `收录 ${formatDate(at)}` : formatDate(entry.publishedAt);
    meta.append(source, time);

    const heading = document.createElement('h2');
    heading.className = 'reader-entry-title';
    const link = document.createElement('a');
    link.setAttribute('href', `/reader/item/?id=${encodeURIComponent(entry.id)}`);
    link.textContent = entry.title;
    heading.append(link);

    const excerpt = document.createElement('p');
    excerpt.className = 'reader-entry-excerpt';
    excerpt.textContent = feedExcerpt(entry.summaryHtml, baseUrlFor(entry, sources));

    item.append(meta, heading, excerpt);

    const origin = externalHref(entry.url);
    if (origin !== null) {
      const original = document.createElement('a');
      original.className = 'reader-entry-origin';
      original.setAttribute('href', origin);
      original.setAttribute('rel', 'noopener noreferrer');
      original.setAttribute('target', '_blank');
      original.textContent = '查看原文 ↗';
      item.append(original);
    }
    return item;
  }

  /**
   * Why the list is empty. "No articles" means something different when nothing is subscribed yet,
   * when the first fetch has not landed, and when a filter simply matched nothing — so each case
   * gets its own sentence instead of one line that is wrong in three of them.
   */
  function emptyMessage(): string {
    if (sourceField.value !== '' || queryField.value.trim() !== '') return '没有匹配的文章。';
    if (!sourcesKnown) return '暂时无法读取订阅源状态，稍后重试。';
    if (sources.size === 0) return '尚未添加订阅源。';
    const enabled = [...sources.values()].filter((source) => source.enabled);
    if (enabled.length === 0) return '订阅源都已停用。';
    const waiting = enabled.filter(
      (source) =>
        source.lastSuccessAt === null &&
        (source.status === 'pending' || source.status === 'fetching'),
    );
    if (waiting.length === enabled.length) return '正在等待首次抓取。';
    return '还没有可读的文章，稍后再来看看。';
  }

  /**
   * The state of the subscriptions themselves: which source is being shown, when it was last
   * checked, and whether anything is failing. The list can be empty, stale or complete while the
   * sources behind it are in any of those states, so this never hides inside the article list.
   */
  function renderSourceStatus(): void {
    const all = [...sources.values()];
    const selected = sourceField.value === '' ? null : sources.get(sourceField.value);
    if (selected) {
      const line = [
        `${selected.title} · ${SOURCE_STATE[selected.status]}`,
        `${selected.enabled ? '已启用' : '已停用'}`,
        `最近检查 ${formatCheckedAt(selected.lastAttemptAt)}`,
      ];
      if (selected.errorCode !== null) {
        line.push(READ_MESSAGES[selected.errorCode] ?? '抓取异常');
      }
      sourceStatus.textContent = line.join(' · ');
      sourceStatus.dataset.readerTone = selected.errorCode === null ? 'idle' : 'error';
      return;
    }
    if (!sourcesKnown) {
      sourceStatus.textContent = '暂时无法读取订阅源状态。';
      sourceStatus.dataset.readerTone = 'error';
      return;
    }
    if (all.length === 0) {
      sourceStatus.textContent = '尚未添加订阅源。';
      sourceStatus.dataset.readerTone = 'idle';
      return;
    }
    const failing = all.filter(
      (source) => source.enabled && (source.status === 'error' || source.errorCode !== null),
    );
    const latest = all.reduce<number | null>(
      (newest, source) =>
        source.lastAttemptAt !== null && (newest === null || source.lastAttemptAt > newest)
          ? source.lastAttemptAt
          : newest,
      null,
    );
    const line = [`共 ${all.length} 个订阅源`, `最近检查 ${formatCheckedAt(latest)}`];
    line.push(
      failing.length === 0 ? '暂无抓取异常' : `${failing.length} 个抓取异常，列表可能不是最新的`,
    );
    sourceStatus.textContent = line.join(' · ');
    sourceStatus.dataset.readerTone = failing.length === 0 ? 'idle' : 'error';
  }

  function renderPage(payload: ReaderEntries, append: boolean): void {
    if (!append) list.replaceChildren();
    for (const entry of payload.entries) list.append(renderEntry(entry));
    if (list.childElementCount === 0) {
      const empty = document.createElement('p');
      empty.className = 'reader-empty';
      empty.textContent = emptyMessage();
      list.append(empty);
    }
    nextCursor = payload.nextCursor;
    more.hidden = nextCursor === null;
    more.disabled = nextCursor === null;
  }

  async function load(append: boolean): Promise<void> {
    if (pageSignal.aborted) return;
    if (append && nextCursor === null) return;
    const current = generation;
    // Superseding aborts the request this generation started, so its fetch is cancelled at the
    // network layer; the generation check below is what keeps a late answer out of the DOM.
    inFlight?.abort();
    const controller = new AbortController();
    inFlight = controller;
    const superseded = () =>
      pageSignal.aborted || controller.signal.aborted || current !== generation;
    setBusy(true);
    setStatus(append ? '正在加载更多…' : '正在加载…', 'busy');
    try {
      const params = new URLSearchParams();
      if (sourceField.value !== '') params.set('source', sourceField.value);
      const query = queryField.value.trim();
      if (query !== '') params.set('q', query);
      if (append && nextCursor !== null) params.set('cursor', nextCursor);
      const search = params.size > 0 ? `?${params.toString()}` : '';
      // The generation's own controller is part of the request, so superseding it really cancels
      // the fetch instead of merely ignoring its answer.
      const payload = await requestJson<ReaderEntries>(
        `/api/reader/entries${search}`,
        AbortSignal.any([pageSignal, controller.signal]),
      );
      if (superseded()) return;
      renderPage(payload, append);
      const shown = list.querySelectorAll('.reader-entry').length;
      setStatus(shown > 0 ? `已加载 ${shown} 篇文章。` : '');
    } catch (error) {
      // A superseded request is not a failure the reader should ever see.
      if (superseded()) return;
      const hasEntries = list.querySelector('.reader-entry') !== null;
      setStatus(hasEntries ? STALE_NOTICE : messageFor(error), 'error');
    } finally {
      if (inFlight === controller) {
        inFlight = null;
        if (!pageSignal.aborted) setBusy(false);
      }
    }
  }

  /**
   * A new filter is a new generation: the cursor is dropped and the old request is aborted. The
   * rendered entries stay until the new page replaces them, so a filter that fails leaves the reader
   * with what they already had instead of an empty page.
   */
  function startFilter(): void {
    generation += 1;
    nextCursor = null;
    // The summary describes the selection, so it changes with the selection, not with the answer.
    renderSourceStatus();
    void load(false);
  }

  filterForm.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      startFilter();
    },
    { signal: pageSignal },
  );
  sourceField.addEventListener('change', startFilter, { signal: pageSignal });
  more.addEventListener(
    'click',
    () => {
      void load(true);
    },
    { signal: pageSignal },
  );

  const loaded = await loadSources(pageSignal);
  if (pageSignal.aborted) return;
  sourcesKnown = loaded !== null;
  for (const source of loaded ?? []) {
    sources.set(source.id, source);
    const option = document.createElement('option');
    option.value = source.id;
    option.textContent = source.title;
    sourceField.append(option);
  }
  renderSourceStatus();
  await load(false);
}

async function mountItem(root: HTMLElement, pageSignal: AbortSignal): Promise<void> {
  const statusNode = root.querySelector<HTMLElement>('[data-reader-status]');
  const detailNode = root.querySelector<HTMLElement>('[data-reader-detail]');
  if (!statusNode || !detailNode) return;

  const setStatus = (message: string, tone: 'idle' | 'error' | 'busy' = 'idle') => {
    statusNode.textContent = message;
    statusNode.dataset.readerTone = tone;
  };

  const id = new URLSearchParams(location.search).get('id');
  if (id === null || !ENTRY_ID.test(id)) {
    detailNode.hidden = true;
    setStatus(
      id === null ? '缺少文章标识，无法打开这篇内容。' : '文章标识无效，无法打开这篇内容。',
      'error',
    );
    return;
  }

  setStatus('正在加载…', 'busy');
  let detail: ReaderDetail;
  try {
    detail = await requestJson<ReaderDetail>(
      `/api/reader/entries/${encodeURIComponent(id)}`,
      pageSignal,
    );
  } catch (error) {
    if (pageSignal.aborted) return;
    detailNode.hidden = true;
    setStatus(messageFor(error), 'error');
    return;
  }
  if (pageSignal.aborted) return;

  // Relative links in the body must land where the feed meant them to. The entry's own URL is the
  // best answer; without it the source's site is the next best, and only then the reader's origin —
  // resolving them against this site instead would silently point a feed's links at our own pages.
  let base = detail.url;
  if (base === null) {
    const sourceList = await loadSources(pageSignal);
    if (pageSignal.aborted) return;
    base = sourceList?.find((source) => source.id === detail.sourceId)?.siteUrl ?? null;
  }

  const title = document.createElement('h1');
  title.className = 'reader-detail-title';
  title.textContent = detail.title;

  const meta = document.createElement('p');
  meta.className = 'reader-detail-meta';
  const fields: [string, string][] = [
    ['作者', detail.author ?? '未提供'],
    ['来源', detail.sourceTitle],
    ['原始日期', detail.publishedAt === null ? '未提供' : formatDate(detail.publishedAt)],
    ['收录日期', formatDate(detail.collectedAt)],
  ];
  for (const [label, value] of fields) {
    const part = document.createElement('span');
    part.className = 'reader-detail-field';
    const name = document.createElement('span');
    name.className = 'reader-detail-label';
    name.textContent = label;
    const text = document.createElement('span');
    text.className = 'reader-detail-value';
    text.textContent = value;
    part.append(name, text);
    meta.append(part);
  }

  const kind = document.createElement('p');
  kind.className = 'reader-detail-kind';
  kind.textContent = detail.contentKind === 'content' ? '正文' : '摘要';

  detailNode.replaceChildren(title, meta, kind);
  if (detail.truncated) {
    const notice = document.createElement('p');
    notice.className = 'reader-detail-truncated';
    notice.textContent = '原始内容较长，这里显示的是收录时的截断部分。';
    detailNode.append(notice);
  }

  const body = document.createElement('div');
  body.className = 'prose reader-detail-body';
  // The only place feed markup reaches the document, and only as a purified fragment.
  body.append(safeFeedFragment(detail.contentHtml || detail.summaryHtml, base ?? location.origin));
  detailNode.append(body);

  const origin = externalHref(detail.url);
  if (origin !== null) {
    const original = document.createElement('a');
    original.className = 'reader-detail-origin';
    original.setAttribute('href', origin);
    original.setAttribute('rel', 'noopener noreferrer');
    original.setAttribute('target', '_blank');
    original.textContent = '查看原文 ↗';
    detailNode.append(original);
  }

  detailNode.hidden = false;
  setStatus('');
}

/** Wires the RSS address card: copying is the only scripted behaviour on that page. */
export async function mountRss(signal: AbortSignal): Promise<void> {
  const root = document.querySelector<HTMLElement>('#rss-subscription');
  if (!root) return;
  const input = root.querySelector<HTMLInputElement>('input[data-rss-url]');
  const copyButton = root.querySelector<HTMLButtonElement>('button[data-rss-copy]');
  const statusNode = root.querySelector<HTMLElement>('[data-rss-status]');
  if (!input || !copyButton || !statusNode) return;

  copyButton.addEventListener(
    'click',
    async () => {
      const address = input.value;
      const setStatus = (message: string, tone: 'idle' | 'error' = 'idle') => {
        statusNode.textContent = message;
        statusNode.dataset.readerTone = tone;
      };
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(address);
        if (signal.aborted) return;
        setStatus('已复制订阅地址。');
      } catch {
        if (signal.aborted) return;
        // Selection is the fallback that always works, so the reader can copy by hand.
        input.focus();
        input.select();
        setStatus('复制失败，地址已选中，请手动复制。', 'error');
      }
    },
    { signal },
  );
}
