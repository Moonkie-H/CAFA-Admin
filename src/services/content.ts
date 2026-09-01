/**
 * Saving the draft.
 *
 * The content set goes over whole — 39 KB, which is cheaper to send than a
 * description of which parts of it moved.
 *
 * Only the write is here. The read arrives with the session, from
 * `/api/session` or from the sign-in that set the cookie, so that opening the
 * admin is one request rather than a session check and then a content read that
 * could not have started any sooner.
 */
import { request } from './http';
import type { SavedResponse } from './types';
import type { ContentSet } from '../../shared/content/types';

export const contentService = {
  save: (content: ContentSet) =>
    request<SavedResponse>('/api/save', { method: 'POST', body: { content } }),
};
