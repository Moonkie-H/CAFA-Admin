/**
 * What the public site is built from.
 *
 * A published revision is not the editable content set — it is a projection of
 * it, and the difference is load-bearing in two ways.
 *
 * First, **a private work publishes nothing but its row in the index.** The
 * site lists private works and gives them no page; the guarantee that their
 * photographs never reach a browser lives here, where the data leaves the
 * database, rather than in the frontend that draws them.
 *
 * Second, **the parts of `site` that are not editable are added here.** The
 * locales and their names are wired to the template's lib/routes.ts and to the
 * deployment, so they are code rather than content — but what a language calls
 * itself in the switch is a word on a screen, so it lives in the copy table as
 * `localeName` and is lifted out into `site` here.
 *
 * The nav is not here, and does not need to be: the bar is the three inner
 * pages, in the order the template lays them out, each labelled by its own
 * title. So nothing in this repository holds a second list of words that could
 * disagree with the first.
 *
 * `contactEndpoint` is a third thing of the same kind, and the reason it is
 * here rather than an environment variable on the template's side is worth
 * stating: CAFA-Template has exactly one module that knows the admin exists,
 * and that module runs at build time. The contact card's form has to reach the
 * admin from a *browser*, so the address has to be in something the build
 * writes into the page — and the content bundle already is that thing. It comes
 * from ADMIN_URL. Absent means the site has no form and offers a `mailto:`
 * draft instead, which is what it did before this endpoint existed.
 *
 * `url` is the same kind of thing as the locales, and arrives the same way. It
 * is the origin the site is deployed on — every canonical, hreflang, og:url and
 * sitemap entry in the template is resolved against it — so it belongs to the
 * deployment, not to the content. It comes from PRODUCTION_URL, which is the
 * same value the admin already polls for build-info.json: one origin, named
 * once. Migration 0002 dropped the column it used to have.
 */
import {
  LOCALES,
  type ContentSet,
  type Dictionary,
  type Locale,
  type LocalisedText,
  type Mentor,
  type Program,
  type Project,
  type SiteContent,
  type SitePages,
  type Work,
} from '../../shared/content/types';
import { citedKeys } from '../../shared/content/images';
import { CONTACT_PATH } from './contact';
import type { MediaRow } from '../models/rows';

/**
 * Copy that describes the chrome rather than a page, and is lifted into `site`
 * instead of staying in the dictionary.
 */
type PageDictionary = Omit<Dictionary, 'localeName'>;

export interface PublishedBundle {
  site: SiteContent & {
    url: string;
    locales: Locale[];
    localeNames: LocalisedText;
  };
  /** The four pages, by name, each carrying the words written on it. */
  pages: SitePages;
  works: Work[];
  programs: Program[];
  mentors: Mentor[];
  /**
   * The grid on About. Its own collection rather than a second reading of
   * `works`: the heading over it always said projects, and now the records
   * under it are projects too. May be empty, which the site draws as no
   * section at all rather than as an empty frame.
   */
  projects: Project[];
  dictionaries: { zh: PageDictionary; en: PageDictionary };
  /**
   * What was measured about each photograph the published content cites, and
   * nothing about the ones it does not: the intrinsic size the template holds
   * an aspect box open with, and the dominant hue it draws the works index's
   * hover band from. `tint` is null for a monochrome photograph and for one
   * uploaded before the admin measured such things; the site reads both as no
   * hue and uses its neutral band.
   */
  media: Record<string, { width: number; height: number; tint: number | null }>;
  /** Where the originals live, so the template can build transform URLs. */
  mediaBase: string;
  /**
   * Where the contact card posts a message, or null where it cannot.
   *
   * Null is not a failure state, it is a site without a working form: the
   * template falls back to composing a `mailto:` and handing the reader a draft,
   * which is what it did before there was anywhere to post to. Making that the
   * documented shape rather than an empty string means a frontend has to decide
   * what to do about it rather than posting to "".
   */
  contactEndpoint: string | null;
  /**
   * Whether those URLs may go through `/cdn-cgi/image/`. False is not a
   * preference — it is a zone that cannot transform, and it tells the site to
   * point at the originals rather than at a path that answers 404.
   */
  mediaTransform: boolean;
}

