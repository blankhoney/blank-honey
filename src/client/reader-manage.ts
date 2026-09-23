/**
 * Mounts the reader's administration surface. Every value on this page is fetched through an
 * authenticated API: the page itself ships no source list, no counts and no credentials, and only
 * the uninitialized notice is static text.
 *
 * The CSRF token lives in a closure variable for the life of the page — never in storage, never in
 * the DOM. Any 401 tears the session down and returns to the login view, because a stale token
 * cannot be repaired locally. Destructive actions ask for confirmation first, and each action
 * disables only its own control, so a slow refresh cannot freeze the rest of the panel.
 *
 * Progress is never polled: a queued refresh says so and waits for the reader to press "更新状态",
 * which is the only thing on this page that refreshes on its own behalf.
 */
import type { ReaderAdminSource, ReaderSession } from '../domain/reader';

const REQUEST_TIMEOUT_MS = 12_000;

/** Bounded codes to the sentences the panel is allowed to show. Unknown codes stay generic. */
const ADMIN_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: '登录状态已过期，请重新登录。',
  INVALID_CREDENTIALS: '密码不正确。',
  CSRF_DENIED: '操作校验失败，请重新登录后再试。',
  RATE_LIMITED: '尝试过于频繁，请稍后再试。',
  ADMIN_UNCONFIGURED: '管理尚未初始化，请管理员在服务器终端设置密码。',
  INVALID_URL: '订阅地址无效，请使用 HTTP(S) 地址和 80 或 443 端口。',
  INVALID_PASSWORD: '新密码至少需要12个字符，且不能超过1024字节。',
  ADDRESS_DENIED: '订阅地址必须指向公开网络，不能访问内网或保留地址。',
  INVALID_FEED: '该地址不是受支持的 RSS 或 Atom，请填写订阅地址而不是普通网页。',
  INVALID_XML: '订阅内容不是有效的 XML，旧缓存已保留。',
  SOURCE_PAUSED: '订阅源已停用，请先启用再刷新。',
  FEED_TOO_LARGE: '订阅内容超过单次2MiB上限，旧缓存已保留。',
  SOURCE_EXISTS: '这个订阅源已经存在。',
  SOURCE_LIMIT: '订阅源数量已达上限。',
  FETCH_FAILED: '抓取失败，请检查订阅地址是否可访问。',
  CAPACITY: '服务器暂时无法处理更多内容。',
  NOT_FOUND: '没有找到这个订阅源。',
};

const GENERIC_FAILURE = '操作失败，请稍后重试。';
const EXPIRED_NOTICE = '登录状态已过期，请重新登录。';

const SOURCE_STATE: Record<ReaderAdminSource['status'], string> = {
  pending: '待抓取',
  fetching: '抓取中',
  ok: '正常',
  error: '抓取失败',
  paused: '已暂停',
};

class AdminRequestError extends Error {
  constructor(
    readonly code: string | null,
    readonly status: number,
  ) {
    super(code ?? `HTTP_${status}`);
    this.name = 'AdminRequestError';
  }
}

function messageFor(error: unknown): string {
  if (error instanceof AdminRequestError && error.code !== null) {
    return ADMIN_MESSAGES[error.code] ?? GENERIC_FAILURE;
  }
  return GENERIC_FAILURE;
}

/** True when the failure means the session is gone and the panel must return to login. */
function isAuthLoss(error: unknown): boolean {
  if (!(error instanceof AdminRequestError)) return false;
  return error.status === 401 || error.code === 'AUTH_REQUIRED' || error.code === 'CSRF_DENIED';
}

async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    if (body === null || typeof body !== 'object' || !('error' in body)) return null;
    const code = (body as { error?: unknown }).error;
    if (typeof code === 'string' && code.length > 0 && code.length <= 64) return code;
  } catch {
    // A body that is not JSON carries no code this panel is allowed to trust.
  }
  return null;
}

