/**
 * Works — the page, and the index of everything on it.
 *
 * One screen for both, because they are one page: the words at the top of it,
 * the three words the index sets a work's state in, and then the works
 * themselves. The list's order is the site's order — an editorial decision
 * rather than anything derived from year or number, which is why it is moved by
 * hand and stored as the `position` column. The number down the left is the
 * work's own `index`, which the studio sets and which is a different thing from
 * where the row sits.
 */
import { useTranslation } from 'react-i18next';

import {
  blankImage,
  emptyLocalised,
  type Work,
} from '../../../shared/content/types';
import { CopyFields, type CopyField } from '../../components/fields';
import { PageTextFields } from '../../components/PageTextFields';
import { DeleteRecord, RecordIndex, RecordRow, ReorderControls } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { navigate, recordAt, type Collection } from '../../routes';

/** The words the index sets a work's state in. They belong to this page. */
const STATUS_WORDS: CopyField[] = [
  { path: 'works.status.completed', label: 'Status word — completed' },
  { path: 'works.status.in-progress', label: 'Status word — in progress' },
  { path: 'works.status.private', label: 'Status word — private' },
];

const SECTION: Collection = 'works';

function blankWork(existing: readonly Work[]): Work {
  const highest = existing.reduce((most, work) => Math.max(most, work.index), 0);
  return {
    slug: '',
    index: highest + 1,
    title: emptyLocalised(),
    status: 'in-progress',
    discipline: [emptyLocalised()],
    year: new Date().getFullYear(),
    summary: emptyLocalised(),
    credits: [],
    cover: blankImage(),
    media: [],
  };
}

interface WorksPageProps {
  editor: Editor;
}

export function WorksPage({ editor }: WorksPageProps) {
  const { t } = useTranslation();
  const works = editor.content.works;
  const write = (next: Work[]) => editor.update('works', next);

  return (
    <section>
      <RecordIndex
        title={t('nav.works')}
        addLabel={t('pages.addWork')}
        note={t('worksPage.intro')}
        empty={t('worksPage.empty')}
        count={works.length}
        onAdd={() => {
          write([...works, blankWork(works)]);
          navigate(recordAt(SECTION, works.length));
        }}
      >
        {works.map((work, at) => {
          const named = work.title.zh || work.title.en || t('pages.untitled');
          return (
            <RecordRow
              key={work.slug === '' ? `new-${at}` : work.slug}
              number={String(work.index).padStart(2, '0')}
              title={named}
              subtitle={work.slug === '' ? t('works.addressMissing') : `/${work.slug}`}
              onOpen={() => navigate(recordAt(SECTION, at))}
              controls={
                <>
                  <ReorderControls
                    items={works}
                    at={at}
                    onChange={write}
                    upLabel={t('common.moveNamedUp', { name: named })}
                    downLabel={t('common.moveNamedDown', { name: named })}
                  />
                  <DeleteRecord
                    action={t('common.remove')}
                    label={t('common.removeNamed', { name: named })}
                    question={t('works.removeQuestion', { title: named })}
                    confirm={t('works.removeIt')}
                    onDelete={() => write(works.filter((_, position) => position !== at))}
                  />
                </>
              }
            >
              <span className="record-meta">{work.year}</span>
              <span className={`badge badge-${work.status}`}>
                {t(`works.statusShort.${work.status}`)}
              </span>
            </RecordRow>
          );
        })}
      </RecordIndex>

      {/* Under the list, because the list is what this screen is for. The two
          lines that name the page and the three words its rows are set in are
          the page's own, and they are read far less often than the works. */}
      <h3 className="panel-heading">{t('common.pageWords')}</h3>

      <PageTextFields
        value={editor.content.pages.works}
        onChange={(text) => editor.update('pages', { ...editor.content.pages, works: text })}
        titleHint={t('pageText.titleHint')}
      />

      <CopyFields
        fields={STATUS_WORDS}
        dictionaries={{ zh: editor.content.zh, en: editor.content.en }}
        onChange={(locale, dictionary) => editor.update(locale, dictionary)}
      />
    </section>
  );
}
