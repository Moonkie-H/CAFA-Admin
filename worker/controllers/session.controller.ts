/**
 * GET /api/session
 *
 * The editor's first call, and now its only one before it can draw: it answers
 * who is signed in *and* the content they are signed in to edit. It answers 401
 * through the normal filter when there is no session, which is how the client
 * tells "signed out" from "broken".
 */
import type { SessionResponse } from '../models/dtos/session.dtos';
import type { ContentService } from '../services/content.service';
import { ApiResponse } from '../shared/api-response';
import type { AuthorizedContext } from '../shared/router';

export class SessionController {
  constructor(private readonly content: ContentService) {}

  whoami = async ({ user }: AuthorizedContext): Promise<ApiResponse<SessionResponse>> => {
    return ApiResponse.ok({ login: user.login, ...(await this.content.read()) });
  };
}
