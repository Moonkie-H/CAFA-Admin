-- Two things the studio asked for that belong to the site rather than to a page.
--
-- 1. THE QR CODE. The contact card prints a WeChat ID and expects a reader to
--    type it into another application from memory. On a phone — which is where
--    WeChat is — that is the whole interaction failing at the last step, and the
--    studio asked for somewhere to put the code instead.
--
--    It is a photograph like any other, so it is four columns like any other:
--    key, both alts, and the decorative flag. What is different is that it is
--    *optional* — a studio without a QR code is a card exactly as it is today —
--    and the empty key is how that is said.
--
--    Two things the other five image columns get from the schema, this one gets
--    from the validators instead, and both are a limit of ALTER TABLE rather
--    than a change of mind. There is no foreign key into `media`, because a
--    column added by ALTER TABLE may only carry a REFERENCES clause if it
--    defaults to NULL, and '' is what "no code" has to be here. And there is no
--    table-level CHECK pairing the key with its alt text, because ALTER TABLE
--    cannot add one at all. `checkContent` refuses a code without a description
--    and `checkImagesInStorage` refuses a key that is not in the bucket — the
--    same two gates every other photograph passes, in the editor and again in
--    the Worker, which is where a studio actually meets them.
--
-- 2. THE TYPE SCALE. Asked for as "a font size feature, like Word". Word's own
--    answer — any number of points on any run of text — is not available here:
--    the site's six type roles are what make its pages look like one site, and a
--    field that can put 9px on a paragraph or 40px on a caption is a field that
--    can break the contrast floor, the touch floor and the page's rhythm in a
--    single edit, with no way for anyone to see it had happened until it was
--    live.
--
--    So it is the same control at the scale the design can honour: one step,
--    for the whole site, applied to all six roles at once so their relationships
--    survive. `normal`, `large` or `larger` — and no step down, because three of
--    the roles already sit at the floor the accessibility rules allow and the
--    only direction they may not move is smaller.
--
--    TEXT with a CHECK rather than an integer, so the value in the database says
--    what it means and an unknown one cannot be stored at all.

ALTER TABLE site ADD COLUMN qr_key TEXT NOT NULL DEFAULT '';
ALTER TABLE site ADD COLUMN qr_alt_zh TEXT NOT NULL DEFAULT '';
ALTER TABLE site ADD COLUMN qr_alt_en TEXT NOT NULL DEFAULT '';
ALTER TABLE site ADD COLUMN qr_decorative INTEGER NOT NULL DEFAULT 0
  CHECK (qr_decorative IN (0, 1));

ALTER TABLE site ADD COLUMN type_scale TEXT NOT NULL DEFAULT 'normal'
  CHECK (type_scale IN ('normal', 'large', 'larger'));
