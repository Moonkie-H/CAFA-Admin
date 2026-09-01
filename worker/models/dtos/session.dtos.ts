/**
 * What the editor is told about its own session.
 *
 * A login, and the content that login is there to edit. The two travel together
 * because they are one question — "who am I and what am I editing" — and asking
 * it as two requests cost a full round trip before the first field could be
 * drawn: the second could not start until the first had answered, because until
 * it has there is no session to read the content with.
 *
 * There is no token in here and nothing else worth putting in the cookie: the
 * password is verified once, at sign-in, and from then on the sealed name is
 * the entire session.
 */
import type { ContentResponse } from './content.dtos';

export interface SessionResponse extends ContentResponse {
  login: string;
}

/**
 * The answer to signing out.
 *
 * A body with something in it rather than a 204, because every other endpoint
 * here answers the envelope and the client unwraps `data` — a null payload is
 * how this client says "the server returned no data", i.e. a failure.
 */
export interface SignedOutResponse {
  signedOut: true;
}
