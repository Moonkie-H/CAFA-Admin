/**
 * Mentors. A name, a discipline, one line, and a portrait.
 */
import { useTranslation } from 'react-i18next';

import { blankImage, emptyLocalised, type Mentor } from '../../../shared/content/types';
import { isSlug } from '../../../shared/content/validate';
import { ImageField, LocalisedField, TextField } from '../../components/fields';
import { Repeatable } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';

function blankMentor(): Mentor {
  return {
    slug: '',
    name: emptyLocalised(),
    discipline: emptyLocalised(),
    note: emptyLocalised(),
    portrait: blankImage(),
  };
}

interface MentorsPageProps {
  editor: Editor;
}

export function MentorsPage({ editor }: MentorsPageProps) {
  const { t } = useTranslation();

  return (
    <section>
      <header className="section-head">
        <h2>{t('pages.mentors')}</h2>
      </header>

      <Repeatable
        label={t('pages.mentor')}
        items={editor.content.mentors}
        addLabel={t('pages.addMentor')}
        blank={blankMentor}
        onChange={(mentors) => editor.update('mentors', mentors)}
        renderItem={(mentor, write) => (
          <>
            <TextField
              label={t('fields.key')}
              value={mentor.slug}
              onChange={(slug) => write({ ...mentor, slug })}
              placeholder="shen-zhibai"
              hint={t('mentorPage.keyHint')}
            />
            <LocalisedField
              label={t('fields.name')}
              value={mentor.name}
              onChange={(name) => write({ ...mentor, name })}
            />
            <LocalisedField
              label={t('fields.discipline')}
              value={mentor.discipline}
              onChange={(discipline) => write({ ...mentor, discipline })}
            />
            <LocalisedField
              label={t('fields.oneLine')}
              value={mentor.note}
              onChange={(note) => write({ ...mentor, note })}
              hint={t('mentorPage.oneLineHint')}
            />
            {isSlug(mentor.slug) ? (
              <ImageField
                label={t('fields.portrait')}
                value={mentor.portrait}
                onChange={(portrait) => write({ ...mentor, portrait })}
                folder="mentors"
                name={mentor.slug}
                mediaUrl={editor.mediaUrl}
                onUpload={editor.putMedia}
              />
            ) : (
              <p className="empty">{t('mentorPage.needsKey')}</p>
            )}
          </>
        )}
      />
    </section>
  );
}
