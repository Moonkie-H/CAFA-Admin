-- Pages stop being records again, and keep their words.
--
-- Migration 0005 made a page a row with an ordered list of section rows under
-- it, so the studio could compose a page — and add a fifth one — without a
-- developer. In practice a page here is not a composition: it is a route in
-- CAFA-Template with its own layout, its own choreography and its own view
-- transitions. A page nobody has drawn is not a new page, it is a blank one,
-- and a section moved into an order nothing was designed for is a page that
-- reads worse than the one it replaced. What the studio actually needed was to
-- edit the words on the four pages that exist, which is what this restores —
-- without giving back the hardcoded copy keys 0005 correctly took away.
--
-- So: the set of pages is code, the composition of each is code, and every
-- word inside them is still a row here.
--
--   pages           the four, each with the title and description it shows.
--   page_line       the single lines a page carries beyond those two.
--   page_paragraph  the prose on Programmes and About, one row per paragraph.
--   home_gallery    the studio photographs below the front page's statement.
--
-- Nothing is invented below: every string is lifted out of the section rows
-- that held it, so applying this changes no word on the live site. What it
-- changes is who owns the structure.
--
-- Apply this *before* deploying the Worker that goes with it: between the two,
-- a save would write pages the old Worker has no tables for. It is a one-person
-- admin and the window is a deploy, but the order is free.

ALTER TABLE pages RENAME TO legacy_pages;

CREATE TABLE pages (
  page           TEXT PRIMARY KEY CHECK (page IN ('home', 'works', 'programs', 'about')),
  title_zh       TEXT NOT NULL,   -- the h1, the browser tab, and the word in the bar
  title_en       TEXT NOT NULL,
  description_zh TEXT NOT NULL,   -- the meta description
  description_en TEXT NOT NULL
);

-- The lines that belong to one page and have nowhere else to sit: the front
-- page's statement, and the two headings About sets over the people and the
-- projects. `name` is schema rather than data — one exists because a component
-- reads it — which is why it is CHECK-constrained to the three that do.
CREATE TABLE page_line (
  page TEXT NOT NULL REFERENCES pages(page) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (name IN ('statement', 'mentorsTitle', 'projectsTitle')),
  zh   TEXT NOT NULL,
  en   TEXT NOT NULL,
  PRIMARY KEY (page, name)
);

-- Prose, in the unit it is authored in. Programmes and About each open with a
-- few paragraphs; a paragraph has no identity beyond where it sits.
CREATE TABLE page_paragraph (
  page     TEXT    NOT NULL REFERENCES pages(page) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  zh       TEXT    NOT NULL,
  en       TEXT    NOT NULL,
  PRIMARY KEY (page, position)
);

-- The photographs under the statement. One page has them, so the table is
-- named for that page rather than pretending to be general.
CREATE TABLE home_gallery (
  position   INTEGER PRIMARY KEY,
  media_key  TEXT    NOT NULL REFERENCES media(key),
  alt_zh     TEXT    NOT NULL DEFAULT '',
  alt_en     TEXT    NOT NULL DEFAULT '',
  decorative INTEGER NOT NULL DEFAULT 0 CHECK (decorative IN (0, 1)),
  CHECK (decorative = 1 OR (alt_zh <> '' AND alt_en <> ''))
);

-- The four rows, blank, so a database that has had the migrations run but has
-- never been seeded still answers with four pages rather than with none. The
-- copies below overwrite whichever of them the old tables can speak for.
INSERT INTO pages (page, title_zh, title_en, description_zh, description_en) VALUES
  ('home',     '', '', '', ''),
  ('works',    '', '', '', ''),
  ('programs', '', '', '', ''),
  ('about',    '', '', '', '');

UPDATE pages SET
  title_zh       = (SELECT title_zh       FROM legacy_pages WHERE slug = ''),
  title_en       = (SELECT title_en       FROM legacy_pages WHERE slug = ''),
  description_zh = (SELECT description_zh FROM legacy_pages WHERE slug = ''),
  description_en = (SELECT description_en FROM legacy_pages WHERE slug = '')
