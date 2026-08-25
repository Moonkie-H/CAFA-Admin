/**
 * Works — the index, and the form behind each row.
 *
 * The list's order is the site's order. That is an editorial decision rather
 * than anything derived from year or number, which is why it is moved by hand
 * here and stored as the `position` column on the works table.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  blankImage,
  emptyLocalised,
  WORK_STATUSES,
  type Credit,
  type Work,
  type WorkStatus,
} from '../content/types';
import { isSlug } from '../content/validate';
import { mediaStem, nextMediaName } from '../images';
import type { Editor } from '../useEditor';
import {
  DeleteRecord,
  Field,
  LocalisedField,
  NumberField,
  ReorderControls,
  Repeatable,
  SelectField,
  TextField,
} from '../ui/fields';
import { ImageField } from '../ui/ImageField';

function blankCredit(): Credit {
  return { role: emptyLocalised(), name: emptyLocalised() };
}

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
  const [openAt, setOpenAt] = useState<number | null>(null);

  const replace = (at: number, work: Work) =>
    editor.update(
      'works',
      works.map((existing, position) => (position === at ? work : existing)),
    );

  if (openAt !== null) {
    const work = works[openAt];
    if (work === undefined) {
      setOpenAt(null);
      return null;
    }
    return (
      <WorkForm
        work={work}
        editor={editor}
        onChange={(next) => replace(openAt, next)}
        onClose={() => setOpenAt(null)}
      />
    );
  }

  return (
    <section>
      <header className="section-head">
        <h2>{t('pages.works')}</h2>
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            editor.update('works', [...works, blankWork(works)]);
            setOpenAt(works.length);
          }}
        >
          {t('pages.addWork')}
        </button>
      </header>

      <p className="section-note">
        {t('pages.worksOrder')}
      </p>

      <ol className="record-list">
        {works.map((work, at) => (
          <li key={work.slug === '' ? `new-${at}` : work.slug} className="record-row">
            <span className="record-number">{String(work.index).padStart(2, '0')}</span>

            <button type="button" className="record-open" onClick={() => setOpenAt(at)}>
              <span className="record-title">{work.title.zh || t('pages.untitled')}</span>
              <span className="record-subtitle">{work.title.en || t('pages.untitled')}</span>
            </button>

            <span className="record-meta">{work.year}</span>
            <span className={`badge badge-${work.status}`}>{t(`works.statusShort.${work.status}`)}</span>

            <span className="record-controls">
              <ReorderControls
                items={works}
                at={at}
                onChange={(next) => editor.update('works', next)}
                upLabel={t('common.moveNamedUp', { name: work.title.en || t('pages.untitled') })}
                downLabel={t('common.moveNamedDown', { name: work.title.en || t('pages.untitled') })}
              />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

interface WorkFormProps {
  work: Work;
  editor: Editor;
  onChange: (work: Work) => void;
  onClose: () => void;
}

function WorkForm({ work, editor, onChange, onClose }: WorkFormProps) {
  const { t } = useTranslation();
  const namedYet = isSlug(work.slug);
  const folder = `works/${work.slug}`;

  const set = <K extends keyof Work>(key: K, value: Work[K]) => onChange({ ...work, [key]: value });

  return (
    <section>
      <header className="section-head">
        <button type="button" className="button button-quiet" onClick={onClose}>
          ← {t('pages.allWorks')}
        </button>
        <h2>{work.title.zh || work.title.en || t('pages.newWork')}</h2>
      </header>

      <TextField
        label={t('fields.webAddress')}
        value={work.slug}
        onChange={(value) => set('slug', value)}
        placeholder="salt-and-scaffold"
        hint={
          namedYet
            ? t('works.addressReady', { slug: work.slug })
            : t('works.addressEmpty')
        }
      />

      <div className="row">
        <NumberField
          label={t('fields.number')}
          value={work.index}
          onChange={(value) => set('index', value)}
          hint={t('works.numberHint')}
        />
        <NumberField label={t('fields.year')} value={work.year} onChange={(value) => set('year', value)} />
      </div>

      <SelectField
        label={t('fields.status')}
        value={work.status}
        options={WORK_STATUSES.map((status: WorkStatus) => ({ value: status, label: t(`works.status.${status}`) }))}
        onChange={(value) => set('status', value)}
      />

      <LocalisedField label={t('fields.title')} value={work.title} onChange={(value) => set('title', value)} />

      <LocalisedField
        label={t('fields.summary')}
        value={work.summary}
        onChange={(value) => set('summary', value)}
        multiline
      />

      <Repeatable
        label={t('fields.discipline')}
        items={work.discipline}
        addLabel={t('works.addDiscipline')}
        blank={emptyLocalised}
        onChange={(discipline) => set('discipline', discipline)}
        renderItem={(entry, write, at) => (
          <LocalisedField
            label={t('works.disciplineNumber', { number: at + 1 })}
            value={entry}
            onChange={write}
          />
        )}
      />

      <Repeatable
        label={t('fields.credits')}
        items={work.credits}
        addLabel={t('works.addCredit')}
        blank={blankCredit}
        onChange={(credits) => set('credits', credits)}
        renderItem={(credit, write) => (
          <>
            <LocalisedField
              label={t('fields.role')}
              value={credit.role}
              onChange={(role) => write({ ...credit, role })}
            />
            <LocalisedField
              label={t('fields.name')}
              value={credit.name}
              onChange={(name) => write({ ...credit, name })}
            />
          </>
        )}
      />

      {namedYet ? (
        <>
          <ImageField
            label={t('fields.cover')}
            value={work.cover}
            onChange={(value) => set('cover', value)}
            folder={folder}
            name="cover"
            mediaUrl={editor.mediaUrl}
            onUpload={editor.putMedia}
          />

          <Repeatable
            label={t('fields.photographs')}
            items={work.media}
            addLabel={t('fields.addPhoto')}
            hint={t('works.photoHint')}
            blank={blankImage}
            onChange={(media) => set('media', media)}
            keyOf={(image, at) => image.src || `new-${at}`}
            renderItem={(image, write, at) => (
              <ImageField
                label={t('works.photoNumber', { number: at + 1 })}
                value={image}
                onChange={write}
                folder={folder}
                // A photograph keeps the name it was filed under; a new one
                // takes the next free number in this work's folder.
                name={
                  image.src === ''
                    ? nextMediaName(work.media.map((entry) => entry.src), '')
                    : mediaStem(image.src)
                }
                mediaUrl={editor.mediaUrl}
                onUpload={editor.putMedia}
              />
            )}
          />
        </>
      ) : (
        <Field label={t('fields.photographs')}>
          <p className="empty">{t('works.needsAddress')}</p>
        </Field>
      )}

      <footer className="form-footer">
        <DeleteRecord
          action={t('works.removeWork')}
          question={t('works.removeQuestion', {
            title: work.title.zh || work.title.en || t('pages.newWork'),
          })}
          confirm={t('works.removeIt')}
          onDelete={() => {
            editor.update(
              'works',
              editor.content.works.filter((existing) => existing !== work),
            );
            onClose();
          }}
        />
      </footer>
    </section>
  );
}
