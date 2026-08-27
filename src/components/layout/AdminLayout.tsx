/**
 * The frame every screen sits in: who you are, where the draft stands, the
 * site as a tree, and the screen itself.
 *
 * **One scrolling thing, and it is the document.** The shell used to be a
 * viewport-height grid with a scrolling middle row, which meant two scroll
 * containers on every screen and a wheel that carried on past the end of one
 * into the other. Now the page is a page: it scrolls the way every other page
 * does, it stops where its content stops, and the momentum on a trackpad is the
 * browser's rather than something we re-implemented.
 *
 * What used to be at the foot of the window is at the top of it. Save, preview
 * and publish are the three things the studio is here to do, and they were
 * below the fold of a long form and above the fold of a short one; sticking
 * them under the header puts them in the same place on every screen and in the
 * place the eye already goes.
 *
 * The chrome measures itself. Two things below it stick to the top of the
 * scrolling page — the sidebar, and the dev panel's index — and both need to
 * stop where the chrome ends. That distance is not a constant we can write down
 * (the bar wraps at narrow widths and grows a line when it has something to
 * say), so it is observed once here and published as `--chrome`, which is the
 * one number the rest of the stylesheet reads rather than guesses.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { at, type Route } from '../../routes';
import { sessionService } from '../../services/session';
import type { Editor } from '../../hooks/useEditor';
import { LanguageToggle } from './LanguageToggle';
import { PublishBar } from './PublishBar';
import { RouteLink } from './RouteLink';
import { SiteNav } from './SiteNav';

interface AdminLayoutProps {
  editor: Editor;
  login: string;
  route: Route;
  onSignedOut: () => void;
  children: ReactNode;
}

export function AdminLayout({ editor, login, route, onSignedOut, children }: AdminLayoutProps) {
  const { t } = useTranslation();
  const chrome = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = chrome.current;
    if (element === null) return;
    const observer = new ResizeObserver(([entry]) => {
      const height = entry?.borderBoxSize?.[0]?.blockSize ?? element.offsetHeight;
      document.documentElement.style.setProperty('--chrome', `${height}px`);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Arriving somewhere new starts at the top of it. The document is what
  // scrolls now, so this is the browser's own scroll rather than a container's,
  // and `instant` because the entrance below is the motion — a smooth scroll
  // underneath it would be two things moving at once.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [route.section, route.record]);

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
      <div className="chrome" ref={chrome}>
        <header className="top">
          <RouteLink to={at('control')} className="brand">
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

        <PublishBar editor={editor} />
      </div>

      <div className="body">
        <SiteNav editor={editor} route={route} />
        {/* Keyed by the screen, so leaving one and arriving at another is a
            remount — which is what gives the arrival its entrance and what
            drops a form's scroll position instead of carrying it into the next
            form. */}
        <main className="main" key={`${route.section}/${route.record ?? ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
