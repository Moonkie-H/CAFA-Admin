/**
 * Every photograph the content cites, walked once.
 *
 * Four places needed this and each had grown its own copy: the publish
 * projection collecting what a revision may name, the read API listing the
 * photographs, the validator checking each one is in the bucket, and the
 * control panel counting them. Four walks of the same graph, and the failure
 * mode was never a wrong answer today — it was the next image-bearing section
 * kind, which three of the four would silently stop seeing. The projection
 * would keep publishing a photograph the validator no longer checked.
 *
 * So the traversal is stated once and the differences stay at the call sites,
 * where they belong: each caller reads the citation and decides what it means.
 * A citation carries the whole record rather than a formatted string, because
 * the four want four different things from it — a slug, a phrase, a `usedBy`
 * label, a status — and a walker that guessed which would be wrong for three.
 *
 * The order is works, then mentors, then pages. It is the order
 * `/api/v1/photographs` answers in, so it is fixed here rather than incidental.
 */
import type { ImageRef, Mentor, Page, Work } from './types';

/**
 * The records a photograph hangs off, and where on one it sits.
 *
 * A discriminated union rather than a `kind: string` and optional fields: a
 * caller that switches on it gets the record already narrowed, and a new kind
 * of citation is a compile error at every call site rather than a branch that
 * quietly falls through.
 */
export type ImageCitation =
  | { kind: 'work-cover'; work: Work }
  | { kind: 'work-photo'; work: Work; position: number }
  | { kind: 'mentor-portrait'; mentor: Mentor }
  | { kind: 'page-photo'; page: Page; section: number; position: number };

export interface CitedImage {
  image: ImageRef;
  cite: ImageCitation;
}

/**
 * The parts of the content a photograph can be reached through.
 *
 * Structural rather than `ContentSet`, so the published bundle fits it too —
 * the read API walks a revision, and a revision is not a content set. Both have
 * these three collections in these three shapes, which is all the walk needs.
 */
export interface ImageBearingContent {
  works: readonly Work[];
  mentors: readonly Mentor[];
  pages: readonly Page[];
}

export function* citedImages(content: ImageBearingContent): Generator<CitedImage> {
  for (const work of content.works) {
    yield { image: work.cover, cite: { kind: 'work-cover', work } };
    for (const [position, image] of work.media.entries()) {
      yield { image, cite: { kind: 'work-photo', work, position } };
    }
  }

  for (const mentor of content.mentors) {
    yield { image: mentor.portrait, cite: { kind: 'mentor-portrait', mentor } };
  }

  for (const page of content.pages) {
    for (const [section, block] of page.sections.entries()) {
      if (block.kind !== 'gallery') continue;
      for (const [position, image] of block.images.entries()) {
        yield { image, cite: { kind: 'page-photo', page, section, position } };
      }
    }
  }
}

/**
 * Whether a citation is one the public site may name.
 *
 * A private work is listed and has no page, so its photographs are dropped when
 * a revision is built and no URL for them ever reaches a browser. That rule is
 * about the *citation* rather than the file — the same photograph cited from a
 * page would publish — so it is answered here, beside the walk, rather than
 * re-derived by each caller that has to honour it.
 */
export function citationIsPublic(cite: ImageCitation): boolean {
  switch (cite.kind) {
    case 'work-cover':
    case 'work-photo':
      return cite.work.status !== 'private';
    case 'mentor-portrait':
    case 'page-photo':
      return true;
  }
}

/** The distinct object keys cited, ignoring the records that cite them. */
export function citedKeys(content: ImageBearingContent, publicOnly = false): Set<string> {
  const keys = new Set<string>();
  for (const { image, cite } of citedImages(content)) {
    if (image.src === '') continue;
    if (publicOnly && !citationIsPublic(cite)) continue;
    keys.add(image.src);
  }
  return keys;
}
