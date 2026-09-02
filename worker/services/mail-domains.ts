/**
 * Whether the domain a visitor typed can receive mail at all.
 *
 * `domain/contact.ts` checks that an address is *shaped* like one and is safe
 * to put in a header, and says plainly that it will not try to decide whether
 * the address is real. That remains true of a string on its own — but the half
 * after the `@` is not only a string, it is a name in a public database, and
 * asking that database is a real answer rather than a cleverer regex. It is
 * what catches the mistake people actually make: `gmial.com`, `hotmial.com`, a
 * fat-fingered `.con`. Those pass every pattern ever written and then bounce
 * silently a day later, by which time whoever wrote the message is gone.
 *
 * So this is the one part of checking an address that needs the network, which
 * is why it is a service and not in `domain/` — everything under there is pure
 * and stays that way.
 *
 * **A domain accepts mail if it has an MX record, or, failing that, an address
 * record.** The second half is not a courtesy: RFC 5321 §5.1 says a host with
 * an A or AAAA and no MX is its own mail exchanger, and small self-hosted
 * domains are still set up that way.
 *
 * **It fails open.** Anything that is not a definite "there is no such domain"
 * — a timeout, a resolver error, a malformed answer, DNSSEC failure — is
 * `unknown`, and the caller sends the message. Losing a real enquiry because a
 * resolver was slow costs the studio a student; letting one typo through costs
 * a bounce that the studio can see. That trade is not close.
 */

/** What the resolver was able to say. `unknown` is every kind of not-knowing. */
export type MailDomainVerdict = 'accepts' | 'refuses' | 'unknown';

export interface MailDomains {
  verdict(domain: string): Promise<MailDomainVerdict>;
}

/** Cloudflare's own resolver, over DNS-over-HTTPS with the JSON answer format. */
const RESOLVER = 'https://cloudflare-dns.com/dns-query';

/**
 * How long a lookup may hold a message up.
 *
 * The sender is watching a spinner on the card, so this is a budget rather than
 * a limit: past it the answer stops being worth waiting for and the message
 * goes anyway.
 */
const TIMEOUT_MS = 2_500;

/** NXDOMAIN — the resolver is certain there is no such name. RFC 1035 §4.1.1. */
const NAME_ERROR = 3;
/** NOERROR. An empty `Answer` under it means the name exists with no such record. */
const NO_ERROR = 0;

interface DnsAnswer {
  Status?: unknown;
  Answer?: unknown;
}

export class DnsMailDomains implements MailDomains {
  async verdict(domain: string): Promise<MailDomainVerdict> {
    const mx = await this.lookup(domain, 'MX');
    if (mx === 'found') return 'accepts';
    if (mx === 'unknown') return 'unknown';
    if (mx === 'no-such-name') return 'refuses';

    // The name exists but publishes no MX. RFC 5321 §5.1: an address record is
    // the mail exchanger then, which is the difference between refusing a small
    // self-hosted domain and delivering to it. Both families at once — the
    // answer is the same either way and one round trip is enough of a wait.
    const addresses = await Promise.all([this.lookup(domain, 'A'), this.lookup(domain, 'AAAA')]);
    if (addresses.includes('found')) return 'accepts';
    return addresses.includes('unknown') ? 'unknown' : 'refuses';
  }

  /**
   * One question to the resolver.
   *
   * Every failure mode collapses to `unknown`, including a non-200 and a body
   * that is not the shape it should be: a resolver having a bad afternoon must
   * not become the site refusing everybody's address.
   */
  private async lookup(
    domain: string,
    type: 'MX' | 'A' | 'AAAA',
  ): Promise<'found' | 'none' | 'no-such-name' | 'unknown'> {
    let payload: DnsAnswer;
    try {
      const answer = await fetch(`${RESOLVER}?name=${encodeURIComponent(domain)}&type=${type}`, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!answer.ok) return 'unknown';
      payload = await answer.json();
    } catch {
      return 'unknown';
    }

    const { Status: status, Answer: records } = payload;
    if (status === NAME_ERROR) return 'no-such-name';
    if (status !== NO_ERROR) return 'unknown';
    // A CNAME chain arrives in the same array, so "found" means a record of the
    // type asked for and not merely a non-empty answer.
    return Array.isArray(records) && records.some((record) => isType(record, type))
      ? 'found'
      : 'none';
  }
}

/** The numeric RR types, because a JSON answer reports `type` as a number. */
const TYPE_NUMBERS = { A: 1, AAAA: 28, MX: 15 } as const;

function isType(record: unknown, type: keyof typeof TYPE_NUMBERS): boolean {
  return (
    typeof record === 'object' &&
    record !== null &&
    (record as { type?: unknown }).type === TYPE_NUMBERS[type]
  );
}
