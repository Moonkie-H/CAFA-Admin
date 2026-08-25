/**
 * Publishing, and the history it appends to.
 *
 * Restoring is a publish, not an edit: it appends a new revision holding an old
 * one's content, so nothing that was ever live becomes unreachable.
 */
import { request } from './http';
import type { PublishResult, RevisionSummary, SiteStatus } from './types';

export const publishService = {
  status: (signal?: AbortSignal) => request<SiteStatus>('/api/status', { signal }),

  publish: () =>
    request<PublishResult>('/api/publish', {
      method: 'POST',
      body: { message: 'Publish from the studio admin' },
    }),

  revisions: (signal?: AbortSignal) => request<RevisionSummary[]>('/api/revisions', { signal }),

  restore: (id: number) =>
    request<PublishResult>(`/api/revisions/${id}/restore`, { method: 'POST' }),
};
