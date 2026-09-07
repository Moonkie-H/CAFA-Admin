/**
 * A box the studio types prose into, with the four controls it asked for:
 * bold, italic, a size, and where the line sits.
 *
 * It is a `contenteditable` rather than a textarea because the studio asked for
 * Word, not for Markdown — the point is seeing the bold word bold while typing
 * it. What comes out is still one string, in the format
 * `shared/content/rich-text` defines, saved through exactly the same field, the
 * same `ContentSet`, the same request and the same tables as the plain text it
 * replaced. There is no new column and nothing new to publish: formatting
 * persists because it is *part of the value*, not something kept beside it.
 *
 * Three decisions are what make it survive contact with a real browser:
 *
 *  - **The surface is uncontrolled.** React writes into it once, when a value
 *    arrives from somewhere other than this component, and reads out of it on
 *    every input. Re-rendering it on each keystroke is what breaks a Chinese
 *    IME — the composition is mid-flight in a DOM node React would replace —
 *    and the studio writes Chinese in every one of these boxes.
 *  - **The browser's own editing is left alone.** Return, backspace, Ctrl+B and
 *    the undo stack are the browser's, which is why they all behave the way
 *    they do everywhere else. `lib/rich-dom` reads whatever shape it leaves.
 *  - **`document.execCommand` for the two inline marks.** It is deprecated and
 *    has no replacement — the Editing API that was to replace it does not
 *    exist — and it is the only way to bold a selection without hand-writing
 *    DOM range surgery, which is where an editor of this size becomes an
 *    editor of a hundred times this size. Alignment and size are ours, because
 *    those commands write inline styles we would only have to read back out.
 */
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
  formatRichText,
  parseRichText,
  RICH_ALIGNS,
  RICH_SIZES,
  type RichAlign,
  type RichSize,
} from '../../../shared/content/rich-text';
import {
  linesIn,
  NEUTRAL,
  paint,
  rangeIn,
  readBlocks,
  selectAll,
  stateAt,
  type RichState,
} from '../../lib/rich-dom';
import { Field } from './Field';

/**
 * Pressing a button must not move focus out of the box.
 *
 * A button that took focus would collapse the selection it is about to act on,
 * so the command would apply to a caret rather than to the chosen words.
 */
function keepSelection(event: { preventDefault: () => void }): void {
  event.preventDefault();
}

interface RichTextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}

