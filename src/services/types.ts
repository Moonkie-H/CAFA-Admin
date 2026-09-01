/**
 * The wire contracts, as the browser sees them.
 *
 * These mirror worker/models/dtos/ deliberately and are written out again
 * rather than imported from it. The Worker's DTOs are free to change shape for
 * server reasons; the day one does, this file is where the compiler says so,
 * which is the point of having a boundary at all. The content types themselves
 * (`ContentSet`, `Work`, `MediaInfo`) *are* shared — they are the domain, not
 * the transport.
 */
import type { ContentSet, MediaInfo } from '../../shared/content/types';
import type { Problem } from '../../shared/content/validate';

/** The envelope every authenticated endpoint answers in. */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  code: number;
  msg: string;
  /** Field-level detail on a rejected save. Absent on success. */
  problems?: Problem[];
}

/**
 * Who is signed in, and what they are signed in to edit. One answer, because
 * the editor has no use for either half without the other and asking twice cost
 * a round trip the second request could not start until the first had finished.
 */
export interface SessionResponse {
  login: string;
  content: ContentSet;
  media: MediaInfo[];
}

export interface SignedOutResponse {
  signedOut: true;
}

export interface SavedResponse {
  saved: true;
}

export interface DeployedOrigin {
  url: string | null;
  revision: number | null;
  /** Whether anything rebuilds it, i.e. whether its deploy hook is configured. */
  rebuilds: boolean;
}

export interface SiteStatus {
  /** The newest published revision, or null before anything is published. */
  latestRevision: number | null;
  publishedAt: string | null;
  /** Whether the draft differs from that revision. */
  unpublished: boolean;
  /** A fingerprint of the draft, which the preview build reports back. */
  draftRevision: number;
  production: DeployedOrigin;
  preview: DeployedOrigin;
}

export interface PublishResult {
  published: boolean;
  /** Present when nothing was published, and says why. */
  reason?: string;
  revision?: number;
  restoredFrom?: number;
}

export interface RevisionSummary {
  id: number;
  message: string;
  publishedAt: string;
  publishedBy: string;
}
