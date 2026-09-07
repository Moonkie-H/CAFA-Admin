/**
 * The formatting the studio can put on a piece of prose, and how it is stored.
 *
 * Three things, and deliberately only three: a **bold** word, an *italic* word,
 * and the **size the field is set at, as a number**. There is no alignment and
 * there are no size presets, because both were answers to questions the studio
 * was not asking — it wanted to say "this line is 28 pixels", not to choose
 * between "large" and "larger" and then discover which of the six type roles
 * that landed on.
 *
 * **It is stored inside the string it formats.** A summary is still one `TEXT`
 * column, one `LocalisedText` field, one line of JSON in the published bundle;
 * nothing about the schema, the revisions, the read API or the build changed to
 * make room for it. That is the whole reason for the format: a second column
 * per field, or a JSON document in place of the string, would have been a
 * migration on ten tables, a new shape in every DTO and a second thing that can
 * be out of step with the first.
 *
 * The grammar, in full:
 *
 *   - A value may **open with a size** — `{28}`, at the very start, before the
 *     first character of the first line. It sets the whole field.
 *   - The rest is **lines**, split on newline.
 *   - Inside a line, `**this**` is bold and `*this*` is italic. `***both***`
 *     falls out of the two.
 *   - `\*`, `\{` and `\\` are the literal characters.
 *
 * And the two rules that make it safe to turn on over content nobody wrote for
 * it:
 *
 *   - **A number outside the range is not a size.** `{2026}` is a year in
 *     braces, because 2026 is not a size a field can be set to. Only a brace
 *     group holding one integer between RICH_SIZE_MIN and RICH_SIZE_MAX is
 *     read as a directive and taken off the value.
 *   - **A delimiter only marks when it has something to mark.** An asterisk
 *     opens a run only when a non-space follows it *and* a closing asterisk
 *     with a non-space before it exists further along the line. So `2 * 3 * 4`
 *     is arithmetic, not an italic 3, and a lone asterisk is a lone asterisk.
 */

/**
 * The size, as a number of pixels, and the two ends it sits between.
 *
 * A number rather than a step to the next type role, which is what this was:
 * the studio asked for the number it was thinking of, and a control offering
 * "normal / large / larger" made it guess which role each word meant on a page
 * it could not see from the form.
 *
 * The floor is the site's own. CLAUDE.md §9 puts body text at 14 px and never
 * below, so 14 is where the picker stops rather than somewhere the studio can
 * arrive at by holding the down arrow — the three roles that go under it (the
 * index, the metadata, the gutter labels) are the site's own carve-out and are
 * not something a prose field is allowed to reproduce. The ceiling is simply
 * larger than the biggest thing on the site, so nothing legitimate is out of
 * reach and a typo of an extra digit is caught rather than published.
 */
export const RICH_SIZE_MIN = 14;
export const RICH_SIZE_MAX = 120;

/** A stretch of text carrying the same two marks throughout. */
export interface RichRun {
  text: string;
  strong: boolean;
  emphasis: boolean;
}

/** One line of prose, as the runs it is made of. */
export type RichLine = RichRun[];

export interface RichText {
  /**
   * The size in pixels, or `null` for whatever the page sets this field at.
   *
   * The distinction is load-bearing rather than fussy. Most prose on the site
   * is drawn in the type role its page chose for it, and that is the right
   * answer — `null` is what every value written before this existed parses to
   * and it overrides nothing. A number is the studio saying otherwise, and it
   * does override, which is the point of typing one.
   *
   * It belongs to the *field*, not to a line, and that is why it sits here
   * rather than on RichLine. The same field in Chinese and in English is one
   * piece of copy set at one size; storing it per line meant the two languages
   * could disagree about how big the same sentence was, and the form had to ask
   * twice to keep them from doing it.
   */
  size: number | null;
  /** Never empty: `''` is one blank line. */
  lines: RichLine[];
}

/** The three characters a backslash can take the meaning out of. */
const ESCAPABLE: ReadonlySet<string> = new Set(['\\', '*', '{']);

const SIZE = /^\{(\d+)\}/;

interface Opening {
  size: number | null;
  /** How many characters it took. Zero where there was none. */
  length: number;
}

const NO_SIZE: Opening = { size: null, length: 0 };

/**
 * The size a value may open with — or nothing, which is most values.
 *
 * Read off the whole value rather than off each line, because a size is the
 * field's and a field is one size. A `{20}` at the start of the fourth line is
 * therefore the characters `{20}`, and prints as them.
 */
function readSize(source: string): Opening {
  const found = SIZE.exec(source);
  if (found === null) return NO_SIZE;
  const size = Number(found[1]);
  if (!Number.isInteger(size) || size < RICH_SIZE_MIN || size > RICH_SIZE_MAX) return NO_SIZE;
  return { size, length: found[0].length };
}

