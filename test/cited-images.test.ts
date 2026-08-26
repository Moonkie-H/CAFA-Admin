/**
 * The one walk of the content's photographs.
 *
 * This used to be four walks — the publish projection, the read API, the
 * validator and the control panel each had their own — and the reason to test
 * it now that it is one is the reason it was collapsed: every rule about which
 * photographs exist and which of them publish is decided here, so a kind of
 * citation this misses is a kind every one of those four misses at once.
 *
 * The order is asserted deliberately. `/api/v1/photographs` answers in it, so
 * it is a contract with the frontend rather than an implementation detail.
 */
import { describe, expect, it } from 'vitest';

import {
  citationIsPublic,
  citedImages,
  citedKeys,
  type ImageCitation,
} from '../shared/content/images';
import type { ContentSet, ImageRef, Mentor, Page, Work } from '../shared/content/types';
import { content, page } from './content-fixture';

function image(src: string): ImageRef {
  return { src, alt: { zh: '照片', en: 'Photograph' } };
}

function work(slug: string, status: Work['status'] = 'completed'): Work {
  return {
    slug,
    index: 1,
    title: { zh: '作品', en: 'Work' },
    status,
    discipline: [{ zh: '建筑', en: 'Architecture' }],
    year: 2024,
    summary: { zh: '摘要', en: 'Summary' },
    credits: [],
    cover: image(`works/${slug}/cover.jpg`),
    media: [image(`works/${slug}/01.jpg`), image(`works/${slug}/02.jpg`)],
  };
}

function mentor(slug: string): Mentor {
  return {
    slug,
    name: { zh: '导师', en: 'Mentor' },
    discipline: { zh: '建筑', en: 'Architecture' },
    note: { zh: '一句话', en: 'One line' },
    portrait: image(`mentors/${slug}.jpg`),
  };
}

function gallery(slug: string, ...srcs: string[]): Page {
  return { ...page(), slug, sections: [{ kind: 'heading' }, { kind: 'gallery', images: srcs.map(image) }] };
}

function populated(): ContentSet {
  return {
    ...content(),
    works: [work('edible-house')],
    mentors: [mentor('shen-zhibai')],
    pages: [gallery('about', 'pages/about/01.jpg')],
  };
}

describe('citedImages', () => {
  it('reaches every photograph a record can hang one off', () => {
    const keys = [...citedImages(populated())].map((cited) => cited.image.src);

    expect(keys).toEqual([
      'works/edible-house/cover.jpg',
      'works/edible-house/01.jpg',
      'works/edible-house/02.jpg',
      'mentors/shen-zhibai.jpg',
      'pages/about/01.jpg',
    ]);
  });

  it('says which record cites each one, and where on it', () => {
    const cites = [...citedImages(populated())].map((cited) => cited.cite);

    expect(cites.map((cite) => cite.kind)).toEqual([
      'work-cover',
      'work-photo',
      'work-photo',
      'mentor-portrait',
      'page-photo',
    ]);

    // The position travels with the citation because three callers number a
    // photograph for a person to read — "photograph 2" — and an off-by-one here
    // would name the wrong field in the banner.
    const second = cites[2];
    expect(second?.kind === 'work-photo' && second.position).toBe(1);

    const onPage = cites[4];
    expect(onPage?.kind === 'page-photo' && onPage.section).toBe(1);
    expect(onPage?.kind === 'page-photo' && onPage.position).toBe(0);
  });

  it('walks a page’s galleries and skips the sections that hold no photographs', () => {
    const mixed: Page = {
      ...page(),
      sections: [
        { kind: 'heading' },
        { kind: 'gallery', images: [image('pages/home/01.jpg')] },
        { kind: 'prose', paragraphs: [{ zh: '文', en: 'Text' }] },
        { kind: 'gallery', images: [image('pages/home/02.jpg')] },
      ],
    };

    const found = [...citedImages({ ...content(), pages: [mixed] })];
    expect(found.map((cited) => cited.image.src)).toEqual([
      'pages/home/01.jpg',
      'pages/home/02.jpg',
    ]);
  });

  it('finds nothing in content that cites nothing', () => {
    expect([...citedImages(content())]).toEqual([]);
  });
});

describe('citationIsPublic', () => {
  it('refuses a private work’s photographs and allows everything else', () => {
    const cites: ImageCitation[] = [
      { kind: 'work-cover', work: work('open-house', 'private') },
      { kind: 'work-photo', work: work('open-house', 'private'), position: 0 },
      { kind: 'work-cover', work: work('edible-house') },
      { kind: 'mentor-portrait', mentor: mentor('shen-zhibai') },
      { kind: 'page-photo', page: page(), section: 0, position: 0 },
    ];

    expect(cites.map(citationIsPublic)).toEqual([false, false, true, true, true]);
  });
});

describe('citedKeys', () => {
  it('counts a photograph cited twice once', () => {
    const twice: ContentSet = {
      ...content(),
      pages: [gallery('about', 'pages/shared.jpg'), gallery('studio', 'pages/shared.jpg')],
    };

    expect(citedKeys(twice)).toEqual(new Set(['pages/shared.jpg']));
  });

  it('leaves out a photograph that has not been chosen yet', () => {
    const blank: ContentSet = { ...content(), mentors: [{ ...mentor('new'), portrait: { src: '', alt: '' } }] };
    expect(citedKeys(blank).size).toBe(0);
  });

  it('drops a private work when asked for public citations only', () => {
    const set: ContentSet = { ...content(), works: [work('open-house', 'private'), work('edible-house')] };

    expect(citedKeys(set).size).toBe(6);
    expect(citedKeys(set, true)).toEqual(
      new Set([
        'works/edible-house/cover.jpg',
        'works/edible-house/01.jpg',
        'works/edible-house/02.jpg',
      ]),
    );
  });
});
