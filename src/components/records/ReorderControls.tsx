/**
 * The two buttons that move a row, and the ends they stop at.
 *
 * Three lists need this — the repeatable beside it, the works index and the
 * pages index — and the part worth having once is not the arrows but the
 * boundary: the first row cannot go up, the last cannot go down. Written out
 * per list, that is three chances to compare against the wrong end.
 *
 * Buttons rather than drag: it works with a keyboard, works on a phone, and
 * needs no library. The lists here are five to ten items long, which is well
 * inside what buttons handle gracefully.
 */
interface ReorderControlsProps<T> {
  items: readonly T[];
  at: number;
  onChange: (items: T[]) => void;
  /** What each button announces. Only the caller knows what the row is called. */
  upLabel: string;
  downLabel: string;
}

/** Moving an item within an array. Out-of-range is a no-op, not a throw. */
export function moved<T>(items: readonly T[], at: number, to: number): T[] {
  const next = [...items];
  if (to < 0 || to >= next.length) return next;
  const [item] = next.splice(at, 1);
  if (item === undefined) return [...items];
  next.splice(to, 0, item);
  return next;
}

export function ReorderControls<T>({
  items,
  at,
  onChange,
  upLabel,
  downLabel,
}: ReorderControlsProps<T>) {
  return (
    <>
      <button
        type="button"
        className="button button-quiet"
        disabled={at === 0}
        aria-label={upLabel}
        onClick={() => onChange(moved(items, at, at - 1))}
      >
        ↑
      </button>
      <button
        type="button"
        className="button button-quiet"
        disabled={at === items.length - 1}
        aria-label={downLabel}
        onClick={() => onChange(moved(items, at, at + 1))}
      >
        ↓
      </button>
    </>
  );
}
