/**
 * The rules a save has to satisfy.
 *
 * `checkContent` is the only copy of these rules that cannot be skipped — the
 * form runs it to draw its banner, and the Worker runs the same function again
 * so a scripted client cannot save what the form would have refused. It
 * collects every problem rather than throwing on the first, so what is tested
 * here is as much *how many* and *which* as whether it complained at all.
 */
import { describe, expect, it } from 'vitest';

import { checkContent, checkImagesInStorage, isSlug } from '../shared/content/validate';
import type { ContentSet, ImageRef, SitePages } from '../shared/content/types';
import { content } from './content-fixture';

/** The problems, as `section/label-key` pairs — enough to say which rule fired. */
function keys(problems: ReturnType<typeof checkContent>): string[] {
  return problems.map((problem) => `${problem.section}/${problem.message.key}`);
}

/** The content set with one page rewritten. */
function withPages(patch: (pages: SitePages) => SitePages): ContentSet {
  const base = content();
  return { ...base, pages: patch(base.pages) };
}

function withGallery(...images: ImageRef[]): ContentSet {
  return withPages((pages) => ({ ...pages, home: { ...pages.home, gallery: images } }));
}

describe('slugs', () => {
  it('accepts lowercase words joined by single hyphens', () => {
    for (const value of ['about', 'edible-house', 'a1', 'salt-and-scaffold']) {
      expect(isSlug(value), value).toBe(true);
    }
  });

  it('refuses spacing, case, and stray hyphens', () => {
    for (const value of ['', 'About', 'edible house', '-house', 'house-', 'a--b', 'café']) {
      expect(isSlug(value), value).toBe(false);
    }
  });
});

