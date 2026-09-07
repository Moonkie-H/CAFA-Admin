-- How each photograph is drawn where it appears.
--
-- Every photograph on the site is shown at its own proportions: the column is
-- as wide as it is, the picture keeps the shape it came off the camera at, and
-- that is the whole of the arrangement. It is the right default and it stays
-- the default — it is what makes the reference sites read as a portfolio rather
-- than as a grid of thumbnails — but it cannot do the one thing the studio
-- asked for, which is put a 3:2 photograph and a 4:5 one in the same grid
-- without the grid going ragged. Nothing about uploading fixes that. Nobody
-- shoots everything at one ratio.
--
-- So a photograph may be given a frame, and this is where the frame is kept: a
-- shape to draw it into, whether it fills that shape or fits inside it, how far
-- it is enlarged, and which point of the picture the shape is held over. The
-- site spends those as `aspect-ratio`, `object-fit`, `scale` and
-- `object-position`, which is the only way this could have been built — the
-- zone cannot transform images, so there is no `/cdn-cgi/image/` to crop with
-- and nothing in either repository can re-encode a JPEG on the way to a reader.
-- Nothing here touches the bucket. The original and every rung of its ladder
-- are exactly the bytes they were, so the studio can change its mind for free.
--
-- One TEXT column per placement, holding the framing as a small JSON object —
-- `{"ratio":1,"fit":"cover","zoom":1.4,"x":50,"y":32}` — rather than five
-- columns per placement, which would have been thirty columns across these six
-- tables. `media.widths` is the precedent and the test is the same one: this is
-- a value that is always read whole, written whole, never queried across and
-- understood by nothing but the renderer. That is a value, not a relation. Alt
-- text is columns because alt is required and pairs with `decorative` under a
-- CHECK; a frame has no such partner and no such rule.
--
-- The empty string is the default and it is the whole of the backwards
-- compatibility: it means "the photograph's own shape, whole, centred", which
-- is what every row already in these tables means and what every row written
-- since the site launched has meant. Nothing is backfilled, nothing has to be
-- re-saved, and a photograph the studio resets goes back to storing nothing at
-- all rather than storing the defaults spelled out. A site that never uses the
-- feature carries no framing data anywhere.
--
-- The six placements are every place `imageBindings` writes: a work's cover and
-- each photograph in its media column, a mentor's portrait, a project's
-- picture, the front page's gallery, and the contact card's QR code.

ALTER TABLE works ADD COLUMN cover_frame TEXT NOT NULL DEFAULT '';

ALTER TABLE work_media ADD COLUMN frame TEXT NOT NULL DEFAULT '';

ALTER TABLE mentors ADD COLUMN portrait_frame TEXT NOT NULL DEFAULT '';

ALTER TABLE projects ADD COLUMN image_frame TEXT NOT NULL DEFAULT '';

ALTER TABLE home_gallery ADD COLUMN frame TEXT NOT NULL DEFAULT '';

ALTER TABLE site ADD COLUMN qr_frame TEXT NOT NULL DEFAULT '';
