/**
 * The contact card's far side.
 *
 * This is the only unauthenticated write in the API, so what is tested here is
 * mostly what it *refuses*: header injection through the two fields that reach
 * a mail header, a body that could fill an inbox, and the two guards — the
 * honeypot and the rate limit — whose whole job is to be silent when they fire.
 *
 * The service is exercised against a fake mailer rather than a network. The
 * question worth answering is "what did it decide to send, and to whom", and
 * the provider's HTTP shape is worth nothing to that.
 */
import { describe, expect, it } from 'vitest';

import {
  checkContactMessage,
  contactBody,
  contactSubject,
  isContactAddress,
} from '../worker/domain/contact';
import { buildBundle } from '../worker/domain/bundle';
import { ContactService, type RateLimiter } from '../worker/services/contact.service';
import type { Mailer, Outgoing, SendResult } from '../worker/services/mailer';
import type { PublishService } from '../worker/services/publish.service';
import { ApiException } from '../worker/shared/api-exception';
import { content } from './content-fixture';

describe('a message, before anything is done with it', () => {
  it('accepts an ordinary address and refuses a shapeless one', () => {
    for (const value of ['a@b.co', 'first.last+tag@sub.example.com']) {
      expect(isContactAddress(value), value).toBe(true);
    }
    for (const value of ['', 'nobody', 'no@domain', 'a b@c.co', '@c.co', 'a@.co']) {
      expect(isContactAddress(value), value).toBe(false);
    }
  });

  it('refuses an address carrying a newline, which is the injection', () => {
    // The address is interpolated into Reply-To. A CR here would end the header
    // and make everything after it a header of the sender's choosing.
    expect(isContactAddress('a@b.co\nBcc: victim@example.com')).toBe(false);
    expect(isContactAddress('a@b.co\r\nBcc: victim@example.com')).toBe(false);
    expect(isContactAddress('a@b.co, victim@example.com')).toBe(false);
    expect(isContactAddress('a@b.co>, <victim@example.com')).toBe(false);
  });

  it('scrubs control characters out of the name rather than refusing it', () => {
    // A name has no shape to fail, so it is cleaned instead — refusing somebody
    // because their mail client sent a stray tab would be the wrong trade.
    const checked = checkContactMessage({
      from: 'a@b.co',
      name: 'Ada\r\nBcc: victim@example.com',
      message: 'Hello.',
    });

    expect(checked.ok).toBe(true);
    expect(checked.ok && checked.message.name).toBe('Ada Bcc: victim@example.com');
    expect(checked.ok && checked.message.name).not.toMatch(/[\r\n]/);
  });

  it('says which of the two required fields is missing, in words', () => {
    const noAddress = checkContactMessage({ from: '  ', name: '', message: 'Hello.' });
    expect(noAddress.ok).toBe(false);
    expect(!noAddress.ok && noAddress.fault).toMatch(/address/i);

    const noMessage = checkContactMessage({ from: 'a@b.co', name: '', message: '   ' });
    expect(noMessage.ok).toBe(false);
    expect(!noMessage.ok && noMessage.fault).toMatch(/empty/i);
  });

  it('refuses a body nobody typed by hand', () => {
    const long = checkContactMessage({ from: 'a@b.co', name: '', message: 'x'.repeat(5_001) });
    expect(long.ok).toBe(false);

    expect(checkContactMessage({ from: 'a@b.co', name: '', message: 'x'.repeat(5_000) }).ok).toBe(
      true,
    );
  });

  it('keeps the sender in the body as well as in the header', () => {
    const body = contactBody(
      { from: 'ada@example.com', name: 'Ada', message: 'Hello.' },
      'https://example.com',
    );

    expect(body).toContain('Hello.');
    expect(body).toContain('Ada <ada@example.com>');
    expect(body).toContain('https://example.com');
  });

  it('titles the message with the studio’s own line and never a newline', () => {
    expect(
      contactSubject('A message from the site', {
        from: 'ada@example.com',
        name: '',
        message: 'Hello.',
      }),
    ).toBe('A message from the site — ada@example.com');

    expect(
      contactSubject('Subject\r\nBcc: victim@example.com', {
        from: 'a@b.co',
        name: '',
        message: 'x',
      }),
    ).not.toMatch(/[\r\n]/);
  });
});

/** A mailer that records rather than sends. */
class Recorder implements Mailer {
  readonly sent: Outgoing[] = [];

  constructor(private readonly answer: SendResult = { sent: true }) {}

  send(message: Outgoing): Promise<SendResult> {
    if (this.answer.sent) this.sent.push(message);
    return Promise.resolve(this.answer);
  }
}

