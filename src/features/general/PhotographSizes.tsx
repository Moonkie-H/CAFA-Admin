/**
 * The one maintenance job in the admin, and the reason it has to exist.
 *
 * The site cannot resize a photograph on its way to a reader. Image
 * Transformations are a zone setting on a paid plan, `MEDIA_TRANSFORM` says
 * `off`, and the published bundle carries that as `mediaTransform: false` — so
 * every `<img>` on the site points straight at the original in the bucket. For
 * a while that meant every device, phones included, was sent the 2400px file
 * with a `srcset` of exactly one candidate, and a page of them is where a
 * mobile browser gives up and draws a broken image instead.
 *
 * The fix is that the narrower copies are made *here*, in the browser, in the
 * pass where the photograph is already decoded in order to be resized — a
 * Worker has no decoder and there is no sharp anywhere in either repository.
 * New uploads have carried their ladder since; this is for everything that was
 * already in the bucket, and it is the only reason the studio ever has to press
 * a button that is not an edit.
 *
 * Nothing here changes a photograph. Each original is fetched and re-filed byte
 * for byte — not decoded and re-encoded — so its digest does not move, no URL
 * the site has published changes, and no cache is invalidated. The only new
 * objects are the rungs underneath it.
 */
import { useTranslation } from 'react-i18next';

import type { Editor } from '../../hooks/useEditor';

interface PhotographSizesProps {
  editor: Editor;
}

export function PhotographSizes({ editor }: PhotographSizesProps) {
  const { t } = useTranslation();
  const missing = editor.unladdered;

  return (
    <section>
      <h3 className="panel-heading">{t('photographs.title')}</h3>
      <p className="section-note">{t('photographs.intro')}</p>

      {missing === 0 ? (
        <p className="field-hint">{t('photographs.complete')}</p>
      ) : (
        <>
          <p className="field-hint">{t('photographs.missing', { count: missing })}</p>
          <p className="field-hint">{t('photographs.missingNote')}</p>
          <button
            type="button"
            className="button"
            disabled={editor.uploading}
            onClick={() => void editor.fillLadders()}
          >
            {editor.uploading ? t('photographs.working') : t('photographs.make')}
          </button>
          <p className="field-hint">{t('photographs.doneNote')}</p>
        </>
      )}
    </section>
  );
}
