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
