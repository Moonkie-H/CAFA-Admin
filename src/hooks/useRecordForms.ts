/**
 * An index of records, and the form behind whichever one is open.
 *
 * Works and Pages are the same screen twice: a list you can reorder, and a form
 * that replaces it when you open a row. What they share is not the markup —
 * a work has a year and a status badge, a page has a section count — but the
 * little state machine underneath, which is the part that is easy to get subtly
 * wrong and impossible to see wrong by reading.
 *
 * Which record is open is held as a *position*, not as the record itself, so
 * editing the open record does not have to write back into two places. The
 * catch that comes with that is a position outliving what it points at: delete
 * the last work while its form is open and the index still says 9. Both screens
 * used to answer that by calling `setOpenAt(null)` in the render body and
 * returning null — a render-phase state update, which React tolerates and which
 * costs a second render pass every time it fires.
 *
 * Deriving it instead removes the question. A position with nothing at it is
 * simply nothing open, computed on the way past, and there is no state to
 * correct and no extra pass to pay for.
 */
import { useState } from 'react';

export interface RecordForms<T> {
  /** The record whose form is showing, with where it sits. Null on the index. */
  open: { record: T; at: number } | null;
  /** Open the form on the record at this position. */
  show: (at: number) => void;
  /** Back to the index. */
  close: () => void;
  /** Append a blank record and open it, which is what "Add" means here. */
  add: (blank: () => T) => void;
  /** Replace the open record, leaving the rest of the list alone. */
  write: (next: T) => void;
}

export function useRecordForms<T>(
  items: readonly T[],
  onChange: (items: T[]) => void,
): RecordForms<T> {
  const [openAt, setOpenAt] = useState<number | null>(null);

  const record = openAt === null ? undefined : items[openAt];

  return {
    open: openAt === null || record === undefined ? null : { record, at: openAt },
    show: setOpenAt,
    close: () => setOpenAt(null),

    add: (blank) => {
      onChange([...items, blank()]);
      setOpenAt(items.length);
    },

    write: (next) => {
      if (openAt === null) return;
      onChange(items.map((existing, at) => (at === openAt ? next : existing)));
    },
  };
}
