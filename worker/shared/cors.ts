/**
 * Who may reach the public half of the API from a browser.
 *
 * The read API exists to be called from another origin — that is the whole
 * point of handing api.json to whoever is building the frontend — so those
 * routes answer any origin. It costs nothing: every one of them serves content
 * that is already on the public website, and none of them looks at the session
 * cookie, so there is no authority for a hostile page to borrow.
 *
 * `/api/v1/contact` is under the same prefix and is the one entry that is not a
 * read. It is still `*`, and for the same reason rather than in spite of it: it
 * looks at no cookie either, so a hostile page posting to it is a stranger with
 * a form, which is what the endpoint is for. Its own guards — the honeypot, the
 * rate limit, the fixed recipient out of published content — are what bound it,
 * and none of them is an origin check. An allowlist here would read as security
 * and provide none: `Origin` is set by the browser for a browser's benefit, and
 * anything that is not a browser simply omits it.
 *
 * The authenticated half is deliberately left out. It answers no cross-origin
 * caller at all, which is what stops a page somewhere else from acting as the
 * signed-in studio in a browser that has the cookie.
 *
 * Applied at the dispatcher rather than in the controller so that a 404 from a
 * mistyped path, or a 405 from the wrong verb, is *readable* cross-origin.
 * Without the header on the error too, a failed request reads as a CORS fault
 * in the console and the actual message never reaches the developer.
 */

/** The paths any origin may reach: the compiled document and the v1 surface. */
export function isPublicRoute(url: URL): boolean {
  return url.pathname === '/api.json' || url.pathname.startsWith('/api/v1/');
}

/**
 * The answer to a preflight.
 *
 * Only one route provokes one. A cross-origin GET of a connector is a simple
 * request and never asks; posting JSON to `/api/v1/contact` sets a
 * `Content-Type` that is not on the simple list, so the browser asks first and
 * a Worker that cannot answer OPTIONS fails the request before the POST is ever
 * sent. Answered at the dispatcher, above the router, because a preflight is
 * not a route — it is a question about one.
 *
 * A day of caching, so a card that is opened repeatedly asks once.
 */
export function preflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * The same response, readable from anywhere.
 *
 * Rebuilt rather than mutated because a response that came back from a binding
 * can have immutable headers, and this runs over every kind of answer the
 * public routes produce.
 */
export function allowAnyOrigin(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
