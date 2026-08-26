/**
 * The two lines every page carries, on every page's own screen.
 *
 * A title and a description, four times over — which is what earns them a
 * component rather than four copies of the same pair. The title is the one
 * worth explaining, and the explanation differs per page, so it arrives as a
 * hint: on three of the four it is the heading at the top of the page as well
 * as the tab and the word in the bar, and on the front page the statement is
 * the heading, so the title is only ever read by a browser and a crawler.
 */
import { useTranslation } from 'react-i18next';

import type { PageText } from '../../shared/content/types';
import { LocalisedField } from './fields';

interface PageTextFieldsProps {
  value: PageText;
  onChange: (value: PageText) => void;
  titleHint: string;
}

export function PageTextFields({ value, onChange, titleHint }: PageTextFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <LocalisedField
        label={t('fields.title')}
        value={value.title}
        onChange={(title) => onChange({ ...value, title })}
        hint={titleHint}
      />
      <LocalisedField
        label={t('fields.description')}
        value={value.description}
        onChange={(description) => onChange({ ...value, description })}
        hint={t('pageText.descriptionHint')}
        multiline
      />
    </>
  );
}
