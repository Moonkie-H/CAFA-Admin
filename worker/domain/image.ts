/**
 * What is true about a photograph before anything stores it.
 *
 * Pure functions over bytes and keys: no bucket, no database, nothing async.
 * The bucket is worker/storage/media-storage.ts and the registry row is
 * worker/repositories/media.repository.ts; this is the part both of them agree
 * about, which is why it is the only one of the three that can be reasoned
 * about — or tested — without a binding.
 *
 * Dimensions are read out of the uploaded bytes rather than taken from the
 * browser that sent them. They are not decoration: the template turns them into
 * the aspect box that holds a slot open before an image arrives, and a wrong
 * number there is layout shift on the live site. A value the site's CLS budget
 * depends on should be derived from the file, not from a form field.
 *
 * Reading a JPEG or PNG header is forty lines. Decoding the image is not
 * possible in a Worker anyway — there is no sharp here — so this is not a
 * shortcut around a better option, it is the only correct one.
 */

import { MAX_IMAGE_EDGE } from '../../shared/content/types';

export interface Measured {
  width: number;
  height: number;
  bytes: number;
  contentType: 'image/jpeg' | 'image/png';
}

/** IHDR is always the first chunk, at a fixed offset past the signature. */
function pngSize(view: DataView): { width: number; height: number } | null {
  if (view.byteLength < 24 || view.getUint32(0) !== 0x89504e47) return null;
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * The frame header carries the dimensions. SOF0–SOF15 is the marker range, less
 * C4, C8 and CC — Huffman tables, JPEG extensions and arithmetic coding share
 * the range and carry no frame.
 */
function jpegSize(view: DataView): { width: number; height: number } | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

  let at = 2;
  while (at < view.byteLength - 9) {
    if (view.getUint8(at) !== 0xff) {
      at += 1;
      continue;
    }
    const marker = view.getUint8(at + 1);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
    }
    const length = view.getUint16(at + 2);
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

export function measure(buffer: ArrayBuffer): Measured {
  const view = new DataView(buffer);
  const png = pngSize(view);
  const size = png ?? jpegSize(view);
  if (size === null || size.width === 0 || size.height === 0) {
    throw new Error('That file is not a JPEG or PNG the site can read.');
  }
  if (size.width > MAX_IMAGE_EDGE || size.height > MAX_IMAGE_EDGE) {
    throw new Error(`Photographs must be at most ${MAX_IMAGE_EDGE}px on their longest edge.`);
  }
  return {
    ...size,
    bytes: buffer.byteLength,
    contentType: png === null ? 'image/jpeg' : 'image/png',
  };
}

/**
 * Which keys the admin may write, and which it may read.
 *
 * Two predicates rather than one, because the answers genuinely differ and
 * collapsing them costs something either way. Three folders carry a photograph
 * today: a work, a page's gallery, and a mentor. `pages/` is the one that has
 * to be here — a page is content now, so its slug is part of the key, and the
 * front page (whose slug is the empty string) files under `pages/home`. See
 * `pageFolder` in src/features/pages/PageForm.tsx, which is what builds these.
 *
 * `studio/` is the fourth and is read-only. Migration 0005 folded the studio
 * photographs into a gallery section on the front page and dropped the table
 * they hung off, but the objects kept their keys — `studio/01.jpg` and its four
 * siblings are still cited by live content, so the editor has to be able to
 * preview them. Nothing files a new one there, so nothing may write one.
 *
 * Neither may climb out of the bucket with "..".
 */
const WRITABLE = /^(?:(?:works|pages)\/[a-z0-9-]+|mentors)\/[a-z0-9-]+\.(?:jpg|png)$/;
const READABLE = /^(?:(?:works|pages)\/[a-z0-9-]+|mentors|studio)\/[a-z0-9-]+\.(?:jpg|png)$/;

/** A key a photograph may be uploaded under. */
export function isWritableMediaKey(key: string): boolean {
  return WRITABLE.test(key) && !key.includes('..');
}

/** A key the editor may fetch bytes for. Everything writable, plus the legacy folder. */
export function isReadableMediaKey(key: string): boolean {
  return READABLE.test(key) && !key.includes('..');
}

export function contentTypeOf(key: string): string {
  return key.endsWith('.png') ? 'image/png' : 'image/jpeg';
}
