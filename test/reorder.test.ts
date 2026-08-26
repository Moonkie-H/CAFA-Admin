/**
 * Moving a row within a list.
 *
 * Three lists reorder — the repeatable, the works index and the pages index —
 * and all three go through this one function, so an off-by-one here is an
 * off-by-one in the site's own order of works and in its navigation bar. The
 * ends are what is worth pinning down: the buttons are disabled at them, but a
 * disabled button is a UI promise and this is the code behind it.
 */
import { describe, expect, it } from 'vitest';

import { moved } from '../src/components/records/ReorderControls';

const list = ['a', 'b', 'c', 'd'];

describe('moved', () => {
  it('swaps an item with the one above it', () => {
    expect(moved(list, 2, 1)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('swaps an item with the one below it', () => {
    expect(moved(list, 1, 2)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('moves the ends inward', () => {
    expect(moved(list, 0, 1)).toEqual(['b', 'a', 'c', 'd']);
    expect(moved(list, 3, 2)).toEqual(['a', 'b', 'd', 'c']);
  });

  it('does nothing when asked to move past either end', () => {
    expect(moved(list, 0, -1)).toEqual(list);
    expect(moved(list, 3, 4)).toEqual(list);
  });

  it('leaves the list it was given alone', () => {
    const original = [...list];
    moved(original, 0, 1);
    expect(original).toEqual(list);
  });

  it('handles a list too short to reorder', () => {
    expect(moved(['only'], 0, 1)).toEqual(['only']);
    expect(moved([], 0, 1)).toEqual([]);
  });
});
