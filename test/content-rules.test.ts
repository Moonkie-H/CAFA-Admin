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
import type { ContentSet, Page } from '../shared/content/types';
import { content, page } from './content-fixture';

/** The problems, as `section/label-key` pairs — enough to say which rule fired. */
function keys(problems: ReturnType<typeof checkContent>): string[] {
  return problems.map((problem) => `${problem.section}/${problem.message.key}`);
}

function withPages(...pages: Page[]): ContentSet {
  return { ...content(), pages };
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
    const half = { ...page(), title: { zh: '首页', en: '' } };
    const problems = checkContent(withPages(half));

    expect(problems).toHaveLength(1);
    expect(problems[0]?.section).toBe('pages');
    expect(problems[0]?.message.key).toBe('problems.message.empty');
    // The label nests the field inside the locale rather than concatenating —
    // the two do not join in the same order in Chinese and English.
    expect(problems[0]?.label.key).toBe('problems.label.inLocale');
    expect(problems[0]?.label.values?.locale).toEqual({ key: 'problems.locale.en' });
  });

  it('requires exactly one heading on a page', () => {
    const none = { ...page(), sections: [{ kind: 'works-index' as const }] };
    expect(keys(checkContent(withPages(none)))).toContain('pages/problems.message.needsHeading');

    const two = {
      ...page(),
      sections: [{ kind: 'heading' as const }, { kind: 'statement' as const, text: { zh: '一', en: 'One' } }],
    };
    expect(keys(checkContent(withPages(two)))).toContain('pages/problems.message.tooManyHeadings');
  });

  it('insists on a front page, and refuses two pages at one address', () => {
    const elsewhere = { ...page(), slug: 'about' };
    expect(keys(checkContent(withPages(elsewhere)))).toContain(
      'pages/problems.message.needsFrontPage',
    );

    const twice = checkContent(withPages(page(), page()));
    expect(keys(twice)).toContain('pages/problems.message.duplicatePage');
  });

  it('refuses an empty prose or gallery section', () => {
    const empty = { ...page(), sections: [{ kind: 'heading' as const }, { kind: 'prose' as const, paragraphs: [] }] };
    expect(keys(checkContent(withPages(empty)))).toContain('pages/problems.message.needsParagraph');

    const bare = { ...page(), sections: [{ kind: 'heading' as const }, { kind: 'gallery' as const, images: [] }] };
    expect(keys(checkContent(withPages(bare)))).toContain('pages/problems.message.needsPhotograph');
  });

  it('collects every problem rather than stopping at the first', () => {
    const broken = {
      ...content(),
      site: { ...content().site, contact: { ...content().site.contact, email: '', wechat: '' } },
    };
    const problems = checkContent(broken);

    expect(problems.filter((problem) => problem.section === 'site')).toHaveLength(2);
  });

  it('treats a decorative photograph as described, and a half-filled alt as not', () => {
    const decorative = {
      ...page(),
      sections: [
        { kind: 'heading' as const },
        { kind: 'gallery' as const, images: [{ src: 'pages/home/01.jpg', alt: '' as const }] },
      ],
    };
    expect(checkContent(withPages(decorative))).toEqual([]);

    const halfAlt = {
      ...page(),
      sections: [
        { kind: 'heading' as const },
        {
          kind: 'gallery' as const,
          images: [{ src: 'pages/home/01.jpg', alt: { zh: '照片', en: '' } }],
        },
      ],
    };
    expect(keys(checkContent(withPages(halfAlt)))).toContain('pages/problems.message.empty');
  });
});

describe('checkImagesInStorage', () => {
  const cited = {
    ...page(),
    sections: [
      { kind: 'heading' as const },
      {
        kind: 'gallery' as const,
        images: [{ src: 'pages/home/01.jpg', alt: { zh: '照片', en: 'Photograph' } }],
      },
    ],
  };

  it('says which file is missing when the bucket has not got it', () => {
    const problems = checkImagesInStorage(withPages(cited), []);

    expect(problems).toHaveLength(1);
    expect(problems[0]?.message.key).toBe('problems.message.notInStorage');
    expect(problems[0]?.message.values?.file).toBe('pages/home/01.jpg');
  });

  it('is satisfied once the key is in storage', () => {
    expect(checkImagesInStorage(withPages(cited), ['pages/home/01.jpg'])).toEqual([]);
  });

  it('ignores a photograph that has not been chosen yet', () => {
    const blank = {
      ...page(),
      sections: [
        { kind: 'heading' as const },
        { kind: 'gallery' as const, images: [{ src: '', alt: '' as const }] },
      ],
    };
    expect(checkImagesInStorage(withPages(blank), [])).toEqual([]);
  });
});
