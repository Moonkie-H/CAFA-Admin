-- The contact form learns to say what it is doing.
--
-- Keys are schema rather than data: one exists because CAFA-Template's
-- `Dictionary` type has a field for it, and the template re-parses every one of
-- them at build time. So a key it has started reading is a failed build until
-- this runs — which is why key changes arrive as a migration, beside the code
-- that reads them, exactly as 0003 did when the form first appeared.
--
-- What changed on the template's side: Send used to compose a `mailto:` and
-- hand the reader a draft, because that repository ships no server runtime and
-- there was nowhere for a POST to land. There is now — /api/v1/contact on this
-- Worker — so Send posts, and a form that posts has three states the old one
-- could not be in:
--
--   contact.sending   the button while the message is in flight
--   contact.sent      what replaces the form once it has gone, so the same
--                     message cannot be sent twice by a second press
--   contact.failed    what is said when the *connection* failed. Not the usual
--                     failure: a message the Worker refused comes back with a
--                     sentence of its own — "that does not look like an email
--                     address" — and the card shows that instead, because the
--                     half that knows what was wrong should be the half that
--                     says so. This is the one there is nothing to relay for.
--   contact.draft     the offer of a `mailto:` draft afterwards, carrying what
--                     was already typed, so a failure is never a dead end.
--
-- `contact.subject` keeps its key and changes meaning slightly: it was the line
-- the reader's own mail client opened with, and it is now the line the message
-- arrives under in the studio's inbox. The same words serve both — it is still
-- a subject on a message from the site — so it is left alone rather than
-- rewritten under somebody's published copy.
--
-- The English and Chinese below are defaults, not decisions. Every one of them
-- is editable on the Contact screen the moment this is applied.
--
-- `INSERT OR IGNORE` so re-running this cannot overwrite words the studio has
-- since edited. Apply it *before* deploying the Worker that goes with it, and
-- do the two together: a save writes the whole copy table from the dictionary
-- the editor is holding, so an old editor saving in between would drop the four
-- new keys and the next build would fail on them.

INSERT OR IGNORE INTO copy (key, zh, en) VALUES
  ('contact.sending', '发送中…',       'Sending…'),
  ('contact.sent',    '已收到，谢谢。', 'Thank you — your message has been sent.'),
  ('contact.failed',  '发送失败。',     'The message could not be sent.'),
  ('contact.draft',   '改用邮件客户端', 'Open it in your mail program instead');
