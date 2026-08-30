/**
 * POST /api/v1/contact
 *
 * The one public endpoint that is not a read, and the only place in this Worker
 * where a stranger causes anything to happen. It is on `/api/v1/` because it is
 * part of the same public surface a frontend is handed, and it is *not* in the
 * connector registry because everything in that list is a GET view of the
 * published content — see worker/connectors/registry.ts, which says so. It is
 * still described in api.json; the document is compiled from the registry plus
 * this one declaration, so it stays what the Worker will actually answer.
 *
 * Answers wear the `ApiResponse` envelope rather than the connectors' bare
 * `{ revision, data }`. That is the right way round: this has a message in it
 * for a person — "that does not look like an email address" is going straight
 * back onto the card under the field — and the envelope is exactly the shape
 * that carries one.
 */
import type { ContactRequest, ContactResponse } from '../models/dtos/contact.dtos';
import type { ContactService } from '../services/contact.service';
import { ApiResponse } from '../shared/api-response';
import { readJson } from '../shared/request-body';
import type { RequestContext } from '../shared/router';

/** Generous for prose, small enough that a thousand of them cost nothing. */
const MAX_BODY_BYTES = 32 * 1024;

/** A field off an untrusted body, as a string, whatever arrived. */
function field(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === 'string' ? value : '';
}

export class ContactController {
  constructor(private readonly contact: ContactService) {}

  send = async ({ request }: RequestContext) => {
    const body = (await readJson(request, MAX_BODY_BYTES)) as Record<string, unknown> | null;
    if (typeof body !== 'object' || body === null) {
      return ApiResponse.fail(400, 'That is not a message.');
    }

    const submission = {
      from: field(body, 'from'),
      name: field(body, 'name'),
      message: field(body, 'message'),
      website: field(body, 'website'),
      locale: field(body, 'locale'),
    } satisfies Record<keyof Required<ContactRequest>, string>;

    // Cloudflare sets this at the edge and it cannot be spoofed by the caller —
    // a header of the same name on the way in is overwritten.
    const outcome = await this.contact.send(submission, request.headers.get('CF-Connecting-IP'));

    return outcome.accepted
      ? ApiResponse.ok<ContactResponse>({ sent: true }, 'Message sent.')
      : ApiResponse.fail(outcome.status, outcome.reason);
  };
}
