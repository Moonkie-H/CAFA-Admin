/**
 * About — the page, read top to bottom.
 *
 * The screen is in the order of the page: the prose the studio opens with, then
 * the heading over the people, then the heading over the projects. The two
 * things under those headings are not edited here, because they are not this
 * page's — the people are the mentors and the projects are the works, and both
 * appear elsewhere on the site as well. So each heading carries a link to the
 * list it names rather than a second copy of it.
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
        hint={t('aboutPage.projectsHint')}
      />
      <p className="field-onward">
        <RouteLink to={sectionAt('works')} className="link-button">
          {t('aboutPage.toWorks')} →
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
