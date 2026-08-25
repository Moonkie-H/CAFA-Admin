/**
 * Where the studio lands: what the site currently is, and where to change it.
 *
 * Everything on this page is already true somewhere else — the publish bar
 * knows the revision, the works page knows how many works there are, the dev
 * panel knows how many connectors there are. What this page adds is that they
 * are true *in one place*, which is the question you actually have when you
 * open the admin on a Tuesday: is what I published live, and is there anything
 * sitting unsaved.
 *
 * It reads and does not write. Every button here is a way to somewhere else;
 * publishing stays in the bar at the top, where it is on every page, because a
 * second Publish button is a second thing to keep in step with the first.
 *
 * The page composes and does not draw: the tiles are a component, the numbers
 * come from the editor's content or from a hook, and the two comparisons it
 * makes — how many photographs, and whether an origin is up to date — are
 * shared functions rather than loops written out here.
 */
import { useTranslation } from 'react-i18next';

import { citedKeys } from '../../../shared/content/images';
import type { Editor } from '../../hooks/useEditor';
import { useRemote } from '../../hooks/useRemote';
import { deploymentKey } from '../../lib/deployment';
import { formatUtcDateTime } from '../../lib/format';
import { connectorCount, connectorService } from '../../services/connectors';
import { publishService } from '../../services/publish';
import { Tile } from './Tile';

interface ControlPanelPageProps {
  editor: Editor;
}

export function ControlPanelPage({ editor }: ControlPanelPageProps) {
  const { t, i18n } = useTranslation();
  const { data: status, error: failure } = useRemote(publishService.status, t('dashboard.stateFailed'));

  // Read separately, and its failure is ignored on purpose: the read API not
  // answering is worth knowing about on the dev panel, not worth a banner here.
  const { data: document } = useRemote(connectorService.document, '');
  const connectors = document === null ? null : connectorCount(document);

  const content = editor.content;
  const photographs = citedKeys(content).size;
  const privateWorks = content.works.filter((work) => work.status === 'private').length;

  return (
    <section>
      <div className="section-head">
        <h2>{t('dashboard.title')}</h2>
      </div>
      <p className="section-note">{t('dashboard.intro')}</p>

      {failure !== null && <p className="problem">{failure}</p>}

      <h3 className="panel-heading">{t('dashboard.now')}</h3>
      <div className="tiles">
        <Tile
          label={t('dashboard.draft')}
          value={editor.dirty ? t('publish.unsaved') : t('dashboard.everythingSaved')}
          note={
            editor.problems.length > 0
              ? t('dashboard.problemsBlock', { count: editor.problems.length })
              : t('dashboard.savingBuildsPreview')
          }
          warn={editor.dirty || editor.problems.length > 0}
        />
        <Tile
          label={t('dashboard.published')}
          value={status === null ? '…' : (status.latestRevision?.toString() ?? t('dashboard.nothingYet'))}
          note={
            status?.publishedAt == null
              ? t('dashboard.nothingPublished')
              : t('dashboard.revisionPublished', {
                  date: formatUtcDateTime(status.publishedAt, i18n.language),
                })
          }
        />
        <Tile
          label={t('dashboard.liveSite')}
          value={
            status === null
              ? '…'
              : t(deploymentKey(status.latestRevision, status.production.revision))
          }
          note={status?.production.url ?? t('dashboard.noProduction')}
          warn={status !== null && status.unpublished}
          link={status?.production.url ?? undefined}
        />
        <Tile
          label={t('dashboard.preview')}
          value={
            status === null
              ? '…'
              : status.preview.url === null
                ? t('common.notConfigured')
                : t(deploymentKey(status.draftRevision, status.preview.revision))
          }
          note={status?.preview.url ?? t('dashboard.previewOptional')}
          link={status?.preview.url ?? undefined}
        />
      </div>

      <h3 className="panel-heading">{t('dashboard.contents')}</h3>
      <div className="tiles">
        <Tile
          label={t('dashboard.pages')}
          value={String(content.pages.length)}
          note={t('dashboard.pagesNote')}
          to="pages"
        />
        <Tile
          label={t('dashboard.works')}
          value={String(content.works.length)}
          note={
            privateWorks === 0
              ? t('dashboard.allPublic')
              : t('dashboard.privateWorks', { count: privateWorks })
          }
          to="works"
        />
        <Tile
          label={t('dashboard.programs')}
          value={String(content.programs.length)}
          note={t('dashboard.teaching')}
          to="programs"
        />
        <Tile
          label={t('dashboard.mentors')}
          value={String(content.mentors.length)}
          note={t('dashboard.withPortraits')}
          to="mentors"
        />
        <Tile
          label={t('dashboard.photos')}
          value={String(photographs)}
          note={t('dashboard.photoNote')}
          to="works"
        />
        <Tile
          label={t('dashboard.siteText')}
          value="中文 / EN"
          note={t('dashboard.bilingualNote')}
          to="copy"
        />
        <Tile
          label={t('dashboard.studio')}
          value={content.site.contact.email === '' ? t('common.incomplete') : t('common.set')}
          note={t('dashboard.contactNote')}
          to="site"
        />
      </div>

      <h3 className="panel-heading">{t('dashboard.frontend')}</h3>
      <div className="tiles">
        <Tile
          label={t('dashboard.connectors')}
          value={connectors === null ? '…' : String(connectors)}
          note={t('dashboard.connectorsNote')}
          to="dev"
        />
        <Tile label="api.json" value="OpenAPI 3.1" note={t('dashboard.apiNote')} link="/api.json" />
        <Tile
          label={t('dashboard.history')}
          value={t('dashboard.historyValue')}
          note={t('dashboard.historyNote')}
          to="history"
        />
      </div>
    </section>
  );
}
