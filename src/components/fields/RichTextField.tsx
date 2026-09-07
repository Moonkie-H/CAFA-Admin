/**
 * A bilingual box the studio types prose into, with the three controls it asked
 * for: bold, italic, and the size the field is set at.
 *
 * **One toolbar, over both languages.** That is the shape of the thing rather
 * than a tidier arrangement of it: a summary is one piece of copy that happens
 * to exist in two languages, so it is one size, and a form that asked for the
 * size twice was a form that let the two answers differ. They did differ —
 * pressing a control with no caret in the box did nothing, so the studio
 * pressed it on the other language instead, and the same sentence went out at
 * two sizes. The size now belongs to the field and there is one control for it.
 *
 * The two marks stay per language, and they have to: bold is on *these words*,
 * and the Chinese sentence and the English one do not share words to put it on.
 * So they act on whichever box the caret is in, which is also the only reading
 * of the gesture that could mean anything.
 *
 * It is a `contenteditable` rather than a textarea because the studio asked for
 * Word, not for Markdown — the point is seeing the bold word bold while typing
 * it. What comes out is still one string per language, in the format
 * `shared/content/rich-text` defines, saved through exactly the same field, the
 * same `ContentSet`, the same request and the same tables as the plain text it
 * replaced. There is no new column and nothing new to publish: formatting
 * persists because it is *part of the value*, not something kept beside it.
 *
 * Three decisions are what make it survive contact with a real browser:
 *
 *  - **The surfaces are uncontrolled.** React writes into one once, when a
 *    value arrives from somewhere other than this component, and reads out of
 *    it on every input. Re-rendering it on each keystroke is what breaks a
 *    Chinese IME — the composition is mid-flight in a DOM node React would
 *    replace — and the studio writes Chinese in every one of these boxes.
 *  - **The browser's own editing is left alone.** Return, backspace, Ctrl+B and
 *    the undo stack are the browser's, which is why they all behave the way
 *    they do everywhere else. `lib/rich-dom` reads whatever shape it leaves.
 *  - **`document.execCommand` for the two inline marks.** It is deprecated and
 *    has no replacement — the Editing API that was to replace it does not
 *    exist — and it is the only way to bold a selection without hand-writing
 *    DOM range surgery, which is where an editor of this size becomes an
 *    editor of a hundred times this size. The size is ours, because it is not a
 *    mark on a selection at all.
 */
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
  formatRichText,
  parseRichText,
  RICH_SIZE_MAX,
  RICH_SIZE_MIN,
} from '../../../shared/content/rich-text';
import { LOCALES, type Locale, type LocalisedText } from '../../../shared/content/types';
import { NEUTRAL, paint, rangeIn, readLines, selectAll, stateAt, type RichState } from '../../lib/rich-dom';
import { LOCALE_NAMES } from './locale-names';

/**
 * Pressing a button must not move focus out of the box.
 *
 * A button that took focus would collapse the selection it is about to act on,
 * so the command would apply to a caret rather than to the chosen words.
 */
function keepSelection(event: { preventDefault: () => void }): void {
  event.preventDefault();
}

/** The size a value is set at, or null where the page decides. */
function sizeOf(value: LocalisedText): number | null {
  // Read off one language because both carry the same number — `resize` writes
  // it to both, and there is no other way for one to acquire it.
  return parseRichText(value[LOCALES[0]]).size;
}

interface RichTextFieldProps {
  label: string;
  value: LocalisedText;
  onChange: (value: LocalisedText) => void;
  hint?: string;
}

