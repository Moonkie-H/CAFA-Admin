/**
 * The words on the chrome — everything that is not a page, a work, a programme
 * or a person.
 *
 * A page's title, its prose and the headings over its sections are not here any
 * more: they belong to a page, which can be deleted, so they are fields on the
 * page record and are edited in Pages. What is left outlives every page — the
 * pager on a work, the labels a screen reader hears, the contact card, the
 * footer.
 *
 * The dictionary's *keys* are structure: the template reads them by name, so a
 * renamed key is a broken build and a missing one is a blank on the page. So
 * this form exposes values only, and each field names the one it exposes with a
 * `CopyPath` — a dotted path the compiler resolves against `Dictionary`, so
 * every entry in the table below is checked to point somewhere real and a
 * renamed field fails to compile here rather than blanking a word on the site.
 *
 * The table is therefore what it looks like: a list of paths and the words the
 * studio should see beside them, in the order they are worth reading.
 */
import { LOCALES, type Locale } from '../content/types';
import { readCopyPath, writeCopyPath, type CopyPath } from '../content/dictionary';
import { useTranslation } from 'react-i18next';
import type { Editor } from '../useEditor';
import { LOCALE_NAMES, TextField } from '../ui/fields';

interface CopyField {
  path: CopyPath;
  label: string;
  hint?: string;
  multiline?: boolean;
}

interface CopyGroup {
  title: string;
  note?: string;
  fields: CopyField[];
}

/**
 * The labels and notes are English because English is the key: they are looked
 * up in the `copy` namespace, which is a flat dictionary of these very
 * sentences. A label with no translation shows its English, which is the right
 * failure — a blank one would be a field with no name.
 */
const GROUPS: CopyGroup[] = [
  {
    title: 'A work’s three states',
    note: 'The words the index and a work’s own page use for its status.',
    fields: [
      { path: 'works.status.completed', label: 'Status word — completed' },
      { path: 'works.status.in-progress', label: 'Status word — in progress' },
      { path: 'works.status.private', label: 'Status word — private' },
    ],
  },
  {
    title: 'Labels on a work page',
    note: 'The words down the left of a work, against its number, year and credits.',
    fields: [
      { path: 'work.index', label: 'Number' },
      { path: 'work.status', label: 'Status' },
      { path: 'work.year', label: 'Year' },
      { path: 'work.discipline', label: 'Discipline' },
      { path: 'work.credits', label: 'Credits' },
      { path: 'work.previous', label: 'Previous' },
      { path: 'work.next', label: 'Next' },
    ],
  },
  {
    title: 'Contact card',
    fields: [
      {
        path: 'contact.nav',
        label: 'The word in the menu that opens it',
        hint: 'Contact is the one menu item that is not a page — it opens the card over whichever page the reader is on.',
      },
      { path: 'contact.title', label: 'Card title' },
      { path: 'contact.email', label: 'Label — email' },
      { path: 'contact.wechat', label: 'Label — WeChat' },
      { path: 'contact.address', label: 'Label — address' },
      { path: 'contact.hours', label: 'Label — hours' },
      {
        path: 'contact.note',
        label: 'Note',
        hint: 'How to apply, and what happens next.',
        multiline: true,
      },
      { path: 'contact.from', label: 'Message form — the address field' },
      { path: 'contact.message', label: 'Message form — the message field' },
      {
        path: 'contact.subject',
        label: 'Message form — subject line',
        hint: 'The line the reader’s own mail client opens with. Send hands them a draft; nothing is collected here.',
      },
      { path: 'contact.send', label: 'Message form — the send button' },
    ],
  },
  {
    title: 'Footer and missing pages',
    fields: [
      { path: 'footer.note', label: 'Footer note' },
      { path: 'notFound.title', label: 'Missing page — title' },
      { path: 'notFound.body', label: 'Missing page — text', multiline: true },
      { path: 'notFound.home', label: 'Missing page — link home' },
    ],
  },
  {
    title: 'Search engines and sharing',
    note: 'What appears in a search result or when someone pastes a link into a chat.',
    fields: [
      { path: 'meta.title', label: 'Site title' },
      {
        path: 'meta.titleTemplate',
        label: 'Title pattern for inner pages',
        hint: '%s is replaced by the page’s own title.',
      },
      { path: 'meta.description', label: 'Site description', multiline: true },
    ],
  },
  {
    title: 'Read aloud by screen readers',
    note: 'Never shown on screen. Changing these changes what a blind visitor hears.',
    fields: [
      { path: 'a11y.skipToContent', label: 'Skip to content' },
      { path: 'a11y.primaryNav', label: 'Main navigation' },
      { path: 'a11y.localeSwitch', label: 'Language switch' },
      { path: 'a11y.worksList', label: 'Index of works' },
      { path: 'a11y.worksRail', label: 'Work numbers' },
      { path: 'a11y.workPager', label: 'Works navigation' },
      { path: 'a11y.close', label: 'Close' },
    ],
  },
];

interface CopyPageProps {
  editor: Editor;
}

export function CopyPage({ editor }: CopyPageProps) {
  const { t } = useTranslation(['translation', 'copy']);
  const copy = (value: string) => t(value, { ns: 'copy', keySeparator: false });

  const write = (locale: Locale, path: CopyPath, value: string) =>
    editor.update(locale, writeCopyPath(editor.content[locale], path, value));

  return (
    <section>
      <header className="section-head">
        <h2>{t('pages.siteText')}</h2>
      </header>
      <p className="section-note">{t('copyPage.intro')}</p>

      {GROUPS.map((group) => (
        <section key={group.title} className="copy-group">
          <h3 className="copy-group-title">{copy(group.title)}</h3>
          {group.note !== undefined && <p className="section-note">{copy(group.note)}</p>}

          {group.fields.map((field) => (
            <fieldset key={field.path} className="field localised">
              <legend className="field-label">{copy(field.label)}</legend>
              <div className="localised-pair">
                {LOCALES.map((locale) => (
                  <TextField
                    key={locale}
                    label={LOCALE_NAMES[locale]}
                    multiline={field.multiline}
                    value={readCopyPath(editor.content[locale], field.path)}
                    onChange={(value) => write(locale, field.path, value)}
                  />
                ))}
              </div>
              {field.hint !== undefined && <p className="field-hint">{copy(field.hint)}</p>}
            </fieldset>
          ))}
        </section>
      ))}
    </section>
  );
}
