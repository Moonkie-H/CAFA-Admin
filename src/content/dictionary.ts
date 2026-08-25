/**
 * Reaching one word inside a dictionary, by a path the compiler checks.
 *
 * The copy form needs a reader and a writer for each of forty-odd strings
 * buried two and three levels down a nested object. Writing that pair out by
 * hand — `(d) => d.contact.note` beside a four-deep spread to put it back — is
 * correct and costs six lines a field, which is how one screen came to be three
 * hundred lines of punctuation.
 *
 * `CopyPath` is what makes the short spelling safe. It is the set of paths that
 * actually lead to a string in `Dictionary`, computed from the type, so
 * `'contact.note'` compiles and `'contact.notes'` does not — the same guarantee
 * the hand-written lenses bought, stated once instead of once per field. Rename
 * a field on `Dictionary` and every path pointing at it stops compiling.
 *
 * The traversal underneath is untyped, and that is the trade: the boundary is
 * proved by `CopyPath`, and inside these two functions the object is walked as
 * plain records. Both are pure and total over a path the type admits.
 */
import type { Dictionary } from './types';

/**
 * Every path through `T` that ends at a string.
 *
 * `T[K] extends string ? K : …` is the recursion: a string leaf contributes its
 * own key, anything else contributes its key joined to its children's paths.
 */
type StringPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${StringPaths<T[K]>}`;
}[keyof T & string];

/** A path to one editable word — `'meta.title'`, `'works.status.completed'`. */
export type CopyPath = StringPaths<Dictionary>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The word at `path`. The empty string where a dictionary is mid-edit. */
export function readCopyPath(dictionary: Dictionary, path: CopyPath): string {
  let node: unknown = dictionary;
  for (const segment of path.split('.')) {
    if (!isRecord(node)) return '';
    node = node[segment];
  }
  return typeof node === 'string' ? node : '';
}

/**
 * The dictionary with `path` set to `value`, and nothing else touched.
 *
 * Rebuilt down the path rather than mutated, because the editor compares
 * content by identity to know it is dirty — writing in place would change a
 * word without anything noticing it had changed.
 */
export function writeCopyPath(
  dictionary: Dictionary,
  path: CopyPath,
  value: string,
): Dictionary {
  const segments = path.split('.');

  const rebuild = (node: unknown, at: number): unknown => {
    const segment = segments[at];
    if (segment === undefined) return value;
    const record = isRecord(node) ? node : {};
    return { ...record, [segment]: rebuild(record[segment], at + 1) };
  };

  return rebuild(dictionary, 0) as Dictionary;
}
