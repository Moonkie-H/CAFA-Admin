/**
 * The editing surface, read as blocks and written from them.
 *
 * A rich field is a `contenteditable`, which means the browser owns the DOM
 * inside it: it decides what pressing return makes, what Ctrl+B wraps a word
 * in, and what a backspace at the start of a line joins to what. So this file
 * is the two directions between that DOM and `shared/content/rich-text`'s
 * blocks — `paint` builds a canonical one, `readBlocks` reads whatever the
 * browser left behind.
 *
 * The asymmetry is deliberate and is the reason this works. What we write is
 * exact: one `<div>` per line, `<strong>` and `<em>` for the marks, the line's
 * alignment and size on its own dataset. What we read is *tolerant*: any block
 * element starts a line, `<b>` counts as `<strong>`, `<i>` as `<em>`, a `<br>`
 * in the middle of a line splits it, and a stray nesting is walked through
 * rather than refused. Being strict about what comes back would mean fighting
 * three browsers over the shape of a paragraph, and losing the studio's
 * sentence each time we lost.
 *
 * Nothing here re-renders on a keystroke. The surface is written once when the
 * value arrives from somewhere else and read on every input, which is what
 * keeps a Chinese IME working: a React re-render mid-composition takes the
 * half-typed characters out from under it.
 */
import {
  type RichAlign,
  type RichBlock,
  type RichRun,
  type RichSize,
  RICH_ALIGNS,
  RICH_SIZES,
} from '../../shared/content/rich-text';

/** What starts a new line when it turns up inside the surface. */
const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'ADDRESS',
  'ARTICLE',
  'BLOCKQUOTE',
  'DIV',
  'FIGURE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'UL',
]);

const STRONG_TAGS: ReadonlySet<string> = new Set(['B', 'STRONG']);
const EMPHASIS_TAGS: ReadonlySet<string> = new Set(['I', 'EM']);

/** The class a line carries, so the stylesheet can draw one. */
const LINE_CLASS = 'rich-line';

function readAlign(element: HTMLElement): RichAlign | null {
  const found = element.dataset.align;
  return RICH_ALIGNS.find((align) => align === found) ?? null;
}

function readSize(element: HTMLElement): RichSize | null {
  const found = element.dataset.size;
  return RICH_SIZES.find((size) => size === found) ?? null;
}

/**
 * The surface as blocks.
 *
 * Always at least one block: an empty field is one empty line, which is what
 * the format says an empty string is, and what the surface has to hold for
 * there to be somewhere to put the caret.
 */
export function readBlocks(root: HTMLElement): RichBlock[] {
  const blocks: RichBlock[] = [];
  let runs: RichRun[] = [];
  let align: RichAlign | null = null;
  let size: RichSize = 'normal';

  const close = () => {
    blocks.push({ align, size, runs });
    runs = [];
  };

  const walk = (node: Node, strong: boolean, emphasis: boolean): void => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        // A space typed at the end of a line comes back as U+00A0: every
        // browser writes one there so the space is not collapsed away while the
        // caret sits after it. It is a *non-breaking* space, and left in the
        // content it would follow the words onto the site and quietly forbid a
        // line break in the middle of a sentence. The studio typed a space.
        const text = (child.nodeValue ?? '').replace(/\u00A0/g, ' ');
        if (text !== '') runs.push({ text, strong, emphasis });
        continue;
      }
      if (!(child instanceof HTMLElement)) continue;

      if (child.tagName === 'BR') {
        // A trailing <br> is the filler every browser puts in an empty line so
        // it has a height. It is not a line break the studio typed, and reading
        // it as one turns every empty line into two.
        if (child !== node.lastChild) close();
        continue;
      }

      if (BLOCK_TAGS.has(child.tagName)) {
        if (runs.length > 0) close();
        const outerAlign = align;
        const outerSize = size;
        align = readAlign(child) ?? outerAlign;
        size = readSize(child) ?? outerSize;
        walk(child, strong, emphasis);
        close();
        align = outerAlign;
        size = outerSize;
        continue;
      }

      walk(
        child,
        strong || STRONG_TAGS.has(child.tagName),
        emphasis || EMPHASIS_TAGS.has(child.tagName),
      );
    }
  };

  walk(root, false, false);
  if (runs.length > 0 || blocks.length === 0) close();
  return blocks;
}

