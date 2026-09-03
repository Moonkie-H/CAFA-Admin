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
import type { MediaRow } from '../models/rows';

export async function readMedia(db: D1Database): Promise<MediaRow[]> {
  const rows = await db
    .prepare('SELECT key, width, height, bytes, tint, version FROM media ORDER BY key')
    .all<MediaRow>();
  return rows.results;
}

/**
 * Upsert rather than insert: replacing a photograph under the same key is a
 * normal thing for the studio to do, and it changes the dimensions.
 *
 * Every column is overwritten, `version` included — which is the point of it.
 * A replacement that happens to be the same size as what it replaces changes
 * nothing else here, and used to leave the published bundle byte-identical.
 */
export async function recordMedia(db: D1Database, row: MediaRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO media (key, width, height, bytes, tint, version)
            VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET width   = excluded.width,
                                       height  = excluded.height,
                                       bytes   = excluded.bytes,
                                       tint    = excluded.tint,
                                       version = excluded.version`,
    )
    .bind(row.key, row.width, row.height, row.bytes, row.tint, row.version)
    .run();
}
