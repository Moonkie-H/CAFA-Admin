/**
 * The four pages, and the words on each.
 *
 * The set of pages is code — CAFA-Template draws each one with its own layout
 * and its own motion — so this repository never asks the database *which* pages
 * exist. It asks what is written on the four it knows about, and defaults a
 * missing row to blanks rather than to nothing: a database that has had the
 * migrations run and has never been seeded should open in the editor as four
 * empty pages, which the validator can then say are empty, rather than as a
 * shape with a hole in it that the editor cannot render at all.
 *
 * Four tables, read together and written together. `page_line` holds the single
 * lines a page carries beyond its title and description, `page_paragraph` holds
 * prose, and `home_gallery` holds the front page's photographs.
 *
 * Deletes and inserts are returned as statements rather than executed, because
 * the whole content set is replaced in a single D1 batch. See
 * worker/repositories/content.repository.ts for the ordering that makes that safe.
 */
import type {
  AboutPage,
  HomePage,
  LocalisedText,
  PageText,
  ProgramsPage,
  SitePages,
} from '../../shared/content/types';
import type {
  HomeGalleryRow,
  PageLineRow,
  PageParagraphRow,
  PageRow,
} from '../models/rows';
import { groupBy, imageBindings, imageRef, pair } from './mapping';

function blank(): LocalisedText {
  return { zh: '', en: '' };
}

export async function readPages(db: D1Database): Promise<SitePages> {
  const [pages, lines, paragraphs, gallery] = await Promise.all([
    db.prepare('SELECT * FROM pages').all<PageRow>(),
    db.prepare('SELECT * FROM page_line').all<PageLineRow>(),
    db.prepare('SELECT * FROM page_paragraph ORDER BY page, position').all<PageParagraphRow>(),
    db.prepare('SELECT * FROM home_gallery ORDER BY position').all<HomeGalleryRow>(),
  ]);

  const byPage = new Map(pages.results.map((row) => [row.page, row]));
  const byLine = new Map(lines.results.map((row) => [`${row.page}.${row.name}`, row]));
  const proseByPage = groupBy(paragraphs.results, (row) => row.page);

  /** A page's own two lines, blank where the row is missing. */
  const text = (page: string): PageText => {
    const row = byPage.get(page);
    return row === undefined
      ? { title: blank(), description: blank() }
      : {
          title: pair(row.title_zh, row.title_en),
          description: pair(row.description_zh, row.description_en),
        };
  };

  const line = (page: string, name: string): LocalisedText => {
    const row = byLine.get(`${page}.${name}`);
    return row === undefined ? blank() : pair(row.zh, row.en);
  };

  const prose = (page: string): LocalisedText[] =>
    (proseByPage.get(page) ?? []).map((row) => pair(row.zh, row.en));

  const home: HomePage = {
    ...text('home'),
    statement: line('home', 'statement'),
    gallery: gallery.results.map((row) =>
      imageRef(row.media_key, row.alt_zh, row.alt_en, row.decorative),
    ),
  };

  const programs: ProgramsPage = { ...text('programs'), intro: prose('programs') };

  const about: AboutPage = {
    ...text('about'),
    intro: prose('about'),
    mentorsTitle: line('about', 'mentorsTitle'),
    projectsTitle: line('about', 'projectsTitle'),
  };

  return { home, works: text('works'), programs, about };
}

/** Children before the parent they reference. */
export function deletePages(db: D1Database): D1PreparedStatement[] {
  return [
    db.prepare('DELETE FROM home_gallery'),
    db.prepare('DELETE FROM page_paragraph'),
    db.prepare('DELETE FROM page_line'),
    db.prepare('DELETE FROM pages'),
  ];
}

export function insertPages(db: D1Database, pages: SitePages): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [];

  const page = (key: string, text: PageText) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO pages (page, title_zh, title_en, description_zh, description_en)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(key, text.title.zh, text.title.en, text.description.zh, text.description.en),
    );
  };

  const line = (key: string, name: string, value: LocalisedText) => {
    statements.push(
      db
        .prepare('INSERT INTO page_line (page, name, zh, en) VALUES (?, ?, ?, ?)')
        .bind(key, name, value.zh, value.en),
    );
  };

  const prose = (key: string, paragraphs: readonly LocalisedText[]) => {
    paragraphs.forEach((paragraph, position) => {
      statements.push(
        db
          .prepare('INSERT INTO page_paragraph (page, position, zh, en) VALUES (?, ?, ?, ?)')
          .bind(key, position, paragraph.zh, paragraph.en),
      );
    });
  };

  page('home', pages.home);
  page('works', pages.works);
  page('programs', pages.programs);
  page('about', pages.about);

  line('home', 'statement', pages.home.statement);
  line('about', 'mentorsTitle', pages.about.mentorsTitle);
  line('about', 'projectsTitle', pages.about.projectsTitle);

  prose('programs', pages.programs.intro);
  prose('about', pages.about.intro);

  pages.home.gallery.forEach((image, position) => {
    statements.push(
      db
        .prepare(
          `INSERT INTO home_gallery (position, media_key, alt_zh, alt_en, decorative)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(position, ...imageBindings(image)),
    );
  });

  return statements;
}
