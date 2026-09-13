let sent = 0;
export function report(kind: string, error: unknown) {
  if (sent++ >= 12) return;
  // Send controlled summaries, never stack traces, query strings or media URLs.
  const code = error instanceof Error ? error.name : 'Error';
  void fetch('/api/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, code, path: location.pathname.slice(0, 180) }),
    keepalive: true,
  }).catch(() => {});
}
