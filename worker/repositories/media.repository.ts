/**
 * The file registry: one row per original in the bucket.
 *
 * Deliberately outside the content unit of work. A photograph arrives before
 * the save that references it — that ordering is what lets the foreign keys
 * from `works`, `mentors` and `site_studio` into `media` stay on — so this is
 * never part of the batch that replaces the content.
 *
 * `width` and `height` are what the template turns into the aspect box that
 * holds a slot open before an image loads, so they are the numbers the site's
 * CLS budget rests on. `tint` is the softer one beside them: the dominant hue
 * the works index draws its band from, null where a photograph has none and
 * where one predates the column. `version` is the newest of the four and the
 * only one that is about identity rather than appearance: a key is stable
 * across a replacement, so this is what says the bytes under it are not the
 * ones the last published revision described.
 */
import type { MediaInfo } from '../../shared/content/types';
import type { MediaRow } from '../models/rows';

/**
 * The registry, as the rest of the system talks about it.
 *
 * `MediaRow` is the shape of the columns and `MediaInfo` is the shape of the
 * answer, and they differ in exactly one place: the ladder is a list in the
 * domain and a comma-separated string in SQLite. Reading and writing it is this
 * file's business and nobody else's, so the conversion happens here — the
 * bundle, the services and the editor all see numbers.
 */
export async function readMedia(db: D1Database): Promise<MediaInfo[]> {
  const rows = await db
    .prepare('SELECT key, width, height, bytes, tint, version, widths FROM media ORDER BY key')
    .all<MediaRow>();
  return rows.results.map(infoOf);
}

function infoOf(row: MediaRow): MediaInfo {
  return {
    key: row.key,
    width: row.width,
    height: row.height,
    bytes: row.bytes,
    tint: row.tint,
    version: row.version,
    widths: widthsOf(row.widths),
  };
}

/**
 * The stored width list, as numbers.
 *
 * Anything that is not a positive whole number is dropped rather than failing:
 * this is a hint about which objects are in the bucket, and a malformed entry
 * should cost that one candidate rather than the photograph.
 */
function widthsOf(widths: string | null): number[] {
  if (widths === null || widths.trim() === '') return [];
  return widths
    .split(',')
    .map((width) => Number(width.trim()))
    .filter((width) => Number.isInteger(width) && width > 0)
    .sort((first, second) => first - second);
}

/** And back: empty is null, because null is how the column spells "no ladder". */
function column(widths: number[]): string | null {
  const sorted = [...new Set(widths)].sort((first, second) => first - second);
  return sorted.length === 0 ? null : sorted.join(',');
}

/**
 * Upsert rather than insert: replacing a photograph under the same key is a
 * normal thing for the studio to do, and it changes the dimensions.
 *
 * Every column is overwritten, `version` included — which is the point of it.
 * A replacement that happens to be the same size as what it replaces changes
 * nothing else here, and used to leave the published bundle byte-identical.
 */
export async function recordMedia(db: D1Database, info: MediaInfo): Promise<void> {
  await db
    .prepare(
      `INSERT INTO media (key, width, height, bytes, tint, version, widths)
            VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET width   = excluded.width,
                                       height  = excluded.height,
                                       bytes   = excluded.bytes,
                                       tint    = excluded.tint,
                                       version = excluded.version,
                                       widths  = excluded.widths`,
    )
    .bind(
      info.key,
      info.width,
      info.height,
      info.bytes,
      info.tint,
      info.version,
      column(info.widths),
    )
    .run();
}
