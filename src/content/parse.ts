/** Runtime parsing for content crossing the HTTP boundary. */
import {
  SECTION_KINDS,
  WORK_STATUSES,
  type ContentSet,
  type Dictionary,
  type ImageRef,
  type LocalisedText,
  type Mentor,
  type Page,
  type PageSection,
  type Program,
  type SiteContent,
  type SectionKind,
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

function isSectionKind(value: string): value is SectionKind {
  return SECTION_KINDS.some((candidate) => candidate === value);
}

function sectionAt(value: unknown, path: string): PageSection {
  const record = objectAt(value, path);
  const kind = stringAt(property(record, 'kind', path), `${path}.kind`);
  if (!isSectionKind(kind)) {
    throw new ContentShapeError(`${path}.kind`, 'a supported section kind');
  }

  switch (kind) {
    case 'heading':
    case 'works-index':
    case 'programs':
      return { kind };
    case 'statement':
    case 'works-grid':
    case 'mentors':
      return { kind, text: localisedAt(property(record, 'text', path), `${path}.text`) };
    case 'prose':
      return {
        kind,
        paragraphs: arrayAt(property(record, 'paragraphs', path), `${path}.paragraphs`).map(
          (paragraph, index) => localisedAt(paragraph, `${path}.paragraphs[${index}]`),
        ),
      };
    case 'gallery':
      return {
        kind,
        images: arrayAt(property(record, 'images', path), `${path}.images`).map((image, index) =>
          imageAt(image, `${path}.images[${index}]`),
        ),
      };
  }
}

function pageAt(value: unknown, path: string): Page {
  const record = objectAt(value, path);
  const rawNavLabel = property(record, 'navLabel', path);
  return {
    slug: stringAt(property(record, 'slug', path), `${path}.slug`),
    title: localisedAt(property(record, 'title', path), `${path}.title`),
    description: localisedAt(property(record, 'description', path), `${path}.description`),
    navLabel: rawNavLabel === null ? null : localisedAt(rawNavLabel, `${path}.navLabel`),
    sections: arrayAt(property(record, 'sections', path), `${path}.sections`).map((section, index) =>
      sectionAt(section, `${path}.sections[${index}]`),
    ),
  };
}

function workStatusAt(value: unknown, path: string): WorkStatus {
  if (typeof value !== 'string' || !isWorkStatus(value)) {
    throw new ContentShapeError(path, 'a supported work status');
  }
  return value;
}

function isWorkStatus(value: string): value is WorkStatus {
  return WORK_STATUSES.some((status) => status === value);
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
    meta: stringsAt(meta, `${path}.meta`, ['title', 'titleTemplate', 'description']) as Dictionary['meta'],
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
      'nav', 'title', 'email', 'wechat', 'address', 'hours', 'note', 'from', 'message', 'subject', 'send',
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
    pages: arrayAt(property(root, 'pages', 'content'), 'content.pages').map((page, index) =>
      pageAt(page, `content.pages[${index}]`),
    ),
    works: arrayAt(property(root, 'works', 'content'), 'content.works').map((work, index) =>
      workAt(work, `content.works[${index}]`),
    ),
    programs: arrayAt(property(root, 'programs', 'content'), 'content.programs').map(
      (program, index) => programAt(program, `content.programs[${index}]`),
    ),
    mentors: arrayAt(property(root, 'mentors', 'content'), 'content.mentors').map(
      (mentor, index) => mentorAt(mentor, `content.mentors[${index}]`),
    ),
    zh: parseDictionary(property(root, 'zh', 'content'), 'content.zh'),
    en: parseDictionary(property(root, 'en', 'content'), 'content.en'),
  };
}
