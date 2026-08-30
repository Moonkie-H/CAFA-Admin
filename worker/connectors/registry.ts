/**
 * Every connector there is.
 *
 * This list is the whole of the public read API. It is also, and this is the
 * reason it looks the way it does, the source api.json is compiled from — so
 * the document a frontend hands to its code generator cannot describe a route
 * that does not exist, or miss one that does.
 *
 * Everything here reads the newest *published* revision. Not the draft: an
 * unpublished edit is exactly what should not be visible from outside, and the
 * one endpoint that serves the draft has always required the preview build's
 * token. So a connector answers what is on the public site, which is also what
 * makes it safe to answer it to anyone.
 *
 * To add one: append it below. The route registers itself in worker/index.ts,
 * the document grows an entry, the dev panel grows a card.
 */
import { isWorkStatus, LOCALES, WORK_STATUSES } from '../../shared/content/types';
import { ApiException } from '../shared/api-exception';
import type { Connector, ConnectorGroup } from './connector';
import { photographsOf } from './photographs';
import { list, ref, shape, text, whole } from './schema';

/** Bumped when a connector's answer changes shape in a way a client would feel. */
export const API_VERSION = '4.0.0';

/** Where the compiled document is served. */
export const DOCUMENT_PATH = '/api.json';

/**
 * One record out of a published collection, or a 404 naming what was asked for.
 *
 * Four connectors do exactly this, and the message is the part worth having
 * once: "no published work called X" is what tells a frontend developer that
 * the slug is real but unpublished, rather than that the endpoint is broken.
 */
function bySlug<T extends { slug: string }>(
  records: readonly T[],
  slug: string,
  missing: (slug: string) => string,
): T {
  const found = records.find((candidate) => candidate.slug === slug);
  if (found === undefined) throw ApiException.notFound(missing(slug));
  return found;
}

export const GROUPS: readonly ConnectorGroup[] = [
  {
    name: 'Site',
    description:
      'The studio itself, the words on its four pages, and how fresh what you are reading is. Start here: `/api/v1/pages` is what is written on each page, and `/api/v1/site` carries the studio’s details, the locales and the media origin.',
  },
  {
    name: 'Works',
    description:
      'The works, as the index lists them and as a single page shows one. A private work appears in the list with no photographs at all.',
  },
  {
    name: 'Programmes',
    description: 'The teaching programmes, in the order the studio keeps them in.',
  },
  { name: 'Mentors', description: 'The people, and their portraits.' },
  {
    name: 'Projects',
    description:
      'The grid at the foot of the about page. A project is a picture, a name and a line or two — it has no page of its own, so nothing here resolves one by URL.',
  },
  {
    name: 'Text',
    description:
      'Every word on the site that is not a work, a programme or a mentor — one dictionary per language.',
  },
  {
    name: 'Photographs',
    description:
      'Where the pictures are, how big they are and what colour they are. The bytes are served from the media origin rather than through this API, so an `<img src>` points straight at the CDN and nothing is proxied.',
  },
  {
    name: 'Everything',
    description: 'The whole revision in one request, for a build that would rather not make eight.',
  },
];

