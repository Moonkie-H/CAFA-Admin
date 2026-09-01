/**
 * The one thing in this Worker that sends an email.
 *
 * Isolated behind an interface with a single method because the provider is the
 * part most likely to change and the least interesting: everything above this
 * file works in terms of "a message was sent, or it was not", and swapping
 * Resend for Postmark or SES should be this file and nothing else.
 *
 * **Why an HTTP provider at all.** A Worker has no SMTP socket. Cloudflare's
 * own Email Routing binding sends only to addresses it has verified inside your
 * own zone, which is a different product to "a stranger writes to the studio",
 * and MailChannels — which every Workers tutorial written before 2024 reaches
 * for — stopped being free to Workers in June of that year. What is left is an
 * HTTPS API and a key, which is what this is.
 *
 * **Why it is optional.** No key configured means no mail, and this says so
 * plainly rather than pretending. That matters more than usual here: a contact
 * form that silently drops messages is worse than one that is honestly absent,
 * because the studio believes it is receiving mail and the sender believes they
 * have sent some. So an unconfigured mailer answers `not-configured`, the
 * endpoint turns that into a 503, and the site falls back to `mailto:`.
 */

export interface Outgoing {
  to: string;
  /**
   * The writer's address, so hitting reply in the studio's mail client goes to
   * them. It is not the `From:`, and cannot be: sending as an address on
   * somebody else's domain is what SPF and DMARC exist to refuse, and a
   * provider will reject it or the message will land in spam. The `From:` is
   * the verified sender the mailer was configured with, which is why it is not
   * a field here — a caller has no business choosing it.
   */
  replyTo: string;
  subject: string;
  text: string;
}

export type SendResult =
  | { sent: true }
  | { sent: false; reason: 'not-configured' }
  | { sent: false; reason: 'refused'; detail: string };

export interface Mailer {
  send(message: Outgoing): Promise<SendResult>;
}

/** What a provider needs before it can send anything. */
export interface MailerConfig {
  token: string | undefined;
  sender: string | undefined;
}

const ENDPOINT = 'https://api.resend.com/emails';

/**
 * Resend, over its HTTP API.
 *
 * Plain text rather than HTML on purpose. The message is prose somebody typed
 * into a textarea; wrapping it in markup would buy nothing and would hand a
 * stranger's input to a mail client's HTML renderer, which is a surface worth
 * not opening for the sake of a font.
 */
export class ResendMailer implements Mailer {
  constructor(private readonly config: MailerConfig) {}

  /** Whether a message would go anywhere, without sending one to find out. */
  get configured(): boolean {
    return (this.config.token ?? '') !== '' && (this.config.sender ?? '') !== '';
  }

  async send(message: Outgoing): Promise<SendResult> {
    const { token, sender } = this.config;
    if (token === undefined || sender === undefined || !this.configured) {
      return { sent: false, reason: 'not-configured' };
    }

    const answer = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to: [message.to],
        reply_to: message.replyTo,
        subject: message.subject,
        text: message.text,
      }),
    });

    if (answer.ok) return { sent: true };

    // The provider's own words, kept for the log and never shown to the sender:
    // it can name the studio's own configuration, which is not a stranger's
    // business. The controller answers with a sentence of its own.
    return { sent: false, reason: 'refused', detail: await answer.text() };
  }
}
