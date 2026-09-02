/**
 * A message off the contact card, checked before anything is done with it.
 *
 * Pure, and in `domain/` for the usual reason: none of this needs a Request, a
 * binding or a network, so none of it should have to be stood up to test. What
 * it decides is what a stranger is allowed to put into an email the studio will
 * open — which is the only place in this Worker where unauthenticated input
 * leaves the building.
 *
 * Three rules, and each is a specific attack rather than tidiness:
 *
 *  - **No control characters in the address or the name.** Both are interpolated
 *    into mail headers. A carriage return in either is header injection: the
 *    rest of the line becomes a `Bcc:` and the studio's address becomes a relay.
 *    `\s` in the pattern below is what refuses it, and the name is scrubbed
 *    separately because it has no pattern to fail.
 *  - **Lengths.** A 5 MB "message" is not a message. The cap is generous for
 *    prose and small enough that a thousand of them cost nothing.
 *  - **A body with something in it.** A blank message is either a mistake or a
 *    probe, and neither is worth an email.
 *
 * What is deliberately *not* here is any attempt to decide whether an address
 * is real. It cannot be known from the string, only from sending to it, and a
 * regex that tries anyway is a regex that eventually refuses somebody's genuine
 * address. This checks the shape and the safety, and stops.
 *
 * The half of that question which *can* be answered is answered elsewhere and
 * over the network: whether the domain after the `@` publishes anywhere to
 * deliver to. That is a DNS lookup rather than a pattern, so it lives in
 * services/mail-domains.ts and this file only supplies the name to ask about.
 */

/**
 * Where a message is posted.
 *
 * Here rather than beside the endpoint's OpenAPI declaration because two things
 * need it and they are on opposite sides of the layering: the router serves it,
 * and the bundle projection writes it into the published content so the site
 * knows where to post. `domain/` is the only place both may import from —
 * dependencies point down, and `connectors/` is not down from `domain/`.
 */
export const CONTACT_PATH = '/api/v1/contact';

/** RFC 5321's limit on a path. Anything longer is not an address. */
const MAX_ADDRESS = 254;
const MAX_NAME = 100;
const MAX_MESSAGE = 5_000;

/**
 * An address, shaped like one and safe to put in a header.
 *
 * The excluded set is whitespace — which covers CR and LF, the injection — plus
 * the punctuation that separates or quotes addresses in a header: a comma or a
 * semicolon would make one address into two, and angle brackets or quotes would
 * let the display name and the address be pulled apart.
 */
const ADDRESS = /^[^\s@,;:<>"'\\]+@[^\s@,;:<>"'\\]+\.[^\s@,;:<>"'\\]{2,}$/;

export interface ContactMessage {
  /** Who wrote it. Checked, because the studio will hit reply. */
  from: string;
  /** What they are called, or the empty string. Never required. */
  name: string;
  message: string;
}

/** Why a message was refused, in a sentence that can be shown to whoever wrote it. */
export type ContactFault = string;

export type ContactCheck =
  | { ok: true; message: ContactMessage }
  | { ok: false; fault: ContactFault };

/**
 * Anything a mail header must not carry, gone.
 *
 * Each control character becomes a space and runs of whitespace then collapse,
 * so a `\r\n` leaves one gap rather than two. That is cosmetic on its own, but
 * it is also what makes the result stable enough to assert on — and a display
 * name is a line of text, where a run of spaces was never meaningful anyway.
 */
function withoutControls(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isContactAddress(value: string): boolean {
  return value.length <= MAX_ADDRESS && ADDRESS.test(value);
}

/**
 * The half of an address after the `@`, lowercased, for asking DNS about.
 *
 * `lastIndexOf` rather than a split: the local part may itself contain an `@`
 * when it is quoted, and it is the final one that separates the domain. Only
 * meaningful for a value `isContactAddress` has already accepted — the empty
 * string is what anything else gives, and a lookup of it fails as it should.
 */
export function addressDomain(address: string): string {
  return address.slice(address.lastIndexOf('@') + 1).toLowerCase();
}

/**
 * The three fields, checked together.
 *
 * One function rather than three, and it returns the fault rather than throwing,
 * because the caller wants to answer the person who typed it — a thrown error
 * would have to be caught and turned back into a sentence at every call site.
 */
export function checkContactMessage(fields: {
  from: string;
  name: string;
  message: string;
}): ContactCheck {
  const from = fields.from.trim();
  const name = withoutControls(fields.name).slice(0, MAX_NAME);
  const message = fields.message.trim();

  if (from === '') return { ok: false, fault: 'Say which address to reply to.' };
  if (!isContactAddress(from)) {
    return { ok: false, fault: 'That does not look like an email address.' };
  }
  if (message === '') return { ok: false, fault: 'The message is empty.' };
  if (message.length > MAX_MESSAGE) {
    return {
      ok: false,
      fault: `That message is longer than ${MAX_MESSAGE.toLocaleString()} characters.`,
    };
  }

  return { ok: true, message: { from, name, message } };
}

/**
 * The email itself: what the studio sees in its inbox.
 *
 * The sender's address is repeated in the body as well as set as `Reply-To`,
 * for the same reason the old `mailto:` form repeated it — a client that
 * ignores or strips the header would otherwise leave a message with no way back
 * to whoever sent it. Belt and braces on the one field that makes the message
 * useful.
 */
export function contactBody(message: ContactMessage, siteUrl: string): string {
  const who = message.name === '' ? message.from : `${message.name} <${message.from}>`;
  return `${message.message}\n\n—\nFrom: ${who}\nSent from the contact card at ${siteUrl}\n`;
}

/**
 * The subject, which is the studio's own copy for this and not a string of
 * ours. `contact.subject` already existed to title the draft the `mailto:` form
 * opened; the message arrives by another route now and is still the same
 * message, so it keeps the same line. The address is appended because an inbox
 * of identically-titled messages cannot be scanned.
 */
export function contactSubject(subject: string, message: ContactMessage): string {
  return withoutControls(`${subject} — ${message.name === '' ? message.from : message.name}`);
}
