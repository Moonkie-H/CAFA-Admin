/**
 * One fact on the control panel, and the way to the screen that changes it.
 *
 * Three shapes of the same box: a tile that leads somewhere in the admin, one
 * that leads outside it, and one that is only a number. Which it is depends on
 * what it was given, so a caller says where it goes rather than which element to
 * draw — and a tile with nowhere to go renders as an `<article>` instead of a
 * link to nothing.
 */
import type { ReactNode } from 'react';

import { RouteLink } from '../../components/layout/RouteLink';
import type { RoutePath } from '../../routes';

interface TileProps {
  label: string;
  value: string;
  note: string;
  /** An admin route this tile leads to. */
  to?: RoutePath;
  /** An address outside the admin. Opens in a new tab. */
  link?: string;
  /** Draws the value as something that wants attention rather than as a fact. */
  warn?: boolean;
}

export function Tile({ label, value, note, to, link, warn = false }: TileProps) {
  const body: ReactNode = (
    <>
      <span className="tile-label">{label}</span>
      <strong className={`tile-value${warn ? ' tile-warn' : ''}`}>{value}</strong>
      <span className="tile-note">{note}</span>
    </>
  );

  if (to !== undefined) {
    return (
      <RouteLink to={to} className="tile tile-link">
        {body}
      </RouteLink>
    );
  }

  if (link !== undefined) {
    return (
      <a className="tile tile-link" href={link} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  }

  return <article className="tile">{body}</article>;
}
