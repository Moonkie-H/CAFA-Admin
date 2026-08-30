/**
 * The contact endpoint, declared.
 *
 * `registry.ts` is the whole read API, and the first thing it says about itself
 * is that nothing in it writes and there is no verb but GET. That statement is
 * worth keeping true, so the one public write lives here instead of being an
 * exception inside the list — and it is declared rather than merely routed, for
 * the same reason every connector is: api.json is compiled from these files, so
 * an endpoint that is not described here is an endpoint a frontend developer
 * cannot discover.
 *
 * The path is `/api/v1/` because that is the public surface a frontend is
 * handed, and `shared/cors.ts` opens the whole prefix to any origin. What makes
 * that safe here is not the origin — it is that the recipient is not the
 * caller's to choose. The message goes to `site.contact.email` out of the
 * newest published revision and nowhere else, so the endpoint cannot be pointed
 * at a stranger and used as a relay.
 */
import { shape, some, text } from './schema';
import type { JsonSchema } from './schema';

// The path itself lives in domain/contact, because the bundle projection needs
// it too and may not import from here. Re-exported so that everything *about*
// this endpoint is still reachable from one place.
export { CONTACT_PATH } from '../domain/contact';

export const CONTACT_SUMMARY = 'Send a message to the studio';

export const CONTACT_DESCRIPTION = `Posts one message to whatever address the published \`site.contact.email\` names — the same address printed on the contact card. The recipient is not a parameter and cannot be one: it is read out of the published revision on every request, so this cannot be used to send mail to anybody else.

Refusals are the admin's own error envelope with a sentence in \`msg\` that is meant to be shown to whoever typed the message. \`400\` is something they can fix — a malformed address, an empty body. \`429\` is too many messages from one address in a short window. \`503\` means the studio has not finished setting the form up, or nothing has been published yet; a site that gets one should fall back to a \`mailto:\` link rather than dropping the message.

\`website\` is a honeypot. Leave it out, or send it empty; a request that fills it is answered \`200\` and nothing is sent.`;

export const CONTACT_REQUEST: JsonSchema = some(
  {
    from: text('The address the studio should reply to. Required.'),
    name: text('What the sender is called. May be empty.'),
    message: text('The message itself, as plain text. At most 5,000 characters.'),
    website: text(
      'The honeypot. A real sender leaves this empty — the field is hidden on the card — and anything in it means the message is silently dropped.',
    ),
    locale: text(
      'Which language the card was read in, "zh" or "en". Decides only which language the subject line arrives in; anything else is read as "en".',
    ),
  },
  // The only two a message cannot be sent without. `some` rather than `shape`
  // because the other three are genuinely optional, and a generated client that
  // demanded a honeypot would be a strange thing to hand anyone.
  ['from', 'message'],
  'A message off the contact card. Only `from` and `message` have to be present.',
);

export const CONTACT_RESPONSE: JsonSchema = shape(
  {
    success: { type: 'boolean', description: 'Always true here; a refusal is the Error shape.' },
    data: shape({ sent: { type: 'boolean', description: 'Always true.' } }),
    code: { type: 'integer', description: 'Always 200.' },
    msg: text('A short confirmation.'),
  },
  'What a sent message answers with. Unlike the read connectors this wears the admin’s envelope, because a refusal carries a sentence for a person and the envelope is the shape that carries one.',
);
