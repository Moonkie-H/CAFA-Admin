/**
 * Removing a record, with the question asked in between.
 *
 * Deleting a work or a person is one click away from an afternoon's typing and
 * there is no undo short of restoring a revision, so the button asks first. The
 * ask owns its own state because nothing outside it needs to know it is being
 * asked — every screen that used to carry a `confirmingDelete` flag carried it
 * for exactly these few lines.
 *
 * It appears twice on the same list and both are this component: once at the
 * foot of a record's own form, and once on each row of the index, because a
 * list you can add to and cannot remove from is a list that only grows. The
 * question and the two answers are one wrapping row either way, so nothing here
 * knows which of the two it is in.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DeleteRecordProps {
  /** The word on the button that starts the ask. */
  action: string;
  /** The question, with the record's own name already in it. */
  question: string;
  /** The word that goes through with it. */
  confirm: string;
  /**
   * What the first button announces, where the word on it is not enough — a row
   * in a list of ten says "Remove", and ten of those need telling apart.
   */
  label?: string;
  onDelete: () => void;
}

export function DeleteRecord({ action, question, confirm, label, onDelete }: DeleteRecordProps) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        className="button button-quiet button-danger"
        aria-label={label}
        onClick={() => setAsking(true)}
      >
        {action}
      </button>
    );
  }

  return (
    <div className="confirm" role="group" aria-label={question}>
      <p>{question}</p>
      <button type="button" className="button button-danger" onClick={onDelete}>
        {confirm}
      </button>
      <button type="button" className="button button-quiet" onClick={() => setAsking(false)}>
        {t('common.keepIt')}
      </button>
    </div>
  );
}
