/**
 * The shell: establish a session, load the content once, then route.
 *
 * Three states before any page renders — checking, signed out, loaded — and
 * they are separate on purpose. "Could not reach the site" and "you are not
 * signed in" are different problems with different fixes, and collapsing them
 * into one screen is how an expired cookie comes to look like an outage.
 *
 * The content is loaded once, here, and held for the session. Every page edits
 * the same in-memory `ContentSet` through the same `Editor`, which is what lets
 * a save be one transaction over the whole thing rather than six that could
 * half-succeed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ProblemList } from './components/ProblemList';
import { AdminLayout } from './components/layout/AdminLayout';
import { AboutPage } from './features/about/AboutPage';
import { ContactPage } from './features/contact/ContactPage';
import { ControlPanelPage } from './features/control/ControlPanelPage';
import { DevPanelPage } from './features/dev/DevPanelPage';
import { GeneralPage } from './features/general/GeneralPage';
import { HistoryPage } from './features/history/HistoryPage';
import { HomePage } from './features/home/HomePage';
import { MentorForm } from './features/mentors/MentorForm';
import { MentorsPage } from './features/mentors/MentorsPage';
import { ProgramForm } from './features/programs/ProgramForm';
import { ProgramsPage } from './features/programs/ProgramsPage';
import { SignInPage } from './features/session/SignInPage';
import { WorkForm } from './features/works/WorkForm';
import { WorksPage } from './features/works/WorksPage';
import { useEditor } from './hooks/useEditor';
import { useRoute, type Route } from './routes';
import { contentService } from './services/content';
import { sessionService } from './services/session';
import type { ContentResponse } from './services/types';

export function App() {
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>({ status: 'checking-session' });
  const requestId = useRef(0);

  const loadContent = useCallback(async (login: string): Promise<void> => {
    const id = ++requestId.current;
    setState({ status: 'loading-content', login });
    try {
      const content = await contentService.load();
      if (requestId.current === id) setState({ status: 'ready', login, content });
    } catch (error) {
      if (requestId.current === id) setState({ status: 'failed', error });
    }
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    void (async () => {
      try {
        const session = await sessionService.whoami();
        if (requestId.current !== id) return;
        if (session === null) {
          setState({ status: 'signed-out' });
          return;
        }
        await loadContent(session.login);
      } catch (error) {
        if (requestId.current === id) setState({ status: 'failed', error });
      }
    })();
    return () => {
      requestId.current += 1;
    };
  }, [loadContent]);

  if (state.status === 'checking-session') {
    return <p className="centred">{t('app.loading')}</p>;
  }
  if (state.status === 'signed-out') {
    return <SignInPage onSignedIn={(session) => void loadContent(session.login)} />;
  }
  if (state.status === 'failed') {
    const message = state.error instanceof Error ? state.error.message : t('app.unreachable');
    return <p className="centred problem">{message}</p>;
  }
  if (state.status === 'loading-content') {
    return <p className="centred">{t('app.loadingSite')}</p>;
  }

  return (
    <Editing
      login={state.login}
      content={state.content}
      onSignedOut={() => {
        // Back to the sign-in screen without a page load. `Editing` unmounts,
        // which is what actually discards the edited content — there is no
        // second copy of it anywhere, and nothing to clear by hand.
        requestId.current += 1;
        setState({ status: 'signed-out' });
      }}
    />
  );
}

type AppState =
  | { status: 'checking-session' }
  | { status: 'signed-out' }
  | { status: 'loading-content'; login: string }
  | { status: 'ready'; login: string; content: ContentResponse }
  | { status: 'failed'; error: unknown };

interface EditingProps {
  login: string;
  content: ContentResponse;
  onSignedOut: () => void;
}

function Editing({ login, content, onSignedOut }: EditingProps) {
  const editor = useEditor(content.content, content.media);
  const route = useRoute();

  // The browser's own guard is the only one that catches a closed tab.
  useEffect(() => {
    if (!editor.dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editor.dirty]);

  return (
    <AdminLayout editor={editor} login={login} route={route} onSignedOut={onSignedOut}>
      <ProblemList problems={editor.problems} />
      <Screen route={route} editor={editor} />
    </AdminLayout>
  );
}

/**
 * Which record of a collection the route has open, if it has one open at all.
 *
 * A record is addressed by *position*, so a position can outlive what it points
 * at: delete the last work while its form is open and the URL still says
 * `/works/9`. Deriving the answer rather than storing it means there is no
 * state to correct — a position with nothing at it is simply nothing open, and
 * the screen falls back to the list it was opened from.
 */
function opened<T>(items: readonly T[], record: number | null): { item: T; at: number } | null {
  if (record === null) return null;
  const item = items[record];
  return item === undefined ? null : { item, at: record };
}

/**
 * The route table's one exhaustive switch. Adding a section to `SECTIONS`
 * without adding it here is a TypeScript error rather than a blank page — the
 * return type has no `undefined` in it and the switch has no default.
 */
function Screen({ route, editor }: { route: Route; editor: ReturnType<typeof useEditor> }) {
  switch (route.section) {
    case 'control':
      return <ControlPanelPage editor={editor} />;
    case 'home':
      return <HomePage editor={editor} />;
    case 'works': {
      const open = opened(editor.content.works, route.record);
      return open === null ? (
        <WorksPage editor={editor} />
      ) : (
        <WorkForm work={open.item} at={open.at} editor={editor} />
      );
    }
    case 'programs': {
      const open = opened(editor.content.programs, route.record);
      return open === null ? (
        <ProgramsPage editor={editor} />
      ) : (
        <ProgramForm program={open.item} at={open.at} editor={editor} />
      );
    }
    case 'about':
      return <AboutPage editor={editor} />;
    case 'mentors': {
      const open = opened(editor.content.mentors, route.record);
      return open === null ? (
        <MentorsPage editor={editor} />
      ) : (
        <MentorForm mentor={open.item} at={open.at} editor={editor} />
      );
    }
    case 'contact':
      return <ContactPage editor={editor} />;
    case 'general':
      return <GeneralPage editor={editor} />;
    case 'history':
      return <HistoryPage editor={editor} />;
    case 'dev':
      return <DevPanelPage />;
  }
}
