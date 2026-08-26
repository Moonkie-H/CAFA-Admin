/**
 * The people, as they are read on the about page: a single band of portraits.
 *
 * They live under About in the sidebar because that is where they live on the
 * site — there is no mentors page, there is a mentors band a third of the way
 * down About. The heading over that band is on the about screen; the people
 * themselves are here.
 */
import { useTranslation } from 'react-i18next';

import { blankImage, emptyLocalised, type Mentor } from '../../../shared/content/types';
import { DeleteRecord, RecordIndex, RecordRow, ReorderControls } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { navigate, recordAt } from '../../routes';

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
  const mentors = editor.content.mentors;
  const write = (next: Mentor[]) => editor.update('mentors', next);

  return (
    <section>
      <RecordIndex
        title={t('nav.mentors')}
        addLabel={t('pages.addMentor')}
        note={t('mentorPage.intro')}
        empty={t('mentorPage.empty')}
        count={mentors.length}
        onAdd={() => {
          write([...mentors, blankMentor()]);
          navigate(recordAt('mentors', mentors.length));
        }}
      >
        {mentors.map((mentor, at) => {
          const named = mentor.name.zh || mentor.name.en || t('pages.untitled');
          return (
            <RecordRow
              key={mentor.slug === '' ? `new-${at}` : mentor.slug}
              number={String(at + 1).padStart(2, '0')}
              title={named}
              subtitle={mentor.discipline.zh || mentor.discipline.en || t('mentorPage.noDiscipline')}
              onOpen={() => navigate(recordAt('mentors', at))}
              controls={
                <>
                  <ReorderControls
                    items={mentors}
                    at={at}
                    onChange={write}
                    upLabel={t('common.moveNamedUp', { name: named })}
                    downLabel={t('common.moveNamedDown', { name: named })}
                  />
                  <DeleteRecord
                    action={t('common.remove')}
                    label={t('common.removeNamed', { name: named })}
                    question={t('mentorPage.removeQuestion', { name: named })}
                    confirm={t('mentorPage.removeIt')}
                    onDelete={() => write(mentors.filter((_, position) => position !== at))}
                  />
                </>
              }
            />
          );
        })}
      </RecordIndex>
    </section>
  );
}
