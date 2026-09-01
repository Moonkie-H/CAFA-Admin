/**
 * What a published revision contains, and — the part worth testing — what it
 * refuses to contain.
 *
 * A private work is listed on the site and has no page, and the guarantee that
 * its photographs never reach a browser lives in `buildBundle` rather than in
 * the frontend that draws them. That is a privacy promise enforced by a
 * projection, which is exactly the kind of thing that stays true only while
 * something checks it: nothing downstream would notice it breaking, because a
 * leaked URL renders perfectly well.
 */
import { describe, expect, it } from 'vitest';

import { buildBundle, transformsOn } from '../worker/domain/bundle';
import type { MediaRow } from '../worker/models/rows';
import type { ContentSet, Work } from '../shared/content/types';
import { content } from './content-fixture';

function work(slug: string, status: Work['status']): Work {
  return {
    slug,
    index: 1,
    title: { zh: '作品', en: 'Work' },
    status,
    discipline: [{ zh: '建筑', en: 'Architecture' }],
    year: 2024,
    summary: { zh: '摘要', en: 'Summary' },
    credits: [],
    cover: { src: `works/${slug}/cover.jpg`, alt: { zh: '封面', en: 'Cover' } },
    media: [{ src: `works/${slug}/01.jpg`, alt: { zh: '照片', en: 'Photograph' } }],
  };
}

function measured(...keys: string[]): MediaRow[] {
  return keys.map((key) => ({ key, width: 1_200, height: 800, bytes: 100_000, tint: 210 }));
}

function withWorks(...works: Work[]): ContentSet {
  return { ...content(), works };
}

const MEDIA_BASE = 'https://media.example.com';
const SITE_URL = 'https://example.com';
const ADMIN_URL = 'https://admin.example.com';

function bundleOf(set: ContentSet, media: MediaRow[]) {
  return buildBundle(set, media, MEDIA_BASE, SITE_URL, undefined, ADMIN_URL);
}

describe('the published bundle', () => {
  it('lists a private work but publishes none of its photographs', () => {
    const bundle = bundleOf(
      withWorks(work('open-house', 'private')),
      measured('works/open-house/cover.jpg', 'works/open-house/01.jpg'),
    );

    const [published] = bundle.works;
    expect(published?.slug).toBe('open-house');
    expect(published?.title).toEqual({ zh: '作品', en: 'Work' });
    expect(published?.cover).toEqual({ src: '', alt: '' });
    expect(published?.media).toEqual([]);

    // And nothing measured about them either — no size, no colour, no key.
    expect(bundle.media).toEqual({});
    expect(JSON.stringify(bundle)).not.toContain('open-house/cover.jpg');
  });

  it('keeps a public work whole', () => {
    const bundle = bundleOf(
      withWorks(work('edible-house', 'completed')),
      measured('works/edible-house/cover.jpg', 'works/edible-house/01.jpg'),
    );

    const [published] = bundle.works;
    expect(published?.cover.src).toBe('works/edible-house/cover.jpg');
    expect(published?.media).toHaveLength(1);
    expect(bundle.media['works/edible-house/cover.jpg']).toEqual({
      width: 1_200,
      height: 800,
      tint: 210,
    });
  });

  it('measures only what published content cites', () => {
    const bundle = bundleOf(
      withWorks(work('edible-house', 'completed'), work('open-house', 'private')),
      measured(
        'works/edible-house/cover.jpg',
        'works/edible-house/01.jpg',
        'works/open-house/cover.jpg',
        'mentors/nobody.jpg',
      ),
    );

    expect(Object.keys(bundle.media).sort()).toEqual([
      'works/edible-house/01.jpg',
      'works/edible-house/cover.jpg',
    ]);
  });

  it('adds the deployment’s own facts to site, and strips the trailing slash', () => {
    const bundle = buildBundle(
      content(),
      [],
      MEDIA_BASE,
      'https://example.com/',
      undefined,
      ADMIN_URL,
    );

    expect(bundle.site.url).toBe('https://example.com');
    expect(bundle.site.locales).toEqual(['zh', 'en']);
    expect(bundle.site.localeNames).toEqual({ zh: 'English', en: 'English' });
    // Lifted out of the dictionaries, so what is left is page copy only.
    expect(bundle.dictionaries.en).not.toHaveProperty('localeName');
  });

  it('points the contact form at the admin, and offers no form without one', () => {
    expect(bundleOf(content(), []).contactEndpoint).toBe(
      'https://admin.example.com/api/v1/contact',
    );

    // A trailing slash on the var must not become a double slash in the URL the
    // browser posts to — the same rule site.url is held to two lines above.
    expect(
      buildBundle(content(), [], MEDIA_BASE, SITE_URL, undefined, 'https://admin.example.com/')
        .contactEndpoint,
    ).toBe('https://admin.example.com/api/v1/contact');

    // No ADMIN_URL is a deployment that has not set the form up. Null rather
    // than '' so the site has to decide, and it decides on a mailto: draft.
    expect(
      buildBundle(content(), [], MEDIA_BASE, SITE_URL, undefined, undefined).contactEndpoint,
    ).toBeNull();
  });

  it('is deterministic over the same content, which is what "nothing to publish" rests on', () => {
    const media = measured('works/edible-house/cover.jpg', 'works/edible-house/01.jpg');
    const first = bundleOf(withWorks(work('edible-house', 'completed')), media);
    const second = bundleOf(withWorks(work('edible-house', 'completed')), media);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('turns transformations off only for a value that plainly says so', () => {
    for (const said of [undefined, '', 'on', 'true', 'yes', 'anything']) {
      expect(transformsOn(said), String(said)).toBe(true);
    }
    for (const said of ['off', 'OFF', ' false ', '0']) {
      expect(transformsOn(said), said).toBe(false);
    }
  });
});
