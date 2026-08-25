/**
 * Works — the index, and the way into the form behind each row.
 *
 * The list's order is the site's order. That is an editorial decision rather
 * than anything derived from year or number, which is why it is moved by hand
 * here and stored as the `position` column on the works table. The number down
 * the left is the work's own `index`, which the studio sets and which is a
 * different thing from where the row sits.
 */
import { useTranslation } from 'react-i18next';

import {
  blankImage,
  emptyLocalised,
  type Work,
} from '../../../shared/content/types';
import { RecordIndex, RecordRow, ReorderControls } from '../../components/records';
import { useRecordForms } from '../../hooks/useRecordForms';
import type { Editor } from '../../hooks/useEditor';
import { WorkForm } from './WorkForm';

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
  const forms = useRecordForms(works, (next) => editor.update('works', next));

  if (forms.open !== null) {
    const { record } = forms.open;
    return (
      <WorkForm
        work={record}
        editor={editor}
        onChange={forms.write}
        onClose={forms.close}
        onDelete={() => {
          editor.update('works', works.filter((existing) => existing !== record));
          forms.close();
        }}
      />
    );
  }

  return (
    <RecordIndex
      title={t('pages.works')}
      addLabel={t('pages.addWork')}
      onAdd={() => forms.add(() => blankWork(works))}
      note={t('pages.worksOrder')}
    >
      {works.map((work, at) => {
        const named = work.title.en || t('pages.untitled');
        return (
          <RecordRow
            key={work.slug === '' ? `new-${at}` : work.slug}
            number={String(work.index).padStart(2, '0')}
            title={work.title.zh || t('pages.untitled')}
            subtitle={named}
            onOpen={() => forms.show(at)}
          >
            <span className="record-meta">{work.year}</span>
            <span className={`badge badge-${work.status}`}>
              {t(`works.statusShort.${work.status}`)}
            </span>

            <span className="record-controls">
              <ReorderControls
                items={works}
                at={at}
                onChange={(next) => editor.update('works', next)}
                upLabel={t('common.moveNamedUp', { name: named })}
                downLabel={t('common.moveNamedDown', { name: named })}
              />
            </span>
          </RecordRow>
        );
      })}
    </RecordIndex>
  );
}
