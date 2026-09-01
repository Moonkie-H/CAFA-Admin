-- Projects stop being the works under another name.
--
-- About ends on a heading — `projectsTitle` — and under it the site drew the
-- works index a second time, as a grid of covers. That was a shortcut with a
-- reasonable story behind it ("the projects are the evidence"), and it was
-- wrong in the way shortcuts usually are: the studio could not put anything
-- under that heading that was not already a work, and could not keep a work
-- off it. Two different things were sharing one table because they happened to
-- look alike on the day the page was drawn.
--
-- So this gives the projects a table. A project is deliberately the smallest
-- record in the schema — a picture, a name, and a line or two about it — and
-- that is the whole of it:
--
--   * No status. A work is completed, in progress or private because the index
--     says so beside its number; nothing on About says anything of the kind.
--   * No year, no disciplines, no credits. Those are the columns of the works
--     index, and the index is where they are read.
--   * No page, and so no route. A project is not clickable: what there is to
--     know about one is on the card. `slug` is here as a stable key for
--     ordering and for filing its photograph under, the way `programs.slug` is
--     — not as a URL segment. Nothing resolves a project by it.
--
-- It starts empty, and that is deliberate too. Seeding it from the works would
-- reproduce the confusion this migration exists to end, and would leave the
-- studio deleting six rows it never asked for. Until a project is added, the
-- template omits the section — heading included — rather than drawing an empty
-- frame, so an empty table is a shorter About page and never a broken one.
--
-- Apply this *before* deploying the Worker that goes with it: between the two,
-- a save would write projects the old Worker has no table for. It is a
-- one-person admin and the window is a deploy, but the order is free.

CREATE TABLE projects (
  slug       TEXT    PRIMARY KEY,   -- stable key; projects have no page of their own
  position   INTEGER NOT NULL,      -- the order they are read across About
  title_zh   TEXT    NOT NULL,
  title_en   TEXT    NOT NULL,
  summary_zh TEXT    NOT NULL,      -- the line or two under the picture
  summary_en TEXT    NOT NULL,

  -- The picture, in the four columns every image occupies here. The foreign key
  -- is why a photograph is uploaded before the record naming it is saved, and
  -- the CHECK is the same alt-text rule the other image tables carry: a
  -- decorative image says so with `decorative = 1`, and a half-described one —
  -- captioned in one language and not the other — is refused rather than
  -- published.
  image_key        TEXT    NOT NULL REFERENCES media(key),
  image_alt_zh     TEXT    NOT NULL DEFAULT '',
  image_alt_en     TEXT    NOT NULL DEFAULT '',
  image_decorative INTEGER NOT NULL DEFAULT 0 CHECK (image_decorative IN (0, 1)),
  CHECK (image_decorative = 1 OR (image_alt_zh <> '' AND image_alt_en <> ''))
);

CREATE INDEX projects_position ON projects (position);
