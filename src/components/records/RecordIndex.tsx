/**
 * The list a record is opened from, and one row of it.
 *
 * Works and Pages both draw a numbered list whose rows open a form, and what
 * they share is the frame: the heading with an add button beside it, the note
 * under it, and a row whose left half is a number and a two-line button. What
 * they do not share is the middle — a work shows a year and a status badge, a
 * page shows how many sections it has and whether it is in the menu — so that
 * stays with the screen that knows about it, as children.
 *
 * Deliberately no state and no knowledge of what a record is. Which row is open
 * is `useRecordForms`; what a row says is the caller's.
 */
import type { ReactNode } from 'react';

interface RecordIndexProps {
  title: string;
  /** The word on the add button, and what it does. */
  addLabel: string;
  onAdd: () => void;
  /** Why the order of this list matters, said once above it. */
  note: string;
  children: ReactNode;
}

export function RecordIndex({ title, addLabel, onAdd, note, children }: RecordIndexProps) {
  return (
    <section>
      <header className="section-head">
        <h2>{title}</h2>
        <button type="button" className="button button-primary" onClick={onAdd}>
          {addLabel}
        </button>
      </header>

      <p className="section-note">{note}</p>

      <ol className="record-list">{children}</ol>
    </section>
  );
}

interface RecordRowProps {
  /** The figure down the left. Works number themselves; pages count from one. */
  number: string;
  /** The two lines in the button that opens the record — Chinese over English. */
  title: string;
  subtitle: ReactNode;
  onOpen: () => void;
  /** The cells between the title and the reorder buttons. */
  children: ReactNode;
}

export function RecordRow({ number, title, subtitle, onOpen, children }: RecordRowProps) {
  return (
    <li className="record-row">
      <span className="record-number">{number}</span>

      <button type="button" className="record-open" onClick={onOpen}>
        <span className="record-title">{title}</span>
        <span className="record-subtitle">{subtitle}</span>
      </button>

      {children}
    </li>
  );
}
