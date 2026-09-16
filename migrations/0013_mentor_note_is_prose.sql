-- A mentor's own lines, in one box.
--
-- A person had three boxes here — a name, a discipline, and one sentence —
-- and the site drew each of them as exactly one line, in that order, under the
-- portrait. The shape was the form's rather than the studio's: what goes under
-- a face is a few lines about somebody, and how many of them there are and
-- where they break is the studio's to decide, the way the footer note has
-- always been. Two of those three boxes were one box asked for twice.
--
-- So the discipline moves into the note and the note becomes prose: the same
-- rich text every other writing field here holds, with the studio's own line
-- breaks in it. The name stays its own column. It is the plate's heading on the
-- site and the person's title in this admin's list of them, and a heading that
-- is "whatever the first line happens to be" is not a heading.
--
-- Nothing is lost and nothing is invented. Every mentor's discipline becomes
-- the first line of their note, which is exactly where it was drawn before, so
-- applying this changes no word on the live site — only who decides where the
-- break goes from now on. A person with one of the two filled in and the other
-- blank keeps the one, with no stray blank line in front of or behind it.
--
-- Apply this *before* deploying the Worker that goes with it. The Worker in
-- front of it writes `discipline_zh` on every save, and these columns will not
-- be there; the window is one deploy, reads keep working throughout it, and a
-- save inside it fails loudly rather than writing anything wrong.

UPDATE mentors
SET note_zh = CASE
      WHEN trim(discipline_zh) = '' THEN note_zh
      WHEN trim(note_zh) = '' THEN discipline_zh
      ELSE discipline_zh || char(10) || note_zh
    END,
    note_en = CASE
      WHEN trim(discipline_en) = '' THEN note_en
      WHEN trim(note_en) = '' THEN discipline_en
      ELSE discipline_en || char(10) || note_en
    END;

ALTER TABLE mentors DROP COLUMN discipline_zh;

ALTER TABLE mentors DROP COLUMN discipline_en;
