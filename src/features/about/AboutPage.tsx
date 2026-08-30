/**
 * About — the page, read top to bottom.
 *
 * The screen is in the order of the page: the prose the studio opens with, then
 * the heading over the people, then the heading over the projects. The two
 * things under those headings are not edited here, because each is a collection
 * of its own — the people are the mentors, the projects are the projects. So
 * each heading carries a link to the list it names rather than a second copy of
 * it.
 *
 * `projectsTitle` used to link to the works, because the grid under it *was*
 * the works index drawn a second time. That was the defect: the studio could
 * not put anything under this heading that was not a work, or keep a work off
 * it. The projects are their own records now, and this link goes to them.
 */
import { useTranslation } from 'react-i18next';

import { emptyLocalised, type AboutPage as AboutContent } from '../../../shared/content/types';
import { LocalisedField } from '../../components/fields';
import { PageTextFields } from '../../components/PageTextFields';
import { RouteLink } from '../../components/layout/RouteLink';
import { Repeatable } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { at as sectionAt } from '../../routes';

interface AboutPageProps {
  editor: Editor;
}

export function AboutPage({ editor }: AboutPageProps) {
  const { t } = useTranslation();
  const pages = editor.content.pages;
  const page = pages.about;

  const set = (next: AboutContent) => editor.update('pages', { ...pages, about: next });

  return (
    <section>
      <header className="section-head">
        <h2>{t('nav.about')}</h2>
      </header>
      <p className="section-note">{t('aboutPage.intro')}</p>

      <Repeatable
        label={t('fields.intro')}
        items={page.intro}
        addLabel={t('fields.addParagraph')}
        hint={t('aboutPage.introHint')}
        blank={emptyLocalised}
        onChange={(intro) => set({ ...page, intro })}
        renderItem={(paragraph, write, at) => (
          <LocalisedField
            label={t('fields.paragraphNumber', { number: at + 1 })}
            value={paragraph}
            onChange={write}
            multiline
          />
        )}
      />

      <LocalisedField
        label={t('fields.mentorsTitle')}
        value={page.mentorsTitle}
        onChange={(mentorsTitle) => set({ ...page, mentorsTitle })}
        hint={t('aboutPage.mentorsHint', { count: editor.content.mentors.length })}
      />
      <p className="field-onward">
        <RouteLink to={sectionAt('mentors')} className="link-button">
          {t('aboutPage.toMentors')} →
        </RouteLink>
      </p>

      <LocalisedField
        label={t('fields.projectsTitle')}
        value={page.projectsTitle}
        onChange={(projectsTitle) => set({ ...page, projectsTitle })}
        hint={t('aboutPage.projectsHint', { count: editor.content.projects.length })}
      />
      <p className="field-onward">
        <RouteLink to={sectionAt('projects')} className="link-button">
          {t('aboutPage.toProjects')} →
        </RouteLink>
      </p>

      <PageTextFields
        value={page}
        onChange={(text) => set({ ...page, ...text })}
        titleHint={t('pageText.titleHint')}
      />
    </section>
  );
}
