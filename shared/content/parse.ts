/** Runtime parsing for content crossing the HTTP boundary. */
import {
  isWorkStatus,
  WORK_STATUSES,
  type AboutPage,
  type ContentSet,
  type Dictionary,
  type HomePage,
  type ImageRef,
  type LocalisedText,
  type Mentor,
  type PageText,
  type Program,
  type ProgramsPage,
  type Project,
  type SiteContent,
  type SitePages,
  type Work,
  type WorkStatus,
} from './types';

const MAX_LIST_LENGTH = 1_000;
const MAX_TEXT_LENGTH = 100_000;

export class ContentShapeError extends Error {
  constructor(path: string, expected: string) {
    super(`${path} must be ${expected}.`);
    this.name = 'ContentShapeError';
  }
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContentShapeError(path, 'an object');
  }
  return value as Record<string, unknown>;
}

function property(record: Record<string, unknown>, key: string, path: string): unknown {
  if (!Object.hasOwn(record, key)) throw new ContentShapeError(`${path}.${key}`, 'present');
  return record[key];
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new ContentShapeError(path, 'a string');
  if (value.length > MAX_TEXT_LENGTH) {
    throw new ContentShapeError(path, `at most ${MAX_TEXT_LENGTH.toLocaleString()} characters`);
  }
  return value;
}

function numberAt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ContentShapeError(path, 'a finite number');
  }
  return value;
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ContentShapeError(path, 'an array');
  if (value.length > MAX_LIST_LENGTH) {
    throw new ContentShapeError(path, `an array of at most ${MAX_LIST_LENGTH.toLocaleString()} items`);
  }
  return value;
}

function stringsAt(record: Record<string, unknown>, path: string, keys: readonly string[]) {
  return Object.fromEntries(
    keys.map((key) => [key, stringAt(property(record, key, path), `${path}.${key}`)]),
  );
}

function localisedAt(value: unknown, path: string): LocalisedText {
  const record = objectAt(value, path);
  return {
    zh: stringAt(property(record, 'zh', path), `${path}.zh`),
    en: stringAt(property(record, 'en', path), `${path}.en`),
  };
}

function imageAt(value: unknown, path: string): ImageRef {
  const record = objectAt(value, path);
  const rawAlt = property(record, 'alt', path);
  return {
    src: stringAt(property(record, 'src', path), `${path}.src`),
    alt: rawAlt === '' ? '' : localisedAt(rawAlt, `${path}.alt`),
  };
}

/** The list of paragraphs a page's prose is authored in. */
function paragraphsAt(value: unknown, path: string): LocalisedText[] {
  return arrayAt(value, path).map((paragraph, index) =>
    localisedAt(paragraph, `${path}[${index}]`),
  );
}

/** The two lines every page carries. */
function pageTextAt(record: Record<string, unknown>, path: string): PageText {
  return {
    title: localisedAt(property(record, 'title', path), `${path}.title`),
    description: localisedAt(property(record, 'description', path), `${path}.description`),
  };
}

function homeAt(value: unknown, path: string): HomePage {
  const record = objectAt(value, path);
  return {
    ...pageTextAt(record, path),
    statement: localisedAt(property(record, 'statement', path), `${path}.statement`),
    gallery: arrayAt(property(record, 'gallery', path), `${path}.gallery`).map((image, index) =>
      imageAt(image, `${path}.gallery[${index}]`),
    ),
  };
}

function programsPageAt(value: unknown, path: string): ProgramsPage {
  const record = objectAt(value, path);
  return {
    ...pageTextAt(record, path),
    intro: paragraphsAt(property(record, 'intro', path), `${path}.intro`),
  };
}

function aboutAt(value: unknown, path: string): AboutPage {
  const record = objectAt(value, path);
  return {
    ...pageTextAt(record, path),
    intro: paragraphsAt(property(record, 'intro', path), `${path}.intro`),
    mentorsTitle: localisedAt(property(record, 'mentorsTitle', path), `${path}.mentorsTitle`),
    projectsTitle: localisedAt(property(record, 'projectsTitle', path), `${path}.projectsTitle`),
  };
}

/**
 * The four pages, by name. Spelled out rather than looped over `PAGE_KEYS`,
 * because each one has different fields — which is the whole reason the set is
 * a type and not a list.
 */
function pagesAt(value: unknown, path: string): SitePages {
  const record = objectAt(value, path);
  return {
    home: homeAt(property(record, 'home', path), `${path}.home`),
    works: pageTextAt(
      objectAt(property(record, 'works', path), `${path}.works`),
      `${path}.works`,
    ),
    programs: programsPageAt(property(record, 'programs', path), `${path}.programs`),
    about: aboutAt(property(record, 'about', path), `${path}.about`),
  };
}

function workStatusAt(value: unknown, path: string): WorkStatus {
  if (typeof value !== 'string' || !isWorkStatus(value)) {
    throw new ContentShapeError(path, 'a supported work status');
  }
  return value;
}

function workAt(value: unknown, path: string): Work {
  const record = objectAt(value, path);
  return {
    slug: stringAt(property(record, 'slug', path), `${path}.slug`),
    index: numberAt(property(record, 'index', path), `${path}.index`),
    title: localisedAt(property(record, 'title', path), `${path}.title`),
    status: workStatusAt(property(record, 'status', path), `${path}.status`),
    discipline: arrayAt(property(record, 'discipline', path), `${path}.discipline`).map(
      (entry, index) => localisedAt(entry, `${path}.discipline[${index}]`),
    ),
    year: numberAt(property(record, 'year', path), `${path}.year`),
    summary: localisedAt(property(record, 'summary', path), `${path}.summary`),
    credits: arrayAt(property(record, 'credits', path), `${path}.credits`).map((credit, index) => {
      const creditPath = `${path}.credits[${index}]`;
      const entry = objectAt(credit, creditPath);
      return {
        role: localisedAt(property(entry, 'role', creditPath), `${creditPath}.role`),
        name: localisedAt(property(entry, 'name', creditPath), `${creditPath}.name`),
      };
    }),
    cover: imageAt(property(record, 'cover', path), `${path}.cover`),
    media: arrayAt(property(record, 'media', path), `${path}.media`).map((image, index) =>
      imageAt(image, `${path}.media[${index}]`),
    ),
  };
}

