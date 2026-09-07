/**
 * The formatting grammar, from both ends.
 *
 * Three properties matter more than any single case here, and most of what
 * follows is one of the three:
 *
 *  - **Nothing already written changes meaning.** Every string in the database
 *    was typed before this format existed, and none of it may start reading
 *    differently now that something parses it. So the cases with braces and
 *    asterisks in ordinary prose are the ones to keep.
 *  - **What the editor writes, the site reads back.** The toolbar builds a
 *    value and formats it; the build parses it. A round trip that loses a mark
 *    is a studio's edit silently discarded at publish.
 *  - **The retired directives leave no trace.** Alignment and the three size
 *    words were a real format that real prose was written in, and the one thing
 *    that must not happen to that prose is the word "{center}" appearing on the
 *    live site in front of a sentence.
 */
import { describe, expect, it } from 'vitest';

import {
  formatRichText,
  parseRichText,
  richPlainText,
  RICH_SIZE_MAX,
  RICH_SIZE_MIN,
  type RichLine,
  type RichRun,
  type RichText,
} from '../shared/content/rich-text';

/** A value, spelled at its shortest: unsized, which is what most fields are. */
function text(lines: RichLine[], size: number | null = null): RichText {
  return { size, lines };
}

/** ...and the commonest of those: one line, no size. */
function one(...runs: RichRun[]): RichText {
  return text([runs]);
}

const plain = (value: string): RichRun => ({ text: value, strong: false, emphasis: false });
const bold = (value: string): RichRun => ({ text: value, strong: true, emphasis: false });
const italic = (value: string): RichRun => ({ text: value, strong: false, emphasis: true });

describe('prose that was written before there was a format', () => {
  it('reads back as itself, with nothing marked', () => {
    for (const value of [
      'A studio for quiet work.',
      '央艺是一间小小的工作室。',
      'Ask about the 2024 programme.',
      'Open 09:00–18:00',
    ]) {
      expect(parseRichText(value), value).toEqual(one(plain(value)));
    }
  });

  it('leaves a lone asterisk, and arithmetic, alone', () => {
    // The flanking rule: an asterisk with a space after it opens nothing.
    expect(parseRichText('2 * 3 * 4')).toEqual(one(plain('2 * 3 * 4')));
    expect(parseRichText('a footnote *')).toEqual(one(plain('a footnote *')));
    expect(parseRichText('*unclosed')).toEqual(one(plain('*unclosed')));
  });

  it('leaves a brace group that is not a directive alone', () => {
    expect(parseRichText('{hello} world')).toEqual(one(plain('{hello} world')));
    expect(parseRichText('{}')).toEqual(one(plain('{}')));
  });

  it('keeps every line, blank ones included', () => {
    expect(parseRichText('one\n\ntwo')).toEqual(
      text([[plain('one')], [], [plain('two')]]),
    );
  });
});

describe('the marks', () => {
  it('reads bold, italic, and both', () => {
    expect(parseRichText('a **b** c')).toEqual(one(plain('a '), bold('b'), plain(' c')));
    expect(parseRichText('a *b* c')).toEqual(one(plain('a '), italic('b'), plain(' c')));
    expect(parseRichText('***b***')).toEqual(one({ text: 'b', strong: true, emphasis: true }));
  });

  it('reads a bold word inside an italic sentence', () => {
    expect(parseRichText('*a **b** c*')).toEqual(
      one(italic('a '), { text: 'b', strong: true, emphasis: true }, italic(' c')),
    );
  });

  it('refuses to open a run that has nowhere to close', () => {
    expect(parseRichText('**bold **x')).toEqual(one(plain('**bold **x')));
  });

  it('takes the meaning out of an escaped character', () => {
    expect(parseRichText('\\*not italic\\*')).toEqual(one(plain('*not italic*')));
    expect(parseRichText('\\{28}')).toEqual(one(plain('{28}')));
    expect(parseRichText('C:\\\\path')).toEqual(one(plain('C:\\path')));
  });
});

