/** Public and administrator projections of the feed reader. Runtime data never enters the build. */
export type ReaderSource = {
  id: string;
  title: string;
  siteUrl: string | null;
  enabled: boolean;
  status: 'pending' | 'fetching' | 'ok' | 'error' | 'paused';
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  nextFetchAt: number;
  errorCode: string | null;
  entryCount: number;
};

export type ReaderAdminSource = ReaderSource & {
  feedUrl: string;
  failureCount: number;
};

export type ReaderEntry = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  title: string;
  url: string | null;
  author: string | null;
  publishedAt: number | null;
  collectedAt: number;
  updatedAt: number;
  contentKind: 'content' | 'summary';
  summaryHtml: string;
  truncated: boolean;
};

export type ReaderDetail = ReaderEntry & { contentHtml: string };
export type ReaderEntries = { entries: ReaderEntry[]; nextCursor: string | null };
export type ReaderSession = {
  configured: boolean;
  authenticated: boolean;
  csrfToken?: string;
};
