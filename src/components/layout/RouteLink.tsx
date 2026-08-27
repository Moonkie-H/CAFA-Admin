/**
 * A link to somewhere else in the admin.
 *
 * A real `<a href>` whose click is intercepted, rather than a button styled to
 * look like one — which means middle-click, ⌘-click, "open in new tab" and
 * "copy link address" all behave, and the keyboard gets anchor semantics for
 * free. The router is `pushState`, so the interception is what keeps the page
 * from reloading; everything the interception declines to handle is left to the
 * browser, which already knows what to do with it.
 *
 * The four guards below are the whole reason this is a component. They were
 * written out three times — on the brand, on each sidebar link and on every
 * tile of the control panel — and each copy was a chance to forget `shiftKey`
 * and quietly break opening a section in a new window.
 */
import type { MouseEvent, ReactNode } from 'react';

import { href, navigate, type Route } from '../../routes';

interface RouteLinkProps {
  to: Route;
  className?: string;
  /** Marks the link to the page already showing, for styling and for a11y. */
  current?: boolean;
  children: ReactNode;
}

/** Whether this click means "go there here", rather than "open it elsewhere". */
function isPlainClick(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return false;
  return event.button === 0;
}

export function RouteLink({ to, className, current = false, children }: RouteLinkProps) {
  return (
    <a
      className={className}
      href={href(to)}
      aria-current={current ? 'page' : undefined}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
