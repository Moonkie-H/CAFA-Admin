/**
 * The media endpoints' contracts.
 *
 * The response is exactly a `MediaInfo` — the key the studio chose, the three
 * numbers measured from the bytes, and the hue measured from the pixels. The
 * client writes it straight into the content set it is holding, so the upload
 * and the save that references it agree without a round trip.
 */
import type { MediaInfo } from '../../../shared/content/types';
import { isReadableMediaKey, isWritableMediaKey } from '../../domain/image';
import { ApiException } from '../../shared/api-exception';

export type UploadMediaResponse = MediaInfo;

/**
 * The `key` query parameter, checked against what the admin may do with it.
 *
 * Both media routes need it and neither may accept a key that climbs out of the
 * bucket, so the check lives here rather than twice in the controller. What
 * they differ on is the legacy `studio/` folder — readable, because live
 * content still cites it; not writable, because nothing files there any more.
 */
export function parseMediaKey(url: URL, intent: 'read' | 'write'): string {
  const key = url.searchParams.get('key');
  if (key === null || key === '') throw ApiException.badRequest('No media key given.');

  const allowed = intent === 'write' ? isWritableMediaKey(key) : isReadableMediaKey(key);
  if (!allowed) {
    throw ApiException.badRequest(
      intent === 'write'
        ? 'Not a media key the admin may write.'
        : 'Not a media key the admin may read.',
    );
  }
  return key;
}

/**
 * The `tint` query parameter: an angle on the OKLCH colour circle, or nothing.
 *
 * Absent is a real answer rather than a client that forgot — a monochrome
 * photograph has no hue to give, and neither has one a browser could not read a
 * hue out of — so it becomes null and the site draws its neutral band. A value
 * that is *present and not an angle* is a bug in the client and is refused,
 * because the site's build fails on a hue outside [0, 360) and it should fail
 * here, where the person who caused it is looking, rather than there.
 */
/**
 * The `widths` query parameter: which rungs of the ladder the client has just
 * finished writing, as "480,768,1200".
 *
 * Absent is an empty ladder, which is what a photograph too narrow to have one
 * genuinely has. Anything that is not a list of positive whole numbers is
 * refused rather than filtered: the site turns each of these into a URL it
 * expects to resolve, and a client sending nonsense here is a client that has
 * put nonsense in the bucket.
 */
export function parseWidths(url: URL): number[] {
  const given = url.searchParams.get('widths');
  if (given === null || given === '') return [];

  const widths = given.split(',').map((width) => Number(width.trim()));
  if (widths.some((width) => !Number.isInteger(width) || width <= 0)) {
    throw ApiException.badRequest('The widths must be a list of whole numbers.');
  }
  return [...new Set(widths)].sort((first, second) => first - second);
}

export function parseTint(url: URL): number | null {
  const given = url.searchParams.get('tint');
  if (given === null || given === '') return null;

  const hue = Number(given);
  if (!Number.isFinite(hue) || hue < 0 || hue >= 360) {
    throw ApiException.badRequest('The tint must be a hue in [0, 360).');
  }
  return hue;
}
