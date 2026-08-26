/**
 * A list the studio can add to, reorder and delete from.
 *
 * It takes the items rather than a count, and that is the whole design: the
 * component owns every operation on the array — add, remove, move, and
 * replacing one entry — so a caller writes what a row *looks* like and nothing
 * about how a list works. Nine lists in this admin used to spell out the same
 * three array updates each, and every one of them had to re-look-up its item by
 * index and guard an `undefined` that could not happen.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ReorderControls } from './ReorderControls';

interface RepeatableProps<T> {
  label: string;
  items: readonly T[];
  addLabel: string;
  /** A new item with nothing in it, for the add button. */
  blank: () => T;
  onChange: (items: T[]) => void;
  /** `write` replaces this one item; the list around it is this component's. */
  renderItem: (item: T, write: (next: T) => void, at: number) => ReactNode;
  hint?: string;
  /**
   * A row's identity, where the item has one. React reuses a row's DOM — and
   * with it whatever local state the row's fields hold — for whatever key sits
   * in its place, so a list keyed by position hands a reordered row the
   * previous occupant's state. A photograph has a key to be identified by;
   * a paragraph has nothing but where it sits, and says so by leaving this out.
   */
  keyOf?: (item: T, at: number) => string;
}

export function Repeatable<T>({
  label,
  items,
  addLabel,
  blank,
  onChange,
  renderItem,
  hint,
  keyOf,
}: RepeatableProps<T>) {
  const { t } = useTranslation();

  const onAdd = () => onChange([...items, blank()]);
  const onRemove = (at: number) => onChange(items.filter((_, position) => position !== at));
  const write = (at: number, next: T) =>
    onChange(items.map((item, position) => (position === at ? next : item)));

  return (
    <section className="repeatable">
      <header className="repeatable-head">
        <h3 className="repeatable-title">{label}</h3>
        <button type="button" className="button" onClick={onAdd}>
          {addLabel}
        </button>
      </header>
      {hint !== undefined && <p className="field-hint">{hint}</p>}

      {items.length === 0 ? (
        <p className="empty">{t('common.empty')}</p>
      ) : (
        <ol className="repeatable-list">
          {items.map((item, at) => (
            <li key={keyOf?.(item, at) ?? at} className="repeatable-item">
              <div className="repeatable-body">{renderItem(item, (next) => write(at, next), at)}</div>
              <div className="repeatable-controls">
                <ReorderControls
                  items={items}
                  at={at}
                  onChange={onChange}
                  upLabel={t('common.moveItemUp', { item: label, number: at + 1 })}
                  downLabel={t('common.moveItemDown', { item: label, number: at + 1 })}
                />
                <button
                  type="button"
                  className="button button-quiet button-danger"
                  aria-label={t('common.removeItem', { item: label, number: at + 1 })}
                  onClick={() => onRemove(at)}
                >
                  {t('common.remove')}
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
