/**
 * The list a record is opened from, and one row of it.
 *
 * Works, programmes and mentors all draw a numbered list whose rows open a
 * form, and what they share is the frame: the heading with an add button beside
 * it, the note under it, and a row whose left half is a number and a two-line
 * button. What they do not share is the middle — a work shows a year and a
 * status badge, a programme shows who it is for — so that stays with the screen
 * that knows about it, as children.
 *
 * The heading is the screen's own `h2` rather than a subheading, because on all
 * three screens the list *is* what the screen is for: a second heading over it
 * saying "Works" under a page already called Works is a line nobody reads.
 *
 * Deliberately no state and no knowledge of what a record is. Which row is open
 * is the URL; what a row says is the caller's.
 */
import type { ReactNode } from 'react';

interface RecordIndexProps {
  title: string;
  /** The word on the add button, and what it does. */
  addLabel: string;
  onAdd: () => void;
  /** Why the order of this list matters, said once above it. */
  note: string;
  /** What to say when there is nothing in the list yet. */
  empty: string;
  /** How many rows there are. Asked for rather than counted off `children`,
      which is a shape React does not promise anything about. */
  count: number;
  children: ReactNode;
}

export function RecordIndex({
  title,
  addLabel,
  onAdd,
  note,
  empty,
  count,
  children,
}: RecordIndexProps) {
  return (
    <section className="record-section">
      <header className="section-head">
        <h2>{title}</h2>
        <button type="button" className="button button-primary" onClick={onAdd}>
          {addLabel}
        </button>
      </header>

      <p className="section-note">{note}</p>

      {count === 0 ? <p className="empty">{empty}</p> : <ol className="record-list">{children}</ol>}
    </section>
  );
}

interface RecordRowProps {
  /** The figure down the left. Works number themselves; the rest count from one. */
  number: string;
  /** The two lines in the button that opens the record — Chinese over English. */
  title: string;
  subtitle: ReactNode;
  onOpen: () => void;
  /** The cells between the title and the controls. */
  children?: ReactNode;
  /** Reordering, and removing. Both belong to the list rather than to the row. */
  controls: ReactNode;
}

export function RecordRow({ number, title, subtitle, onOpen, children, controls }: RecordRowProps) {
  return (
    <li className="record-row">
      <span className="record-number">{number}</span>

      <button type="button" className="record-open" onClick={onOpen}>
        <span className="record-title">{title}</span>
        <span className="record-subtitle">{subtitle}</span>
      </button>

      {children}

      <span className="record-controls">{controls}</span>
    </li>
  );
}
