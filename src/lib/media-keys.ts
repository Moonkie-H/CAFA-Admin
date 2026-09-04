/**
 * Where a photograph is filed, as a key rather than as a path.
 *
 * A photograph is filed under a work, a mentor or a page, and the content
 * record stores exactly the key the bucket uses — so both are derived here and
 * there is no prefix to get wrong. `worker/domain/image.ts` holds the allowlist
 * that refuses anything these would not have produced.
 *
 * Pure string work, deliberately kept apart from `image-prepare.ts` next door:
 * that half needs a canvas and a decoder and only runs in a browser, this half
 * is three functions over text.
 */

/** The key a newly chosen photograph is filed under. */
export function mediaKey(folder: string, name: string): string {
  return `${folder}/${name}.jpg`;
}

/**
 * The widths a photograph is filed at, besides its own.
 *
 * The same ladder `lib/media.ts` asks Cloudflare for on a zone that can
 * transform, because the point is that the site's `srcset` looks the same
 * either way — the rungs are written at upload instead of derived on delivery,
 * and nothing above the URL has to know which of the two happened.
 */
export const MEDIA_WIDTHS = [480, 768, 1200, 1800] as const;

/**
 * Where one rung of the ladder is filed.
 *
 * Under `derived/` rather than beside the original as `01-768.jpg`, and the
 * prefix is doing real work: content only ever names a photograph by the key it
 * was uploaded under, so a namespace nothing cites is a namespace a rung can
 * never collide with. `nextMediaName` cannot hand out a name that reads as a
 * rung, a mentor slug cannot shadow one, and the whole ladder for a photograph
 * — or for a width the site stops asking for — can be found by prefix.
 */
export function derivedKey(width: number, key: string): string {
  return `derived/${width}/${key}`;
}

/**
 * The rungs worth writing for a photograph this wide.
 *
 * Never upscale: a rung wider than the original is the same pixels in a bigger
 * file, and a `srcset` that offers 1800w and hands over 1200 pixels is a lie
 * the browser plans its `sizes` around. Equal is excluded too — that rung is
 * the original, which is always the top of the ladder.
 */
export function ladderFor(width: number): number[] {
  return MEDIA_WIDTHS.filter((rung) => rung < width);
}

/**
 * The stem `mediaKey` was given, read back off a key.
 *
 * A photograph keeps the name it was filed under, so re-uploading over one has
 * to reconstruct that name rather than take the next free number — which would
 * leave the old object orphaned in the bucket under the name the record no
 * longer points at.
 */
export function mediaStem(key: string): string {
  return (key.split('/').pop() ?? '').replace(/\.[^.]+$/, '');
}

/**
 * A file name that will not collide with what is already in the folder.
 *
 * Two-digit numbers from 01, which is what makes a bucket listing sort the way
 * the gallery does. The keys to compare against are the caller's, because what
 * counts as "the folder" differs: a work's photographs are the work's, and a
 * page's are every gallery on that page, so two of them cannot collide.
 */
export function nextMediaName(existing: readonly string[]): string {
  for (let n = 1; n < 1000; n += 1) {
    const candidate = String(n).padStart(2, '0');
    if (!existing.some((key) => key.endsWith(`/${candidate}.jpg`))) return candidate;
  }
  throw new Error('Too many images in one folder.');
}
