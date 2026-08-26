/** One programme: who it is for, how long it runs, and what it is. */
import { useTranslation } from 'react-i18next';

import type { Program } from '../../../shared/content/types';
import { LocalisedField, TextField } from '../../components/fields';
import { RouteLink } from '../../components/layout/RouteLink';
import { DeleteRecord } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { at as sectionAt, navigate } from '../../routes';

interface ProgramFormProps {
  program: Program;
  at: number;
  editor: Editor;
}

export function ProgramForm({ program, at, editor }: ProgramFormProps) {
  const { t } = useTranslation();
  const programs = editor.content.programs;
  const named = program.name.zh || program.name.en || t('programsPage.newProgram');

  const set = <K extends keyof Program>(key: K, value: Program[K]) =>
    editor.update(
      'programs',
      programs.map((existing, position) =>
        position === at ? { ...existing, [key]: value } : existing,
      ),
    );

  return (
    <section>
      <header className="section-head">
        <RouteLink to={sectionAt('programs')} className="button button-quiet">
          ← {t('programsPage.allPrograms')}
        </RouteLink>
        <h2>{named}</h2>
      </header>

      <TextField
        label={t('fields.key')}
        value={program.slug}
        onChange={(slug) => set('slug', slug)}
        placeholder="summer-atelier"
        hint={t('programsPage.keyHint')}
      />
      <LocalisedField
        label={t('fields.name')}
        value={program.name}
        onChange={(name) => set('name', name)}
      />
      <LocalisedField
        label={t('fields.audience')}
        value={program.audience}
        onChange={(audience) => set('audience', audience)}
      />
      <LocalisedField
        label={t('fields.duration')}
        value={program.duration}
        onChange={(duration) => set('duration', duration)}
      />
      <LocalisedField
        label={t('fields.summary')}
        value={program.summary}
        onChange={(summary) => set('summary', summary)}
        multiline
      />

      <footer className="form-footer">
        <DeleteRecord
          action={t('programsPage.removeProgram')}
          question={t('programsPage.removeQuestion', { name: named })}
          confirm={t('programsPage.removeIt')}
          onDelete={() => {
            editor.update('programs', programs.filter((_, position) => position !== at));
            navigate(sectionAt('programs'));
          }}
        />
      </footer>
    </section>
  );
}
