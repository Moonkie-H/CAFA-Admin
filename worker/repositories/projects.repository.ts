/**
 * Projects. One table with a picture in it, so it reads like the mentors'
 * repository rather than the works' — no children, one image, and the foreign
 * key on `image_key` is what makes uploading before saving the required order.
 */
import type { Project } from '../../shared/content/types';
import type { ProjectRow } from '../models/rows';
import { imageBindings, imageRef, pair } from './mapping';

export async function readProjects(db: D1Database): Promise<Project[]> {
  const rows = await db.prepare('SELECT * FROM projects ORDER BY position').all<ProjectRow>();

  return rows.results.map((row) => ({
    slug: row.slug,
    title: pair(row.title_zh, row.title_en),
    summary: pair(row.summary_zh, row.summary_en),
    image: imageRef(
      row.image_key,
      row.image_alt_zh,
      row.image_alt_en,
      row.image_decorative,
      row.image_frame,
    ),
  }));
}

export function deleteProjects(db: D1Database): D1PreparedStatement[] {
  return [db.prepare('DELETE FROM projects')];
}

export function insertProjects(
  db: D1Database,
  projects: readonly Project[],
): D1PreparedStatement[] {
  return projects.map((project, at) =>
    db
      .prepare(
        `INSERT INTO projects (slug, position, title_zh, title_en, summary_zh, summary_en,
                               image_key, image_alt_zh, image_alt_en, image_decorative,
                               image_frame)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        project.slug,
        at,
        project.title.zh,
        project.title.en,
        project.summary.zh,
        project.summary.en,
        ...imageBindings(project.image),
      ),
  );
}
