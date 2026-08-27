# CAFA-Admin

The editor and the backend for [CAFA-Template](https://github.com/Adventnl/CAFA-Template) —
the c.a.f.a atelier site. It lets the studio write every word on the site, add
works, programmes and people, and replace photographs without touching code,
then preview the result and publish it.

## How it works

One Cloudflare Worker serves both halves: the React editor as static assets, and
the API that owns the content. The content is in D1 and the photographs are in
R2. The site itself is a static export with no server runtime, so nothing is
read at request time — the content is fetched once, by the site's build. What is
published is also readable endpoint by endpoint over a [public read
API](#the-read-api), for anything else that wants the content.

```
studio edits  →  saved to the live tables  →  preview build reads the draft
                              ↓
                        studio publishes
                              ↓
        snapshot into a revision  →  deploy hook  →  production build
```

Saving writes the tables. Publishing copies them into an append-only `revision`
row and pokes a Cloudflare deploy hook; the production build reads the newest
revision. So there are two states, as there always were, and they are no longer
branches:

| | What it is | Where it shows up |
|---|---|---|
| The live tables | Where every save goes, immediately | The preview URL |
| The newest revision | What the public sees | cafa-studio.com |

Rolling back inserts a new revision holding an old one's content, so history is
append-only and anything that was ever live stays recoverable.

## What it will not let you do

The admin is deliberately narrower than a general CMS. Most of the constraints
the site's constitution sets are enforced in the form, and now also in the
schema, rather than discovered at build time:

- **Both languages, always.** Every piece of copy has a Chinese and an English
  column side by side, both `NOT NULL`. A blank in either blocks the save.
- **Alt text is required.** A `CHECK` constraint refuses an image whose
  description is half-filled. A photograph that genuinely carries no information
  is marked *decorative*, which is a deliberate choice rather than an omission.
- **Photographs are resized before upload.** The site never asks for anything
  above 2400px, so originals are scaled to fit that in the browser and
  re-encoded — which also drops the EXIF block and the GPS coordinates in it.
  Their dimensions are then measured again in the Worker, from the bytes,
  because they become the aspect box the site's CLS budget rests on.
- **And measured for colour on the way past.** The browser has just decoded the
  photograph to resize it, so it reads the dominant hue out of it in the same
  pass — an OKLCH angle, which is what the site's works index draws the band
  behind a hovered row from. That one number comes from the client rather than
  from the bytes, because a Worker has no decoder; the Worker checks it is an
  angle and the column checks again. A photograph with no hue to give, and one
  uploaded before this existed, both record nothing and get a neutral band.
- **A private work publishes nothing.** It is listed in the index and has no
  page; its cover and photographs are dropped when a revision is built, so no
  URL for them ever reaches a browser.
- **The locales and the site URL are not editable.** They are wired to the
  template's `lib/routes.ts` and to the deployment — the site URL literally so:
  it is the `PRODUCTION_URL` var, stamped into each published revision by
  `worker/domain/bundle.ts`.
- **You cannot add a page, and cannot rearrange one.** The site has four, and
  each is a design in CAFA-Template with its own layout and its own motion — the
  front page's statement holding a screen on its own, the mentors read sideways
  through a pinned window. A fifth page is that much drawing and that much
  animation, so it is a deploy over there. Every *word* on the four is here.

If a save would still produce content the site cannot build, the build fails and
the previous deploy keeps serving. The live site cannot be broken from here.

## The four pages, and the tree

The site has four pages, and the sidebar is those pages in the order a visitor
meets them. Each one is a screen holding the words written on it; the things a
page *shows* hang under it as a folder, because that is where they appear:

```
Home                       the statement, and the photographs under it
Works            ▸ 12      the words at the top, and every work
Programmes       ▸ 4       the words at the top, and every programme
About            ▸         the prose, the two headings
  Mentors        ▸ 6       the people, who are a band across About
Contact                    the studio's details, and the words on the card
General                    the footer, the missing-page notice, the rest
```

That is also the answer to "where do I change this word": the same place you
would look for it on the site. The three status words a work can carry are on
Works, because that is where they are read; the labels on the contact card are
on Contact, beside the address they label. What is left on **General** is what
belongs to no page — and the words nobody changes twice in a decade (the labels
down a work, the strings a screen reader hears) are shut behind one disclosure
there rather than mixed in with the four that do change.

| | Where |
|---|---|
| The line on the front page | **Home** |
| A new work, or removing one | **Works → Add a work**, or Remove on its row |
| The paragraphs above the programmes | **Programmes** |
| What About says about the studio | **About** |
| The heading over the people | **About**; the people themselves are under it |
| The footer | **General** |
| A fifth page | a design and a deploy in CAFA-Template |

## The two panels

The admin opens on the **control panel**: what is published, whether the draft
is ahead of it, whether each origin has caught up, and how much of everything
there is. It writes nothing. Publishing stays in the bar at the top, where it is
on every page.

The account menu in the header links to **Developer tools**, kept outside the
studio's editorial navigation. It is for whoever is building the frontend rather
than for the studio. It lists every public
endpoint, what comes back from it, and lets you send the request and read the
answer without leaving the page — and it offers `api.json`, which is what you
hand to the other repository.

## The read API

Alongside the editor's own authenticated routes there is a public, read-only
API — one GET per view of the content, no writes and no verbs but GET:

```
GET /api/v1/site              the studio, the locales, the media origin
GET /api/v1/pages             what is written on each of the four pages
GET /api/v1/revision          which snapshot you are reading, and when it went live
GET /api/v1/works             ?status=completed|in-progress|private
GET /api/v1/works/{slug}
GET /api/v1/programs          GET /api/v1/programs/{slug}
GET /api/v1/mentors           GET /api/v1/mentors/{slug}
GET /api/v1/copy/{locale}     every fixed word on the site, in one language
GET /api/v1/photographs       ?prefix=works/ — URLs, dimensions, hue, alt text
GET /api/v1/bundle            all of the above in one answer, ~40 KB
GET /api.json                 the OpenAPI 3.1 document, compiled from the above
```

Four things are true of all of them:

- **They answer the newest published revision.** Never the draft — an
  unpublished edit is exactly what should not be visible from outside, and the
  one endpoint that serves the draft still requires the preview build's token.
- **They answer `{ revision, data }`.** The revision travels with the data
  because a client that caches anything needs to know what it cached, and
  asking a second endpoint for it is a race. Failures answer the admin's
  ordinary `{ success, code, msg }` envelope, because a failure has a sentence
  in it worth showing to someone.
- **Any origin may read them.** They carry only what is already on the public
  website and none of them looks at the session cookie, so there is no
  authority for a hostile page to borrow. The authenticated half answers no
  cross-origin caller at all.
- **They do not serve photographs.** Content names a photograph by its object
  key; `mediaBase` on the bundle, or the `url` on each entry of
  `/api/v1/photographs`, resolves that key against `media.cafa-studio.com`. An
  `<img src>` reaches the CDN directly and nothing is proxied through the
  Worker. `mediaTransform` on the bundle says whether that URL is fetched
  through `/cdn-cgi/image/` first.

### api.json is compiled, not committed

There is no OpenAPI file in this repository, and that is deliberate. A checked-in
document is a second copy of the route table that nobody updates in the same
commit as the route. `worker/connectors/registry.ts` holds one array in which
each entry carries its path, its prose, the shape of its answer and the function
that produces it; `worker/index.ts` registers the routes from that array and
`/api.json` is built from it per request. So adding a connector routes it,
documents it, and gives it a card in the dev panel, in one edit — and the
document can never describe an endpoint the Worker does not answer.

The `servers` entry is the origin the document was fetched from, so the copy
downloaded from a local `wrangler dev` points at localhost and the copy
downloaded from the deployed admin points at the deployed admin. The scheme is
forced to `https` for anything that is not loopback, because `url.origin`
reports the scheme the *caller* used and a plain-HTTP fetch would otherwise bake
`http://` into every generated client.

### What api.json does not say

It describes the read API and nothing else, which leaves four things a frontend
needs and cannot infer: that a build should read `/api/content/published` rather
than the `/api/v1/*` connectors, that `mediaTransform` decides whether a
photograph is fetched through `/cdn-cgi/image/` or straight from the bucket,
that the site must publish `build-info.json` for the control panel to know a
deploy landed, and how the two deploy hooks are wired.

[docs/Frontend.md](docs/Frontend.md) is those four things. Hand it over with
`api.json`.

## Checking that photographs load

Nothing in either repository serves an image. The site's HTML carries one URL
per photograph:

```
/cdn-cgi/image/<options>/https://media.cafa-studio.com/works/<slug>/01.jpg
```

and that URL resolves only if four things are true in the Cloudflare account —
the zone is active, the bucket exists, `MEDIA_BASE`'s hostname is an R2 custom
domain on it, and Image Transformations are enabled on the zone. **The middle
two fail silently.** Content publishes, the build fetches it, `next build`
writes correct HTML, the deploy goes green, and every photograph on the live
site is a broken image. There is no error anywhere to read.

The fourth is the one that cannot always be arranged. Image Transformations are
a paid-plan zone setting: on a Free zone the API reports `image_resizing` as
readable and **not editable**, so no token and no `--fix` turns it on.
`MEDIA_TRANSFORM` is the answer to that — set it to `"off"` and the published
bundle carries `mediaTransform: false`, which tells the site to render

```
https://media.cafa-studio.com/works/<slug>/01.jpg
```

directly instead. The photographs are the ≤2400px versions the editor
downscales to on upload, so the page costs more bytes and nothing else. Remove
the var once the zone can transform, redeploy, and publish once.

```sh
npm run media           # report
npm run media -- --fix  # repair what the API can repair, then report
```

It reads the bucket, `MEDIA_BASE`, `MEDIA_TRANSFORM` and `PRODUCTION_URL` out
of `wrangler.jsonc`, so it is checking the deployment rather than a second copy
of its hostnames. The last checks are the ones worth having: it takes a real
object key from what the admin has actually published and fetches it the way a
browser would — from the media origin, and then through the transformation if
that is what the site asks for — so passing is the site working rather than a
proxy for it. It reads the *deployed* Worker's `mediaBase` and `mediaTransform`
rather than this checkout's, so a var edited and never deployed shows up as the
mismatch it is.

Because it judges the zone against what the site publishes, it complains in
both directions: transformations off while the site asks for them is the broken
site, and transformations available while `MEDIA_TRANSFORM` says off is a note
rather than a failure — the site works, it is just paying for a fast path it
already has.

Exit code is 0 only when every link holds, so a deploy can gate on it.

## Setting it up

From nothing: a registered domain and these two repositories. The order below is
load-bearing in three places, each flagged where it matters.

Hostnames, decided once and wired everywhere:

| | |
|---|---|
| `cafa-studio.com` | the site — CAFA-Template's Worker, apex only |
| `admin.cafa-studio.com` | this editor |
| `media.cafa-studio.com` | the R2 bucket, so transformations have an origin |

### 1. The zone

Add `cafa-studio.com` to Cloudflare as a zone and move its nameservers at the
registrar. **Nothing else in this list works until the zone is active** — custom
domains, the R2 domain and image transformations all hang off it.

Then, on the zone: turn on **Image Transformations** (Images → Transformations),
and add a **redirect rule** sending `www.cafa-studio.com` to the apex, 301.

Transformations are the one that fails invisibly. Every photograph on the site
is served through `/cdn-cgi/image/…`, so with it off the site builds, deploys
and renders with every image broken. `npm run media` is the check that catches
it — see [Checking that photographs load](#checking-that-photographs-load).

**They are a paid-plan setting.** If the zone is on Free, that page offers an
upgrade rather than a switch, and the API reports the setting as not editable.
Set `"MEDIA_TRANSFORM": "off"` in `wrangler.jsonc` and the site renders the
originals from R2 instead — larger files, working page — until the zone is on a
plan that can transform them.

### 2. The database and the bucket

```sh
npx wrangler d1 create cafa-content     # paste the id into wrangler.jsonc
npx wrangler r2 bucket create cafa-media
npx wrangler d1 migrations apply cafa-content --remote
```

`database_id` in `wrangler.jsonc` ships as a placeholder, because it is specific
to your account. The first command prints the real one; nothing works until it
is pasted in.

Then connect **`media.cafa-studio.com`** to the bucket in its R2 settings, so it
matches `MEDIA_BASE` in `wrangler.jsonc`. A subdomain of the site's own zone on
purpose: `/cdn-cgi/image/` runs on the zone serving the page, so an origin
inside that same zone costs no second TLS handshake on the LCP path.

That click and the transformations toggle above are the two steps in this
runbook that nothing downstream complains about when they are skipped, so both
can be done — and checked — with one command instead:

```sh
export CLOUDFLARE_API_TOKEN=…    # Zone:Read + Workers R2 Storage:Read to look
export CLOUDFLARE_ACCOUNT_ID=…   # + Zone Settings:Edit, R2:Edit, DNS:Edit to fix
npm run media -- --fix
```

### 3. The content

There is nothing to import. The migrations create the four pages blank, and the
studio fills them in: **Home**, **Works**, **Programmes** and **About** each
want a title and a description, the front page wants its statement, and the two
pages that open with prose want at least one paragraph. Until they have them the
save is refused and says which field is empty, which is the same list you would
have had to write an importer against.

Works, programmes and mentors are added the same way, and their photographs are
uploaded through the form — which is where they get resized, stripped of their
EXIF block and measured, so a photograph put in the bucket by hand would be
missing the dimensions the site's layout rests on.

The one-shot importer that moved the original six JSON files into this database
has been deleted. It was a script that ran once, against a shape neither
repository has any more; the record of what it did is
`migrations/0001_initial.sql` and the migrations after it.

### 4. The password

There is one account. It signs in with a username and a password, both checked
by this Worker — no third party, nothing to register, and nothing that has to be
told when the admin's hostname changes.

The password is never stored. What is stored is a PBKDF2-SHA256 verifier, which
this prints and does not keep:

```sh
npm run set-password
```

It asks twice, with the echo off, and hands back one line to paste in the next
step. The format is `pbkdf2$sha256$<iterations>$<salt>$<key>`, read back by
`worker/domain/password.ts`; the iteration count travels inside the hash, so
raising it later does not invalidate a password set today.

### 5. Secrets

Only the first three are needed to get the admin working. The deploy hooks come
later, in step 7, because the thing they point at does not exist yet.

```sh
npx wrangler secret put ADMIN_USERNAME            # what you type to sign in
npx wrangler secret put ADMIN_PASSWORD_HASH       # the line from step 4
npx wrangler secret put SESSION_SECRET            # 32+ random bytes
```

A secret takes effect immediately — changing the password is those two commands
again and no redeploy. It does *not* end sessions that are already open, because
a session is a sealed cookie rather than a row someone can delete.

`SESSION_SECRET` both signs and encrypts that cookie. Rotating it invalidates
every cookie at once, which is the way to sign everyone out in a hurry.

Until `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` are both set, sign-in answers
503 and says so, rather than letting anyone in.

**On brute force.** There is no attempt counter — a Worker has nowhere to keep
one without adding storage that exists for no other reason. What stands in for
it is the cost of a guess: 100,000 PBKDF2 iterations per attempt — the most the
Workers runtime will derive — paid by the Worker on every try, correct or not.
Choose a password long enough that this matters; if the admin ever has more than
one user, that is the moment to add Cloudflare's rate limiting in front of
`/auth/login`.

### 6. Deploy the admin, and publish once

```sh
npm install
npm run deploy
```

`wrangler deploy` creates `admin.cafa-studio.com` from the `routes` entry in
`wrangler.jsonc`. Sign in, confirm the content is there, and **press Publish**.

That first publish matters more than it looks. A revision is a *snapshot* of the
bundle, so until one exists `/api/content/published` answers 404 and the
template has nothing to build from. Publishing before the site exists is the
right way round.

### 7. The site

A Workers Builds project on **CAFA-Template**, building the default branch, with
one environment variable:

```
CONTENT_API=https://admin.cafa-studio.com/api/content/published
```

Its `wrangler.jsonc` binds the apex, so the first successful build is also what
puts `cafa-studio.com` on the air.

Then close the loop: create a **deploy hook** for that project and store it back
here, so publishing rebuilds the site instead of only writing a revision.

```sh
npx wrangler secret put DEPLOY_HOOK_URL
```

This is the third ordering that matters, and it is circular if you fight it: the
hook cannot exist before the project does, and the project cannot build before
something has been published. Publish first, wire the hook second.

### 8. The preview — optional, and worth deferring

A second Workers Builds environment on the same repository, env
`CONTENT_API=https://admin.cafa-studio.com/api/content/draft` plus a
`PREVIEW_TOKEN` matching the secret below. Its deploy hook becomes
`PREVIEW_DEPLOY_HOOK_URL`, and its alias becomes `PREVIEW_URL` in
`wrangler.jsonc`; until that is set the admin simply shows no preview link.

```sh
npx wrangler secret put PREVIEW_TOKEN             # lets the preview read the draft
npx wrangler secret put PREVIEW_DEPLOY_HOOK_URL   # rebuilds the preview on save
```

The preview never answers on the custom domain — only the production deployment
does — so it keeps its own alias URL and the apex keeps serving whatever was
last published.

Both are optional. Without them there is no preview, and everything else works.

## Developing

```sh
npm install
npm run dev        # wrangler dev, Worker + SPA together on :8787
npm run build      # typecheck, then build the SPA into dist/
npm run lint
```

Local development needs a `.dev.vars` file with the secrets above. It is
gitignored; do not commit it.

### Deploying a change to a database that already exists

```sh
npx wrangler d1 migrations apply cafa-content --remote
npm run deploy
```

**In that order, and close together.** Every migration here has been one the
Worker deployed after it depends on, and the gap between the two commands is the
only window in which the two disagree — a save landing in it would write nine
values into an eight-column table, or drop copy keys the new editor has and the
old one does not. It is a one-person admin and the window is a deploy, so this
costs nothing to get right.

Then open the admin and press **Publish** once. A migration changes what a
published revision would contain; until something is published, the live site is
still being built from the revision before it.

## Layout

The Worker is layered the way `veyra_api` is, because the same shape solves the
same problem: **dependencies point down only, and each layer is allowed to know
exactly one thing.** A controller knows HTTP and no SQL. A service knows the
rules and never builds a `Response`. A repository knows rows and has never heard
of a `Request`.

The editor is arranged on the same principle, one axis over. `components/` is
everything drawn more than once — the form vocabulary, the shapes a record is
edited in, the chrome — and none of it knows what a work is. `features/` is one
folder per screen, holding that screen and the components only it uses, and a
screen composes rather than draws. Data is behind `hooks/` and `services/`, and
no component fetches its own.

`shared/content/` is neither half's. It is the shape of the content and the
rules a save must satisfy, and both the browser and the Worker import it —
which is what keeps the arrow pointing one way on both sides rather than the
Worker reaching into the editor's folder for its own types.

```
migrations/
  0001_initial.sql          the schema, and the constraints that are really rules
  0002_…url_is_…config.sql  the site's origin stops being content
  0003_template_copy_sync…  the copy keys follow the template's Dictionary
  0004_media_tint.sql       a photograph's dominant hue, beside its dimensions
  0005_pages.sql            pages become content: the schema, and the four the
                            site already had, lifted out of the copy table
  0006_pages_are_code.sql   and back: the set of pages is the template's again,
                            every word on them still a row here
scripts/
  media-delivery.mjs        does the zone transform, and does the bucket answer
  set-password.mjs          a password in, the ADMIN_PASSWORD_HASH line out

worker/
  index.ts                  the composition root: build, declare routes, dispatch
  env.ts                    every binding and secret, in one interface

  shared/                   what veyra_api keeps in its Shared project
    api-response.ts         the { success, data, code, msg } envelope
    api-exception.ts        the one exception a service throws on purpose
    exception-filter.ts     where every throw becomes a response
    router.ts               the route table; [Authorize] and [AllowAnonymous]
    current-user.ts         who is asking
    cors.ts                 which paths any origin may read, and nothing else

  connectors/               the public read API, declared once
    registry.ts             every connector: path, prose, shape, and reader
    schema.ts               the shapes, as JSON Schema — mirrors shared/content/
    openapi.ts              api.json, compiled from the registry on the way out
    connector.ts            what a connector is

  controllers/              HTTP in, HTTP out — one per resource
    auth · session · content · media · publish · revisions · public-content
    connectors.controller.ts  one action, bound per connector, plus the document

  services/                 the rules
    auth · content · media · publish · deploy · connector

  repositories/             D1: rows in, domain objects out
    content.repository.ts   the unit of work — one batch, one transaction
    site · pages · works · programs · mentors · copy    one aggregate each
    pages.repository.ts     the four pages, and the words on each
    media · revision
    mapping.ts              paired columns ⇄ LocalisedText, four columns ⇄ ImageRef

  storage/media-storage.ts  R2
  models/rows.ts            the tables, as TypeScript sees them
  models/dtos/              request and response contracts
  domain/
    bundle.ts               what a published revision contains, and what it withholds
    image.ts                dimensions read from the file rather than trusted
    session.ts              AES-GCM sealed cookie — no session storage anywhere
    password.ts             PBKDF2 verification, and the one hash format
    base64url.ts            bytes ⇄ text, and a comparison that does not leak

shared/content/             owned by neither half; imported by both
  types.ts                  the records, and the blank ones every form starts from
  parse.ts                  an untrusted body into the exact editable shape
  validate.ts               every rule a save must satisfy, as phrases not sentences
  dictionary.ts             one word inside a dictionary, by a path the compiler checks
  images.ts                 the one walk of every photograph the content cites

src/
  App.tsx                   session, then content, then route — the three states
  routes.ts                 the route table, and the whole of the client router

  components/               drawn more than once; none of it knows what a work is
    fields/                 the form vocabulary — one control per file
      Field · TextField · NumberField · LocalisedField · SelectField · ImageField
      CopyFields            a run of dictionary words, edited where they appear
    records/                the shapes a *record* is edited in, not the fields in one
      Repeatable            a list that owns add, reorder, remove and replace
      RecordIndex           the numbered list a form is opened from, and one row
      ReorderControls · DeleteRecord
    layout/                 the chrome: header, workflow bar, the site as a tree
      AdminLayout · PublishBar · SiteNav · LanguageToggle
      RouteLink             a real <a> whose click is intercepted, in one place
    PageTextFields.tsx      the title and description every page carries
    ProblemList.tsx         what has to be fixed before this can be saved

  features/                 one folder per screen: the page, and what only it uses
    control/                ControlPanelPage · Tile
    home/                   HomePage — the statement, and the photographs under it
    works/                  WorksPage · WorkForm
    programs/               ProgramsPage · ProgramForm
    about/                  AboutPage — the prose, and the two headings
    mentors/                MentorsPage · MentorForm — the band across About
    contact/                ContactPage — the details, and the card's own words
    general/                GeneralPage — the footer, the 404, the rest
    dev/                    DevPanelPage · ConnectorCard · markdown
    history · session

  hooks/                    where data and the state around it live
    useEditor.ts            what has changed, and how it gets sent
    useRemote.ts            something read from the Worker, and its stale guard

  lib/                      pure helpers, no React
    image-prepare.ts        resize, strip EXIF, and read the dominant hue
    media-keys.ts           where a photograph is filed, as a key
    deployment.ts           whether an origin is serving what it should be
    format.ts · say.ts

  services/                 the only place the browser talks to the Worker
    http.ts                 unwraps the envelope; nothing else knows about fetch
    session · content · media · publish
    connectors.ts           reads api.json — the dev panel keeps no list of its own
```

### Why the envelope stops at the build endpoints

Every authenticated route answers in `ApiResponse<T>`. The two that a *build*
reads — `/api/content/published` and `/api/content/draft` — deliberately do not:
they answer a bare `{ revision, bundle }`, because that is a contract with a
different repository. CAFA-Template's `scripts/fetch-content.mjs` checks for
exactly that shape before `next build` starts. The envelope exists for a client
that branches on `success` and shows `msg` to a person; a build script that
exits non-zero is not that client, and wrapping those two would buy consistency
nobody reads at the cost of a lockstep deploy across two repositories.

Their *failures* still come back enveloped, because those go through the same
exception filter as everything else — and the build script exits on the status
code before it ever looks at the body.

### Why the whole content set goes over at once

It is 39 KB. Sending all of it is simpler than describing which parts moved and
cheaper than getting that description wrong. The write is a single `db.batch()`,
which D1 runs as one transaction — deletes ordered children-first and inserts
parents-first, so no statement in the batch leaves a dangling reference and no
build can catch a half-applied save.

### Why photographs upload before the save, not with it

They used to arrive in the same git commit as the record referencing them, which
is what made an edit atomic. A database gets that guarantee from a foreign key
instead, and a foreign key needs its target to exist — so the object goes to R2
and the row goes to `media` the moment a photograph is chosen, and the save that
names it comes after. A photograph uploaded and then abandoned is an orphan in
the bucket, which costs nothing at this volume and is the deliberate trade.

### The copy of the content types

`shared/content/types.ts` mirrors the template's `src/lib/types.ts` rather than
importing it, because the two repositories deploy separately and a shared
package for six interfaces would cost more than it saves. It diverges in two
places on purpose — `SiteContent` has no `locales` or `localeNames`, and
`Dictionary` has `localeName` — both because the admin's types should describe
what the admin can actually change. `worker/domain/bundle.ts` reconciles the
two when it builds a revision. The copy cannot drift dangerously: the template
re-parses every field at build time, so a mismatch fails the build and never
reaches the live site.

Which is also how the two are kept in step, and it is worth writing down because
it is the one maintenance job this repository has. When the template changes
what it reads — a heading that moved to another page, a form that grew four
labels — the sequence is always the same four edits:

1. `shared/content/types.ts`, so `Dictionary` says what the template's says.
2. `src/features/copy/CopyPage.tsx`, so the studio can reach the new field.
3. A migration, because copy keys are schema: the old ones are deleted and the
   new ones inserted with a default, since the template refuses to build on a
   blank.
4. `worker/connectors/schema.ts`, so `api.json` describes what it now answers.

Miss the first and the compiler says so. Miss the third and the site's next
build fails with the path to the missing key, which is the failure you want —
loud, before anything is served, with the previous deploy still up.
