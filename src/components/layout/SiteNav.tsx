/**
 * The sidebar: the site, read as a tree.
 *
 * It is the *site's* shape rather than the database's, and that is the whole
 * design. The four pages are the four branches, in the order a visitor meets
 * them, and what a page draws hangs under it: the works under Works, the
 * programmes under Programmes, the people and the projects under About —
 * because on the site the mentors are a band across the about page and the
 * projects are the grid at the end of it, not collections of their own. So
 * finding where a word is edited is the same problem as remembering where it
 * appears, which is a problem the studio already knows the answer to.
 *
 * A branch is a link *and* a disclosure, not one or the other: the section's own
 * screen is where its page text lives, and the twist beside it opens the list.
 * A branch you are inside opens itself; anything else you have opened or shut by
 * hand stays that way, which is what `toggled` holds and why it holds only what
 * was actually touched.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Editor } from '../../hooks/useEditor';
import { at, recordAt, sameRoute, type Collection, type Route, type Section } from '../../routes';
import { RouteLink } from './RouteLink';

/** One entry under a branch: a record, and the form that opens it. */
interface Entry {
  label: string;
  route: Route;
}

interface Branch {
  section: Section;
  labelKey: string;
  entries?: Entry[];
  branches?: Branch[];
}

interface Group {
  labelKey: string;
  branches: Branch[];
}

interface SiteNavProps {
  editor: Editor;
  route: Route;
}

export function SiteNav({ editor, route }: SiteNavProps) {
  const { t } = useTranslation();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const content = editor.content;

  /** A record's own name, in whichever language it has one, or a placeholder. */
  const named = (title: { zh: string; en: string }): string =>
    title.zh || title.en || t('pages.untitled');

  const entries = <T,>(section: Collection, items: readonly T[], label: (item: T) => string): Entry[] =>
    items.map((item, position) => ({ label: label(item), route: recordAt(section, position) }));

  const GROUPS: Group[] = [
    { labelKey: 'nav.overview', branches: [{ section: 'control', labelKey: 'nav.control' }] },
    {
      labelKey: 'nav.site',
      branches: [
        { section: 'home', labelKey: 'nav.home' },
        {
          section: 'works',
          labelKey: 'nav.works',
          entries: entries('works', content.works, (work) => `${work.index} · ${named(work.title)}`),
        },
        {
          section: 'programs',
          labelKey: 'nav.programs',
          entries: entries('programs', content.programs, (program) => named(program.name)),
        },
        {
          section: 'about',
          labelKey: 'nav.about',
          branches: [
            {
              section: 'mentors',
              labelKey: 'nav.mentors',
              entries: entries('mentors', content.mentors, (mentor) => named(mentor.name)),
            },
            {
              section: 'projects',
              labelKey: 'nav.projects',
              entries: entries('projects', content.projects, (project) => named(project.title)),
            },
          ],
        },
        { section: 'contact', labelKey: 'nav.contact' },
        { section: 'general', labelKey: 'nav.general' },
      ],
    },
    {
      labelKey: 'nav.tools',
      branches: [
        { section: 'history', labelKey: 'nav.history' },
        { section: 'dev', labelKey: 'nav.developer' },
      ],
    },
  ];

  /** Every section a branch covers, so a branch knows when it holds the route. */
  const covers = (branch: Branch): Section[] => [
    branch.section,
    ...(branch.branches ?? []).flatMap(covers),
  ];

  function render(branch: Branch) {
    const label = t(branch.labelKey);
    const children = [...(branch.entries ?? []), ...(branch.branches ?? [])];
    const holdsRoute = covers(branch).includes(route.section);
    const open = toggled[branch.section] ?? holdsRoute;
    const listId = `nav-${branch.section}`;
    const count = branch.entries?.length;

    return (
      <li key={branch.section}>
        <div className="sidebar-row">
          <RouteLink
            to={at(branch.section)}
            current={sameRoute(route, at(branch.section))}
            className={`sidebar-link${sameRoute(route, at(branch.section)) ? ' is-current' : ''}`}
          >
            {label}
            {count !== undefined && <span className="sidebar-count">{count}</span>}
          </RouteLink>

          {children.length > 0 && (
            <button
              type="button"
              className={`sidebar-twist${open ? ' is-open' : ''}`}
              aria-expanded={open}
              aria-controls={listId}
              aria-label={t(open ? 'nav.collapse' : 'nav.expand', { name: label })}
              onClick={() => setToggled((current) => ({ ...current, [branch.section]: !open }))}
            >
              <span aria-hidden="true">›</span>
            </button>
          )}
        </div>

        {children.length > 0 && (
          <div className={`sidebar-branch${open ? ' is-open' : ''}`} id={listId}>
            <ul className="sidebar-sublist">
              {branch.entries?.map((entry) => (
                <li key={entry.route.record ?? entry.label}>
                  <RouteLink
                    to={entry.route}
                    current={sameRoute(route, entry.route)}
                    className={`sidebar-link sidebar-entry${sameRoute(route, entry.route) ? ' is-current' : ''}`}
                  >
                    {entry.label}
                  </RouteLink>
                </li>
              ))}
              {branch.branches?.map((nested) => render(nested))}
            </ul>
          </div>
        )}
      </li>
    );
  }

  return (
    <nav className="sidebar" aria-label={t('nav.label')}>
      {GROUPS.map((group) => (
        <div className="sidebar-group" key={group.labelKey}>
          <h2 className="sidebar-heading">{t(group.labelKey)}</h2>
          <ul className="sidebar-list">{group.branches.map((branch) => render(branch))}</ul>
        </div>
      ))}
    </nav>
  );
}
