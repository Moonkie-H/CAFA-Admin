# Building a frontend against this admin

`api.json` describes the read API completely and is generated from the routes
themselves, so it cannot describe an endpoint that does not exist. What it does
**not** describe is everything that is not an HTTP request: how the site gets its
content at build time, how photographs are actually rendered, and what the site
has to publish back so the admin can tell whether a deploy has landed.

Those four things are this document. Hand it over alongside `api.json`.

## First: which contract are you on

There are two, and picking the wrong one is the mistake this document mostly
exists to prevent.

**A build reads `/api/content/published`.** One request, at build time, for the
whole revision. This is what CAFA-Template does, and what any statically
generated site should do. The endpoint is unauthenticated, uncached, and
answers **outside** the `{ revision, data }` envelope every other endpoint uses:

```json
{ "revision": 42, "bundle": { "site": …, "works": […], … } }
```

`bundle` is the `Bundle` schema in `api.json`. The envelope is different here on
purpose — see the comment at the top of
[`worker/controllers/public-content.controller.ts`](../worker/controllers/public-content.controller.ts).
It is passed as an environment variable to the build:

```
CONTENT_API=https://admin.cafa-studio.com/api/content/published
```

**A client reads `/api/v1/*`.** The connectors in `api.json`, at request time,
any origin, one minute of edge cache, wearing the `{ revision, data }` envelope.
Use these for anything fetched from a browser after the page has loaded.

Both read the same published revision. If the site is statically generated, the
`/api/v1/*` endpoints are not on its critical path at all — do not build pages
out of them because they are the ones that happen to be documented.

## Second: the bundle decides how a photograph is fetched

This is the one that fails silently, so it comes second only because the build
contract has to come first.

`Photograph.url`, and `mediaBase` on the bundle, resolve an object key against
`media.cafa-studio.com`, which serves R2 originals — full-size, straight off the
bucket. Whether an `<img src>` may point at one is not your decision and not a
constant. It is one boolean, published alongside the origin:

```json
{ "mediaBase": "https://media.cafa-studio.com", "mediaTransform": true }
```

**`mediaTransform: true`** — the arrangement this site is designed around. Every
photograph goes through Cloudflare's image transformations, and pointing an
`<img src>` straight at an original is a bug:

```
/cdn-cgi/image/<options>/<absolute source url>
```

**`mediaTransform: false`** — the zone cannot transform, so `/cdn-cgi/image/`
answers with something that is not an image. Render `<mediaBase>/<key>` as it
is. The photographs are the ≤2400px versions the editor downscales to on
upload, so this is a page that costs more bytes, not a page that is broken.

Read the field. Hard-coding either branch means the site breaks on the day the
zone's plan changes, in the direction that is hardest to notice.

Three things about this are load-bearing:

- **`/cdn-cgi/image/` runs on the zone serving the page**, not on the media
  origin. The path is relative to the site's own hostname; the source URL inside
  it is absolute. `media.cafa-studio.com` is a subdomain of the same zone
  specifically so this costs no second TLS handshake on the LCP path.
- **Image Transformations are a paid-plan zone setting** (Images →
  Transformations). That is why the flag exists: on a Free zone the setting
  reads back as not editable, and no token or API call turns it on. `MEDIA_TRANSFORM`
  in CAFA-Admin's `wrangler.jsonc` is where the answer is set, and it reaches
  the site only through a redeploy *and* a publish — the bundle is a snapshot,
  so a var changed after the last publish is not yet in the revision you read.
- **Nothing downstream notices a mismatch.** With the flag on and the zone off,
  the site builds, deploys and renders with every image broken, and no layer in
  between reports anything. `npm run media` in CAFA-Admin is what detects it: it
  fetches a real published photograph the way a browser would — through the
  transformation, or not, according to the flag the deployed admin publishes —
  and names whichever link is down.

Every photograph arrives with `width` and `height` measured from the file at
upload rather than taken from the client, so they can be trusted as an aspect
box — set them on the `<img>` and the layout does not shift.

`alt` is `{ zh, en }` or the empty string. The empty string is not a missing
translation: it means the photograph carries no information and should be marked
decorative (`alt=""`, and out of the accessibility tree). `Photograph.decorative`
says the same thing as a boolean.

## Third: the site must publish `build-info.json`

The admin's control panel answers "is it live yet" by fetching
`<origin>/build-info.json` from each deployed origin and comparing what it finds
to the newest revision. The whole contract is one field:

```json
{ "revision": 42 }
```

Write it at build time, from the `revision` that came back with the content, to
the site's public root. It must be a number.

If the site does not serve this file the admin does not break — it reports the
live revision as unknown, permanently, and the studio loses the one signal that
tells them a publish has actually reached the public site. See
[`worker/services/deploy.service.ts`](../worker/services/deploy.service.ts).

## Fourth: the two deploy hooks

