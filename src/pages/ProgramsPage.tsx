/**
 * Programmes. Four of them, no pages of their own — one list, edited in place.
 */
import { emptyLocalised, type Program } from '../content/types';
import { useTranslation } from 'react-i18next';
import type { Editor } from '../useEditor';
import { LocalisedField, Repeatable, TextField } from '../ui/fields';

function blankProgram(): Program {
  return {
    slug: '',
    name: emptyLocalised(),
    audience: emptyLocalised(),
    duration: emptyLocalised(),
    summary: emptyLocalised(),
  };
}

interface ProgramsPageProps {
  editor: Editor;
}

export function ProgramsPage({ editor }: ProgramsPageProps) {
  const { t } = useTranslation();

  return (
    <section>
      <header className="section-head">
        <h2>{t('pages.programs')}</h2>
      </header>

      <Repeatable
        label={t('pages.program')}
        items={editor.content.programs}
        addLabel={t('pages.addProgram')}
        blank={blankProgram}
        onChange={(programs) => editor.update('programs', programs)}
        renderItem={(program, write) => (
          <>
            <TextField
              label={t('fields.key')}
              value={program.slug}
              onChange={(slug) => write({ ...program, slug })}
              placeholder="summer-atelier"
              hint={t('programPage.keyHint')}
            />
            <LocalisedField
              label={t('fields.name')}
              value={program.name}
              onChange={(name) => write({ ...program, name })}
            />
            <LocalisedField
              label={t('fields.audience')}
              value={program.audience}
              onChange={(audience) => write({ ...program, audience })}
            />
            <LocalisedField
              label={t('fields.duration')}
              value={program.duration}
              onChange={(duration) => write({ ...program, duration })}
            />
            <LocalisedField
              label={t('fields.summary')}
              value={program.summary}
              onChange={(summary) => write({ ...program, summary })}
              multiline
            />
          </>
        )}
      />
    </section>
  );
}