describe('checkContent', () => {
  it('passes a complete content set', () => {
    expect(checkContent(content())).toEqual([]);
  });

  it('names both languages when a localised field is half filled', () => {
    const problems = checkContent(
      withPages((pages) => ({ ...pages, home: { ...pages.home, title: { zh: '首页', en: '' } } })),
    );

    expect(problems).toHaveLength(1);
    expect(problems[0]?.section).toBe('pages');
    expect(problems[0]?.record).toBe('home');
    expect(problems[0]?.message.key).toBe('problems.message.empty');
    // The label nests the field inside the locale rather than concatenating —
    // the two do not join in the same order in Chinese and English.
    expect(problems[0]?.label.key).toBe('problems.label.inLocale');
    expect(problems[0]?.label.values?.locale).toEqual({ key: 'problems.locale.en' });
  });

  /*
   * There is no rule here about a page having exactly one heading, or about the
   * site having a front page, and their absence is the change rather than an
   * omission: the four pages are code now, so neither can go wrong. What is
   * left is a blank where a word should be, on the page that is missing it.
   */
  it('names the page a blank is on', () => {
    const problems = checkContent(
      withPages((pages) => ({
        ...pages,
        about: { ...pages.about, mentorsTitle: { zh: '', en: '' } },
      })),
    );

    expect(problems).toHaveLength(2);
    expect(problems.every((problem) => problem.record === 'about')).toBe(true);
    expect(problems[0]?.label.values?.field).toEqual({ key: 'fields.mentorsTitle' });
  });

  it('asks the two pages that open with prose for at least one paragraph', () => {
    expect(
      keys(checkContent(withPages((pages) => ({ ...pages, about: { ...pages.about, intro: [] } })))),
    ).toContain('pages/problems.message.needsParagraph');

    expect(
      keys(
        checkContent(
          withPages((pages) => ({ ...pages, programs: { ...pages.programs, intro: [] } })),
        ),
      ),
    ).toContain('pages/problems.message.needsParagraph');
  });

  it('lets the front page carry no photographs at all', () => {
    expect(checkContent(withGallery())).toEqual([]);
  });

  it('refuses two records at one address', () => {
    const base = content();
    const program = {
      slug: 'summer-atelier',
      name: { zh: '课程', en: 'Programme' },
      audience: { zh: '人群', en: 'Audience' },
      duration: { zh: '两周', en: 'Two weeks' },
      summary: { zh: '摘要', en: 'Summary' },
    };

    expect(keys(checkContent({ ...base, programs: [program, program] }))).toContain(
      'programs/problems.message.duplicateProgram',
    );
  });

  it('holds a project to its key, its words and its picture', () => {
    const blank = {
      slug: '',
      title: { zh: '', en: '' },
      summary: { zh: '简介', en: 'Summary' },
      image: { src: '', alt: '' } as ImageRef,
    };

    const problems = keys(checkContent({ ...content(), projects: [blank] }));

    // The key, both halves of the title, and the missing file — a project is
    // four required fields and nothing else, which is the point of it.
    expect(problems.filter((problem) => problem.startsWith('projects/'))).toHaveLength(4);
  });

  it('accepts a site with no projects at all', () => {
    expect(checkContent({ ...content(), projects: [] })).toEqual([]);
  });

  it('refuses two projects at one key', () => {
    const project = {
      slug: 'salt-and-scaffold',
      title: { zh: '项目', en: 'Project' },
      summary: { zh: '简介', en: 'Summary' },
      image: { src: 'projects/salt-and-scaffold.jpg', alt: { zh: '照片', en: 'Photograph' } },
    };

    expect(keys(checkContent({ ...content(), projects: [project, project] }))).toContain(
      'projects/problems.message.duplicateProject',
    );
  });

  it('collects every problem rather than stopping at the first', () => {
    const broken = {
      ...content(),
      site: { ...content().site, contact: { ...content().site.contact, email: '', wechat: '' } },
    };
    const problems = checkContent(broken);

    expect(problems.filter((problem) => problem.section === 'site')).toHaveLength(2);
  });

  it('counts a value that is nothing but formatting as blank', () => {
    // A size and nothing else — the field has no words in it, so the studio
    // would have published an empty statement. It does not trim to nothing,
    // which is why the rule measures the plain text. The English is a directive
    // this format has retired, which parses to no words for the same reason.
    expect(
      keys(
        checkContent(
          withPages((pages) => ({
            ...pages,
            home: { ...pages.home, statement: { zh: '{28}', en: '{right larger}' } },
          })),
        ),
      ),
    ).toEqual(['pages/problems.message.empty', 'pages/problems.message.empty']);
  });

  it('lets a formatted line through, because it has words in it', () => {
    expect(
      checkContent(
        withPages((pages) => ({
          ...pages,
          home: { ...pages.home, statement: { zh: '{28}**央艺**', en: '{28}**c.a.f.a**' } },
        })),
      ),
    ).toEqual([]);
  });

  it('treats a decorative photograph as described, and a half-filled alt as not', () => {
    expect(checkContent(withGallery({ src: 'pages/home/01.jpg', alt: '' }))).toEqual([]);

    expect(
      keys(checkContent(withGallery({ src: 'pages/home/01.jpg', alt: { zh: '照片', en: '' } }))),
    ).toContain('pages/problems.message.empty');
  });
});

describe('checkImagesInStorage', () => {
  const cited = withGallery({ src: 'pages/home/01.jpg', alt: { zh: '照片', en: 'Photograph' } });

  it('says which file is missing when the bucket has not got it', () => {
    const problems = checkImagesInStorage(cited, []);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.record).toBe('home');
    expect(problems[0]?.message.key).toBe('problems.message.notInStorage');
    expect(problems[0]?.message.values?.file).toBe('pages/home/01.jpg');
  });

  it('is satisfied once the key is in storage', () => {
    expect(checkImagesInStorage(cited, ['pages/home/01.jpg'])).toEqual([]);
  });

  it('ignores a photograph that has not been chosen yet', () => {
    expect(checkImagesInStorage(withGallery({ src: '', alt: '' }), [])).toEqual([]);
  });
});
