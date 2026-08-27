/**
 * A run of dictionary words, edited where they appear.
 *
 * The site's fixed words used to be one screen called Site text: forty-odd
 * fields, in six groups, none of which said anything about which page you would
 * find them on. Most of them are not about the site at all — the three status
 * words belong to the works index, the contact card's labels belong to Contact
 * — so they are edited on those screens now, and this is the piece each of them
 * renders.
 *
 * The dictionary's *keys* are structure: the template reads them by name, so a
 * renamed key is a broken build and a missing one is a blank on the page. So a
 * field names the word it exposes with a `CopyPath` — a dotted path the compiler
 * resolves against `Dictionary` — and a field pointing nowhere fails to compile
 * here rather than blanking a word on the site.
 *
 * The labels are written in English because English is the key: they are looked
 * up in the `copy` namespace, which is a flat dictionary of these very
 * sentences. A label with no translation shows its English, which is the right
 * failure — a blank one would be a field with no name.
 */
import { useTranslation } from 'react-i18next';

import { readCopyPath, writeCopyPath, type CopyPath } from '../../../shared/content/dictionary';
import { LOCALES, type Dictionary, type Locale } from '../../../shared/content/types';
import { LOCALE_NAMES } from './locale-names';
import { TextField } from './TextField';

export interface CopyField {
  path: CopyPath;
  label: string;
  hint?: string;
  multiline?: boolean;
}

interface CopyFieldsProps {
  fields: readonly CopyField[];
  dictionaries: Record<Locale, Dictionary>;
  onChange: (locale: Locale, dictionary: Dictionary) => void;
}

export function CopyFields({ fields, dictionaries, onChange }: CopyFieldsProps) {
  const { t } = useTranslation(['translation', 'copy']);
  const copy = (value: string) => t(value, { ns: 'copy', keySeparator: false });

  return (
    <>
      {fields.map((field) => (
        <fieldset key={field.path} className="field localised">
          <legend className="field-label">{copy(field.label)}</legend>
          <div className="localised-pair">
            {LOCALES.map((locale) => (
              <TextField
                key={locale}
                label={LOCALE_NAMES[locale]}
                multiline={field.multiline}
                value={readCopyPath(dictionaries[locale], field.path)}
                onChange={(value) =>
                  onChange(locale, writeCopyPath(dictionaries[locale], field.path, value))
                }
              />
            ))}
          </div>
          {field.hint !== undefined && <p className="field-hint">{copy(field.hint)}</p>}
        </fieldset>
      ))}
    </>
  );
}
