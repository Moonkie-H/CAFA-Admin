/**
 * The formatting grammar, from both ends.
 *
 * Two properties matter more than any single case here, and most of what
 * follows is one of the two:
 *
 *  - **Nothing already written changes meaning.** Every string in the database
 *    was typed before this format existed, and none of it may start reading
 *    differently now that something parses it. So the cases with braces and
 *    asterisks in ordinary prose are the ones to keep.
 *  - **What the editor writes, the site reads back.** The toolbar builds blocks
 *    and formats them; the build parses them. A round trip that loses a mark is
 *    a studio's edit silently discarded at publish.
 */
import { describe, expect, it } from 'vitest';

import {
  formatRichText,
  parseRichText,
  richPlainText,
  type RichBlock,
  type RichRun,
} from '../shared/content/rich-text';

/** A block, spelled at its shortest: the defaults are what most lines are. */
function block(runs: RichRun[], patch: Partial<RichBlock> = {}): RichBlock {
  return { align: null, size: 'normal', runs, ...patch };
}

const plain = (text: string): RichRun => ({ text, strong: false, emphasis: false });
const bold = (text: string): RichRun => ({ text, strong: true, emphasis: false });
const italic = (text: string): RichRun => ({ text, strong: false, emphasis: true });

describe('prose that was written before there was a format', () => {
  it('reads back as itself, with nothing marked', () => {
    for (const value of [
      'A studio for quiet work.',
      '央艺是一间小小的工作室。',
      'Ask about the 2024 programme.',
      'Open 09:00–18:00',
    ]) {
      expect(parseRichText(value), value).toEqual([block([plain(value)])]);
    }
  });

  it('leaves a lone asterisk, and arithmetic, alone', () => {
    // The flanking rule: an asterisk with a space after it opens nothing.
    expect(parseRichText('2 * 3 * 4')).toEqual([block([plain('2 * 3 * 4')])]);
    expect(parseRichText('a footnote *')).toEqual([block([plain('a footnote *')])]);
    expect(parseRichText('*unclosed')).toEqual([block([plain('*unclosed')])]);
  });

  it('leaves a brace group that is not a directive alone', () => {
    expect(parseRichText('{hello} world')).toEqual([block([plain('{hello} world')])]);
    expect(parseRichText('{center left}x')).toEqual([block([plain('{center left}x')])]);
    expect(parseRichText('{}')).toEqual([block([plain('{}')])]);
  });

  it('keeps every line, blank ones included', () => {
    expect(parseRichText('one\n\ntwo')).toEqual([
      block([plain('one')]),
      block([]),
      block([plain('two')]),
    ]);
  });
});

describe('the marks', () => {
  it('reads bold, italic, and both', () => {
    expect(parseRichText('a **b** c')).toEqual([block([plain('a '), bold('b'), plain(' c')])]);
    expect(parseRichText('a *b* c')).toEqual([block([plain('a '), italic('b'), plain(' c')])]);
    expect(parseRichText('***b***')).toEqual([
      block([{ text: 'b', strong: true, emphasis: true }]),
    ]);
  });

  it('reads a bold word inside an italic sentence', () => {
    expect(parseRichText('*a **b** c*')).toEqual([
      block([
        italic('a '),
        { text: 'b', strong: true, emphasis: true },
        italic(' c'),
      ]),
    ]);
  });

  it('refuses to open a run that has nowhere to close', () => {
    expect(parseRichText('**bold **x')).toEqual([block([plain('**bold **x')])]);
  });

  it('takes the meaning out of an escaped character', () => {
    expect(parseRichText('\\*not italic\\*')).toEqual([block([plain('*not italic*')])]);
    expect(parseRichText('\\{center}')).toEqual([block([plain('{center}')])]);
    expect(parseRichText('C:\\\\path')).toEqual([block([plain('C:\\path')])]);
  });
});

describe('the directive', () => {
  it('reads alignment, size, and both', () => {
    expect(parseRichText('{center}x')).toEqual([block([plain('x')], { align: 'center' })]);
    expect(parseRichText('{large}x')).toEqual([block([plain('x')], { size: 'large' })]);
    expect(parseRichText('{right larger}x')).toEqual([
      block([plain('x')], { align: 'right', size: 'larger' }),
    ]);
  });

  it('applies to its own line and no other', () => {
    expect(parseRichText('{center}one\ntwo')).toEqual([
      block([plain('one')], { align: 'center' }),
      block([plain('two')]),
    ]);
  });

  it('leaves alignment unset where the studio has not chosen one', () => {
    // null, not 'left' — the front page statement is centred by the site's own
    // stylesheet, and an unformatted line must not override it.
    expect(parseRichText('x')[0]?.align).toBeNull();
  });
});

describe('round trips', () => {
  const cases = [
    'A studio for **quiet** work.',
    '{center}A studio for **quiet** work.',
    '{center larger}One line.\n{center}And another.',
    '*a **b** c*',
    '2 * 3 * 4',
    '{hello} world',
    'C:\\path\\to',
    '',
    'one\n\ntwo',
    '央艺**工作室**',
    '**a*b*c**',
    'a **b c** d',
    '{left}x',
    '\\{center}x',
    '***everything***',
    '{center}**中文** *斜体*',
  ];

  it('formats back to something that parses the same way', () => {
    for (const value of cases) {
      const once = parseRichText(value);
      expect(parseRichText(formatRichText(once)), value).toEqual(once);
    }
  });

  it('writes a mark tight against its own words', () => {
    // A selection dragged past the end of a word: the spaces have to end up
    // outside the asterisks or the result does not parse back as bold.
    const written = formatRichText([block([plain('a'), bold(' b '), plain('c')])]);
    expect(written).toBe('a **b** c');
    expect(parseRichText(written)).toEqual([block([plain('a '), bold('b'), plain(' c')])]);
  });

  it('writes a mark that begins with a space as one that does not', () => {
    // The whole selection is one leading space and a word — index 0 has no
    // character to its left, which is exactly where an edge check goes wrong.
    const written = formatRichText([block([bold(' quiet')])]);
    expect(written).toBe(' **quiet**');
    expect(parseRichText(written)).toEqual([block([plain(' '), bold('quiet')])]);
  });

  it('drops a mark laid over nothing but spaces', () => {
    expect(formatRichText([block([plain('a'), italic('  '), plain('b')])])).toBe('a  b');
  });

  it('hides a brace the studio actually typed', () => {
    const written = formatRichText([block([plain('{center}')])]);
    expect(written).toBe('\\{center}');
    expect(richPlainText(written)).toBe('{center}');
  });
});

describe('the words on their own', () => {
  it('is the text with the formatting taken off', () => {
    expect(richPlainText('{center}A **quiet** studio')).toBe('A quiet studio');
    expect(richPlainText('one\ntwo')).toBe('one\ntwo');
  });

  it('is empty for a line that is nothing but formatting', () => {
    expect(richPlainText('{center}')).toBe('');
    expect(richPlainText('{center large}').trim()).toBe('');
  });
});
