/**
 * The four conversions every repository in here needs.
 *
 * Localised text is two columns and an object; an image is five columns and an
 * `ImageRef`. Both appear in five tables, so they are written once rather than
 * five times — which is also the only place the `decorative` convention and the
 * framing column's encoding are explained.
 */
import { framingAt } from '../../shared/content/parse';
import {
  isNaturalFraming,
  naturalFraming,
  type ImageFraming,
  type ImageRef,
  type LocalisedText,
} from '../../shared/content/types';

export function pair(zh: string, en: string): LocalisedText {
  return { zh, en };
}

/**
 * The framing column, read.
 *
 * Empty is the default and is what every row written before migration 0012
 * holds: the photograph's own shape, whole, centred. So a site that has never
 * framed anything stores nothing anywhere, and nothing had to be backfilled.
 *
 * Anything else is the JSON `frameColumn` wrote, checked through the same gate
 * the HTTP boundary uses rather than trusted because it came out of the
 * database. A column that fails it means the schema and this file have drifted,
 * which is worth the throw — the same judgement `workStatus` makes about a
 * status the CHECK should have refused.
 */
function framing(column: string): ImageFraming {
  if (column === '') return naturalFraming();
  return framingAt(JSON.parse(column), 'frame');
}

/**
 * And written. The default is stored as the empty string rather than as its own
 * fields spelled out, so resetting a photograph puts the row back exactly as it
 * was before anybody touched it — and so `insertRevisionIfChanged` cannot see a
 * change where the studio made none.
 */
function frameColumn(frame: ImageFraming): string {
  return isNaturalFraming(frame) ? '' : JSON.stringify(frame);
}

/**
 * Five columns back into an ImageRef. `decorative` is what distinguishes a
 * deliberate empty alt from a forgotten one — the schema refuses the second,
 * so by the time a row is read only the first is possible.
 */
export function imageRef(
  key: string,
  altZh: string,
  altEn: string,
  decorative: number,
  frame: string,
): ImageRef {
  return {
    src: key,
    alt: decorative === 1 ? '' : pair(altZh, altEn),
    frame: framing(frame),
  };
}

/** The five columns an ImageRef occupies, ready to bind. */
export function imageBindings(image: ImageRef): [string, string, string, number, string] {
  const frame = frameColumn(image.frame);
  if (image.alt === '') return [image.src, '', '', 1, frame];
  return [image.src, image.alt.zh, image.alt.en, 0, frame];
}

/** Rows grouped by the column that owns them, preserving the query's order. */
export function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const owner = key(row);
    const existing = grouped.get(owner);
    if (existing === undefined) grouped.set(owner, [row]);
    else existing.push(row);
  }
  return grouped;
}
