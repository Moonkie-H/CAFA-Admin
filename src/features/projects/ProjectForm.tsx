/** One project: a name, a line or two, and the picture the card is built on. */
import { useTranslation } from 'react-i18next';

import type { Project } from '../../../shared/content/types';
import { isSlug } from '../../../shared/content/validate';
import { Field, ImageField, LocalisedField, TextField } from '../../components/fields';
import { RouteLink } from '../../components/layout/RouteLink';
import { DeleteRecord } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { at as sectionAt, navigate } from '../../routes';

interface ProjectFormProps {
  project: Project;
  at: number;
  editor: Editor;
}

export function ProjectForm({ project, at, editor }: ProjectFormProps) {
  const { t } = useTranslation();
  const projects = editor.content.projects;
  const named = project.title.zh || project.title.en || t('projectsPage.newProject');

  const set = <K extends keyof Project>(key: K, value: Project[K]) =>
    editor.update(
      'projects',
      projects.map((existing, position) =>
        position === at ? { ...existing, [key]: value } : existing,
      ),
    );

  return (
    <section>
      <header className="section-head">
        <RouteLink to={sectionAt('projects')} className="button button-quiet">
          ← {t('projectsPage.allProjects')}
        </RouteLink>
        <h2>{named}</h2>
      </header>

      <TextField
        label={t('fields.key')}
        value={project.slug}
        onChange={(slug) => set('slug', slug)}
        placeholder="edible-house"
        hint={t('projectsPage.keyHint')}
      />
      <LocalisedField
        label={t('fields.title')}
        value={project.title}
        onChange={(title) => set('title', title)}
      />
      <LocalisedField
        label={t('fields.summary')}
        value={project.summary}
        onChange={(summary) => set('summary', summary)}
        hint={t('projectsPage.summaryHint')}
        rich
      />

      {/* The picture is filed under the project's own key, so it cannot be
          chosen until there is a key to file it under — the same order the
          mentors' portraits follow, and for the same reason: the row in `media`
          has to exist before the save that references it. */}
      {isSlug(project.slug) ? (
        <ImageField
          label={t('fields.picture')}
          value={project.image}
          onChange={(image) => set('image', image)}
          folder="projects"
          name={project.slug}
          mediaUrl={editor.mediaUrl}
          onUpload={editor.putMedia}
        />
      ) : (
        <Field label={t('fields.picture')}>
          <p className="empty">{t('projectsPage.needsKey')}</p>
        </Field>
      )}

      <footer className="form-footer">
        <DeleteRecord
          action={t('projectsPage.removeProject')}
          question={t('projectsPage.removeQuestion', { name: named })}
          confirm={t('projectsPage.removeIt')}
          onDelete={() => {
            editor.update('projects', projects.filter((_, position) => position !== at));
            navigate(sectionAt('projects'));
          }}
        />
      </footer>
    </section>
  );
}
