/**
 * The server half of the admin — composition root and nothing else.
 *
 * It holds two things the browser must not: the session, and the only writable
 * handle on the content. What is left in this file is the wiring: build the
 * services, build the controllers, declare the routes, dispatch. Every question
 * about *what* a route does is answered one layer down.
 *
 *   controllers/   HTTP in, HTTP out. No SQL, no bucket, no business rule.
 *   services/      The rules. Throw ApiException; never build a Response.
 *   repositories/  D1. Rows in, domain objects out.
 *   storage/       R2.
 *   domain/        Pure: the bundle projection, the cookie seal, image headers.
 *   connectors/    The public read API, declared: routes, shapes, api.json.
 *   shared/        The envelope, the exception, the filter, the router.
 *
 * Dependencies point down only. A repository has never heard of a Request.
 */
import { CONTACT_PATH } from './connectors/contact-endpoint';
import { DOCUMENT_PATH, CONNECTORS } from './connectors/registry';
import { AuthController } from './controllers/auth.controller';
import { ConnectorsController } from './controllers/connectors.controller';
import { ContactController } from './controllers/contact.controller';
import { ContentController } from './controllers/content.controller';
import { MediaController } from './controllers/media.controller';
import { PublicContentController } from './controllers/public-content.controller';
import { PublishController } from './controllers/publish.controller';
import { RevisionsController } from './controllers/revisions.controller';
import { SessionController } from './controllers/session.controller';
import { readSession } from './domain/session';
import type { Env } from './env';
import { AuthService } from './services/auth.service';
import { ConnectorService } from './services/connector.service';
import { ContactService } from './services/contact.service';
import { ContentService } from './services/content.service';
import { ResendMailer } from './services/mailer';
import { DeployService } from './services/deploy.service';
import { MediaService } from './services/media.service';
import { PublishService } from './services/publish.service';
import { ApiException } from './shared/api-exception';
import { ApiResponse, toResponse } from './shared/api-response';
import { allowAnyOrigin, isPublicRoute, preflight } from './shared/cors';
import { applyExceptionFilter } from './shared/exception-filter';
import { Router } from './shared/router';

/**
 * The container, such as it is.
 *
 * Built per request, which is what a scoped lifetime means in a framework that
 * has one. It costs a handful of object allocations and no I/O — every service
 * here is a closure over bindings — and it buys the thing that matters: nothing
 * is shared between two requests by accident.
 */
function compose(env: Env, ctx: ExecutionContext): Router {
  const deploy = new DeployService(env, ctx);
  const auth = new AuthService(env);

  const content = new ContentService(env.DB, deploy);
  const media = new MediaService(env.DB, env.MEDIA);
  const publishing = new PublishService(env, deploy);

  const authController = new AuthController(auth, env.SESSION_SECRET);
  const sessionController = new SessionController();
  const contentController = new ContentController(content);
  const mediaController = new MediaController(media);
  const publishController = new PublishController(publishing);
  const revisionsController = new RevisionsController(publishing);
  const publicController = new PublicContentController(publishing, auth);
  const connectorsController = new ConnectorsController(new ConnectorService(publishing));
  const contactController = new ContactController(
    new ContactService(
      publishing,
      new ResendMailer({ token: env.CONTACT_TOKEN, sender: env.CONTACT_SENDER }),
      env.CONTACT_RATE,
    ),
  );

  const router = (
    new Router()
      // Sign-in. A username and a password checked here; the two routes that
      // set the cookie are the only ones that may be reached without it.
      .allowAnonymous('POST', '/auth/login', authController.login)
      .allowAnonymous('POST', '/auth/logout', authController.logout)

      // The two build-time reads. Unwrapped on purpose — see the controller.
      .allowAnonymous('GET', '/api/content/published', publicController.published)
      .allowAnonymous('GET', '/api/content/draft', publicController.draft)

      // Everything the editor does.
      .authorize('GET', '/api/session', sessionController.whoami)
      .authorize('GET', '/api/content', contentController.get)
      .authorize('POST', '/api/save', contentController.save)
      .authorize('GET', '/api/media', mediaController.get)
      .authorize('POST', '/api/media', mediaController.upload)
      .authorize('GET', '/api/status', publishController.status)
      .authorize('POST', '/api/publish', publishController.publish)
      .authorize('GET', '/api/revisions', revisionsController.list)
      .authorize('POST', '/api/revisions/:id/restore', revisionsController.restore)
  );

  // The public read API. Registered from the same list that compiles api.json,
  // so a connector cannot be documented without being routed or the reverse —
  // see worker/connectors/registry.ts.
  for (const connector of CONNECTORS) {
    router.allowAnonymous('GET', connector.path, connectorsController.action(connector));
  }
  router.allowAnonymous('GET', DOCUMENT_PATH, connectorsController.document);

  // The one public route that is not a read, and so the one that is not in the
  // registry above — everything in that list is a GET view of the published
  // content, and keeping the exception out of it is what lets the list say so
  // without qualification. It is registered here, beside them, because it is
  // the same public surface; api.json describes it from its own declaration in
  // worker/connectors/contact-endpoint.ts.
  router.allowAnonymous('POST', CONTACT_PATH, contactController.send);

  return router;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const open = isPublicRoute(url);

    // A preflight is a question about a route rather than a route, so it is
    // answered before the router is asked — which is also why the router still
    // knows only GET and POST. Only /api/v1/contact provokes one; the reads are
    // all simple requests.
    if (open && request.method === 'OPTIONS') return preflight();

    const answer = await respond(request, env, ctx, url);

    // Anything a frontend on another origin is meant to call says so here, in
    // one place, including its errors. Nothing else in the API answers a
    // cross-origin caller at all.
    return open ? allowAnyOrigin(answer) : answer;
  },
} satisfies ExportedHandler<Env>;

/** Match, authenticate, dispatch. Everything but who is allowed to read it. */
async function respond(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
): Promise<Response> {
  return applyExceptionFilter(async () => {
    const matched = compose(env, ctx).resolve(request, url);

    if (matched === null) {
      // An unclaimed /api path is a mistake worth naming. Anything else is a
      // client route, and the SPA's asset handler owns it.
      return url.pathname.startsWith('/api/')
        ? ApiResponse.fail(404, 'No such endpoint.')
        : env.ASSETS.fetch(request);
    }

    if (matched.kind === 'method-not-allowed') {
      return toResponse(
        ApiResponse.fail(405, `That endpoint takes ${matched.allowed.join(' or ')}.`),
        { Allow: matched.allowed.join(', ') },
      );
    }

    const context = { request, url, params: matched.params };
    if (matched.kind === 'anonymous') return matched.handler(context);

    const session = await readSession(request, env.SESSION_SECRET);
    if (session === null) throw ApiException.unauthorized('Not signed in.');

    return matched.handler({ ...context, user: { login: session.login } });
  }, request);
}
