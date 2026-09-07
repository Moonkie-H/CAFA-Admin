/**
 * Programmes — the page, and the list of them.
 *
 * The words that open the page, then every programme as a row. A programme has
 * no page of its own on the site: it is one screen of the list, which is why
 * the form behind a row is short and why the order of the rows is the order a
 * reader scrolls through them.
 */
import { useTranslation } from 'react-i18next';

import { emptyLocalised, type Program } from '../../../shared/content/types';
import { LocalisedField } from '../../components/fields';
import { PageTextFields } from '../../components/PageTextFields';
import {
  DeleteRecord,
  RecordIndex,
  RecordRow,
  Repeatable,
  ReorderControls,
} from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { navigate, recordAt } from '../../routes';

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
  const pages = editor.content.pages;
  const page = pages.programs;
  const programs = editor.content.programs;
  const write = (next: Program[]) => editor.update('programs', next);

  return (
    <section>
      <RecordIndex
        title={t('nav.programs')}
        addLabel={t('pages.addProgram')}
        note={t('programsPage.intro')}
        empty={t('programsPage.empty')}
        count={programs.length}
        onAdd={() => {
          write([...programs, blankProgram()]);
          navigate(recordAt('programs', programs.length));
        }}
      >
        {programs.map((program, at) => {
          const named = program.name.zh || program.name.en || t('pages.untitled');
          return (
            <RecordRow
              key={program.slug === '' ? `new-${at}` : program.slug}
              number={String(at + 1).padStart(2, '0')}
              title={named}
              subtitle={program.audience.zh || program.audience.en || t('programsPage.noAudience')}
              onOpen={() => navigate(recordAt('programs', at))}
              controls={
                <>
                  <ReorderControls
                    items={programs}
                    at={at}
                    onChange={write}
                    upLabel={t('common.moveNamedUp', { name: named })}
                    downLabel={t('common.moveNamedDown', { name: named })}
                  />
                  <DeleteRecord
                    action={t('common.remove')}
                    label={t('common.removeNamed', { name: named })}
                    question={t('programsPage.removeQuestion', { name: named })}
                    confirm={t('programsPage.removeIt')}
                    onDelete={() => write(programs.filter((_, position) => position !== at))}
                  />
                </>
              }
            >
              <span className="record-meta">{program.duration.zh || program.duration.en}</span>
            </RecordRow>
          );
        })}
      </RecordIndex>

      {/* Under the list, for the same reason as Works: this screen is the
          programmes, and the words that open the page are read far less often
          than the entries under them. */}
      <h3 className="panel-heading">{t('common.pageWords')}</h3>

      <PageTextFields
        value={page}
        onChange={(text) => editor.update('pages', { ...pages, programs: { ...page, ...text } })}
        titleHint={t('pageText.titleHint')}
      />

      <Repeatable
        label={t('fields.intro')}
        items={page.intro}
        addLabel={t('fields.addParagraph')}
        hint={t('programsPage.introHint')}
        blank={emptyLocalised}
        onChange={(intro) => editor.update('pages', { ...pages, programs: { ...page, intro } })}
        renderItem={(paragraph, set, at) => (
          <LocalisedField
            label={t('fields.paragraphNumber', { number: at + 1 })}
            value={paragraph}
            onChange={set}
            rich
          />
        )}
      />
    </section>
  );
}
