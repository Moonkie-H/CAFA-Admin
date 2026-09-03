/**
 * The rules, stated once, in the language of the person breaking them.
 *
 * The template validates the same things at build time and throws on the first
 * failure — right for a build, useless for a form. This collects every problem
 * at once and names each one where the editor can see it, so nothing is saved
 * that would fail the build and nobody has to read a stack trace to find out
 * which field was blank.
 *
 * A problem names its field and its fault as **phrases rather than sentences**:
 * a translation key and the numbers to fill it with. This module runs in two
 * places that cannot share a translator — the form, where react-i18next is
 * loaded, and the Worker, which has no UI at all and sends its problems back
 * over the wire — so the one thing both can produce is a key. `src/components/ProblemList`
 * turns them into words in whichever language the studio is reading, which is
 * the whole point: the banner that appears when someone is stuck was the last
 * surface in this admin still speaking English at a Chinese studio.
 *
 * The keys are the form's own, wherever the form has one. A problem about a
 * work's title says `fields.title`, which is the label the studio was just
 * looking at — so the banner and the field it points to cannot drift apart, and
 * translating one translates the other.
 */
import { citedImages, type ImageCitation } from './images';
import {
  LOCALES,
  WORK_STATUSES,
  type ContentSet,
  type Dictionary,
  type ImageRef,
  type LocalisedText,
  type Locale,
  type PageText,
  type SitePages,
} from './types';

/**
 * Something to say, before anyone has decided which language to say it in.
 *
 * `values` may hold another phrase — "Cover (Chinese)" is one key filled with
 * two others — so the renderer resolves it depth-first. Nesting rather than
 * concatenation because the pieces do not join in the same order in both
 * languages, and a phrase built by `+` can only ever be right in one of them.
 */
export interface Phrase {
  key: string;
  values?: Record<string, string | number | Phrase>;
}

export interface Problem {
  section: keyof ContentSet;
  /**
   * The record the problem sits in — a slug, a page's key, or a dictionary
   * group's name. Data rather than copy, so it is not a phrase.
   */
  record: string;
  /** Which field, in the words the form uses for it. */
  label: Phrase;
  /** What is wrong with it. */
  message: Phrase;
}

/** A phrase, short enough to read inline at a call site. */
function say(key: string, values?: Phrase['values']): Phrase {
  return values === undefined ? { key } : { key, values };
}

/** The faults. One key each, so a new rule is a new line here and in the copy. */
const fault = {
  empty: say('problems.message.empty'),
  slugChars: say('problems.message.slugChars'),
  needsParagraph: say('problems.message.needsParagraph'),
  wholeNumber: say('problems.message.wholeNumber'),
  notAStatus: say('problems.message.notAStatus'),
  needsEntry: say('problems.message.needsEntry'),
  duplicateWork: (slug: string) => say('problems.message.duplicateWork', { slug }),
  duplicateProgram: (slug: string) => say('problems.message.duplicateProgram', { slug }),
  duplicateMentor: (slug: string) => say('problems.message.duplicateMentor', { slug }),
  duplicateProject: (slug: string) => say('problems.message.duplicateProject', { slug }),
} as const;