function programAt(value: unknown, path: string): Program {
  const record = objectAt(value, path);
  return {
    slug: stringAt(property(record, 'slug', path), `${path}.slug`),
    name: localisedAt(property(record, 'name', path), `${path}.name`),
    audience: localisedAt(property(record, 'audience', path), `${path}.audience`),
    duration: localisedAt(property(record, 'duration', path), `${path}.duration`),
    summary: localisedAt(property(record, 'summary', path), `${path}.summary`),
  };
}

function projectAt(value: unknown, path: string): Project {
  const record = objectAt(value, path);
  return {
    slug: stringAt(property(record, 'slug', path), `${path}.slug`),
    title: localisedAt(property(record, 'title', path), `${path}.title`),
    summary: localisedAt(property(record, 'summary', path), `${path}.summary`),
    image: imageAt(property(record, 'image', path), `${path}.image`),
  };
}

function mentorAt(value: unknown, path: string): Mentor {
  const record = objectAt(value, path);
  return {
    slug: stringAt(property(record, 'slug', path), `${path}.slug`),
    name: localisedAt(property(record, 'name', path), `${path}.name`),
    discipline: localisedAt(property(record, 'discipline', path), `${path}.discipline`),
    note: localisedAt(property(record, 'note', path), `${path}.note`),
    portrait: imageAt(property(record, 'portrait', path), `${path}.portrait`),
  };
}

function siteAt(value: unknown, path: string): SiteContent {
  const record = objectAt(value, path);
  const contactPath = `${path}.contact`;
  const contact = objectAt(property(record, 'contact', path), contactPath);
  return {
    name: localisedAt(property(record, 'name', path), `${path}.name`),
    contact: {
      email: stringAt(property(contact, 'email', contactPath), `${contactPath}.email`),
      wechat: stringAt(property(contact, 'wechat', contactPath), `${contactPath}.wechat`),
      address: localisedAt(property(contact, 'address', contactPath), `${contactPath}.address`),
      hours: localisedAt(property(contact, 'hours', contactPath), `${contactPath}.hours`),
    },
  };
}

export function parseDictionary(value: unknown, path = 'dictionary'): Dictionary {
  const root = objectAt(value, path);
  const group = (name: string) => objectAt(property(root, name, path), `${path}.${name}`);
  const meta = group('meta');
  const a11y = group('a11y');
  const works = group('works');
  const statusPath = `${path}.works.status`;
  const status = objectAt(property(works, 'status', `${path}.works`), statusPath);
  const work = group('work');
  const contact = group('contact');
  const notFound = group('notFound');
  const footer = group('footer');

  return {
    meta: stringsAt(meta, `${path}.meta`, ['titleTemplate']) as Dictionary['meta'],
    a11y: stringsAt(a11y, `${path}.a11y`, [
      'skipToContent', 'primaryNav', 'localeSwitch', 'worksList', 'worksRail', 'workPager', 'close',
    ]) as Dictionary['a11y'],
    works: {
      status: stringsAt(status, statusPath, WORK_STATUSES) as Record<WorkStatus, string>,
    },
    work: stringsAt(work, `${path}.work`, [
      'index', 'status', 'year', 'discipline', 'credits', 'previous', 'next',
    ]) as Dictionary['work'],
    contact: stringsAt(contact, `${path}.contact`, [
      'nav', 'title', 'email', 'wechat', 'address', 'hours', 'note', 'from', 'message', 'subject',
      'send', 'sending', 'sent', 'failed', 'draft',
    ]) as Dictionary['contact'],
    notFound: stringsAt(notFound, `${path}.notFound`, ['title', 'body', 'home']) as Dictionary['notFound'],
    footer: stringsAt(footer, `${path}.footer`, ['note']) as Dictionary['footer'],
    localeName: stringAt(property(root, 'localeName', path), `${path}.localeName`),
  };
}

/** Parse and copy an untrusted value into the exact editable content shape. */
export function parseContentSet(value: unknown): ContentSet {
  const root = objectAt(value, 'content');
  return {
    site: siteAt(property(root, 'site', 'content'), 'content.site'),
    pages: pagesAt(property(root, 'pages', 'content'), 'content.pages'),
    works: arrayAt(property(root, 'works', 'content'), 'content.works').map((work, index) =>
      workAt(work, `content.works[${index}]`),
    ),
    programs: arrayAt(property(root, 'programs', 'content'), 'content.programs').map(
      (program, index) => programAt(program, `content.programs[${index}]`),
    ),
    mentors: arrayAt(property(root, 'mentors', 'content'), 'content.mentors').map(
      (mentor, index) => mentorAt(mentor, `content.mentors[${index}]`),
    ),
    projects: arrayAt(property(root, 'projects', 'content'), 'content.projects').map(
      (project, index) => projectAt(project, `content.projects[${index}]`),
    ),
    zh: parseDictionary(property(root, 'zh', 'content'), 'content.zh'),
    en: parseDictionary(property(root, 'en', 'content'), 'content.en'),
  };
}
