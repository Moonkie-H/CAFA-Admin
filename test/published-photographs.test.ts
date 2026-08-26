/**
 * What `/api/v1/photographs` answers, and what it must never answer.
 *
 * Two contracts meet here. `usedBy` is one a frontend branches on, and it had
 * drifted: the document still described a `"studio"` value that migration 0005
 * removed, and never mentioned the `"page:"` one that replaced it. Nothing
 * downstream would report that — a generated client simply has a branch that
 * never runs and a value it has never heard of — so it is pinned here.
 *
 * The other is the privacy promise. A private work's photographs are dropped
 * when a revision is built, so they reach this projection already absent; the
 * test is that the absence survives the two of them being wired together.
 */
import { describe, expect, it } from 'vitest';

import { buildBundle } from '../worker/domain/bundle';
import { photographsOf } from '../worker/connectors/photographs';
import type { MediaRow } from '../worker/models/rows';
import type { ContentSet, ImageRef, Work } from '../shared/content/types';
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
    media: [],
  };
}

function measured(...keys: string[]): MediaRow[] {
  return keys.map((key) => ({ key, width: 1_200, height: 800, bytes: 100_000, tint: 210 }));
}

function published(set: ContentSet, media: MediaRow[]) {
  return photographsOf(
    buildBundle(set, media, 'https://media.example.com', 'https://example.com', undefined),
  );
}

describe('the published photographs', () => {
  it('names what draws each one, in the three forms the document promises', () => {
    const set: ContentSet = {
      ...content(),
      works: [work('edible-house')],
      mentors: [
        {
          slug: 'shen-zhibai',
          name: { zh: '导师', en: 'Mentor' },
          discipline: { zh: '建筑', en: 'Architecture' },
          note: { zh: '一句话', en: 'One line' },
          portrait: image('mentors/shen-zhibai.jpg'),
        },
      ],
      pages: [
        { ...page(), sections: [{ kind: 'heading' }, { kind: 'gallery', images: [image('pages/home/01.jpg')] }] },
        { ...page(), slug: 'about', sections: [{ kind: 'heading' }, { kind: 'gallery', images: [image('pages/about/01.jpg')] }] },
      ],
    };

    const photographs = published(
      set,
      measured(
        'works/edible-house/cover.jpg',
        'mentors/shen-zhibai.jpg',
        'pages/home/01.jpg',
        'pages/about/01.jpg',
      ),
    );

    expect(photographs.map((photograph) => photograph.usedBy)).toEqual([
      'work:edible-house',
      'mentor:shen-zhibai',
      // The front page's slug is empty, and "/" is how the answer spells it.
      'page:/',
      'page:about',
    ]);
  });

  it('resolves each key against the media origin', () => {
    const set: ContentSet = { ...content(), works: [work('edible-house')] };
    const [photograph] = published(set, measured('works/edible-house/cover.jpg'));

    expect(photograph?.url).toBe('https://media.example.com/works/edible-house/cover.jpg');
    expect(photograph?.width).toBe(1_200);
    expect(photograph?.decorative).toBe(false);
  });

  it('publishes nothing at all for a private work', () => {
    const set: ContentSet = { ...content(), works: [work('open-house', 'private')] };

    expect(published(set, measured('works/open-house/cover.jpg'))).toEqual([]);
  });
});