const LOCALE_LABEL: Record<Locale, Phrase> = {
  zh: say('problems.locale.zh'),
  en: say('problems.locale.en'),
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSlug(value: string): boolean {
  return SLUG.test(value);
}

class Collector {
  readonly problems: Problem[] = [];

  constructor(
    private readonly section: keyof ContentSet,
    private readonly record: string,
  ) {}

  add(label: Phrase, message: Phrase): void {
    this.problems.push({ section: this.section, record: this.record, label, message });
  }

  text(value: string, label: Phrase): void {
    if (value.trim() === '') this.add(label, fault.empty);
  }

  localised(value: LocalisedText, label: Phrase): void {
    for (const locale of LOCALES) {
      if ((value[locale] ?? '').trim() === '') {
        this.add(say('problems.label.inLocale', { field: label, locale: LOCALE_LABEL[locale] }), fault.empty);
      }
    }
  }

  slug(value: string, label: Phrase): void {
    if (value.trim() === '') return this.add(label, fault.empty);
    if (!isSlug(value)) this.add(label, fault.slugChars);
  }

  /**
   * Alt text is required. A decorative image says so with an empty alt; a
   * half-filled one — described in one language and not the other — is the
   * failure this catches, and the `CHECK` on the media columns catches again.
   */
  image(value: ImageRef, label: Phrase): void {
    this.text(value.src, say('problems.label.imageFile', { field: label }));
    if (value.alt === '') return;
    this.localised(value.alt, say('problems.label.imageAlt', { field: label }));
  }

  /** A page's prose: at least one paragraph, and both languages in each. */
  paragraphs(entries: readonly LocalisedText[]): void {
    if (entries.length === 0) this.add(say('fields.intro'), fault.needsParagraph);
    entries.forEach((paragraph, at) =>
      this.localised(paragraph, say('fields.paragraphNumber', { number: at + 1 })),
    );
  }

  /** The two lines every page carries, in the words its own screen uses. */
  pageText(page: PageText): void {
    this.localised(page.title, say('fields.title'));
    this.localised(page.description, say('fields.description'));
  }
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function checkDictionary(dictionary: Dictionary, locale: Locale): Problem[] {
  const section: keyof ContentSet = locale;
  const problems: Problem[] = [];

  const walk = (value: unknown, trail: string[]): void => {
    if (typeof value === 'string') {
      if (value.trim() === '') {
        problems.push({
          section,
          record: trail[0] ?? 'text',
          // The trail is a path through the dictionary rather than a field name
          // the form has a label for, so it travels as a value inside a phrase
          // that does have one. It is the one label here that is not the
          // studio's own words for the field, and it is the one place where the
          // words belong to the schema rather than to a form.
          label: say('problems.label.siteText', { trail: trail.join(' › ') }),
          message: fault.empty,
        });
      }
      return;
    }
    if (typeof value === 'object' && value !== null) {
      for (const [key, nested] of Object.entries(value)) walk(nested, [...trail, key]);
    }
  };

  walk(dictionary, []);
  return problems;
}

/**
 * The four pages, each checked against the fields it actually has.
 *
 * There is no rule here about how many headings a page has or whether a front
 * page exists, and their absence is the change: the set of pages is code now,
 * so a site cannot be missing one and a page cannot be composed wrongly. What
 * is left is the only thing that can go wrong — a blank where a word should be.
 */
function checkPages(pages: SitePages): Problem[] {
  const problems: Problem[] = [];

  const home = new Collector('pages', 'home');
  home.pageText(pages.home);
  home.localised(pages.home.statement, say('fields.statement'));
  pages.home.gallery.forEach((image, at) =>
    home.image(image, say('fields.photographNumber', { number: at + 1 })),
  );
  problems.push(...home.problems);

  const works = new Collector('pages', 'works');
  works.pageText(pages.works);
  problems.push(...works.problems);

  const programs = new Collector('pages', 'programs');
  programs.pageText(pages.programs);
  programs.paragraphs(pages.programs.intro);
  problems.push(...programs.problems);

  const about = new Collector('pages', 'about');
  about.pageText(pages.about);
  about.paragraphs(pages.about.intro);
  about.localised(pages.about.mentorsTitle, say('fields.mentorsTitle'));
  about.localised(pages.about.projectsTitle, say('fields.projectsTitle'));
  problems.push(...about.problems);

  return problems;
}

/**
 * The one rule this file cannot check on its own: that every photograph a
 * record names is actually in storage.
 *
 * A photograph is uploaded before the record pointing at it is saved, so the
 * `media` table is the list of files that exist and an image src that is not in
 * it is a foreign key waiting to fail. Separate from `checkContent` because it
 * needs that list, which the form has and the pure rules do not — the editor
 * passes what it has loaded, and the Worker passes what the table says.
 *
 * Without this the save still cannot corrupt anything: the constraint refuses
 * it. It just refuses it as `D1_ERROR: FOREIGN KEY constraint failed`, which is
 * a sentence for a developer reading logs rather than for the person who has to
 * fix it.
 */
export function checkImagesInStorage(content: ContentSet, keys: Iterable<string>): Problem[] {
  const known = new Set(keys);
  const problems: Problem[] = [];

  for (const { image, cite } of citedImages(content)) {
    if (image.src === '' || known.has(image.src)) continue;
    problems.push({
      ...whichRecord(cite),
      message: say('problems.message.notInStorage', { file: image.src }),
    });
  }

  return problems;
}

/**
 * Where a citation sits, in the words the form uses for it.
 *
 * The walker hands over the record; naming it is this file's job, because the
 * name has to be a phrase the banner can say in either language and nothing
 * else that walks the content needs one.
 */
function whichRecord(cite: ImageCitation): Pick<Problem, 'section' | 'record' | 'label'> {
  switch (cite.kind) {
    case 'work-cover':
      return { section: 'works', record: cite.work.slug, label: say('fields.cover') };
    case 'work-photo':
      return {
        section: 'works',
        record: cite.work.slug,
        label: say('fields.photographNumber', { number: cite.position + 1 }),
      };
    case 'mentor-portrait':
      return { section: 'mentors', record: cite.mentor.slug, label: say('fields.portrait') };
    case 'project-image':
      return { section: 'projects', record: cite.project.slug, label: say('fields.picture') };
    case 'home-photo':
      return {
        section: 'pages',
        record: 'home',
        label: say('fields.photographNumber', { number: cite.position + 1 }),
      };
    case 'site-qr':
      return { section: 'site', record: 'site', label: say('fields.qr') };
  }
}

export function checkContent(content: ContentSet): Problem[] {
  const problems: Problem[] = [...checkPages(content.pages)];

  for (const work of content.works) {
    const check = new Collector('works', work.slug);
    check.slug(work.slug, say('fields.webAddress'));
    check.localised(work.title, say('fields.title'));
    check.localised(work.summary, say('fields.summary'));
    if (!Number.isInteger(work.year)) check.add(say('fields.year'), fault.wholeNumber);
    if (!Number.isInteger(work.index)) check.add(say('fields.number'), fault.wholeNumber);
    if (!WORK_STATUSES.includes(work.status)) check.add(say('fields.status'), fault.notAStatus);
    if (work.discipline.length === 0) check.add(say('fields.discipline'), fault.needsEntry);
    work.discipline.forEach((entry, at) =>
      check.localised(entry, say('works.disciplineNumber', { number: at + 1 })),
    );
    work.credits.forEach((credit, at) => {
      check.localised(credit.role, say('problems.label.creditRole', { number: at + 1 }));
      check.localised(credit.name, say('problems.label.creditName', { number: at + 1 }));
    });
    check.image(work.cover, say('fields.cover'));
    work.media.forEach((image, at) =>
      check.image(image, say('fields.photographNumber', { number: at + 1 })),
    );
    problems.push(...check.problems);
  }

  for (const slug of duplicates(content.works.map((work) => work.slug))) {
    problems.push({
      section: 'works',
      record: slug,
      label: say('fields.webAddress'),
      message: fault.duplicateWork(slug),
    });
  }

  for (const program of content.programs) {
    const check = new Collector('programs', program.slug);
    check.slug(program.slug, say('fields.key'));
    check.localised(program.name, say('fields.name'));
    check.localised(program.audience, say('fields.audience'));
    check.localised(program.duration, say('fields.duration'));
    check.localised(program.summary, say('fields.summary'));
    problems.push(...check.problems);
  }

  for (const slug of duplicates(content.programs.map((program) => program.slug))) {
    problems.push({
      section: 'programs',
      record: slug,
      label: say('fields.key'),
      message: fault.duplicateProgram(slug),
    });
  }

  for (const mentor of content.mentors) {
    const check = new Collector('mentors', mentor.slug);
    check.slug(mentor.slug, say('fields.key'));
    check.localised(mentor.name, say('fields.name'));
    check.localised(mentor.discipline, say('fields.discipline'));
    check.localised(mentor.note, say('fields.oneLine'));
    check.image(mentor.portrait, say('fields.portrait'));
    problems.push(...check.problems);
  }

  for (const slug of duplicates(content.mentors.map((mentor) => mentor.slug))) {
    problems.push({
      section: 'mentors',
      record: slug,
      label: say('fields.key'),
      message: fault.duplicateMentor(slug),
    });
  }

  for (const project of content.projects) {
    const check = new Collector('projects', project.slug);
    check.slug(project.slug, say('fields.key'));
    check.localised(project.title, say('fields.title'));
    check.localised(project.summary, say('fields.summary'));
    check.image(project.image, say('fields.picture'));
    problems.push(...check.problems);
  }

  for (const slug of duplicates(content.projects.map((project) => project.slug))) {
    problems.push({
      section: 'projects',
      record: slug,
      label: say('fields.key'),
      message: fault.duplicateProject(slug),
    });
  }

  const site = new Collector('site', 'site');
  site.localised(content.site.name, say('fields.studioName'));
  site.text(content.site.contact.email, say('fields.email'));
  site.text(content.site.contact.wechat, say('fields.wechat'));
  site.localised(content.site.contact.address, say('fields.address'));
  site.localised(content.site.contact.hours, say('fields.hours'));
  // Optional, so only a code that *is* there is held to the alt-text rule. The
  // schema cannot state that pairing for this one column — ALTER TABLE cannot
  // add a table-level CHECK — so unlike every other photograph on the site, this
  // gate is the only one that says a code must be described.
  if (content.site.contact.qr !== null) {
    site.image(content.site.contact.qr, say('fields.qr'));
  }
  problems.push(...site.problems);

  problems.push(...checkDictionary(content.zh, 'zh'));
  problems.push(...checkDictionary(content.en, 'en'));

  return problems;
}
