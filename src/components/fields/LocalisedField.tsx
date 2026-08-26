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
 */
import { LOCALES, type LocalisedText } from '../../../shared/content/types';
import { LOCALE_NAMES } from './locale-names';
import { TextField } from './TextField';

interface LocalisedFieldProps {
  label: string;
  value: LocalisedText;
  onChange: (value: LocalisedText) => void;
  hint?: string;
  multiline?: boolean;
}

export function LocalisedField({ label, value, onChange, hint, multiline }: LocalisedFieldProps) {
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
