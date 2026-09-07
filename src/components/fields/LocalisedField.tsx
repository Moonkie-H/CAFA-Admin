/**
 * The important one: Chinese and English side by side, on every piece of copy.
 *
 * Both columns are `NOT NULL` in the schema and the validator refuses a blank in
 * either, so the point of putting them next to each other is that writing only
 * one of them is a visible gap on the form rather than something discovered at
 * build time.
 *
 * A `<fieldset>` with a `<legend>` rather than a labelled div, because this
 * names two controls rather than one — the pair is the field, and each half
 * carries its own label saying which language it is.
 *
 * A prose field is handed over whole rather than assembled here, because it is
 * not two independent boxes: the two languages share one size and one toolbar,
 * and something has to own both of them at once. See RichTextField.
 */
import { LOCALES, type LocalisedText } from '../../../shared/content/types';
import { LOCALE_NAMES } from './locale-names';
import { RichTextField } from './RichTextField';
import { TextField } from './TextField';

interface LocalisedFieldProps {
  label: string;
  value: LocalisedText;
  onChange: (value: LocalisedText) => void;
  hint?: string;
  multiline?: boolean;
  /**
   * Prose the studio can format — bold, italic, a size.
   *
   * A separate flag from `multiline` rather than a widening of it, because the
   * two are not the same claim. Both give a box with room for several lines;
   * this one also says the value is *read as prose on a page*, which is what
   * makes formatting mean anything. A page's meta description is several lines
   * long and is read by a crawler, so it stays a plain box.
   */
  rich?: boolean;
}

export function LocalisedField({
  label,
  value,
  onChange,
  hint,
  multiline,
  rich,
}: LocalisedFieldProps) {
  if (rich === true) {
    return <RichTextField label={label} value={value} onChange={onChange} hint={hint} />;
  }

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