/** A dictionary minus the chrome keys, which belong to `site` instead. */
function pageCopy(dictionary: Dictionary): PageDictionary {
  return {
    meta: dictionary.meta,
    a11y: dictionary.a11y,
    works: dictionary.works,
    work: dictionary.work,
    contact: dictionary.contact,
    notFound: dictionary.notFound,
    footer: dictionary.footer,
  };
}

/**
 * A private work keeps only what the index draws: its number, its title, its
 * year, its disciplines and the fact that it is private. No cover, no media,
 * no URL for either.
 */
function project(work: Work): Work {
  if (work.status !== 'private') return work;
  return {
    slug: work.slug,
    index: work.index,
    title: work.title,
    status: work.status,
    discipline: work.discipline,
    year: work.year,
    summary: work.summary,
    credits: work.credits,
    cover: { src: '', alt: '' },
    media: [],
  };
}

/**
 * `MEDIA_TRANSFORM`, as a decision rather than a string.
 *
 * Image Transformations are a zone setting, and on a Free zone it is readable
 * and not writable — no token and no API call turns it on. The site cannot see
 * the zone, so this is how it is told: absent means the documented setup, where
 * the zone transforms; the word `off` means it does not, and every photograph
 * should be requested straight from `mediaBase`.
 *
 * The asymmetry is deliberate. Only a value that plainly says off turns it off,
 * so a typo cannot quietly drop the whole site onto full-size originals — and
 * the opposite mistake, a var that says on for a zone that is not, is exactly
 * what `npm run media` fetches a real photograph to catch.
 */
export function transformsOn(value: string | undefined): boolean {
  const said = (value ?? '').trim().toLowerCase();
  return said !== 'off' && said !== 'false' && said !== '0';
}

/**
 * The address the contact card posts to, built from the admin's own origin.
 *
 * The path is `domain/contact`'s own constant, which the router also serves
 * from; a bundle that named a path the router does not answer would be a form
 * that posts into nothing.
 */
function contactEndpointFor(adminUrl: string | undefined): string | null {
  const origin = (adminUrl ?? '').trim().replace(/\/$/, '');
  return origin === '' ? null : `${origin}${CONTACT_PATH}`;
}

export function buildBundle(
  content: ContentSet,
  media: MediaRow[],
  mediaBase: string,
  siteUrl: string,
  mediaTransform: string | undefined,
  adminUrl: string | undefined,
): PublishedBundle {
  const works = content.works.map(project);

  // Only the photographs public content actually cites. A private work's
  // originals are in the bucket and in the media table; they are not in here,
  // so nothing published names them — not their size, not their colour. The
  // `publicOnly` flag is that guarantee: `citationIsPublic` in the walker is the
  // one place that knows a private work's citations do not publish.
  const cited = citedKeys(content, true);

  const measured: PublishedBundle['media'] = {};
  for (const row of media) {
    if (cited.has(row.key)) {
      measured[row.key] = { width: row.width, height: row.height, tint: row.tint };
    }
  }

  return {
    site: {
      ...content.site,
      // Trailing slash stripped for the same reason lib/media.ts strips one off
      // mediaBase: everything downstream resolves against it, and `new URL()`
      // against a base ending in a slash is not the same URL.
      url: siteUrl.replace(/\/$/, ''),
      locales: [...LOCALES],
      localeNames: { zh: content.zh.localeName, en: content.en.localeName },
    },
    pages: content.pages,
    works,
    programs: content.programs,
    mentors: content.mentors,
    projects: content.projects,
    dictionaries: { zh: pageCopy(content.zh), en: pageCopy(content.en) },
    media: measured,
    mediaBase,
    mediaTransform: transformsOn(mediaTransform),
    contactEndpoint: contactEndpointFor(adminUrl),
  };
}
