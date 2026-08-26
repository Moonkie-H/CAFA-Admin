/**
 * Removing a record, with the question asked in between.
 *
 * Deleting a work or a page is one click away from an afternoon's typing and
 * there is no undo short of restoring a revision, so the button asks first. The
 * ask owns its own state because nothing outside it needs to know it is being
 * asked — both pages used to carry a `confirmingDelete` flag whose entire reach
 * was these few lines.
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
  onDelete: () => void;
}

export function DeleteRecord({ action, question, confirm, onDelete }: DeleteRecordProps) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="button button-danger" onClick={() => setAsking(true)}>
        {action}
      </button>
    );
  }

  return (
    <div className="confirm">
      <p>{question}</p>
      <button type="button" className="button button-danger" onClick={onDelete}>
        {confirm}
      </button>
      <button type="button" className="button" onClick={() => setAsking(false)}>
        {t('common.keepIt')}
      </button>
    </div>
  );
}