Publishing writes a revision. It does not, by itself, put anything on the air —
a rebuild does. The admin pokes a deploy hook to start one, fire-and-forget, and
the site's project has to provide the hook.

| Fired on | Secret on this side | Reads |
|---|---|---|
| Publish | `DEPLOY_HOOK_URL` | `/api/content/published` |
| Every save | `PREVIEW_DEPLOY_HOOK_URL` | `/api/content/draft` |

The preview is optional and worth deferring. When it exists it is a second
Workers Builds environment on the same repository, pointed at
`/api/content/draft` with a `PREVIEW_TOKEN` matching the secret here, sent as:

```
X-Preview-Token: <token>
```

`/api/content/draft` answers the same `{ revision, bundle }` shape as
`published`, but reads unpublished work — which is exactly what must not leak,
hence the token. Everything else in the API refuses it.

The ordering is circular if you fight it: the hook cannot exist before the
project does, and the project cannot build before something has been published.
Publish first, wire the hook second. The full sequence is in the README.

## Details worth knowing before you start

**Nothing is optional.** Every property in every schema is in `required` except
the fields a `PageSection` only has for some kinds. That is not laziness — the
editor refuses a save with a blank in it, both columns of every localised field
are `NOT NULL`, and the bundle is built by projection rather than by merge. You
do not need defensive defaults.

**A private work is listed but has no page.** It appears in `/api/v1/works` with
`cover.src` as the empty string and `media` empty. Those photographs are dropped
before a revision is written, so no URL for them ever leaves the database. Render
the listing; do not generate a route for it.

**The site has four pages, and the set is fixed.** `/api/v1/pages` answers with
an object, not a list: `home`, `works`, `programs`, `about`. Each is a design of
its own — the front page's statement holding a screen, the mentors read sideways,
the programmes stacking one at a time — so a fifth page is a route you write,
not a row the studio can add. What the studio owns is every word on the four:
each page's `title` and `description`, the front page's `statement` and
`gallery`, the `intro` paragraphs on programmes and about, and the
`mentorsTitle` and `projectsTitle` about sets over the people and the projects.

**The collections are not on the pages.** The works index is `/api/v1/works`,
the programme list is `/api/v1/programs`, the band of portraits is
`/api/v1/mentors`, and the grid at the foot of About is `/api/v1/projects`. A
page names a collection rather than carrying one, so adding a work changes three
pages and nothing in `pages` moves.

**The projects are not the works**, and `projectsTitle` used to head a second
drawing of the works index. It heads `/api/v1/projects` now: a picture, a title
and a short summary each, with no status, no year, no disciplines and no page.
Nothing routes to a project, so render its cards as figures rather than links,
and expect the list to be legitimately empty — a studio that has not filled it
in yet wants a shorter About page, not an empty frame under a heading.

**The nav is the pages' own titles.** There is no `site.nav` and no separate nav
label: the bar is Works, Programmes and About, in that order, each labelled by
`pages.<key>.title`. The one item that is not a page is Contact, which opens a
panel over the current page rather than leading anywhere — its label is
`contact.nav` in the dictionary.

**A page's own words are on the page, not in the dictionary.** Its title, its
prose and the headings over its parts belong to that page. `/api/v1/copy/{locale}`
is the chrome that appears on every page and belongs to none — the labels on a
work, the accessibility strings, the contact card, the footer, the 404.

**`contactEndpoint` is where the contact card posts**, or `null` where it has
nowhere to. It is on the bundle beside `mediaBase`, and for the same reason: it
is a fact about the deployment that a *browser* needs, so it travels with the
content rather than as a second environment variable on the frontend's side.
`POST` it `{ from, message, locale }` and it emails the studio at the address
printed on the card. `null` is not an error — it is a site whose admin has not
been told its own origin, or a revision published before the endpoint existed —
and the right answer to it is the one the card gave before: compose a `mailto:`
and hand the reader a draft. Do the same when a `POST` fails, carrying what was
already typed, so a message is never silently dropped.

A refusal comes back in the admin's `{ success, code, msg }` envelope with a
sentence written for whoever typed the message — "that does not look like an
email address". Show it. `429` is too many messages in a short window; `503` is
the studio's own configuration and means fall back to the draft.

**`site.url` is the site's own origin**, without a trailing slash, and every
canonical, hreflang, `og:url` and sitemap entry should resolve against it. It
comes from the admin's `PRODUCTION_URL`, so moving domains is one edit here
rather than an edit plus a hand-written `UPDATE` against D1.

**Fetch `api.json` over HTTPS.** The `servers` entry is derived from the origin
the document was fetched from. The scheme is forced to `https` for anything that
is not loopback, but the hostname is not — download it from the deployed admin,
not from a local `wrangler dev`, or the generated client points at localhost.

**Before the first publish, everything answers 404.** A revision is a snapshot;
until one exists there is nothing to read. That is a real state to handle in a
build script, not a misconfiguration.
