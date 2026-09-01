/**
 * POST /api/save
 *
 * The content set goes over whole in both directions. It is 39 KB, and sending
 * all of it is simpler than describing which parts changed and cheaper than
 * getting that description wrong.
 *
 * Only the write is a route of its own. The read is answered by `/api/session`
 * and by `/auth/login`, because the editor never wants the content without also
 * wanting to know whose session is holding it — see the session DTO.
 */
import { parseSaveRequest, type SavedResponse } from '../models/dtos/content.dtos';
import type { ContentService } from '../services/content.service';
import { ApiResponse } from '../shared/api-response';
import { readJson } from '../shared/request-body';
import type { AuthorizedContext } from '../shared/router';

export class ContentController {
  constructor(private readonly content: ContentService) {}

  save = async ({ request }: AuthorizedContext): Promise<ApiResponse<SavedResponse>> => {
    const content = parseSaveRequest(await readJson(request));
    await this.content.save(content);
    return ApiResponse.ok({ saved: true as const }, 'Saved.');
  };
}
