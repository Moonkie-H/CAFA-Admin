/**
 * General — the words that belong to no page in particular.
 *
 * What is left after every other word went to the screen it appears on: the
 * studio's own name, the line in the footer, the missing-page notice, and how
 * a page title is composed for a browser tab. Four short groups instead of the
 * forty-field wall this screen used to be.
 *
 * The rest of it is behind one disclosure, and that is the point rather than a
 * tidy-up. The labels down a work — Year, Credits, Previous, Next — and the
 * strings only a screen reader hears are real copy that the site reads by name,
 * so they cannot be hardcoded in the template; they are also words nobody
 * changes twice in a decade, and having them open on the screen made the four
 * that do change look like four of forty. Shut, they are out of the way. Open,
 * they are exactly where they were.
 */
import { useTranslation } from 'react-i18next';

import type { Dictionary, Locale } from '../../../shared/content/types';
import { CopyFields, LocalisedField, type CopyField } from '../../components/fields';
import type { Editor } from '../../hooks/useEditor';

const EVERY_PAGE: CopyField[] = [
  { path: 'footer.note', label: 'Footer note' },
  {
    path: 'meta.titleTemplate',
    label: 'Title pattern for inner pages',
    hint: '%s is replaced by the page’s own title. The front page uses its title as it is.',
  },
];

const MISSING_PAGE: CopyField[] = [
  { path: 'notFound.title', label: 'Missing page — title' },
  { path: 'notFound.body', label: 'Missing page — text', multiline: true },
  { path: 'notFound.home', label: 'Missing page — link home' },
];

const RARELY: CopyField[] = [
  {
    path: 'localeName',
    label: 'What each language calls itself',
    hint: 'The two words in the language switch. Each is written in its own language, which is why they look the same in both columns.',
  },
  { path: 'work.index', label: 'A work’s label — number' },
  { path: 'work.status', label: 'A work’s label — status' },
  { path: 'work.year', label: 'A work’s label — year' },
  { path: 'work.discipline', label: 'A work’s label — discipline' },
  { path: 'work.credits', label: 'A work’s label — credits' },
  { path: 'work.previous', label: 'A work’s label — previous' },
  { path: 'work.next', label: 'A work’s label — next' },
  { path: 'a11y.skipToContent', label: 'Skip to content' },
  { path: 'a11y.primaryNav', label: 'Main navigation' },
  { path: 'a11y.localeSwitch', label: 'Language switch' },
  { path: 'a11y.worksList', label: 'Index of works' },
  { path: 'a11y.worksRail', label: 'Work numbers' },
  { path: 'a11y.workPager', label: 'Works navigation' },
  { path: 'a11y.close', label: 'Close' },
];

interface GeneralPageProps {
  editor: Editor;
}

export function GeneralPage({ editor }: GeneralPageProps) {
  const { t } = useTranslation();
  const site = editor.content.site;
  const dictionaries = { zh: editor.content.zh, en: editor.content.en };
  const onCopyChange = (locale: Locale, dictionary: Dictionary) =>
    editor.update(locale, dictionary);

  return (
    <section>
      <header className="section-head">
        <h2>{t('nav.general')}</h2>
      </header>
      <p className="section-note">{t('generalPage.intro')}</p>

      <LocalisedField
        label={t('fields.studioName')}
        value={site.name}
        onChange={(name) => editor.update('site', { ...site, name })}
        hint={t('generalPage.studioNameHint')}
      />

      <CopyFields fields={EVERY_PAGE} dictionaries={dictionaries} onChange={onCopyChange} />

      <h3 className="panel-heading">{t('generalPage.missing')}</h3>
      <CopyFields fields={MISSING_PAGE} dictionaries={dictionaries} onChange={onCopyChange} />

      <details className="disclosure">
        <summary className="disclosure-summary">{t('generalPage.rarely')}</summary>
        <p className="section-note">{t('generalPage.rarelyNote')}</p>
        <CopyFields fields={RARELY} dictionaries={dictionaries} onChange={onCopyChange} />
      </details>
    </section>
  );
}
