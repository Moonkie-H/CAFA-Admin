/**
 * The projects, as they are read at the foot of the about page: a grid of
 * pictures, each with a name and a line or two under it.
 *
 * They live under About in the sidebar for the same reason the mentors do —
 * that is where they live on the site. There is no projects page; there is a
 * grid at the end of About, and the heading over it is on the about screen
 * while the cards themselves are here.
 *
 * This list used to be the works. It was not a list at all — About drew the
 * works index a second time under a heading that called them projects, so the
 * studio could neither put something here that was not a work nor keep a work
 * out. These are records of their own now, and an empty list is a legitimate
 * answer: the site omits the whole section, heading included, rather than
 * drawing an empty frame.
 */
import { useTranslation } from 'react-i18next';

import { blankImage, emptyLocalised, type Project } from '../../../shared/content/types';
import { DeleteRecord, RecordIndex, RecordRow, ReorderControls } from '../../components/records';
import type { Editor } from '../../hooks/useEditor';
import { navigate, recordAt } from '../../routes';

function blankProject(): Project {
  return {
    slug: '',
    title: emptyLocalised(),
    summary: emptyLocalised(),
    image: blankImage(),
  };
}

interface ProjectsPageProps {
  editor: Editor;
}

export function ProjectsPage({ editor }: ProjectsPageProps) {
  const { t } = useTranslation();
  const projects = editor.content.projects;
  const write = (next: Project[]) => editor.update('projects', next);

  return (
    <section>
      <RecordIndex
        title={t('nav.projects')}
        addLabel={t('pages.addProject')}
        note={t('projectsPage.intro')}
        empty={t('projectsPage.empty')}
        count={projects.length}
        onAdd={() => {
          write([...projects, blankProject()]);
          navigate(recordAt('projects', projects.length));
        }}
      >
        {projects.map((project, at) => {
          const named = project.title.zh || project.title.en || t('pages.untitled');
          return (
            <RecordRow
              key={project.slug === '' ? `new-${at}` : project.slug}
              number={String(at + 1).padStart(2, '0')}
              title={named}
              subtitle={
                project.summary.zh || project.summary.en || t('projectsPage.noSummary')
              }
              onOpen={() => navigate(recordAt('projects', at))}
              controls={
                <>
                  <ReorderControls
                    items={projects}
                    at={at}
                    onChange={write}
                    upLabel={t('common.moveNamedUp', { name: named })}
                    downLabel={t('common.moveNamedDown', { name: named })}
                  />
                  <DeleteRecord
                    action={t('common.remove')}
                    label={t('common.removeNamed', { name: named })}
                    question={t('projectsPage.removeQuestion', { name: named })}
                    confirm={t('projectsPage.removeIt')}
                    onDelete={() => write(projects.filter((_, position) => position !== at))}
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