/** A publish service that answers with one bundle, or with nothing published. */
function publisher(options: { email?: string; published?: boolean } = {}): PublishService {
  const set = content();
  const bundle = buildBundle(
    {
      ...set,
      site: {
        ...set.site,
        contact: { ...set.site.contact, email: options.email ?? 'studio@example.com' },
      },
    },
    [],
    'https://media.example.com',
    'https://example.com',
    undefined,
    'https://admin.example.com',
  );

  return {
    publishedSnapshot: () =>
      options.published === false
        ? Promise.reject(new ApiException(404, 'Nothing has been published yet.'))
        : Promise.resolve({
            revision: 1,
            bundle: JSON.stringify(bundle),
            publishedAt: '2026-01-01 00:00:00',
          }),
  } as unknown as PublishService;
}

const BLANK = { from: '', name: '', message: '', website: '', locale: '' };

describe('sending one', () => {
  it('sends to the address the published content names, replying to the sender', async () => {
    const mailer = new Recorder();
    const service = new ContactService(publisher({ email: 'studio@cafa.test' }), mailer, undefined);

    const outcome = await service.send(
      { ...BLANK, from: 'ada@example.com', name: 'Ada', message: 'Hello.' },
      '203.0.113.1',
    );

    expect(outcome.accepted).toBe(true);
    expect(mailer.sent).toHaveLength(1);
    // The recipient is content, not a parameter: this is what stops the
    // endpoint being a relay for anyone who can post to it.
    expect(mailer.sent[0]?.to).toBe('studio@cafa.test');
    expect(mailer.sent[0]?.replyTo).toBe('ada@example.com');
    expect(mailer.sent[0]?.text).toContain('Hello.');
  });

  it('drops a message that filled the honeypot, and says nothing about it', async () => {
    const mailer = new Recorder();
    const service = new ContactService(publisher(), mailer, undefined);

    const outcome = await service.send(
      { ...BLANK, from: 'bot@example.com', message: 'Buy things.', website: 'http://spam' },
      '203.0.113.1',
    );

    // A 200 with nothing sent. Telling a bot it was caught is telling it what
    // to change.
    expect(outcome.accepted).toBe(true);
    expect(mailer.sent).toHaveLength(0);
  });

  it('refuses over the limit before it reads the published content', async () => {
    const mailer = new Recorder();
    const limiter: RateLimiter = { limit: () => Promise.resolve({ success: false }) };
    const service = new ContactService(publisher(), mailer, limiter);

    const outcome = await service.send(
      { ...BLANK, from: 'ada@example.com', message: 'Hello.' },
      '203.0.113.1',
    );

    expect(outcome).toMatchObject({ accepted: false, status: 429 });
    expect(mailer.sent).toHaveLength(0);
  });

  it('hands a malformed address back as something the sender can fix', async () => {
    const service = new ContactService(publisher(), new Recorder(), undefined);

    const outcome = await service.send(
      { ...BLANK, from: 'not-an-address', message: 'Hello.' },
      null,
    );

    expect(outcome).toMatchObject({ accepted: false, status: 400 });
  });

  it('says the form is not set up rather than pretending to send', async () => {
    const service = new ContactService(
      publisher(),
      new Recorder({ sent: false, reason: 'not-configured' }),
      undefined,
    );

    const outcome = await service.send(
      { ...BLANK, from: 'ada@example.com', message: 'Hello.' },
      null,
    );

    // Not a 200. A form that silently drops messages is worse than no form:
    // the studio believes it is receiving mail and the sender believes they
    // have sent some.
    expect(outcome).toMatchObject({ accepted: false, status: 503 });
  });

  it('has no endpoint before the site has been published', async () => {
    const service = new ContactService(publisher({ published: false }), new Recorder(), undefined);

    await expect(
      service.send({ ...BLANK, from: 'ada@example.com', message: 'Hello.' }, null),
    ).rejects.toMatchObject({ code: 503 });
  });

  it('titles the message in the language the card was read in', async () => {
    const mailer = new Recorder();
    const service = new ContactService(publisher(), mailer, undefined);

    await service.send(
      { ...BLANK, from: 'ada@example.com', message: 'Hello.', locale: 'zh' },
      null,
    );
    await service.send(
      { ...BLANK, from: 'ada@example.com', message: 'Hello.', locale: 'klingon' },
      null,
    );

    // The fixture's two dictionaries carry the same words, so what is asserted
    // is that an unknown locale falls back rather than reaching for undefined.
    expect(mailer.sent).toHaveLength(2);
    expect(mailer.sent[1]?.subject).toBe(mailer.sent[0]?.subject);
  });
});
