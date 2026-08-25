/**
 * The form vocabulary: every control the editing screens are built out of.
 *
 * `LocalisedField` is the important one: it puts Chinese and English side by
 * side on every piece of copy, so writing only one of them is a visible gap
 * rather than something discovered at build time.
 *
 * The last three are not fields but the shapes a *record* is edited in —
 * `Repeatable` owns a list and every operation on it, `ReorderControls` owns
 * the two buttons and the ends they stop at, and `DeleteRecord` owns the
 * question asked before something is thrown away. They live here because every
 * one of them was previously written out once per screen.
 */
import type { ReactNode } from 'react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LOCALES, type LocalisedText, type Locale } from '../../shared/content/types';

export const LOCALE_NAMES: Record<Locale, string> = { zh: '中文', en: 'English' };

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint !== undefined && <p className="field-hint">{hint}</p>}
    </div>
  );
}

interface TextProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  multiline?: boolean;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'url';
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  multiline = false,
  placeholder,
  inputMode = 'text',
}: TextProps) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="input"
          rows={4}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input"
          type="text"
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {hint !== undefined && <p className="field-hint">{hint}</p>}
    </div>
  );
}

interface NumberProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
}

export function NumberField({ label, value, onChange, hint }: NumberProps) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input input-narrow"
        type="number"
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(event.target.valueAsNumber)}
      />
      {hint !== undefined && <p className="field-hint">{hint}</p>}
    </div>
  );
}

interface LocalisedProps {
  label: string;
  value: LocalisedText;
  onChange: (value: LocalisedText) => void;
  hint?: string;
  multiline?: boolean;
}

export function LocalisedField({ label, value, onChange, hint, multiline }: LocalisedProps) {
  return (
    <fieldset className="field localised">
      <legend className="field-label">{label}</legend>
      <div className="localised-pair">
        {LOCALES.map((locale) => (
          <TextField
            key={locale}
            label={LOCALE_NAMES[locale]}
            value={value[locale] ?? ''}
            multiline={multiline}
            onChange={(next) => onChange({ ...value, [locale]: next })}
          />
        ))}
      </div>
      {hint !== undefined && <p className="field-hint">{hint}</p>}
    </fieldset>
  );
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: SelectProps<T>) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="input input-narrow"
        value={value}
        onChange={(event) => {
          const chosen = options.find((option) => option.value === event.target.value);
          if (chosen !== undefined) onChange(chosen.value);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint !== undefined && <p className="field-hint">{hint}</p>}
    </div>
  );
}

interface DeleteRecordProps {
  /** The word on the button that starts the ask. */
  action: string;
  /** The question, with the record's own name already in it. */
  question: string;
  /** The word that goes through with it. */
  confirm: string;
  onDelete: () => void;
}

/**
 * Removing a record, with the question asked in between.
 *
 * Deleting a work or a page is one click away from an afternoon's typing and
 * there is no undo short of restoring a revision, so the button asks first. The
 * ask owns its own state because nothing outside it needs to know it is being
 * asked — both pages used to carry a `confirmingDelete` flag whose entire reach
 * was these few lines.
 */
export function DeleteRecord({ action, question, confirm, onDelete }: DeleteRecordProps) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="button button-danger" onClick={() => setAsking(true)}>
        {action}
      </button>
    );
  }

  return (
    <div className="confirm">
      <p>{question}</p>
      <button type="button" className="button button-danger" onClick={onDelete}>
        {confirm}
      </button>
      <button type="button" className="button" onClick={() => setAsking(false)}>
        {t('common.keepIt')}
      </button>
    </div>
  );
}

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

/**
 * A list the studio can add to, reorder and delete from.
 *
 * It takes the items rather than a count, and that is the whole design: the
 * component owns every operation on the array — add, remove, move, and
 * replacing one entry — so a caller writes what a row *looks* like and nothing
 * about how a list works. Nine lists in this admin used to spell out the same
 * three array updates each, and every one of them had to re-look-up its item by
 * index and guard an `undefined` that could not happen.
 *
 * Reordering is buttons rather than drag: it works with a keyboard, works on a
 * phone, and needs no library. The lists here are five to ten items long, which
 * is well inside what buttons handle gracefully.
 */
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
  const count = items.length;

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

      {count === 0 ? (
        <p className="empty">{t('common.empty')}</p>
      ) : (
        <ol className="repeatable-list">
          {items.map((item, at) => (
            <li key={keyOf?.(item, at) ?? at} className="repeatable-item">
              <div className="repeatable-body">
                {renderItem(item, (next) => write(at, next), at)}
              </div>
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

/** Moving an item within an array. Out-of-range is a no-op, not a throw. */
function moved<T>(items: readonly T[], at: number, to: number): T[] {
  const next = [...items];
  if (to < 0 || to >= next.length) return next;
  const [item] = next.splice(at, 1);
  if (item === undefined) return [...items];
  next.splice(to, 0, item);
  return next;
}

interface ReorderProps<T> {
  items: readonly T[];
  at: number;
  onChange: (items: T[]) => void;
  /** What each button announces. Only the caller knows what the row is called. */
  upLabel: string;
  downLabel: string;
}

/**
 * The two buttons that move a row, and the ends they stop at.
 *
 * Three lists need this — the repeatable above, the works index and the pages
 * index — and the part worth having once is not the arrows but the boundary:
 * first row cannot go up, last cannot go down. Written out per list, that is
 * three chances to compare against the wrong end.
 */
export function ReorderControls<T>({ items, at, onChange, upLabel, downLabel }: ReorderProps<T>) {
  return (
    <>
      <button
        type="button"
        className="button button-quiet"
        disabled={at === 0}
        aria-label={upLabel}
        onClick={() => onChange(moved(items, at, at - 1))}
      >
        ↑
      </button>
      <button
        type="button"
        className="button button-quiet"
        disabled={at === items.length - 1}
        aria-label={downLabel}
        onClick={() => onChange(moved(items, at, at + 1))}
      >
        ↓
      </button>
    </>
  );
}