function lineElement(block: RichBlock): HTMLElement {
  const line = document.createElement('div');
  line.className = LINE_CLASS;
  if (block.align !== null) line.dataset.align = block.align;
  if (block.size !== 'normal') line.dataset.size = block.size;

  for (const run of block.runs) {
    let node: Node = document.createTextNode(run.text);
    if (run.emphasis) {
      const emphasis = document.createElement('em');
      emphasis.appendChild(node);
      node = emphasis;
    }
    if (run.strong) {
      const strong = document.createElement('strong');
      strong.appendChild(node);
      node = strong;
    }
    line.appendChild(node);
  }

  // The filler, so an empty line is a line the caret can sit on rather than a
  // collapsed box the pointer cannot reach.
  if (line.childNodes.length === 0) line.appendChild(document.createElement('br'));
  return line;
}

/** Draw the blocks into the surface, replacing whatever was there. */
export function paint(root: HTMLElement, blocks: readonly RichBlock[]): void {
  root.replaceChildren(...blocks.map(lineElement));
}

/**
 * The lines a selection touches, which is what a block control acts on.
 *
 * Direct element children of the surface, because that is what `paint` writes
 * and what a browser splitting a line on return leaves behind. A line nested
 * deeper than that is a shape no edit produces; `readBlocks` still copes with
 * one, but nothing has to aim a control at it.
 */
export function linesIn(root: HTMLElement, range: Range | null): HTMLElement[] {
  const lines = [...root.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  );
  if (range === null) return [];
  return lines.filter((line) => range.intersectsNode(line));
}

/**
 * The selection, if it is inside this surface and still pointing at live nodes.
 *
 * Both halves matter. A selection somewhere else on the page is not this
 * field's business — there are two of these on every bilingual pair. And a
 * range remembered from before `paint` replaced the contents points at nodes
 * that are no longer in the document, which is a range that silently matches
 * nothing rather than one that throws.
 */
export function rangeIn(root: HTMLElement): Range | null {
  const selection = document.getSelection();
  if (selection === null || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return root.contains(range.startContainer) ? range : null;
}

/** Take the whole of the surface, which is what "nothing selected" means here. */
export function selectAll(root: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(root);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** What the toolbar shows as switched on, for wherever the caret is. */
export interface RichState {
  strong: boolean;
  emphasis: boolean;
  align: RichAlign | null;
  size: RichSize;
}

export const NEUTRAL: RichState = { strong: false, emphasis: false, align: null, size: 'normal' };

/** Whether some ancestor of this node, up to the surface, is one of `tags`. */
function within(root: HTMLElement, node: Node, tags: ReadonlySet<string>): boolean {
  const from = node instanceof HTMLElement ? node : node.parentElement;
  for (let element = from; element !== null; element = element.parentElement) {
    if (tags.has(element.tagName)) return true;
    if (element === root) break;
  }
  return false;
}

/**
 * The marks a *stretch* of text carries — on only where every word has them.
 *
 * A collapsed caret has one place to ask about and this is not used for it. A
 * selection has many, and asking only the first was wrong in the way that
 * mattered most: after a control applies to the whole box, the range begins at
 * the box itself rather than inside the words, so the button that had just
 * bolded everything reported itself unpressed. A studio looking for whether
 * bold took needs the light to agree with the text.
 */
function marksAcross(root: HTMLElement, range: Range): Pick<RichState, 'strong' | 'emphasis'> | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let strong = true;
  let emphasis = true;
  let found = false;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if ((node.nodeValue ?? '') === '' || !range.intersectsNode(node)) continue;
    found = true;
    strong &&= within(root, node, STRONG_TAGS);
    emphasis &&= within(root, node, EMPHASIS_TAGS);
    if (!strong && !emphasis) break;
  }

  return found ? { strong, emphasis } : null;
}

export function stateAt(root: HTMLElement, range: Range | null): RichState {
  if (range === null) return NEUTRAL;

  const start = range.startContainer;
  if (!root.contains(start)) return NEUTRAL;

  const marks = range.collapsed
    ? {
        strong: within(root, start, STRONG_TAGS),
        emphasis: within(root, start, EMPHASIS_TAGS),
      }
    : (marksAcross(root, range) ?? { strong: false, emphasis: false });

  const state: RichState = { ...NEUTRAL, ...marks };
  const [line] = linesIn(root, range);
  if (line !== undefined) {
    state.align = readAlign(line);
    state.size = readSize(line) ?? 'normal';
  }
  return state;
}