export function RichTextField({ label, value, onChange, hint }: RichTextFieldProps) {
  const { t } = useTranslation();
  const surfaces = useRef<Partial<Record<Locale, HTMLDivElement>>>({});
  /** The last value this component put on the wire for each language, so its
      own edits do not come back as an external change and repaint the box
      under the caret. */
  const written = useRef<Partial<Record<Locale, string>>>({});
  /** Where the caret was when focus left for a toolbar button. */
  const saved = useRef<Range | null>(null);
  /** Which box that caret was in, and so which one the marks act on. */
  const [active, setActive] = useState<Locale>(LOCALES[0]);
  const [state, setState] = useState<RichState>(NEUTRAL);

  const size = sizeOf(value);

  useEffect(() => {
    for (const locale of LOCALES) {
      const editable = surfaces.current[locale];
      const next = value[locale];
      if (editable === undefined || next === written.current[locale]) continue;
      written.current[locale] = next;
      paint(editable, parseRichText(next).lines);
    }
  }, [value]);

  useEffect(() => {
    const onSelectionChange = () => {
      const selection = document.getSelection();
      if (selection === null || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      for (const locale of LOCALES) {
        const editable = surfaces.current[locale];
        if (editable === undefined || !editable.contains(range.startContainer)) continue;
        saved.current = range.cloneRange();
        setActive(locale);
        setState(stateAt(editable, range));
        return;
      }
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  const emit = useCallback(
    (locale: Locale) => {
      const editable = surfaces.current[locale];
      if (editable === undefined) return;
      const next = formatRichText({ size: sizeOf(value), lines: readLines(editable) });
      written.current[locale] = next;
      onChange({ ...value, [locale]: next });
    },
    [onChange, value],
  );

  /**
   * Put the caret back where it was, do the thing, then read the result.
   *
   * The mousedown handler on each button keeps focus in the box for a pointer,
   * but a keyboard reaches a button by tabbing to it. `execCommand` acts on
   * whatever is focused, so the selection is re-established here rather than
   * assumed.
   *
   * **A box nobody has put a caret in yet has no selection, and that is the
   * ordinary first thing that happens to every one of these fields.** Nothing
   * selected means the whole box, which is both the useful reading of the
   * gesture and the one that cannot fail silently — a mark sent to a collapsed
   * caret only arms the next character, so the studio pressed bold and watched
   * nothing happen.
   */
  const mark = (command: 'bold' | 'italic') => {
    const editable = surfaces.current[active];
    if (editable === undefined) return;
    editable.focus();

    // Only a remembered range that still points into this box: one taken
    // before an external value repainted it names nodes that are gone.
    const remembered = saved.current;
    if (remembered !== null && editable.contains(remembered.startContainer)) {
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(remembered);
    } else {
      selectAll(editable);
    }

    // Tags, not inline styles: `styleWithCSS` off is what makes the browser
    // write <b> and <i> instead of a span carrying a font-weight that would
    // then have to be parsed back into a boolean.
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(command);
    emit(active);
    // Read the live selection rather than the remembered one: the command just
    // moved it, and the toolbar has to show what is true now.
    setState(stateAt(editable, rangeIn(editable)));
  };

  /**
   * Set the field's size, in both languages, in one write.
   *
   * It reads each surface rather than each stored string so that a size changed
   * while a sentence is half-typed keeps the half-typed sentence: the box the
   * caret is not in has nothing pending, but the box it is in may have an
   * `input` that has not been emitted yet.
   */
  const resize = (next: number | null) => {
    const changed = { ...value };
    for (const locale of LOCALES) {
      const editable = surfaces.current[locale];
      const lines =
        editable === undefined ? parseRichText(value[locale]).lines : readLines(editable);
      const text = formatRichText({ size: next, lines });
      // Marked as ours: the words in the box did not change, only the number in
      // front of them, so there is nothing to repaint and a repaint here would
      // drop the caret.
      written.current[locale] = text;
      changed[locale] = text;
    }
    onChange(changed);
  };

  const onInput = (locale: Locale) => (event: FormEvent<HTMLDivElement>) => {
    // Mid-composition the DOM holds a half-typed character the IME still owns.
    // Reading it would put it on the wire and marking it saved would be a lie.
    if ((event.nativeEvent as InputEvent).isComposing) return;
    emit(locale);
  };

  const onPaste = (locale: Locale) => (event: ClipboardEvent<HTMLDivElement>) => {
    // Plain text only. A paste out of Word carries a stylesheet's worth of
    // markup, and this field has three controls rather than Word's hundred — so
    // what is kept is the words.
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    emit(locale);
  };

  return (
    <fieldset className="field localised">
      <legend className="field-label">{label}</legend>

      <div className="rich-toolbar">
        <button
          type="button"
          className="rich-button rich-bold"
          onMouseDown={keepSelection}
          aria-pressed={state.strong}
          aria-label={t('formatting.bold')}
          title={t('formatting.bold')}
          onClick={() => mark('bold')}
        >
          B
        </button>
        <button
          type="button"
          className="rich-button rich-italic"
          onMouseDown={keepSelection}
          aria-pressed={state.emphasis}
          aria-label={t('formatting.italic')}
          title={t('formatting.italic')}
          onClick={() => mark('italic')}
        >
          I
        </button>
        <SizePicker size={size} onChange={resize} />
      </div>

      <div className="localised-pair">
        {LOCALES.map((locale) => (
          <div key={locale} className="field">
            <span className="field-label">{LOCALE_NAMES[locale]}</span>
            {/* No children: the contents belong to lib/rich-dom and to the
                browser, and React must not reconcile a DOM it did not write. */}
            <div
              ref={(node) => {
                if (node === null) delete surfaces.current[locale];
                else surfaces.current[locale] = node;
              }}
              className="input rich-surface"
              // The number the studio typed, shown at the number the studio
              // typed. It is the one honest preview of a size that is a size
              // rather than a step to a role this form cannot see.
              style={size === null ? undefined : { fontSize: `${size}px` }}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label={`${label} — ${LOCALE_NAMES[locale]}`}
              spellCheck={false}
              onInput={onInput(locale)}
              onCompositionEnd={() => emit(locale)}
              onPaste={onPaste(locale)}
            />
          </div>
        ))}
      </div>

      {hint !== undefined && <p className="field-hint">{hint}</p>}
    </fieldset>
  );
}

/**
 * The size, as the number it is.
 *
 * Typed rather than chosen from a list, because the studio knows the number it
 * wants and a list of three words made it guess which of the site's type roles
 * each word landed on. Empty is a real answer and the common one — it means the
 * page sets this field the way it sets every other one, which is what all the
 * copy written before this control existed says.
 *
 * A draft, because a number field is typed one digit at a time and 1 is not a
 * size: committing on every keystroke would have "18" pass through 1 and be
 * refused, or worse, clamped to 14 under the studio's fingers. So the box holds
 * what is being typed and the field takes it only once it reads as a size, with
 * a blur to put back the last one that did.
 *
 * The draft follows the value when the value changes *underneath* it — another
 * record opened into the same form, a revision reverted — and that is done here
 * in the render rather than in an effect. It is React's own answer for state
 * that has to adjust to a prop (`react.dev/learn/you-might-not-need-an-effect`):
 * an effect would render the stale number once, paint it, and only then correct
 * it, which is both a wasted pass and a visible flicker of the previous
 * record's size.
 */
function SizePicker({
  size,
  onChange,
}: {
  size: number | null;
  onChange: (size: number | null) => void;
}) {
  const { t } = useTranslation();
  const committed = size === null ? '' : String(size);
  const [draft, setDraft] = useState(committed);
  const [shown, setShown] = useState(committed);

  if (shown !== committed) {
    setShown(committed);
    setDraft(committed);
  }

  return (
    <label className="rich-size">
      <span className="rich-size-label">{t('formatting.size')}</span>
      <input
        type="number"
        className="rich-size-input"
        inputMode="numeric"
        min={RICH_SIZE_MIN}
        max={RICH_SIZE_MAX}
        step={1}
        value={draft}
        placeholder={t('formatting.sizeAuto')}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (next.trim() === '') onChange(null);
          else {
            const parsed = Number(next);
            const usable =
              Number.isInteger(parsed) && parsed >= RICH_SIZE_MIN && parsed <= RICH_SIZE_MAX;
            if (usable) onChange(parsed);
          }
        }}
        onBlur={() => setDraft(committed)}
      />
    </label>
  );
}
