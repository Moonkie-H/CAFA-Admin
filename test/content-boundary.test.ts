import { describe, expect, it } from 'vitest';

import { ContentShapeError, parseContentSet } from '../shared/content/parse';
import { readCopyPath, writeCopyPath } from '../shared/content/dictionary';
import { content, dictionary } from './content-fixture';
import { parseSaveRequest } from '../worker/models/dtos/content.dtos';

describe('content HTTP boundary', () => {
  it('parses and copies a complete content set', () => {
    const source = content();
    const parsed = parseContentSet(source);

    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(parsed.site).not.toBe(source.site);
  });

  it('names a missing nested field', () => {
    const source = content();
    const malformed = {
      ...source,
      site: {
        ...source.site,
        contact: {
          wechat: source.site.contact.wechat,
          address: source.site.contact.address,
          hours: source.site.contact.hours,
        },
      },
    };

    expect(() => parseContentSet(malformed)).toThrowError(
      new ContentShapeError('content.site.contact.email', 'present'),
    );
  });

  it('names the page a missing field is on', () => {
    const source = content();
    const malformed = {
      ...source,
      pages: { ...source.pages, about: { ...source.pages.about, mentorsTitle: undefined } },
    };

    expect(() => parseContentSet(malformed)).toThrow(/content\.pages\.about\.mentorsTitle/);
  });

  it('caps collection sizes at the boundary', () => {
    const source = content();
    const work = { ...source, works: Array.from({ length: 1_001 }, () => ({})) };
    expect(() => parseContentSet(work)).toThrow(/at most 1,000 items/);
  });

  it('turns malformed saves into a 400 ApiException', () => {
    expect(() => parseSaveRequest({ content: { ...content(), pages: 'not-an-object' } }))
      .toThrow(expect.objectContaining({ code: 400 }));
  });
});

describe('reaching one word in a dictionary', () => {
  it('reads a leaf at every depth the form exposes', () => {
    const source = dictionary();
    expect(readCopyPath(source, 'localeName')).toBe('English');
    expect(readCopyPath(source, 'footer.note')).toBe('Footer');
    expect(readCopyPath(source, 'works.status.in-progress')).toBe('In progress');
  });

  it('writes one word and leaves every other branch identical', () => {
    const source = dictionary();
    const next = writeCopyPath(source, 'contact.note', 'Come by on a Tuesday.');

    expect(next.contact.note).toBe('Come by on a Tuesday.');
    expect(next.contact.title).toBe(source.contact.title);
    // Untouched branches keep their identity, so the editor's dirty check sees
    // exactly the one subtree that moved.
    expect(next.a11y).toBe(source.a11y);
    expect(next.contact).not.toBe(source.contact);
    expect(source.contact.note).toBe('Note');
  });

  it('rebuilds only the path it was given, however deep', () => {
    const source = dictionary();
    const next = writeCopyPath(source, 'works.status.private', 'Not shown');

    expect(next.works.status.private).toBe('Not shown');
    expect(next.works.status.completed).toBe(source.works.status.completed);
    expect(next.work).toBe(source.work);
  });
});
