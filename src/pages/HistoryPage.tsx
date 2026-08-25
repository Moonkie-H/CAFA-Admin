/**
 * Every revision that has ever been live, and the way back to one.
 *
 * Restoring does not rewind anything. It publishes the chosen revision's
 * content as a *new* revision, so the history only ever grows and whatever is
 * live right now stays recoverable after you have rolled away from it. That is
 * why the confirmation below says "publish it again" rather than "roll back" —
 * the wording is the model.
 *
 * The one thing to be careful about is unsaved work: restoring re-publishes an
 * old snapshot, but the draft tables are untouched, so a dirty editor would
 * still be sitting on edits that are now behind the live site. The confirmation
 * says so when that is the case.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { publishService } from '../services/publish';
import type { Editor } from '../useEditor';
import { useRemote } from '../useRemote';
import { formatUtcDateTime } from '../ui/format';

interface HistoryPageProps {
  editor: Editor;
}

const readRevisions = (signal: AbortSignal) => publishService.revisions(signal);

export function HistoryPage({ editor }: HistoryPageProps) {
  const { t, i18n } = useTranslation();
  const { data: revisions, error: failure, reload } = useRemote(
    readRevisions,
    t('historyPage.readFailed'),
  );
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onRestore(id: number): Promise<void> {
    setBusy(true);
    setNotice(null);
    try {
      const result = await publishService.restore(id);
      setConfirming(null);
      setNotice(
        t('historyPage.restored', {
          from: result.restoredFrom ?? id,
          to: result.revision ?? id,
        }),
      );
      await reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('historyPage.restoreFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="section-head">
        <h2>{t('pages.history')}</h2>
      </div>
      <p className="section-note">
        {t('historyPage.intro')}
      </p>

      {failure !== null && <p className="problem">{failure}</p>}
      {notice !== null && <p className="publish-notice">{notice}</p>}

      {revisions === null && failure === null && <p className="empty">{t('historyPage.loading')}</p>}
      {revisions !== null && revisions.length === 0 && (
        <p className="empty">{t('historyPage.empty')}</p>
      )}

      {revisions !== null && revisions.length > 0 && (
        <ul className="repeatable-list">
          {revisions.map((revision, at) => (
            <li key={revision.id} className="repeatable-item">
              <div className="repeatable-head">
                <div className="repeatable-title">
                  <span className="record-number">{revision.id}</span> {revision.message}
                  {at === 0 && <span className="pill">{t('common.live')}</span>}
                </div>
                <div className="repeatable-controls">
                  {at !== 0 && (
                    <button
                      type="button"
                      className="button button-quiet"
                      disabled={busy}
                      onClick={() => setConfirming(revision.id)}
                    >
                      {t('historyPage.restore')}
                    </button>
                  )}
                </div>
              </div>

              <p className="record-meta">
                {revision.publishedBy} · {formatUtcDateTime(revision.publishedAt, i18n.language)}
              </p>

              {confirming === revision.id && (
                <div className="confirm">
                  <p>
                    {t('historyPage.question', { revision: revision.id })}
                  </p>
                  {editor.dirty && (
                    <p className="problem">
                      {t('historyPage.dirtyWarning')}
                    </p>
                  )}
                  <div className="repeatable-controls">
                    <button
                      type="button"
                      className="button button-danger"
                      disabled={busy}
                      onClick={() => void onRestore(revision.id)}
                    >
                      {busy ? t('historyPage.restoring') : t('historyPage.restoreIt')}
                    </button>
                    <button
                      type="button"
                      className="button button-quiet"
                      disabled={busy}
                      onClick={() => setConfirming(null)}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
