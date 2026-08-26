/**
 * The reference for whoever is building the site that reads this content.
 *
 * It draws nothing of its own. Everything on the page — the endpoints, their
 * parameters, their shapes, the prose at the top — is read from /api.json,
 * which the Worker compiles from the connector registry on the way out. So this
 * panel cannot describe an endpoint that does not exist, and cannot miss one
 * that does; adding a connector in worker/connectors/registry.ts makes a card
 * appear here with no change to this file.
 */
import { useTranslation } from 'react-i18next';

import { useRemote } from '../../hooks/useRemote';
import {
  connectorCount,
  connectorService,
  DOCUMENT_PATH,
  groupsOf,
} from '../../services/connectors';
import { ConnectorCard } from './ConnectorCard';
import { plain, shortPath } from './markdown';

export function DevPanelPage() {
  const { t } = useTranslation();
  const { data: spec, error } = useRemote(connectorService.document, t('devPage.documentFailed'));

  if (error !== null) return <p className="problem">{error}</p>;
  if (spec === null) return <p className="empty">{t('devPage.loading')}</p>;

  const groups = groupsOf(spec);
  const server = spec.servers[0]?.url ?? window.location.origin;

  return (
    <section className="dev">
      <div className="section-head">
        <h2>{t('pages.developer')}</h2>
        <span className="pill">v{spec.info.version}</span>
        <span className="pill">OpenAPI {spec.openapi}</span>
        <span className="pill">{t('devPage.connectors', { count: connectorCount(spec) })}</span>
      </div>
      <p className="section-note">{t('devPage.intro')}</p>

      <div className="dev-server">
        <div>
          <span className="tile-label">{t('devPage.server')}</span>
          <code className="dev-origin">{server}</code>
        </div>
        <a className="button" href={DOCUMENT_PATH} download="api.json">
          {t('devPage.download')}
        </a>
      </div>

      <p className="dev-overview">{plain(spec.info.description)}</p>

      <div className="dev-layout">
        <nav className="dev-index" aria-label={t('devPage.connectorsNav')}>
          {groups.map((group) => (
            <div key={group.name} className="dev-index-group">
              <span className="dev-index-title">{group.name}</span>
              <ul>
                {group.connectors.map((connector) => (
                  <li key={connector.id}>
                    <a href={`#${connector.id}`}>
                      <code>{shortPath(connector.path)}</code>
                      <span className="method">GET</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="dev-main">
          {groups.map((group) => (
            <div key={group.name} className="dev-group">
              <h3 className="panel-heading">{group.name}</h3>
              <p className="section-note">{plain(group.description)}</p>
              {group.connectors.map((connector) => (
                <ConnectorCard key={connector.id} connector={connector} server={server} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