export function RichTextField({ label, value, onChange, hint }: RichTextFieldProps) {
  const { t } = useTranslation();
  const surface = useRef<HTMLDivElement>(null);
  /** The last value this component put on the wire, so its own edits do not
      come back as an external change and repaint the box under the caret. */
  const written = useRef<string | null>(null);
  /** Where the caret was when focus left for a toolbar button. */
  const saved = useRef<Range | null>(null);
  const [state, setState] = useState<RichState>(NEUTRAL);

  useEffect(() => {
    const editable = surface.current;
    if (editable === null || value === written.current) return;
    written.current = value;
    paint(editable, parseRichText(value));
  }, [value]);

  useEffect(() => {
    const editable = surface.current;
    if (editable === null) return;

    const onSelectionChange = () => {
      const selection = document.getSelection();
      if (selection === null || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!editable.contains(range.startContainer)) return;
      saved.current = range.cloneRange();
      setState(stateAt(editable, range));
    };

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  const emit = useCallback(() => {
    const editable = surface.current;
    if (editable === null) return;
    const next = formatRichText(readBlocks(editable));
    written.current = next;
    onChange(next);
  }, [onChange]);

  /**
   * Put the caret back where it was, do the thing, then read the result.
   *
   * The mousedown handler on each button keeps focus in the box for a pointer,
   * but a keyboard reaches a button by tabbing to it — and the size control is
   * a `<select>`, which takes focus whichever way it is reached. `execCommand`
   * acts on whatever is focused and a line control needs a range to find its
   * lines, so the selection is re-established here rather than assumed.
   *
   * **A box nobody has put a caret in yet has no selection, and that is the
   * ordinary first thing that happens to every one of these fields.** It used
   * to mean the remembered range was null, which made a line control find no
   * lines and do nothing at all, and sent a mark to whatever character `focus`
   * happened to land on — so the studio pressed a button, watched nothing
   * happen, pressed it on the other language, watched that one work, and ended
   * up with the two reading at different sizes. Nothing selected now means the
   * whole box, which is both the useful reading of the gesture and the one that
   * cannot fail silently.
   */
  const act = useCallback(
    (run: (editable: HTMLDivElement, range: Range | null) => void) => {
      const editable = surface.current;
      if (editable === null) return;
      editable.focus();

      // Only a remembered range that still points into this box: one taken
      // before an external value repainted it names nodes that are gone.
      const remembered = saved.current;
      if (remembered !== null && editable.contains(remembered.startContainer)) {
        const selection = document.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(remembered);
      } else {
        // Nothing remembered means nobody has put a caret in this box, so the
        // press is about the box. It has to be decided on the *remembered*
        // range rather than on the live one: `focus` above leaves a collapsed
        // caret behind, which is a perfectly good range for a line control and
        // useless for a mark — bold on a caret only arms the next character, so
        // the studio saw the size button work and the bold button do nothing.
        selectAll(editable);
      }

      run(editable, rangeIn(editable));
      emit();
      // Read the live selection rather than the remembered one: the command
      // just moved it, and the toolbar has to show what is true now.
      setState(stateAt(editable, rangeIn(editable)));
    },
    [emit],
  );

  const mark = (command: 'bold' | 'italic') =>
    act(() => {
      // Tags, not inline styles: `styleWithCSS` off is what makes the browser
      // write <b> and <i> instead of a span carrying a font-weight that would
      // then have to be parsed back into a boolean.
      document.execCommand('styleWithCSS', false, 'false');
      document.execCommand(command);
    });

  const align = (next: RichAlign) =>
    act((editable, range) => {
      // Pressing the alignment a line already has takes it back off, which is
      // the only way back to "however the page lays this out" — and that is a
      // different thing from left: the front page centres its statement.
      const clearing = state.align === next;
      for (const line of linesIn(editable, range)) {
        if (clearing) delete line.dataset.align;
        else line.dataset.align = next;
      }
    });

  const resize = (next: RichSize) =>
    act((editable, range) => {
      for (const line of linesIn(editable, range)) {
        if (next === 'normal') delete line.dataset.size;
        else line.dataset.size = next;
      }
    });

  const onInput = (event: FormEvent<HTMLDivElement>) => {
    // Mid-composition the DOM holds a half-typed character the IME still owns.
    // Reading it would put it on the wire and marking it saved would be a lie.
    if ((event.nativeEvent as InputEvent).isComposing) return;
    emit();
  };

  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    // Plain text only. A paste out of Word carries a stylesheet's worth of
    // markup, and the studio's site has six type roles rather than Word's
    // hundred — so what is kept is the words, and the formatting is the four
    // buttons above.
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    emit();
  };

  return (
    <Field label={label} hint={hint}>
      {/* `keepSelection` is on the buttons and deliberately not on the bar: a
          `<select>` whose mousedown is default-prevented does not open its
          menu, so blanketing the toolbar with it made the size control
          unclickable. The select is free to take focus instead — `act` puts the
          selection back before it does anything. */}
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

        <select
          className="rich-size"
          value={state.size}
          aria-label={t('formatting.size')}
          title={t('formatting.size')}
          onChange={(event) => resize(event.target.value as RichSize)}
        >
          {RICH_SIZES.map((size) => (
            <option key={size} value={size}>
              {t(`typeScale.${size}`)}
            </option>
          ))}
        </select>

        <span className="rich-group">
          {RICH_ALIGNS.map((option) => (
            <button
              key={option}
              type="button"
              className="rich-button"
              onMouseDown={keepSelection}
              aria-pressed={state.align === option}
              aria-label={t(`formatting.${option}`)}
              title={t(`formatting.${option}`)}
              onClick={() => align(option)}
            >
              <AlignMark align={option} />
            </button>
          ))}
        </span>
      </div>

      {/* No children: the contents belong to lib/rich-dom and to the browser,
          and React must not reconcile a DOM it did not write. */}
      <div
        ref={surface}
        className="input rich-surface"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        spellCheck={false}
        onInput={onInput}
        onCompositionEnd={emit}
        onPaste={onPaste}
      />
    </Field>
  );
}

/**
 * Four bars, two of them short, shifted to the side they mean. Drawn here
 * rather than typed, because the alphabet has no glyph for "ranged right" and
 * the three words would be wider than the box they sit on at a narrow width.
 */
function AlignMark({ align }: { align: RichAlign }) {
  const widths = [16, 10, 16, 10];
  return (
    <svg viewBox="0 0 16 12" width="16" height="12" aria-hidden="true" focusable="false">
      {widths.map((width, row) => (
        <rect
          key={row}
          x={align === 'left' ? 0 : align === 'right' ? 16 - width : (16 - width) / 2}
          y={row * 3 + 0.5}
          width={width}
          height="1.5"
          rx="0.75"
        />
      ))}
    </svg>
  );
}
