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
import { ControlPanelPage } from './features/control/ControlPanelPage';
import { CopyPage } from './features/copy/CopyPage';
import { DevPanelPage } from './features/dev/DevPanelPage';
import { HistoryPage } from './features/history/HistoryPage';
import { MentorsPage } from './features/mentors/MentorsPage';
import { PagesPage } from './features/pages/PagesPage';
import { ProgramsPage } from './features/programs/ProgramsPage';
import { SignInPage } from './features/session/SignInPage';
import { SitePage } from './features/site/SitePage';
import { WorksPage } from './features/works/WorksPage';
import { useEditor } from './hooks/useEditor';
import { useRoute, type RoutePath } from './routes';
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
      <Page route={route} editor={editor} />
    </AdminLayout>
  );
}

/**
 * The route table's one exhaustive switch. Adding a route to `ROUTES` without
 * adding it here is a TypeScript error rather than a blank page — the return
 * type has no `undefined` in it and the switch has no default.
 */
function Page({ route, editor }: { route: RoutePath; editor: ReturnType<typeof useEditor> }) {
  switch (route) {
    case 'control':
      return <ControlPanelPage editor={editor} />;
    case 'dev':
      return <DevPanelPage />;
    case 'pages':
      return <PagesPage editor={editor} />;
    case 'works':
      return <WorksPage editor={editor} />;
    case 'programs':
      return <ProgramsPage editor={editor} />;
    case 'mentors':
      return <MentorsPage editor={editor} />;
    case 'site':
      return <SitePage editor={editor} />;
    case 'copy':
      return <CopyPage editor={editor} />;
    case 'history':
      return <HistoryPage editor={editor} />;
  }
}