/**
 * The words the format used to understand, taken back off without being obeyed.
 *
 * This format had alignment and it had `large` / `larger`, and prose written
 * while it did still carries `{center}` and `{right larger}` at the head of a
 * line. Neither means anything now, so there are exactly two things that can
 * happen to such a line: it loses the directive, or it grows the literal text
 * "{center}" in front of a sentence on the live site. It loses the directive.
 *
 * No pixel value is invented from `large` on the way past. It meant "one type
 * role up from whatever this page draws this field in", which is not a number
 * this file knows — guessing one would put a size the studio never chose onto a
 * page it never asked about. Where a line was deliberately bigger, the studio
 * types the number it wanted, once, in a control that now shows it the number.
 */
const RETIRED_ALIGNS: ReadonlySet<string> = new Set(['left', 'center', 'right']);
const RETIRED_SIZES: ReadonlySet<string> = new Set(['normal', 'large', 'larger']);

const BRACE_WORDS = /^\{([a-z]+(?: [a-z]+)*)\}/;

function stripRetired(line: string): string {
  const found = BRACE_WORDS.exec(line);
  if (found === null) return line;

  // One alignment and one size at most, in either order — character for
  // character the test the old parser applied before it stripped a directive.
  // It has to be that test and not a looser one: `{center left}` named two
  // alignments, so it was never a directive and has always printed itself, and
  // a line that read as literal text then must read as literal text now.
  let align = false;
  let size = false;
  for (const word of (found[1] ?? '').split(' ')) {
    if (!align && RETIRED_ALIGNS.has(word)) align = true;
    else if (!size && RETIRED_SIZES.has(word)) size = true;
    else return line;
  }
  return line.slice(found[0].length);
}

function isSpace(char: string | undefined): boolean {
  return char === undefined || /\s/.test(char);
}

/** A delimiter opens only when there is something on its right to mark. */
function opens(source: string, at: number, width: number): boolean {
  return !isSpace(source[at + width]);
}

/** ...and closes only when there is something on its left it has marked. */
function closes(source: string, at: number): boolean {
  return !isSpace(source[at - 1]);
}

/** Whether the run being opened here has somewhere to end. */
function hasCloser(source: string, from: number, marker: string): boolean {
  for (let at = from; at < source.length; at += 1) {
    if (source[at] === '\\') {
      at += 1;
      continue;
    }
    if (source.startsWith(marker, at) && closes(source, at)) return true;
  }
  return false;
}

function parseRuns(source: string): RichLine {
  const runs: RichLine = [];
  let text = '';
  let strong = false;
  let emphasis = false;

  const flush = () => {
    if (text !== '') runs.push({ text, strong, emphasis });
    text = '';
  };

  let at = 0;
  while (at < source.length) {
    const char = source[at] ?? '';

    if (char === '\\' && ESCAPABLE.has(source[at + 1] ?? '')) {
      text += source[at + 1];
      at += 2;
      continue;
    }

    if (char === '*') {
      const double = source.startsWith('**', at);
      const width = double ? 2 : 1;
      const marker = double ? '**' : '*';
      const turns = (double ? strong : emphasis)
        ? closes(source, at)
        : opens(source, at, width) && hasCloser(source, at + width, marker);
      if (turns) {
        flush();
        if (double) strong = !strong;
        else emphasis = !emphasis;
      } else {
        // Both of them, together. A `**` that cannot turn is a pair of literal
        // asterisks — letting it fall through one character at a time would
        // have the second half open an italic across the rest of the line,
        // which is how `**bold **x` used to come out half in italics.
        text += marker;
      }
      at += width;
      continue;
    }

    text += char;
    at += 1;
  }

  flush();
  return runs;
}

/** One value, as its size and the lines it is made of. */
export function parseRichText(source: string): RichText {
  const normalised = source.replace(/\r\n?/g, '\n');
  const opening = readSize(normalised);
  return {
    size: opening.size,
    lines: normalised
      .slice(opening.length)
      .split('\n')
      .map((line) => parseRuns(stripRetired(line))),
  };
}

function escapeText(text: string): string {
  return text.replace(/[\\*]/g, (char) => `\\${char}`);
}

/**
 * The two marks, in the order a fresh pair is opened in.
 *
 * Only the order they are *opened* in when neither is already open — where one
 * is, the other nests inside it, which is what keeps `*a **b** c*` from being
 * written as delimiters that cross.
 */
const MARKS = ['strong', 'emphasis'] as const;

type Mark = (typeof MARKS)[number];

