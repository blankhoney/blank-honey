/** Budgets belong to this reader, not to the unrelated probe or frontend error endpoint. */
export const LIMITS = Object.freeze({
  sources: 50,
  entries: 10_000,
  feedEntries: 200,
  responseBytes: 2 * 1024 * 1024,
  contentBytes: 64 * 1024,
  summaryBytes: 2048,
  timeoutMs: 12_000,
  leaseMs: 60_000,
  intervalMs: 24 * 60 * 60 * 1000,
  pageSize: 40,
  sessionMs: 12 * 60 * 60 * 1000,
  sessions: 5,
});

export const RETRY_MS = [15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, LIMITS.intervalMs];

/** Only these bounded codes, never upstream URLs, headers or response bodies, reach API errors. */
export class ReaderError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'ReaderError';
    this.code = code;
    this.status = status;
  }
}
