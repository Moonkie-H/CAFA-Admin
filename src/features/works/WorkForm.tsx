/**
 * One work, opened from the index.
 *
 * Photographs only appear once the work has an address. That is not a style
 * choice: the key a photograph is filed under is built from the slug, so
 * uploading before there is one would file it under `works//01.jpg` and leave
 * it there when the slug arrives. The empty state says so rather than showing a
 * chooser that would misfile whatever it was given.
 */
import { useTranslation } from 'react-i18next';

import {
  blankImage,
  emptyLocalised,
  WORK_STATUSES,
  type Credit,
  type Work,
} from '../../../shared/content/types';
import { isSlug } from '../../../shared/content/validate';
import {
  Field,
  ImageField,
  LocalisedField,
  NumberField,
  SelectField,
  TextField,
} from '../../components/fields';
import { DeleteRecord, Repeatable } from '../../components/records';
import { RouteLink } from '../../components/layout/RouteLink';
import { mediaStem, nextMediaName } from '../../lib/media-keys';
import type { Editor } from '../../hooks/useEditor';
import { at as sectionAt, navigate } from '../../routes';

function blankCredit(): Credit {
  return { role: emptyLocalised(), name: emptyLocalised() };
}

interface WorkFormProps {
  work: Work;
  /** Where this work sits in the list, which is the whole of its identity here. */
  at: number;
  editor: Editor;
}

export function WorkForm({ work, at, editor }: WorkFormProps) {
  const { t } = useTranslation();
  const works = editor.content.works;
  const namedYet = isSlug(work.slug);
  const folder = `works/${work.slug}`;
  const named = work.title.zh || work.title.en || t('pages.newWork');

  const set = <K extends keyof Work>(key: K, value: Work[K]) =>
    editor.update(
      'works',
      works.map((existing, position) =>
        position === at ? { ...existing, [key]: value } : existing,
      ),
    );

  return (
    <section>
      <header className="section-head">
        <RouteLink to={sectionAt('works')} className="button button-quiet">
          ← {t('pages.allWorks')}
        </RouteLink>
        <h2>{named}</h2>
      </header>

      <TextField
        label={t('fields.webAddress')}
        value={work.slug}
        onChange={(value) => set('slug', value)}
        placeholder="salt-and-scaffold"
        hint={namedYet ? t('works.addressReady', { slug: work.slug }) : t('works.addressEmpty')}
      />

      <div className="row">
        <NumberField
          label={t('fields.number')}
          value={work.index}
          onChange={(value) => set('index', value)}
          hint={t('works.numberHint')}
        />
        <NumberField
          label={t('fields.year')}
          value={work.year}
          onChange={(value) => set('year', value)}
        />
      </div>

      <SelectField
        label={t('fields.status')}
        value={work.status}
        options={WORK_STATUSES.map((status) => ({
          value: status,
          label: t(`works.status.${status}`),
        }))}
        onChange={(value) => set('status', value)}
      />

      <LocalisedField
        label={t('fields.title')}
        value={work.title}
        onChange={(value) => set('title', value)}
      />

      <LocalisedField
        label={t('fields.summary')}
        value={work.summary}
        onChange={(value) => set('summary', value)}
        rich
      />

      <Repeatable
        label={t('fields.discipline')}
        items={work.discipline}
        addLabel={t('works.addDiscipline')}
        blank={emptyLocalised}
        onChange={(discipline) => set('discipline', discipline)}
        renderItem={(entry, write, position) => (
          <LocalisedField
            label={t('works.disciplineNumber', { number: position + 1 })}
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
            keyOf={(image, position) => image.src || `new-${position}`}
            renderItem={(image, write, position) => (
              <ImageField
                label={t('fields.photographNumber', { number: position + 1 })}
                value={image}
                onChange={write}
                folder={folder}
                // A photograph keeps the name it was filed under; a new one
                // takes the next free number in this work's folder.
                name={
                  image.src === ''
                    ? nextMediaName(work.media.map((entry) => entry.src))
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
          question={t('works.removeQuestion', { title: named })}
          confirm={t('works.removeIt')}
          onDelete={() => {
            editor.update('works', works.filter((_, position) => position !== at));
            navigate(sectionAt('works'));
          }}
        />
      </footer>
    </section>
  );
}
