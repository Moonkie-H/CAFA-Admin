/**
 * The published photographs, gathered from the two halves that each know part
 * of the answer.
 *
 * The content knows what a photograph is *of* and what draws it; the media map
 * knows how big it is and what colour it is. Only keys in that map are
 * returned, and that is the privacy guarantee doing its work rather than a
 * filter of our own — `buildBundle` measures a photograph into it only when
 * public content cites it, so a private work's pictures cannot appear here even
 * by accident.
 *
 * A projection rather than a connector, and in its own file for that reason:
 * `registry.ts` beside it is a table of declarations, and the one entry that
 * needed forty lines of gathering was the only thing in it that was code.
 */
import { citedImages, type ImageCitation } from '../../shared/content/images';
import type { ImageRef } from '../../shared/content/types';
import type { ReadableBundle } from './connector';

export interface Photograph {
  key: string;
  url: string;
  width: number;
  height: number;
  tint: number | null;
  alt: ImageRef['alt'];
  decorative: boolean;
  usedBy: string;
}

export function photographsOf(bundle: ReadableBundle): Photograph[] {
  const base = bundle.mediaBase.replace(/\/$/, '');
  const photographs: Photograph[] = [];
  const seen = new Set<string>();

  for (const { image, cite } of citedImages(bundle)) {
    const measured = bundle.media[image.src];
    // A private work reaches here with an empty cover and no media, because the
    // projection emptied them — so it is already absent rather than filtered.
    if (image.src === '' || measured === undefined || seen.has(image.src)) continue;
    seen.add(image.src);

    photographs.push({
      key: image.src,
      url: versioned(`${base}/${image.src}`, measured.version),
      width: measured.width,
      height: measured.height,
      tint: measured.tint,
      alt: image.alt,
      decorative: image.alt === '',
      usedBy: citedBy(cite),
    });
  }

  return photographs;
}

/**
 * The same URL, named for the bytes currently under the key.
 *
 * A key is stable across a replacement, so the bare URL is the one a caller
 * already has cached. The version rides in the query for the same reason the
 * site puts it there: R2 ignores an unknown parameter, and every cache in
 * between keys on the whole URL. Absent for a photograph uploaded before the
 * admin recorded one, which leaves that URL exactly as it was.
 */
function versioned(url: string, version: string | null): string {
  return version === null ? url : `${url}?v=${version}`;
}

/** Which record a photograph is drawn by, as the answer names it. */
function citedBy(cite: ImageCitation): string {
  switch (cite.kind) {
    case 'work-cover':
    case 'work-photo':
      return `work:${cite.work.slug}`;
    case 'mentor-portrait':
      return `mentor:${cite.mentor.slug}`;
    case 'project-image':
      return `project:${cite.project.slug}`;
    case 'home-photo':
      return 'page:home';
    case 'site-qr':
      return 'site:qr';
  }
}