describe('the size', () => {
  it('is the number the studio typed', () => {
    expect(parseRichText('{28}x')).toEqual(text([[plain('x')]], 28));
    expect(parseRichText(`{${RICH_SIZE_MIN}}x`)).toEqual(text([[plain('x')]], RICH_SIZE_MIN));
    expect(parseRichText(`{${RICH_SIZE_MAX}}x`)).toEqual(text([[plain('x')]], RICH_SIZE_MAX));
  });

  it('belongs to the whole value, not to the line it is written on', () => {
    expect(parseRichText('{28}one\ntwo')).toEqual(text([[plain('one')], [plain('two')]], 28));
  });

  it('is unset where the studio has not typed one', () => {
    // null, not a number — most prose on the site is drawn in the type role its
    // page chose for it, and an unformatted line must not override that.
    expect(parseRichText('x').size).toBeNull();
  });

  it('is not a number outside the range, which is therefore ordinary text', () => {
    // The rule that makes this safe over content nobody wrote for it: a year in
    // braces is a year in braces.
    expect(parseRichText('{2026}x')).toEqual(one(plain('{2026}x')));
    expect(parseRichText(`{${RICH_SIZE_MIN - 1}}x`)).toEqual(
      one(plain(`{${RICH_SIZE_MIN - 1}}x`)),
    );
    expect(parseRichText(`{${RICH_SIZE_MAX + 1}}x`)).toEqual(
      one(plain(`{${RICH_SIZE_MAX + 1}}x`)),
    );
  });

  it('is only read at the head of the value', () => {
    // A brace on line four is four characters the studio typed.
    expect(parseRichText('one\n{28}two')).toEqual(text([[plain('one')], [plain('{28}two')]]));
  });
});

describe('the directives this format used to have', () => {
  it('drops an alignment rather than printing it', () => {
    expect(parseRichText('{center}x')).toEqual(one(plain('x')));
    expect(parseRichText('{right larger}x')).toEqual(one(plain('x')));
  });

  it('drops one wherever a line carries it, not only on the first', () => {
    expect(parseRichText('{center}one\n{large}two')).toEqual(
      text([[plain('one')], [plain('two')]]),
    );
  });

  it('invents no size from the words that used to name one', () => {
    // `large` meant "one type role up from whatever this page draws this field
    // in", which is not a number — so it becomes no number rather than a guess.
    expect(parseRichText('{large}x').size).toBeNull();
  });

  it('still leaves a brace group that was never a directive alone', () => {
    expect(parseRichText('{center left}x')).toEqual(one(plain('{center left}x')));
    expect(parseRichText('{center center}x')).toEqual(one(plain('{center center}x')));
  });
});

describe('round trips', () => {
  const cases = [
    'A studio for **quiet** work.',
    '{28}A studio for **quiet** work.',
    '{96}One line.\nAnd another.',
    '*a **b** c*',
    '2 * 3 * 4',
    '{hello} world',
    '{2026} was the year',
    'C:\\path\\to',
    '',
    'one\n\ntwo',
    '央艺**工作室**',
    '**a*b*c**',
    'a **b c** d',
    '\\{28}x',
    '***everything***',
    '{14}**中文** *斜体*',
    'one\n{28}two',
  ];

  it('formats back to something that parses the same way', () => {
    for (const value of cases) {
      const once = parseRichText(value);
      expect(parseRichText(formatRichText(once)), value).toEqual(once);
    }
  });

  it('writes the size once, at the head of the value', () => {
    expect(formatRichText(text([[plain('one')], [plain('two')]], 28))).toBe('{28}one\ntwo');
  });

  it('writes a mark tight against its own words', () => {
    // A selection dragged past the end of a word: the spaces have to end up
    // outside the asterisks or the result does not parse back as bold.
    const written = formatRichText(one(plain('a'), bold(' b '), plain('c')));
    expect(written).toBe('a **b** c');
    expect(parseRichText(written)).toEqual(one(plain('a '), bold('b'), plain(' c')));
  });

  it('writes a mark that begins with a space as one that does not', () => {
    // The whole selection is one leading space and a word — index 0 has no
    // character to its left, which is exactly where an edge check goes wrong.
    const written = formatRichText(one(bold(' quiet')));
    expect(written).toBe(' **quiet**');
    expect(parseRichText(written)).toEqual(one(plain(' '), bold('quiet')));
  });

  it('drops a mark laid over nothing but spaces', () => {
    expect(formatRichText(one(plain('a'), italic('  '), plain('b')))).toBe('a  b');
  });

  it('hides a brace the studio actually typed', () => {
    const written = formatRichText(one(plain('{28}')));
    expect(written).toBe('\\{28}');
    expect(richPlainText(written)).toBe('{28}');
  });

  it('hides one on a line that is not the first, where a retired word would eat it', () => {
    const written = formatRichText(text([[plain('one')], [plain('{center}')]]));
    expect(richPlainText(written)).toBe('one\n{center}');
  });
});

describe('the words on their own', () => {
  it('is the text with the formatting taken off', () => {
    expect(richPlainText('{28}A **quiet** studio')).toBe('A quiet studio');
    expect(richPlainText('one\ntwo')).toBe('one\ntwo');
  });

  it('is empty for a value that is nothing but formatting', () => {
    expect(richPlainText('{28}')).toBe('');
    expect(richPlainText('{center}').trim()).toBe('');
  });
});
