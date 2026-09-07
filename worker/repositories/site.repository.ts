/**
 * The site row.
 *
 * One row, by construction — `id INTEGER PRIMARY KEY CHECK (id = 1)`. That
 * constraint is the seam that makes multi-tenant a migration rather than a
 * rewrite, and it costs one table to leave open.
 *
 * `locales` and `url` are not here. They are wired to the template's
 * lib/routes.ts and to the deployment, and are added when a revision is built.
 * Nor are the studio photographs: they are a `gallery` section on the front
 * page now (migration 0005), which is the same photographs with one owner
 * instead of two.
 */
import { isTypeScale, type SiteContent } from '../../shared/content/types';
import type { SiteRow } from '../models/rows';
import { imageBindings, imageRef, pair } from './mapping';

export async function readSite(db: D1Database): Promise<SiteContent> {
  const site = await db.prepare('SELECT * FROM site WHERE id = 1').first<SiteRow>();

  if (site === null) throw new Error('The site row is missing. Has the seed been run?');

  return {
    name: pair(site.name_zh, site.name_en),
    contact: {
      email: site.contact_email,
      wechat: site.contact_wechat,
      address: pair(site.address_zh, site.address_en),
      hours: pair(site.hours_zh, site.hours_en),
      // An empty key is a studio that has not uploaded a code, which is a card
      // without one rather than an image element pointed at nothing.
      qr:
        site.qr_key === ''
          ? null
          : imageRef(
              site.qr_key,
              site.qr_alt_zh,
              site.qr_alt_en,
              site.qr_decorative,
              site.qr_frame,
            ),
    },
    // The column's CHECK already refuses anything else, so this narrows a string
    // the compiler cannot see that about rather than defending against the
    // database. A row from before migration 0011 defaults to 'normal' anyway.
    typeScale: isTypeScale(site.type_scale) ? site.type_scale : 'normal',
  };
}

export function deleteSite(db: D1Database): D1PreparedStatement[] {
  return [db.prepare('DELETE FROM site')];
}

export function insertSite(db: D1Database, site: SiteContent): D1PreparedStatement[] {
  return [
    db
      .prepare(
        `INSERT INTO site (id, name_zh, name_en, contact_email, contact_wechat,
                           address_zh, address_en, hours_zh, hours_en,
                           qr_key, qr_alt_zh, qr_alt_en, qr_decorative, qr_frame, type_scale)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        site.name.zh,
        site.name.en,
        site.contact.email,
        site.contact.wechat,
        site.contact.address.zh,
        site.contact.address.en,
        site.contact.hours.zh,
        site.contact.hours.en,
        // No code is four empty columns rather than a NULL key: the column is
        // NOT NULL, and '' is the value the read above turns back into null.
        ...(site.contact.qr === null
          ? (['', '', '', 0, ''] as const)
          : imageBindings(site.contact.qr)),
        site.typeScale,
      ),
  ];
}
