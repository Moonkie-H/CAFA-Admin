/**
 * Pages — the site's own list of them, and the way into the form behind each.
 *
 * This is the screen the whole change exists for. The site used to have four
 * pages because CAFA-Template had four route files; it has whatever is in this
 * list now, in this order, composed of whatever sections each row carries.
 * Adding a page adds a URL and — if it carries a name for the menu — an item in
 * the bar; removing one takes both away. Neither is a deploy.
 *
 * The order here is the order of the nav bar, which is why the list is moved by
 * hand rather than sorted: it is an editorial decision, stored as the
 * `position` column on the pages table.
 */
import { useTranslation } from 'react-i18next';

import { emptyLocalised, HOME_SLUG, type Page } from '../../../shared/content/types';
import { RecordIndex, RecordRow, ReorderControls } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { useRecordForms } from '../../hooks/useRecordForms';
import { PageForm } from './PageForm';

/**
 * A new page starts with a heading, because every page needs exactly one thing
 * that sets its `h1` and a heading is the quiet one. The slug is seeded rather
 * than blank: an empty slug is the *front page's* address, so a blank new page
 * would silently claim it.
 */
const NEW_PAGE_SLUG = 'new-page';

function blankPage(): Page {
  return {
    slug: NEW_PAGE_SLUG,
    title: emptyLocalised(),
    description: emptyLocalised(),
    navLabel: emptyLocalised(),
    sections: [{ kind: 'heading' }],
  };
}

interface PagesPageProps {
  editor: Editor;
}

export function PagesPage({ editor }: PagesPageProps) {
  const { t } = useTranslation();
  const pages = editor.content.pages;
  const forms = useRecordForms(pages, (next) => editor.update('pages', next));

  if (forms.open !== null) {
    const { record } = forms.open;
    return (
      <PageForm
        page={record}
        editor={editor}
        onChange={forms.write}
        onClose={forms.close}
        onDelete={() => {
          editor.update('pages', pages.filter((existing) => existing !== record));
          forms.close();
        }}
      />
    );
  }

  return (
    <RecordIndex
      title={t('pages.pages')}
      addLabel={t('pages.addPage')}
      onAdd={() => forms.add(blankPage)}
      note={t('pagePage.order')}
    >
      {pages.map((page, at) => (
        <RecordRow
          key={page.slug === '' ? 'front' : page.slug}
          number={String(at + 1).padStart(2, '0')}
          title={page.title.zh || t('pages.untitled')}
          subtitle={
            <>
              {page.slug === HOME_SLUG ? '/' : `/${page.slug}`} ·{' '}
              {t('pagePage.sectionCount', { count: page.sections.length })}
            </>
          }
          onOpen={() => forms.show(at)}
        >
          <span className="record-meta">
            {t(page.navLabel === null ? 'pagePage.notInMenu' : 'pagePage.inMenu')}
          </span>

          <span className="record-controls">
            <ReorderControls
              items={pages}
              at={at}
              onChange={(next) => editor.update('pages', next)}
              upLabel={t('pagePage.moveUp', { page: page.title.en || page.slug })}
              downLabel={t('pagePage.moveDown', { page: page.title.en || page.slug })}
            />
          </span>
        </RecordRow>
      ))}
    </RecordIndex>
  );
}
