/**
 * One mentor: a name, the lines under it, and a portrait.
 *
 * The lines are one box rather than the two this form used to ask for. What
 * goes under a face is a few lines about somebody — a discipline, where they
 * studied, how long they have taught — and how many of them there are and where
 * they break is the studio's to decide, so it is the same prose field the rest
 * of the writing here uses, with its own line breaks. The name stays separate
 * because it is a heading rather than a line: the site sets it as the plate's
 * h3 and this admin titles the record with it.
 */
import { useTranslation } from 'react-i18next';

import type { Mentor } from '../../../shared/content/types';
import { isSlug } from '../../../shared/content/validate';
import { Field, ImageField, LocalisedField, TextField } from '../../components/fields';
import { RouteLink } from '../../components/layout/RouteLink';
import { DeleteRecord } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { at as sectionAt, navigate } from '../../routes';

interface MentorFormProps {
  mentor: Mentor;
  at: number;
  editor: Editor;
}

export function MentorForm({ mentor, at, editor }: MentorFormProps) {
  const { t } = useTranslation();
  const mentors = editor.content.mentors;
  const named = mentor.name.zh || mentor.name.en || t('mentorPage.newMentor');

  const set = <K extends keyof Mentor>(key: K, value: Mentor[K]) =>
    editor.update(
      'mentors',
      mentors.map((existing, position) =>
        position === at ? { ...existing, [key]: value } : existing,
      ),
    );

  return (
    <section>
      <header className="section-head">
        <RouteLink to={sectionAt('mentors')} className="button button-quiet">
          ← {t('mentorPage.allMentors')}
        </RouteLink>
        <h2>{named}</h2>
      </header>

      <TextField
        label={t('fields.key')}
        value={mentor.slug}
        onChange={(slug) => set('slug', slug)}
        placeholder="shen-zhibai"
        hint={t('mentorPage.keyHint')}
      />
      <LocalisedField
        label={t('fields.name')}
        value={mentor.name}
        onChange={(name) => set('name', name)}
      />
      <LocalisedField
        label={t('fields.about')}
        value={mentor.note}
        onChange={(note) => set('note', note)}
        hint={t('mentorPage.aboutHint')}
        rich
      />

      {isSlug(mentor.slug) ? (
        <ImageField
          label={t('fields.portrait')}
          value={mentor.portrait}
          onChange={(portrait) => set('portrait', portrait)}
          folder="mentors"
          name={mentor.slug}
          mediaUrl={editor.mediaUrl}
          onUpload={editor.putMedia}
        />
      ) : (
        <Field label={t('fields.portrait')}>
          <p className="empty">{t('mentorPage.needsKey')}</p>
        </Field>
      )}

      <footer className="form-footer">
        <DeleteRecord
          action={t('mentorPage.removeMentor')}
          question={t('mentorPage.removeQuestion', { name: named })}
          confirm={t('mentorPage.removeIt')}
          onDelete={() => {
            editor.update('mentors', mentors.filter((_, position) => position !== at));
            navigate(sectionAt('mentors'));
          }}
        />
      </footer>
    </section>
  );
}
