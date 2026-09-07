/**
 * The formatting the studio can put on a piece of prose, and how it is stored.
 *
 * The studio asked to be able to bold a word, italicise one, set a line bigger
 * and push a line to the middle — and asked for it on every box they type prose
 * into. This is the one place that says what those four things are, so the form
 * that writes them and the site that draws them cannot disagree about it.
 *
 * **It is stored inside the string it formats.** A summary is still one `TEXT`
 * column, one `LocalisedText` field, one line of JSON in the published bundle;
 * nothing about the schema, the revisions, the read API or the build changed to
 * make room for it. That is the whole reason for the format: a second column
 * per field, or a JSON document in place of the string, would have been a
 * migration on ten tables, a new shape in every DTO and a second thing that can
 * be out of step with the first. What the studio can express here is small
 * enough to write down in a line of text, so it is written down in the line of
 * text.
 *
 * The grammar, in full:
 *
 *   - A value is **lines**, split on newline. A line is a block: it can be
 *     aligned and it can be set a step or two larger.
 *   - A line may open with a **directive** — `{center}`, `{large}`,
 *     `{right larger}` — naming its alignment, its size, or both.
 *   - Inside a line, `**this**` is bold and `*this*` is italic. `***both***`
 *     falls out of the two.
 *   - `\*`, `\{` and `\\` are the literal characters.
 *
 * And the two rules that make it safe to turn on over content nobody wrote for
 * it — which is all of it, today:
 *
 *   - **An unrecognised directive is not a directive.** `{hello}` is the word
 *     "hello" in braces, because `hello` is not one of the six keywords. Only a
 *     brace group whose every word is a keyword is stripped.
 *   - **A delimiter only marks when it has something to mark.** An asterisk
 *     opens a run only when a non-space follows it *and* a closing asterisk
 *     with a non-space before it exists further along the line. So `2 * 3 * 4`
 *     is arithmetic, not an italic 3, and a lone asterisk is a lone asterisk.
 *
 * Which means every string already in the database parses to exactly itself
 * with no formatting on it, and there is nothing to migrate.
 */

export const RICH_ALIGNS = ['left', 'center', 'right'] as const;

export type RichAlign = (typeof RICH_ALIGNS)[number];

/**
 * A size as a step, not a measurement.
 *
 * The same three words the site-wide type scale uses, and for the same reason:
 * the site has six type roles and they are what make its pages look like one
 * site. A field that could put a number of pixels on a paragraph could break
 * the contrast floor and the touch floor in a single edit. A step moves the
 * line to the *next role up* — the site's own next size — so a formatted page
 * still sets type in six sizes rather than in as many as there are paragraphs.
 *
 * No step down, for the third time in this codebase and the same reason: three
 * of the roles already sit on the smallest size the accessibility rules allow.
 */
export const RICH_SIZES = ['normal', 'large', 'larger'] as const;

export type RichSize = (typeof RICH_SIZES)[number];

/** A stretch of text carrying the same two marks throughout. */
export interface RichRun {
  text: string;
  strong: boolean;
  emphasis: boolean;
}

export interface RichBlock {
  /**
   * How the line is aligned, or `null` for however the design lays it out.
   *
   * The distinction is load-bearing rather than fussy. The front page statement
   * is centred by the site's own stylesheet; if "not aligned" meant "aligned
   * left", turning this on would have silently un-centred a statement nobody
   * touched. `null` is what every existing line parses to and it overrides
   * nothing. `left` is what the studio pressing the left button writes, and it
   * does override — which is the point of pressing it.
   */
  align: RichAlign | null;
  size: RichSize;
  runs: RichRun[];
}

const ALIGNS: ReadonlySet<string> = new Set(RICH_ALIGNS);
const SIZES: ReadonlySet<string> = new Set(RICH_SIZES);

/** The three characters a backslash can take the meaning out of. */
const ESCAPABLE: ReadonlySet<string> = new Set(['\\', '*', '{']);

const DIRECTIVE = /^\{([a-z]+(?: [a-z]+)*)\}/;

interface Directive {
  align: RichAlign | null;
  size: RichSize;
  /** How many characters it took. Zero where there was none. */
  length: number;
}

const NO_DIRECTIVE: Directive = { align: null, size: 'normal', length: 0 };

/**
 * The brace group a line may open with — or nothing, which is most lines.
 *
 * Every word has to be a keyword, and no keyword twice, or the whole group is
 * ordinary text. That is what lets this be switched on over prose written years
 * before it existed without reading a single sentence differently.
 */
function readDirective(source: string): Directive {
  const found = DIRECTIVE.exec(source);
  if (found === null) return NO_DIRECTIVE;

  let align: RichAlign | null = null;
  let size: RichSize | null = null;
  for (const word of (found[1] ?? '').split(' ')) {
    if (align === null && ALIGNS.has(word)) align = word as RichAlign;
    else if (size === null && SIZES.has(word)) size = word as RichSize;
    else return NO_DIRECTIVE;
  }
  return { align, size: size ?? 'normal', length: found[0].length };
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

function parseRuns(source: string): RichRun[] {
  const runs: RichRun[] = [];
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

/** One value, as the lines it is made of. Never empty: `''` is one blank line. */
export function parseRichText(source: string): RichBlock[] {
  return source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      const directive = readDirective(line);
      return {
        align: directive.align,
        size: directive.size,
        runs: parseRuns(line.slice(directive.length)),
      };
    });
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

function formatBlock(block: RichBlock): string {
  const words = [
    ...(block.align === null ? [] : [block.align]),
    ...(block.size === 'normal' ? [] : [block.size]),
  ];
  const body = formatRuns(block.runs);
  // A brace only needs hiding where there is no directive in front of it: after
  // one, the line has already been read and what follows is plain text.
  if (words.length === 0) return body.startsWith('{') ? `\\${body}` : body;
  return `{${words.join(' ')}}${body}`;
}

/** The inverse of parseRichText. Round-trips: parse ∘ format ∘ parse = parse. */
export function formatRichText(blocks: readonly RichBlock[]): string {
  return blocks.map(formatBlock).join('\n');
}

/**
 * The words, with the formatting taken back off.
 *
 * What the validator measures a field against, so that `{center}` on its own —
 * which is not blank, and renders as nothing — is caught as the empty field it
 * is rather than saved as a line the site draws no words for.
 */
export function richPlainText(source: string): string {
  return parseRichText(source)
    .map((block) => block.runs.map((run) => run.text).join(''))
    .join('\n');
}