/**
 * One request under the page signal, its own abort handle and a hard timeout. `csrf` is the login
 * receipt; only the login call itself omits it, and a body always travels as JSON.
 */
async function adminRequest<T>(
  url: string,
  options: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; csrf?: string | null; body?: unknown },
  pageSignal: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const signal = AbortSignal.any([
    pageSignal,
    controller.signal,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  ]);
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.csrf) headers['X-Reader-CSRF'] = options.csrf;
  try {
    const response = await fetch(url, {
      method: options.method,
      signal,
      credentials: 'same-origin',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    if (!response.ok) throw new AdminRequestError(await readErrorCode(response), response.status);
    return (await response.json()) as T;
  } finally {
    controller.abort();
  }
}

/** Local-time stamp for display; the panel never shows a raw epoch. */
function formatDate(at: number | null): string {
  if (at === null) return '未提供';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '未提供';
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export async function mountReaderManager(signal: AbortSignal): Promise<void> {
  const root = document.querySelector<HTMLElement>('#reader-manage');
  if (!root) return;
  const statusNode = root.querySelector<HTMLElement>('[data-reader-status]');
  const unconfiguredNode = root.querySelector<HTMLElement>('[data-reader-unconfigured]');
  const loginForm = root.querySelector<HTMLFormElement>('form[data-reader-login]');
  const loginPassword = root.querySelector<HTMLInputElement>('input[data-reader-login-password]');
  const loginSubmit = root.querySelector<HTMLButtonElement>('button[data-reader-login-submit]');
  const adminNode = root.querySelector<HTMLElement>('[data-reader-admin]');
  if (
    !statusNode ||
    !unconfiguredNode ||
    !loginForm ||
    !loginPassword ||
    !loginSubmit ||
    !adminNode
  )
    return;
  const addForm = root.querySelector<HTMLFormElement>('form[data-reader-add]');
  const addUrl = root.querySelector<HTMLInputElement>('input[data-reader-add-url]');
  const addTitle = root.querySelector<HTMLInputElement>('input[data-reader-add-title]');
  const addSubmit = root.querySelector<HTMLButtonElement>('button[data-reader-add-submit]');
  const refreshState = root.querySelector<HTMLButtonElement>('button[data-reader-refresh-state]');
  const logoutButton = root.querySelector<HTMLButtonElement>('button[data-reader-logout]');
  const sourcesNode = root.querySelector<HTMLElement>('[data-reader-sources]');
  const passwordForm = root.querySelector<HTMLFormElement>('form[data-reader-password]');
  const currentPassword = root.querySelector<HTMLInputElement>(
    'input[data-reader-current-password]',
  );
  const newPassword = root.querySelector<HTMLInputElement>('input[data-reader-new-password]');
  const passwordSubmit = root.querySelector<HTMLButtonElement>(
    'button[data-reader-password-submit]',
  );
  if (
    !addForm ||
    !addUrl ||
    !addTitle ||
    !addSubmit ||
    !refreshState ||
    !logoutButton ||
    !sourcesNode ||
    !passwordForm ||
    !currentPassword ||
    !newPassword ||
    !passwordSubmit
  )
    return;

  /** The login receipt. In memory for this page only, and never rendered anywhere. */
  let csrf: string | null = null;
  /** Bumped whenever the authenticated session changes, so work from the old one cannot write. */
  let sessionEpoch = 0;
  /** Bumped per source-list request, so a slower older reply cannot replace a newer list. */
  let sourcesSequence = 0;

  // The view helpers below are hoisted, so they are analysed before the guard above narrows the
  // queries. Binding the nodes they reach for gives them the types the guard just proved.
  const unconfiguredNotice = unconfiguredNode;
  const loginPanel = loginForm;
  const panel = adminNode;
  const rows = sourcesNode;

  const setStatus = (message: string, tone: 'idle' | 'error' | 'busy' = 'idle') => {
    statusNode.textContent = message;
    statusNode.dataset.readerTone = tone;
  };

  function show(view: 'unconfigured' | 'login' | 'admin'): void {
    unconfiguredNotice.hidden = view !== 'unconfigured';
    loginPanel.hidden = view !== 'login';
    panel.hidden = view !== 'admin';
  }

  /** True while the session an action started in is still the live one. */
  const sessionCurrent = (epoch: number) => !signal.aborted && epoch === sessionEpoch;

  function enterSession(csrfToken: string): void {
    // A fresh login is a new session: everything in flight from the previous one is now stale.
    sessionEpoch += 1;
    csrf = csrfToken;
    rows.replaceChildren();
    show('admin');
    setStatus('');
  }

  /**
   * Ends the panel's session: the epoch moves so work already in flight can no longer write, the
   * receipt and the rows are dropped, and the requested view is shown.
   */
  function endSession(
    view: 'unconfigured' | 'login',
    message: string,
    tone: 'idle' | 'error' = 'idle',
  ): void {
    sessionEpoch += 1;
    csrf = null;
    rows.replaceChildren();
    show(view);
    setStatus(message, tone);
  }

  /** Returns to the login view with the session already forgotten and stale rows dropped. */
  function requireLogin(message: string, tone: 'idle' | 'error' = 'idle'): void {
    endSession('login', message, tone);
  }

  function applySession(session: ReaderSession): void {
    if (!session.configured) {
      endSession('unconfigured', '');
      return;
    }
    if (!session.authenticated) {
      requireLogin('');
      return;
    }
    if (typeof session.csrfToken !== 'string' || session.csrfToken === '') {
      // Authenticated without a usable receipt: writes cannot be authorized, so ask again.
      requireLogin(EXPIRED_NOTICE, 'error');
      return;
    }
    enterSession(session.csrfToken);
  }

  /** Runs one panel action, surfacing a lost session rather than leaving a dead form behind. */
  async function guarded(action: () => Promise<void>): Promise<void> {
    const epoch = sessionEpoch;
    try {
      await action();
    } catch (error) {
      if (!sessionCurrent(epoch)) return;
      if (isAuthLoss(error)) requireLogin(EXPIRED_NOTICE, 'error');
      else setStatus(messageFor(error), 'error');
    }
  }

  /** Disables one control for the duration of its own action, and never after the page is gone. */
  async function withControl(control: HTMLButtonElement, action: () => Promise<void>) {
    control.disabled = true;
    try {
      await action();
    } finally {
      if (!signal.aborted) control.disabled = false;
    }
  }

  function renderSource(source: ReaderAdminSource): HTMLLIElement {
    const row = document.createElement('li');
    row.className = 'reader-source';
    row.dataset.sourceId = source.id;

    const head = document.createElement('p');
    head.className = 'reader-source-head';
    const title = document.createElement('span');
    title.className = 'reader-source-title';
    title.textContent = source.title === '' ? '未命名订阅源' : source.title;
    const state = document.createElement('span');
    state.className = 'reader-source-state';
    state.textContent = `${source.enabled ? '已启用' : '已停用'} · ${SOURCE_STATE[source.status]}`;
    head.append(title, state);

    const feed = document.createElement('p');
    feed.className = 'reader-source-url';
    feed.textContent = source.feedUrl;

    const stats = document.createElement('p');
    stats.className = 'reader-source-stats';
    const details = [
      `文章 ${source.entryCount} 篇`,
      `连续失败 ${source.failureCount} 次`,
      `最近成功 ${formatDate(source.lastSuccessAt)}`,
      `下次抓取 ${formatDate(source.nextFetchAt)}`,
    ];
    if (source.errorCode !== null) {
      details.push(ADMIN_MESSAGES[source.errorCode] ?? '抓取失败');
    }
    stats.textContent = details.join(' · ');

    const actions = document.createElement('div');
    actions.className = 'reader-source-actions';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.dataset.sourceToggle = '';
    toggle.textContent = source.enabled ? '停用' : '启用';
    toggle.addEventListener(
      'click',
      () => {
        const epoch = sessionEpoch;
        void withControl(toggle, () =>
          guarded(async () => {
            const payload = await adminRequest<{ source: ReaderAdminSource }>(
              `/api/reader/admin/sources/${encodeURIComponent(source.id)}`,
              { method: 'PATCH', csrf, body: { enabled: !source.enabled } },
              signal,
            );
            if (!sessionCurrent(epoch)) return;
            row.replaceWith(renderSource(payload.source));
            setStatus(payload.source.enabled ? '订阅源已启用。' : '订阅源已停用。');
          }),
        );
      },
      { signal },
    );

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.dataset.sourceRefresh = '';
    refresh.textContent = '刷新';
    refresh.addEventListener(
      'click',
      () => {
        const epoch = sessionEpoch;
        void withControl(refresh, () =>
          guarded(async () => {
            await adminRequest(
              `/api/reader/admin/sources/${encodeURIComponent(source.id)}/refresh`,
              { method: 'POST', csrf, body: {} },
              signal,
            );
            if (!sessionCurrent(epoch)) return;
            // The fetch happens on the server, so the panel reports a queue, never a result.
            setStatus('刷新已排入后台执行，稍后可用「更新状态」查看进度。');
          }),
        );
      },
      { signal },
    );

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.dataset.sourceClear = '';
    clear.textContent = '清缓存';
    clear.addEventListener(
      'click',
      () => {
        const agreed = confirm(
          '清缓存会重新抓取这个订阅源当前的 feed 窗口，不会恢复旧历史。确定继续吗？',
        );
        if (!agreed) return;
        const epoch = sessionEpoch;
        void withControl(clear, () =>
          guarded(async () => {
            await adminRequest(
              `/api/reader/admin/sources/${encodeURIComponent(source.id)}/entries`,
              { method: 'DELETE', csrf, body: { confirm: true } },
              signal,
            );
            if (!sessionCurrent(epoch)) return;
            await reloadSources();
            if (!sessionCurrent(epoch)) return;
            setStatus('缓存已清除，接下来会重新抓取当前的 feed 窗口。');
          }),
        );
      },
      { signal },
    );

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.sourceDelete = '';
    remove.textContent = '删除';
    remove.addEventListener(
      'click',
      () => {
        const agreed = confirm(
          '删除后这个订阅源及其已收录文章都会被移除，且无法恢复。确定删除吗？',
        );
        if (!agreed) return;
        const epoch = sessionEpoch;
        void withControl(remove, () =>
          guarded(async () => {
            await adminRequest(
              `/api/reader/admin/sources/${encodeURIComponent(source.id)}`,
              { method: 'DELETE', csrf, body: { confirm: true } },
              signal,
            );
            if (!sessionCurrent(epoch)) return;
            await reloadSources();
            if (!sessionCurrent(epoch)) return;
            setStatus('订阅源已删除。');
          }),
        );
      },
      { signal },
    );

    actions.append(toggle, refresh, clear, remove);
    row.append(head, feed, stats, actions);
    return row;
  }

  /**
   * Loads the source list for the session that asked for it. Two numbers guard the reply: the
   * request sequence drops an older reply in favour of a newer one, and the session epoch drops any
   * reply that began before the current login. A delayed response from a previous session must never
   * replace the list the panel is showing now.
   */
  async function reloadSources(): Promise<void> {
    const epoch = sessionEpoch;
    const sequence = ++sourcesSequence;
    const payload = await adminRequest<{ sources: ReaderAdminSource[] }>(
      '/api/reader/admin/sources',
      { method: 'GET', csrf },
      signal,
    );
    if (sequence !== sourcesSequence || !sessionCurrent(epoch)) return;
    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    rows.replaceChildren();
    if (sources.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'reader-empty';
      empty.textContent = '还没有订阅源。添加一个公开的 feed 地址开始。';
      rows.append(empty);
      return;
    }
    for (const source of sources) rows.append(renderSource(source));
  }

  loginForm.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      let epoch = sessionEpoch;
      const password = loginPassword.value;
      // The password exists only for the request that just started.
      loginPassword.value = '';
      void withControl(loginSubmit, async () => {
        setStatus('正在登录…', 'busy');
        try {
          const session = await adminRequest<ReaderSession>(
            '/api/reader/admin/login',
            { method: 'POST', body: { password } },
            signal,
          );
          if (!sessionCurrent(epoch)) return;
          applySession(session);
          epoch = sessionEpoch;
          if (session.authenticated) await reloadSources();
        } catch (error) {
          if (!sessionCurrent(epoch)) return;
          if (
            isAuthLoss(error) &&
            !(error instanceof AdminRequestError && error.code === 'INVALID_CREDENTIALS')
          ) {
            requireLogin(EXPIRED_NOTICE, 'error');
            return;
          }
          // A server with no password yet is the same state as an unconfigured session, and the
          // panel must never offer to set that first password remotely.
          if (error instanceof AdminRequestError && error.code === 'ADMIN_UNCONFIGURED') {
            endSession('unconfigured', '');
            return;
          }
          setStatus(messageFor(error), 'error');
        }
      });
    },
    { signal },
  );

  passwordForm.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      const epoch = sessionEpoch;
      const current = currentPassword.value;
      const next = newPassword.value;
      // Cleared at the instant of submission; the request carries its own copies from here on.
      currentPassword.value = '';
      newPassword.value = '';
      void withControl(passwordSubmit, () =>
        guarded(async () => {
          await adminRequest(
            '/api/reader/admin/password',
            { method: 'POST', csrf, body: { currentPassword: current, newPassword: next } },
            signal,
          );
          if (!sessionCurrent(epoch)) return;
          // Changing the password revokes this login, so the panel asks for it again.
          requireLogin('密码已修改，请用新密码重新登录。');
        }),
      );
    },
    { signal },
  );

  addForm.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      const epoch = sessionEpoch;
      const feedUrl = addUrl.value.trim();
      const title = addTitle.value.trim();
      void withControl(addSubmit, () =>
        guarded(async () => {
          const payload = await adminRequest<{ source: ReaderAdminSource }>(
            '/api/reader/admin/sources',
            { method: 'POST', csrf, body: title === '' ? { feedUrl } : { feedUrl, title } },
            signal,
          );
          if (!sessionCurrent(epoch)) return;
          addUrl.value = '';
          addTitle.value = '';
          await reloadSources();
          if (!sessionCurrent(epoch)) return;
          setStatus(`已添加订阅源「${payload.source.title}」。`);
        }),
      );
    },
    { signal },
  );

  refreshState.addEventListener(
    'click',
    () => {
      const epoch = sessionEpoch;
      void withControl(refreshState, () =>
        guarded(async () => {
          await reloadSources();
          if (!sessionCurrent(epoch)) return;
          setStatus('状态已更新。');
        }),
      );
    },
    { signal },
  );

  logoutButton.addEventListener(
    'click',
    () => {
      const epoch = sessionEpoch;
      void withControl(logoutButton, () =>
        guarded(async () => {
          await adminRequest(
            '/api/reader/admin/logout',
            { method: 'POST', csrf, body: {} },
            signal,
          );
          if (!sessionCurrent(epoch)) return;
          // Dropping the session clears the rows and the receipt; the panel shows the login form.
          requireLogin('已退出登录。');
        }),
      );
    },
    { signal },
  );

  setStatus('正在读取管理状态…', 'busy');
  const initialEpoch = sessionEpoch;
  await guarded(async () => {
    const session = await adminRequest<ReaderSession>(
      '/api/reader/admin/session',
      { method: 'GET' },
      signal,
    );
    if (!sessionCurrent(initialEpoch)) return;
    applySession(session);
    if (session.configured && session.authenticated && csrf !== null) await guarded(reloadSources);
  });
}
