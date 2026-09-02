/**
 * The contact card, from the far side.
 *
 * This is the only unauthenticated *write* in the API, and everything below is
 * shaped by that. It does not touch the content tables — it reads the published
 * revision and sends one email — so the worst a flood can cost is quota, and
 * the guards here are about making that bound tight.
 *
 * **Where the message goes is content.** The recipient is `site.contact.email`
 * out of the newest published revision, which is the address already printed on
 * the card. So moving the studio's inbox is an edit and a publish, the same as
 * changing the address a visitor reads — one owner for the fact, and no way for
 * the printed address and the delivered-to address to disagree. It also means a
 * site with nothing published yet has no contact endpoint, which is correct: it
 * has no contact card either.
 *
 * **The honeypot.** A field the CSS hides and a person never fills in. A bot
 * that fills every input gives itself away, and the answer is a cheerful 200
 * with nothing sent — telling a bot it was caught is telling it what to change.
 *
 * **The address is checked twice**, and the second check is the one that earns
 * its keep. `checkContactMessage` decides whether what was typed is shaped like
 * an address and is safe to put in a mail header; `MailDomains` then asks DNS
 * whether the domain after the `@` has anywhere to deliver to. A message whose
 * reply-to bounces is a message the studio cannot answer, and the sender is the
 * only person who can fix it — so they are told now, while they are still
 * looking at the card, rather than never. A resolver that cannot answer is
 * treated as a yes; see mail-domains.ts for why that trade is not close.
 *
 * **The rate limit** is Cloudflare's own binding, keyed on the caller's IP. It
 * is optional in the same way the mailer's key is: absent means unlimited, and
 * absent is what `wrangler dev` gives you unless configured, so the code must
 * work either way rather than crash locally.
 */
import { addressDomain, checkContactMessage, contactBody, contactSubject } from '../domain/contact';
import type { PublishedBundle } from '../domain/bundle';
import { LOCALES, type Locale } from '../../shared/content/types';
import { ApiException } from '../shared/api-exception';
import type { Mailer } from './mailer';
import type { MailDomains } from './mail-domains';
import type { PublishService } from './publish.service';

/**
 * Cloudflare's rate-limiting binding, as this file uses it.
 *
 * Declared structurally rather than imported: the generated binding types come
 * from wrangler.jsonc, and writing the one method that is called keeps this
 * compiling when the binding is not configured at all.
 */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** What the form sends. `website` is the honeypot and is never a real field. */
export interface ContactSubmission {
  from: string;
  name: string;
  message: string;
  website: string;
  locale: string;
}

export type ContactOutcome =
  | { accepted: true }
  /** Refused for something the sender can fix, in words they can read. */
  | { accepted: false; status: 400; reason: string }
  | { accepted: false; status: 429; reason: string }
  | { accepted: false; status: 503; reason: string };

function isLocale(value: string): value is Locale {
  return LOCALES.some((known) => known === value);
}

export class ContactService {
  constructor(
    private readonly publishing: PublishService,
    private readonly mailer: Mailer,
    private readonly limiter: RateLimiter | undefined,
    private readonly domains: MailDomains,
  ) {}

  async send(submission: ContactSubmission, from: string | null): Promise<ContactOutcome> {
    // Before anything else, and before any I/O: a bot that filled the hidden
    // field costs one string comparison and learns nothing.
    if (submission.website.trim() !== '') return { accepted: true };

    if (!(await this.withinLimit(from))) {
      return {
        accepted: false,
        status: 429,
        reason: 'That is a lot of messages at once. Try again in a minute.',
      };
    }

    const checked = checkContactMessage(submission);
    if (!checked.ok) return { accepted: false, status: 400, reason: checked.fault };

    // Shaped like an address, but is there anything behind it? A typo'd domain
    // passes every pattern and then bounces a day later, in the studio's outbox
    // rather than in front of the person who mistyped it.
    if ((await this.domains.verdict(addressDomain(checked.message.from))) === 'refuses') {
      return {
        accepted: false,
        status: 400,
        reason: 'That address’s domain does not receive mail. Check the spelling.',
      };
    }

    const bundle = await this.publishedBundle();
    const to = bundle.site.contact.email;
    if (to === '') {
      return { accepted: false, status: 503, reason: 'The studio has no address to write to.' };
    }

    const locale = isLocale(submission.locale) ? submission.locale : 'en';
    const sent = await this.mailer.send({
      to,
      replyTo: checked.message.from,
      subject: contactSubject(bundle.dictionaries[locale].contact.subject, checked.message),
      text: contactBody(checked.message, bundle.site.url),
    });

    if (sent.sent) return { accepted: true };
    if (sent.reason === 'not-configured') {
      return { accepted: false, status: 503, reason: 'The message form is not set up yet.' };
    }

    // The provider's reason goes to the log, where the studio's developer can
    // read it; the sender gets a sentence that does not describe somebody
    // else's configuration.
    console.error('contact: the mail provider refused the message', sent.detail);
    return { accepted: false, status: 503, reason: 'The message could not be sent just now.' };
  }

  /** True when there is no limiter, which is what an unconfigured binding means. */
  private async withinLimit(from: string | null): Promise<boolean> {
    if (this.limiter === undefined) return true;
    // No address to key on is a request that did not come through Cloudflare's
    // edge — `wrangler dev`, or a test. One shared bucket is the safe reading.
    const { success } = await this.limiter.limit({ key: from ?? 'unknown' });
    return success;
  }

  /**
   * The published revision, parsed. Nothing published means no card and so no
   * endpoint, which is a 503 rather than the 404 `publishedSnapshot` throws —
   * the path exists, it just has nothing to work with yet.
   */
  private async publishedBundle(): Promise<PublishedBundle> {
    try {
      const snapshot = await this.publishing.publishedSnapshot();
      return JSON.parse(snapshot.bundle) as PublishedBundle;
    } catch (failure) {
      if (failure instanceof ApiException && failure.code === 404) {
        throw new ApiException(503, 'The site has not been published yet.');
      }
      throw failure;
    }
  }
}