const DELIMITER: Record<Mark, string> = { strong: '**', emphasis: '*' };

function marked(run: RichRun, mark: Mark): boolean {
  return mark === 'strong' ? run.strong : run.emphasis;
}

/** Take the innermost mark back off, and write the delimiter that does it. */
function close(open: Mark[]): string {
  const mark = open.pop();
  return mark === undefined ? '' : DELIMITER[mark];
}

/**
 * Move a mark's own leading and trailing spaces outside it.
 *
 * `** bold **` does not parse back as bold, by the flanking rule above, so it
 * must never be written. A selection dragged past the end of a word is the
 * ordinary way to acquire that space, so this is not an edge case — it is what
 * happens the third time somebody uses the toolbar.
 *
 * It has to be the space at the *edge of a mark*, not the space at the edge of
 * a run, and the difference is the whole reason this works a character at a
 * time. `*a **b** c*` is three runs, and the spaces around the bold word are in
 * the middle of the italic that spans all three; trimming per run would have
 * cut that italic into three, each ending where the next began.
 *
 * Two passes rather than one, because a leading space is found by looking left
 * and a trailing one by looking right. Each clears as it goes, so a whole run
 * of spaces at an edge — or a mark laid over nothing but spaces — comes off in
 * the one pass.
 */
function tightened(runs: readonly RichRun[]): RichRun[] {
  const letters: RichRun[] = runs.flatMap((run) =>
    // Code points, not code units: a run of Chinese is what this mostly holds.
    [...run.text].map((text) => ({ text, strong: run.strong, emphasis: run.emphasis })),
  );

  for (const mark of MARKS) {
    for (let at = 0; at < letters.length; at += 1) {
      const letter = letters[at];
      const before = letters[at - 1];
      if (letter === undefined || !marked(letter, mark) || !isSpace(letter.text)) continue;
      if (before === undefined || !marked(before, mark)) letter[mark] = false;
    }
    for (let at = letters.length - 1; at >= 0; at -= 1) {
      const letter = letters[at];
      const after = letters[at + 1];
      if (letter === undefined || !marked(letter, mark) || !isSpace(letter.text)) continue;
      if (after === undefined || !marked(after, mark)) letter[mark] = false;
    }
  }

  const out: RichRun[] = [];
  for (const letter of letters) {
    const last = out[out.length - 1];
    if (last !== undefined && last.strong === letter.strong && last.emphasis === letter.emphasis) {
      last.text += letter.text;
    } else {
      out.push({ ...letter });
    }
  }
  return out;
}

/**
 * The runs as a line of markup, with the delimiters nested rather than crossed.
 *
 * A stack, because which mark is inside which is decided by whichever opened
 * first and not by any order chosen here. Closing the inner one and leaving the
 * outer one open is the ordinary case — `*a **b** c*` — and it is exactly what
 * a pair of independent flags gets wrong.
 */
function formatRuns(runs: readonly RichRun[]): string {
  const open: Mark[] = [];
  let out = '';

  for (const run of tightened(runs)) {
    // Everything above the deepest mark this run still wants comes back off.
    let keep = 0;
    for (const mark of open) {
      if (!marked(run, mark)) break;
      keep += 1;
    }
    while (open.length > keep) out += close(open);

    for (const mark of MARKS) {
      if (marked(run, mark) && !open.includes(mark)) {
        out += DELIMITER[mark];
        open.push(mark);
      }
    }
    out += escapeText(run.text);
  }

  while (open.length > 0) out += close(open);
  return out;
}

/**
 * A line, with a leading brace hidden.
 *
 * Unconditionally, even on a line that follows the size directive and could not
 * be misread as one. Two things can eat a brace group — the size at the head of
 * the value and the retired keywords at the head of any line — and a rule per
 * position would be two rules to keep in step with them. `\{` costs one
 * character and parses back to `{` wherever it lands.
 */
function formatLine(runs: readonly RichRun[]): string {
  const body = formatRuns(runs);
  return body.startsWith('{') ? `\\${body}` : body;
}

/** The inverse of parseRichText. Round-trips: parse ∘ format ∘ parse = parse. */
export function formatRichText(value: RichText): string {
  const body = value.lines.map(formatLine).join('\n');
  return value.size === null ? body : `{${value.size}}${body}`;
}

/**
 * The words, with the formatting taken back off.
 *
 * What the validator measures a field against, so that `{28}` on its own —
 * which is not blank, and renders as nothing — is caught as the empty field it
 * is rather than saved as a line the site draws no words for.
 */
export function richPlainText(source: string): string {
  return parseRichText(source)
    .lines.map((runs) => runs.map((run) => run.text).join(''))
    .join('\n');
}
