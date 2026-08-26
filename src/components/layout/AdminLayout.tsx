/**
 * The frame every page sits in: a header, the navigation, the page, and the
 * draft workflow along the bottom.
 *
 * Three regions, none of them on top of another. The header is one row of plain
 * text and holds nothing that needs a menu to reach; the sidebar is editorial
 * navigation and the two utilities that are not editorial; the workflow — save,
 * preview, publish — sits in a bar at the foot of the window, where it is on
 * every page and never competes with the page's own heading for the top of the
 * screen. The main column reserves the bar's height, so the bar covers nothing.
 *
 * Navigation renders from the route table rather than a list of its own. Each
 * item is a real `<a href>` that the click handler intercepts — which means
 * middle-click, ⌘-click and "copy link" all behave, and the keyboard gets
 * anchor semantics for free rather than a button pretending to be a link.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ROUTES, type RouteGroup, type RoutePath } from '../../routes';
import { sessionService } from '../../services/session';
import type { Editor } from '../../hooks/useEditor';
import { LanguageToggle } from './LanguageToggle';
import { PublishBar } from './PublishBar';
import { RouteLink } from './RouteLink';

/** The order of the sidebar, and the heading each run of links sits under. */
const GROUPS: { group: RouteGroup; labelKey: string }[] = [
  { group: 'overview', labelKey: 'nav.overview' },
  { group: 'content', labelKey: 'nav.content' },
  { group: 'utility', labelKey: 'nav.tools' },
];

interface AdminLayoutProps {
  editor: Editor;
  login: string;
  route: RoutePath;
  onSignedOut: () => void;
  children: ReactNode;
}

export function AdminLayout({ editor, login, route, onSignedOut, children }: AdminLayoutProps) {
  const { t } = useTranslation();
  /**
   * A button rather than a link, because signing out is a POST now.
   *
   * The unsaved-changes question is asked here rather than left to the
   * browser's `beforeunload`, because nothing unloads — the app returns to the
   * sign-in screen in place, so this is the only place that can ask.
   */
  async function signOut() {
    if (editor.dirty && !window.confirm(t('account.unsavedSignOut'))) return;

    try {
      await sessionService.signOut();
    } finally {
      // Whatever the network did, the studio asked to be signed out. A request
      // that failed leaves a cookie behind on this browser and nowhere else.
      onSignedOut();
    }
  }

  return (
    <div className="shell">
      <header className="top">
        <RouteLink to="control" className="brand">
          {t('app.editor')}
        </RouteLink>

        <div className="top-account">
          <LanguageToggle />
          <span className="account-name" title={t('account.signedInAs')}>
            {login}
          </span>
          <button className="link-button" type="button" onClick={() => void signOut()}>
            {t('account.signOut')}
          </button>
        </div>
      </header>

      <div className="body">
        <nav className="sidebar" aria-label={t('nav.label')}>
          {GROUPS.map(({ group, labelKey }) => (
            <div className="sidebar-group" key={group}>
              <h2 className="sidebar-heading">{t(labelKey)}</h2>
              <ul className="sidebar-list">
                {ROUTES.filter((entry) => entry.group === group).map((entry) => {
                  const current = route === entry.path;
                  return (
                    <li key={entry.path}>
                      <RouteLink
                        to={entry.path}
                        current={current}
                        className={`sidebar-link${current ? ' is-current' : ''}`}
                      >
                        {t(entry.labelKey)}
                      </RouteLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <main className="main">{children}</main>
      </div>

      <PublishBar editor={editor} />
    </div>
  );
}