WHERE page = 'home' AND EXISTS (SELECT 1 FROM legacy_pages WHERE slug = '');

UPDATE pages SET
  title_zh       = (SELECT title_zh       FROM legacy_pages WHERE slug = 'works'),
  title_en       = (SELECT title_en       FROM legacy_pages WHERE slug = 'works'),
  description_zh = (SELECT description_zh FROM legacy_pages WHERE slug = 'works'),
  description_en = (SELECT description_en FROM legacy_pages WHERE slug = 'works')
WHERE page = 'works' AND EXISTS (SELECT 1 FROM legacy_pages WHERE slug = 'works');

UPDATE pages SET
  title_zh       = (SELECT title_zh       FROM legacy_pages WHERE slug = 'programs'),
  title_en       = (SELECT title_en       FROM legacy_pages WHERE slug = 'programs'),
  description_zh = (SELECT description_zh FROM legacy_pages WHERE slug = 'programs'),
  description_en = (SELECT description_en FROM legacy_pages WHERE slug = 'programs')
WHERE page = 'programs' AND EXISTS (SELECT 1 FROM legacy_pages WHERE slug = 'programs');

UPDATE pages SET
  title_zh       = (SELECT title_zh       FROM legacy_pages WHERE slug = 'about'),
  title_en       = (SELECT title_en       FROM legacy_pages WHERE slug = 'about'),
  description_zh = (SELECT description_zh FROM legacy_pages WHERE slug = 'about'),
  description_en = (SELECT description_en FROM legacy_pages WHERE slug = 'about')
WHERE page = 'about' AND EXISTS (SELECT 1 FROM legacy_pages WHERE slug = 'about');

-- The three lines, read off the section that used to carry each.
INSERT INTO page_line (page, name, zh, en)
SELECT 'home', 'statement', text_zh, text_en
FROM page_section WHERE page_slug = '' AND kind = 'statement';

INSERT INTO page_line (page, name, zh, en)
SELECT 'about', 'mentorsTitle', text_zh, text_en
FROM page_section WHERE page_slug = 'about' AND kind = 'mentors';

INSERT INTO page_line (page, name, zh, en)
SELECT 'about', 'projectsTitle', text_zh, text_en
FROM page_section WHERE page_slug = 'about' AND kind = 'works-grid';

-- And blanks for whichever of the three the old tables could not speak for.
INSERT OR IGNORE INTO page_line (page, name, zh, en) VALUES
  ('home',  'statement',     '', ''),
  ('about', 'mentorsTitle',  '', ''),
  ('about', 'projectsTitle', '', '');

-- The prose. Each page had exactly one `prose` section; its paragraphs keep
-- their order, renumbered from the section they hung off to the page itself.
INSERT INTO page_paragraph (page, position, zh, en)
SELECT 'programs', p.position, p.zh, p.en
FROM section_paragraph p
JOIN page_section s ON s.page_slug = p.page_slug AND s.position = p.section_position
WHERE p.page_slug = 'programs' AND s.kind = 'prose';

INSERT INTO page_paragraph (page, position, zh, en)
SELECT 'about', p.position, p.zh, p.en
FROM section_paragraph p
JOIN page_section s ON s.page_slug = p.page_slug AND s.position = p.section_position
WHERE p.page_slug = 'about' AND s.kind = 'prose';

-- The studio photographs, out of the front page's gallery section.
INSERT INTO home_gallery (position, media_key, alt_zh, alt_en, decorative)
SELECT m.position, m.media_key, m.alt_zh, m.alt_en, m.decorative
FROM section_media m
JOIN page_section s ON s.page_slug = m.page_slug AND s.position = m.section_position
WHERE m.page_slug = '' AND s.kind = 'gallery';

DROP TABLE section_media;
DROP TABLE section_paragraph;
DROP TABLE page_section;
DROP TABLE legacy_pages;

-- `meta.title` and `meta.description` were the front page's title and
-- description under another name — 0005 seeded the page row from them and left
-- both copies in place. There is one owner now, and it is the page.
DELETE FROM copy WHERE key IN ('meta.title', 'meta.description');
