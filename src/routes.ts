/**
 * Where the editor is, and the whole of its router.
 *
 * Path-based rather than hash-based, because the infrastructure for it is
 * already paid for: `not_found_handling: "single-page-application"` in
 * wrangler.jsonc means the Worker hands unknown paths to index.html, and the
 * Worker checks /api and /auth before it gets there — so /works reaches this
 * file and nothing collides.
 *
 * A route is a *section* and, in the three sections that hold a list, which
 * record of that list is open — `/works` is the index of works and `/works/3`
 * is the third of them. The position rather than the slug, because a record
 * that has just been added has no slug yet and a screen you cannot address
 * until you have named it is a screen you cannot fill in.
 *
 * The order below is the order of the sidebar, and it is meant. The control
 * panel is where you land; then the site, page by page, in the order a visitor
 * meets them — with the two collections About draws, the mentors and the
 * projects, sitting under it in the order the page reads them; then the two
 * tools for looking backwards, at what has been published and at what the
 * site's own frontend can read.
 */
import { useSyncExternalStore } from 'react';

export const SECTIONS = [
  'control',
  'home',
  'works',
  'programs',
  'about',
  'mentors',
  'projects',
  'contact',
  'general',
  'history',
  'dev',
] as const;

export type Section = (typeof SECTIONS)[number];

/**
 * The sections whose entries open a form of their own.
 *
 * These are the four collections the studio adds to — the works, the
 * programmes, the people and the projects. Every other section is one screen,
 * and asking for `/about/2` lands on About rather than on a form that does not
 * exist.
 */
const COLLECTIONS = ['works', 'programs', 'mentors', 'projects'] as const;

export type Collection = (typeof COLLECTIONS)[number];

function isCollection(section: Section): section is Collection {
  return COLLECTIONS.some((known) => known === section);
}

export interface Route {
  section: Section;
  /** Which record of the section's list is open, or null for the list itself. */
  record: number | null;
}

/** What `/` resolves to: the overview, not a form. */
const DEFAULT_SECTION: Section = 'control';

export function href(route: Route): string {
  return route.record === null ? `/${route.section}` : `/${route.section}/${route.record + 1}`;
}

/** A section with nothing open, which is what a sidebar link points at. */
export function at(section: Section): Route {
  return { section, record: null };
}

/** One record of a collection, by where it sits in that collection's list. */
export function recordAt(section: Collection, record: number): Route {
  return { section, record };
}

export function sameRoute(one: Route, other: Route): boolean {
  return one.section === other.section && one.record === other.record;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

/**
 * The path, read as a route. Anything that is not one — a stale bookmark, a
 * typo, `/about/2` — falls back rather than showing a blank screen.
 */
function parse(pathname: string): Route {
  const [first = '', second = ''] = pathname.replace(/^\/+/, '').split('/');
  const section = SECTIONS.find((known) => known === first);
  if (section === undefined) return at(DEFAULT_SECTION);
  if (second === '' || !isCollection(section)) return at(section);

  const position = Number.parseInt(second, 10);
  return Number.isInteger(position) && position > 0
    ? recordAt(section, position - 1)
    : at(section);
}

/**
 * The current route, as a string the store can compare by value.
 *
 * `useSyncExternalStore` re-renders whenever the snapshot changes identity, so
 * a fresh object every read would loop forever. The path is the snapshot, and
 * the route is derived from it.
 */
function currentPath(): string {
  return window.location.pathname;
}

export function useRoute(): Route {
  return parse(useSyncExternalStore(subscribe, currentPath));
}

/**
 * `pushState` does not fire `popstate`, so subscribers are told directly.
 * Going back still fires it, and both paths land on the same snapshot read.
 */
export function navigate(to: Route): void {
  const path = href(to);
  if (window.location.pathname === path) return;
  window.history.pushState(null, '', path);
  for (const listener of listeners) listener();
}
