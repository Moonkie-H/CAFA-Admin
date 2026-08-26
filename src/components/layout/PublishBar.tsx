/**
 * Saving, previewing and publishing — the three states the studio cares about,
 * and the only place the difference between a draft and the live site is
 * explained.
 *
 * One bar along the foot of the window: where the draft stands on the left,
 * what you can do about it on the right, and a line of plain text underneath
 * when there is something to say. Ordinary buttons, in the order the work
 * happens; the order is the row, so it does not need numbering.
 *
 * "Is it live yet?" is answered by asking the site itself: the template writes
 * build-info.json with the revision it was built from, and the Worker fetches
 * it. A published revision that matches what the origin is serving means the
 * deploy landed. Nothing here infers it from elapsed time.
 *
 * The preview answers the same question against the draft, which has no
 * revision number of its own — so it reports a fingerprint of the content
 * instead, and the comparison is otherwise identical.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { deploymentOf } from '../../lib/deployment';
import type { Editor } from '../../hooks/useEditor';
import { useRemote } from '../../hooks/useRemote';
import { publishService } from '../../services/publish';

/** How often to re-ask while a build is in flight. */
const POLL_MS = 15_000;

interface PublishBarProps {
  editor: Editor;
}

export function PublishBar({ editor }: PublishBarProps) {
  const { t } = useTranslation();
  // A failed status poll is not worth interrupting an edit over, so the error
  // is never read: `useRemote` keeps the last good answer and the next poll
  // either succeeds or the save surfaces the real problem.
  const { data: status, reload } = useRemote(publishService.status, '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const preview =
    status === null ? 'unknown' : deploymentOf(status.draftRevision, status.preview.revision);
  const production =
    status === null ? 'unknown' : deploymentOf(status.latestRevision, status.production.revision);
  const settling = preview === 'building' || production === 'building';

  // Re-ask while a build is in flight, waiting a full interval *after* each
  // answer rather than every interval regardless — a slow reply should not
  // stack a second request behind the first.
  useEffect(() => {
    if (!settling) return;
    let stopped = false;
    let timer = 0;

    const tick = async (): Promise<void> => {
      await reload();
      if (!stopped) timer = window.setTimeout(() => void tick(), POLL_MS);
    };
    timer = window.setTimeout(() => void tick(), POLL_MS);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [settling, reload]);

  const blocked = editor.problems.length > 0;
  const unpublished = status?.unpublished ?? false;

  async function onSave(): Promise<void> {
    setNotice(null);
    if (await editor.save()) {
      setNotice(t('publish.savedNotice'));
      await reload();
    }
  }

  async function onPublish(): Promise<void> {
    setBusy(true);
    setNotice(null);
    try {
      const result = await publishService.publish();
      setNotice(
        result.published
          ? t('publish.publishedNotice', { revision: result.revision })
          : (result.reason ?? t('publish.nothing')),
      );
      await reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t('publish.failed'));
    } finally {
      setBusy(false);
    }
  }

  // One sentence at a time, most urgent first: a failure, then what just
  // happened, then the reason a button next to it is doing nothing.
  const message =
    editor.error ??
    notice ??
    (editor.dirty && unpublished ? t('publish.saveFirst') : null);

  return (
    <div className="publish-bar" aria-label={t('publish.workflow')}>
      <p className="publish-state">
        <span className={`state ${editor.dirty ? 'state-warn' : 'state-ok'}`}>
          <span className="state-dot" aria-hidden="true" />
          {editor.dirty ? t('publish.unsaved') : t('publish.saved')}
        </span>

        {unpublished && <span className="state state-warn">{t('publish.notLive')}</span>}

        {status?.latestRevision != null && (
          <span className="state">{t('publish.revision', { revision: status.latestRevision })}</span>
        )}

        {preview === 'building' && <span className="state">{t('publish.previewBuilding')}</span>}
        {production === 'building' && <span className="state">{t('publish.publishing')}</span>}
      </p>

      <div className="publish-actions">
        <button
          type="button"
          className="button"
          disabled={!editor.dirty || editor.saving || editor.uploading || blocked}
          onClick={() => void onSave()}
        >
          {editor.saving ? t('publish.saving') : t('publish.save')}
        </button>

        {status?.preview.url != null && !editor.dirty ? (
          <a
            className="button button-external"
            href={status.preview.url}
            target="_blank"
            rel="noreferrer"
          >
            {t('publish.preview')}
          </a>
        ) : (
          <button className="button" type="button" disabled>
            {status?.preview.url == null ? t('publish.previewUnavailable') : t('publish.preview')}
          </button>
        )}

        <button
          type="button"
          className="button button-primary"
          disabled={busy || editor.dirty || !unpublished}
          onClick={() => void onPublish()}
        >
          {busy ? t('publish.publishing') : t('publish.publish')}
        </button>

        {status?.production.url != null && (
          <a
            className="button button-external publish-live"
            href={status.production.url}
            target="_blank"
            rel="noreferrer"
          >
            {t('publish.live')}
          </a>
        )}
      </div>

      {message !== null && (
        <p className={`publish-notice${editor.error !== null ? ' problem' : ''}`} aria-live="polite">
          {message}
        </p>
      )}
    </div>
  );
}