export const CONNECTORS: readonly Connector[] = [
  {
    id: 'getSite',
    group: 'Site',
    path: '/api/v1/site',
    summary: 'The studio, its origin and its locales',
    description:
      'The chrome around every page: the studio’s name and contact details, the site’s own origin and the languages it is published in. The navigation is not here — the bar is Works, Programmes and About, in that order, each labelled by its own page title from `/api/v1/pages`.',
    returns: ref('Site'),
    read: ({ bundle }) => bundle.site,
  },

  {
    id: 'getPages',
    group: 'Site',
    path: '/api/v1/pages',
    summary: 'What is written on each of the four pages',
    description:
      'The site has four pages — home, works, programs, about — and the set is fixed: each is a route in the frontend with its own layout and its own motion, so a fifth is a design rather than a row. This answers with what is *written* on them: every page’s title and description, the front page’s statement and photographs, the paragraphs that open Programmes and About, and the two headings About sets over the mentors and the projects. The collections those pages draw — including `/api/v1/projects`, which is what sits under `projectsTitle` — are endpoints of their own.',
    returns: ref('Pages'),
    read: ({ bundle }) => bundle.pages,
  },

  {
    id: 'getRevision',
    group: 'Site',
    path: '/api/v1/revision',
    summary: 'Which snapshot you are reading',
    description:
      'The number of the newest published revision and when it went live. Every other connector returns this same number alongside its data, so this endpoint is for the case where the number is all you want — a poll that decides whether to refetch anything at all.',
    returns: shape({
      revision: whole('The newest published revision.'),
      publishedAt: text('When it was published, UTC, as "YYYY-MM-DD HH:MM:SS".'),
    }),
    read: ({ revision, publishedAt }) => ({ revision, publishedAt }),
  },

  {
    id: 'listWorks',
    group: 'Works',
    path: '/api/v1/works',
    summary: 'Every work',
    description:
      'The index, in the studio’s own numbering. A private work is included — it is listed on the site — but its cover and its photographs are empty, because they are dropped before a revision is written.',
    params: [
      {
        name: 'status',
        in: 'query',
        required: false,
        description: 'Keep only works in this state.',
        example: 'completed',
        values: WORK_STATUSES,
      },
    ],
    returns: list(ref('Work'), 'The works, in index order.'),
    read: ({ bundle }, { query }) => {
      const status = query.get('status');
      const works = [...bundle.works].sort((a, b) => a.index - b.index);
      if (status === null || status === '') return works;

      if (!isWorkStatus(status)) throw ApiException.badRequest(`Not a work status: ${status}.`);
      return works.filter((work) => work.status === status);
    },
  },

  {
    id: 'getWork',
    group: 'Works',
    path: '/api/v1/works/:slug',
    summary: 'One work',
    description:
      'A single work by its slug, in the same shape the index carries. Answers 404 for a slug that is not published — including one that exists in the draft and has not been published yet.',
    params: [
      {
        name: 'slug',
        in: 'path',
        required: true,
        description: 'The work’s slug, as the index gives it.',
        example: 'edible-house',
      },
    ],
    returns: ref('Work'),
    read: ({ bundle }, { params }) =>
      bySlug(
        bundle.works,
        params.slug ?? '',
        (slug) => `No published work called ${slug}.`,
      ),
  },

  {
    id: 'listPrograms',
    group: 'Programmes',
    path: '/api/v1/programs',
    summary: 'Every programme',
    description: 'The teaching programmes, in the order the studio keeps them in.',
    returns: list(ref('Program'), 'The programmes.'),
    read: ({ bundle }) => bundle.programs,
  },

  {
    id: 'getProgram',
    group: 'Programmes',
    path: '/api/v1/programs/:slug',
    summary: 'One programme',
    description: 'A single programme by its slug.',
    params: [
      {
        name: 'slug',
        in: 'path',
        required: true,
        description: 'The programme’s slug.',
        example: 'summer-atelier',
      },
    ],
    returns: ref('Program'),
    read: ({ bundle }, { params }) =>
      bySlug(bundle.programs, params.slug ?? '', (slug) => `No programme called ${slug}.`),
  },

  {
    id: 'listMentors',
    group: 'Mentors',
    path: '/api/v1/mentors',
    summary: 'Every mentor',
    description: 'The people, each with the portrait a `mentors` block draws.',
    returns: list(ref('Mentor'), 'The mentors.'),
    read: ({ bundle }) => bundle.mentors,
  },

  {
    id: 'getMentor',
    group: 'Mentors',
    path: '/api/v1/mentors/:slug',
    summary: 'One mentor',
    description: 'A single mentor by their slug.',
    params: [
      {
        name: 'slug',
        in: 'path',
        required: true,
        description: 'The mentor’s slug.',
        example: 'shen-zhibai',
      },
    ],
    returns: ref('Mentor'),
    read: ({ bundle }, { params }) =>
      bySlug(bundle.mentors, params.slug ?? '', (slug) => `No mentor called ${slug}.`),
  },

  {
    id: 'listProjects',
    group: 'Projects',
    path: '/api/v1/projects',
    summary: 'Every project',
    description:
      'The projects, in the order they are read across the foot of the about page. Each is a picture, a title and a short summary, and that is the whole record — a project has no status, no year and no page, because it is not a work. The grid may legitimately be empty, in which case the site omits the section rather than drawing an empty one.',
    returns: list(ref('Project'), 'The projects, in the studio’s order.'),
    read: ({ bundle }) => bundle.projects,
  },

  {
    id: 'getProject',
    group: 'Projects',
    path: '/api/v1/projects/:slug',
    summary: 'One project',
    description:
      'A single project by its slug. The slug is a stable key rather than a URL segment — the site never routes to a project — so this is for a client that already holds one and wants the record again.',
    params: [
      {
        name: 'slug',
        in: 'path',
        required: true,
        description: 'The project’s slug.',
        example: 'edible-house',
      },
    ],
    returns: ref('Project'),
    read: ({ bundle }, { params }) =>
      bySlug(bundle.projects, params.slug ?? '', (slug) => `No project called ${slug}.`),
  },

  {
    id: 'getCopy',
    group: 'Text',
    path: '/api/v1/copy/:locale',
    summary: 'The dictionary for one language',
    description:
      'Every fixed word on the *chrome* in the language asked for: the labels on a work, the accessibility strings, the contact card, the footer, the 404 page. A page’s own title, its prose and the headings over its parts are in `/api/v1/pages`, because they belong to that page rather than to the site around it.',
    params: [
      {
        name: 'locale',
        in: 'path',
        required: true,
        description: 'Which language.',
        example: 'en',
        values: LOCALES,
      },
    ],
    returns: ref('Dictionary'),
    read: ({ bundle }, { params }) => {
      const locale = params.locale ?? '';
      if (locale !== 'zh' && locale !== 'en') {
        throw ApiException.notFound(`No dictionary for ${locale}. The site is ${LOCALES.join(' and ')}.`);
      }
      return bundle.dictionaries[locale];
    },
  },

  {
    id: 'listPhotographs',
    group: 'Photographs',
    path: '/api/v1/photographs',
    summary: 'Every published photograph',
    description:
      'One flat list of everything the published content cites — the works’ covers and pages, the mentors’ portraits, the projects’ pictures, the galleries on the pages — each with an absolute URL, its intrinsic dimensions, its dominant hue and its alt text. A private work’s photographs are absent, because a published revision does not name them. The dimensions are measured from the file at upload rather than taken from the client, so they can be trusted as an aspect box.',
    params: [
      {
        name: 'prefix',
        in: 'query',
        required: false,
        description: 'Keep only keys that start with this. A key is the folder it was filed under when it was uploaded — "works/", "mentors/", "pages/" — and never changes afterwards, so an older photograph may sit under a folder no longer offered.',
        example: 'works/',
      },
    ],
    returns: list(ref('Photograph'), 'The photographs, grouped by what cites them.'),
    read: ({ bundle }, { query }) => {
      const prefix = query.get('prefix') ?? '';
      const photographs = photographsOf(bundle);
      return prefix === ''
        ? photographs
        : photographs.filter((photograph) => photograph.key.startsWith(prefix));
    },
  },

  {
    id: 'getBundle',
    group: 'Everything',
    path: '/api/v1/bundle',
    summary: 'The whole revision',
    description:
      'The four pages, the works, the programmes, the mentors, the projects, the studio, both dictionaries and every photograph’s dimensions, in one answer — around 40 KB. This is the same projection the site’s own build reads from /api/content/published; that endpoint keeps its unwrapped `{ revision, bundle }` shape because a build script in another repository parses it, and this one wears the envelope every other connector wears.',
    returns: ref('Bundle'),
    read: ({ bundle }) => bundle,
  },
];
