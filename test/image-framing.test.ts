/**
 * How a photograph is drawn, across the two boundaries it has to survive.
 *
 * The framing is four numbers and a word that become CSS on the site, so
 * neither boundary can be loose about them. The HTTP one has to accept a record
 * saved before the frame existed — every record the studio owns today — without
 * inventing a shape for it, and has to refuse a value that would lay out
 * wrongly rather than pass it through to a page nobody looks at again. The
 * database one has to store the default as nothing at all, so that a site which
 * never frames a photograph carries no framing data and a reset really does put
 * the row back as it was.
 */
import { describe, expect, it } from 'vitest';

import { ContentShapeError, framingAt } from '../shared/content/parse';
import { naturalFraming, type ImageFraming } from '../shared/content/types';
import { imageBindings, imageRef } from '../worker/repositories/mapping';

const framed: ImageFraming = { ratio: 1, fit: 'cover', zoom: 1.4, x: 20, y: 80 };

describe('a photograph’s framing', () => {
  it('reads a record saved before frames existed as the photograph’s own shape', () => {
    expect(framingAt(undefined, 'frame')).toEqual(naturalFraming());
    expect(framingAt(null, 'frame')).toEqual(naturalFraming());
  });

  it('keeps every field of a frame that is there', () => {
    expect(framingAt(framed, 'frame')).toEqual(framed);
  });

  it('keeps a shape that is the photograph’s own', () => {
    expect(framingAt({ ...framed, ratio: null }, 'frame').ratio).toBeNull();
  });

  it('refuses a zoom past what the photograph has pixels for', () => {
    expect(() => framingAt({ ...framed, zoom: 12 }, 'frame')).toThrowError(
      new ContentShapeError('frame.zoom', 'between 1 and 3'),
    );
  });

  it('refuses a shape no page could lay out', () => {
    expect(() => framingAt({ ...framed, ratio: 40 }, 'frame')).toThrowError(ContentShapeError);
    expect(() => framingAt({ ...framed, ratio: 0 }, 'frame')).toThrowError(ContentShapeError);
  });

  it('refuses a focus outside the picture', () => {
    expect(() => framingAt({ ...framed, x: 140 }, 'frame')).toThrowError(ContentShapeError);
  });

  it('refuses a word that is neither filling nor fitting', () => {
    expect(() => framingAt({ ...framed, fit: 'stretch' }, 'frame')).toThrowError(ContentShapeError);
  });

  /*
   * The empty column is the whole of the backwards compatibility: it is what
   * every row in these six tables already holds, and it has to read as the
   * photograph's own shape rather than as a malformed value.
   */
  it('stores the default as no framing at all, and reads it back', () => {
    const image = { src: 'works/a/01.jpg', alt: '' as const, frame: naturalFraming() };
    const bindings = imageBindings(image);

    expect(bindings[4]).toBe('');
    expect(imageRef('works/a/01.jpg', '', '', 1, '').frame).toEqual(naturalFraming());
  });

  it('round-trips a frame the studio set', () => {
    const image = {
      src: 'works/a/01.jpg',
      alt: { zh: '照片', en: 'Photograph' },
      frame: framed,
    };
    const [key, altZh, altEn, decorative, frame] = imageBindings(image);

    expect(imageRef(key, altZh, altEn, decorative, frame)).toEqual(image);
  });
});
